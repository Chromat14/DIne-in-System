package com.restaurant.foodsystem.service;

import com.restaurant.foodsystem.dto.*;
import com.restaurant.foodsystem.entity.*;
import com.restaurant.foodsystem.repository.*;
import com.restaurant.foodsystem.exception.InsufficientStockException;
import com.restaurant.foodsystem.payment.dto.AdminPaymentNotification;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class OrderService {
    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final MenuItemRepository menuItemRepository;
    private final RestaurantTableRepository tableRepository;
    private final TransactionRepository transactionRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final WaitTimeService waitTimeService;
    private final KitchenPriorityService kitchenPriorityService;
    private final MenuAutocompleteService menuAutocompleteService;

    @Transactional(readOnly = true)
    public Optional<OrderResponse> getActiveOrderForTable(String tableToken) {
        return tableRepository.findByTableToken(tableToken)
                .flatMap(table -> orderRepository.findFirstByRestaurantTableAndOrderStatusInOrderByPlacedAtDesc(
                        table,
                        Arrays.asList(OrderStatus.OPEN, OrderStatus.PENDING, OrderStatus.IN_PROGRESS, OrderStatus.READY, OrderStatus.SERVED)
                ))
                .map(this::mapToOrderResponse);
    }

    @Transactional
    public OrderResponse placeOrder(String tableToken, PlaceOrderRequest request) {
        RestaurantTable table = tableRepository.findByTableToken(tableToken)
                .orElseThrow(() -> new RuntimeException("Table not found"));

        // 1. Stock Validation
        for (OrderItemRequest itemReq : request.getItems()) {
            MenuItem menuItem = menuItemRepository.findById(itemReq.getMenuItemId())
                    .orElseThrow(() -> new RuntimeException("Menu item not found"));

            if (!Boolean.TRUE.equals(menuItem.getIsAvailable()) || menuItem.getStockQuantity() <= 0) {
                throw new RuntimeException("'" + menuItem.getName() + "' is currently unavailable.");
            }

            if (menuItem.getStockQuantity() < itemReq.getQuantity()) {
                throw new InsufficientStockException(menuItem.getName(), itemReq.getQuantity(), menuItem.getStockQuantity());
            }
        }

        // 2. Synchronized block to prevent concurrent duplicates
        synchronized (this) {
            Optional<Order> activeOrder = orderRepository.findFirstByRestaurantTableAndOrderStatusInOrderByPlacedAtDesc(
                    table,
                    Arrays.asList(OrderStatus.OPEN, OrderStatus.PENDING, OrderStatus.IN_PROGRESS, OrderStatus.READY, OrderStatus.SERVED)
            );

            if (activeOrder.isPresent() && Boolean.TRUE.equals(activeOrder.get().getPaymentRequested())) {
                throw new RuntimeException("Payment is already requested for this session. Please complete settlement first.");
            }

            boolean newlyCreated = activeOrder.isEmpty();
            Order order = activeOrder.orElseGet(() -> {
                String uniqueId = "ORD-" + System.nanoTime() + "-" + UUID.randomUUID().toString().substring(0, 4).toUpperCase();
                Order newOrder = Order.builder()
                        .orderNumber(uniqueId)
                        .restaurantTable(table)
                        .orderStatus(OrderStatus.OPEN)
                        .placedAt(OffsetDateTime.now())
                        .totalAmount(BigDecimal.ZERO)
                        .orderItems(new ArrayList<>())
                        .notes(request.getNotes())
                        .paymentRequested(false)
                        .build();
                return orderRepository.saveAndFlush(newOrder);
            });

            if (Boolean.TRUE.equals(order.getPaymentRequested())) {
                order.setPaymentRequested(false);
            }

            // 3. Force update table status
            if (table.getStatus() != TableStatus.OCCUPIED) {
                table.setStatus(TableStatus.OCCUPIED);
                tableRepository.saveAndFlush(table);
                publishTableStatusUpdate(table);
            }

            // 4. Process Items
            for (OrderItemRequest itemReq : request.getItems()) {
                MenuItem menuItem = menuItemRepository.findById(itemReq.getMenuItemId()).get();

                // Stock management
                menuItem.setStockQuantity(menuItem.getStockQuantity() - itemReq.getQuantity());
                if (menuItem.getStockQuantity() <= 0) {
                    menuItem.setStockQuantity(0);
                    menuItem.setIsAvailable(false);
                }
                menuItemRepository.saveAndFlush(menuItem);
                messagingTemplate.convertAndSend("/topic/menu", mapMenuItemForBroadcast(menuItem));

                Optional<OrderItem> existingItem = order.getOrderItems().stream()
                        .filter(i -> i.getMenuItem().getId().equals(menuItem.getId()))
                        .filter(i -> i.getItemStatus() != OrderItemStatus.CANCELLED)
                        .findFirst();

                if (existingItem.isPresent()) {
                    OrderItem item = existingItem.get();
                    item.setQuantity(item.getQuantity() + itemReq.getQuantity());
                    item.setLineTotal(item.getUnitPrice().multiply(new BigDecimal(item.getQuantity())));
                } else {
                    OrderItem newItem = OrderItem.builder()
                            .order(order)
                            .menuItem(menuItem)
                            .quantity(itemReq.getQuantity())
                            .unitPrice(menuItem.getPrice())
                            .lineTotal(menuItem.getPrice().multiply(new BigDecimal(itemReq.getQuantity())))
                            .itemStatus(OrderItemStatus.PENDING)
                            .build();
                    order.getOrderItems().add(newItem);
                }
            }
            menuAutocompleteService.markDirty();

            // 5. Update Totals
            BigDecimal subtotal = calculateActiveSubtotal(order);
            order.setTotalAmount(subtotal);
            order.setServiceChargeAmount(BigDecimal.ZERO);
            order.setDiscountAmount(BigDecimal.ZERO);
            reconcileOrderStatusFromItems(order);

            Order savedOrder = orderRepository.saveAndFlush(order);
            OrderResponse response = mapToOrderResponse(savedOrder);

            // Notify via WebSockets
            try {
                messagingTemplate.convertAndSend("/topic/kitchen", response);
                messagingTemplate.convertAndSend("/topic/order/" + savedOrder.getId(), response);
                publishTableSessionEvent(
                        table,
                        order,
                        newlyCreated ? "SESSION_STARTED" : "ORDER_UPDATED",
                        newlyCreated ? "New dining session started" : "Running tab updated"
                );
                notifyAdminStats();
            } catch (Exception e) {
                // Non-critical if WS fails
            }

            return response;
        }
    }

    @Transactional
    public OrderResponse updateOrderStatus(Long orderId, String status) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Order not found"));

        String mappedStatus = status.toUpperCase();
        if (mappedStatus.equals("PREPARING")) mappedStatus = "IN_PROGRESS";

        try {
            OrderStatus newStatus = OrderStatus.valueOf(mappedStatus);
            order.setOrderStatus(newStatus);
            synchronizeItemStatuses(order, newStatus);

            if (newStatus == OrderStatus.IN_PROGRESS && order.getPreparationStartedAt() == null) {
                order.setPreparationStartedAt(OffsetDateTime.now());
            }
            if (newStatus == OrderStatus.READY || newStatus == OrderStatus.SERVED) {
                if (order.getCompletedAt() == null) {
                    order.setCompletedAt(OffsetDateTime.now());
                }
            }

            Order savedOrder = orderRepository.saveAndFlush(order);
            OrderResponse response = mapToOrderResponse(savedOrder);
            messagingTemplate.convertAndSend("/topic/kitchen", response);
            messagingTemplate.convertAndSend("/topic/order/" + orderId, response);
            notifyAdminStats();
            return response;
        } catch (IllegalArgumentException e) {
            throw new RuntimeException("Invalid status: " + mappedStatus);
        }
    }

    @Transactional
    public OrderResponse updateOrderItemStatus(Long orderItemId, String status) {
        OrderItem orderItem = orderItemRepository.findById(orderItemId)
                .orElseThrow(() -> new RuntimeException("Order item not found"));

        OrderItemStatus newStatus;
        try {
            newStatus = OrderItemStatus.valueOf(status.toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new RuntimeException("Invalid item status: " + status);
        }

        orderItem.setItemStatus(newStatus);

        Order order = orderItem.getOrder();
        if (newStatus == OrderItemStatus.PREPARING && order.getPreparationStartedAt() == null) {
            order.setPreparationStartedAt(OffsetDateTime.now());
        }

        reconcileOrderStatusFromItems(order);

        Order savedOrder = orderRepository.saveAndFlush(order);
        OrderResponse response = mapToOrderResponse(savedOrder);
        messagingTemplate.convertAndSend("/topic/kitchen", response);
        messagingTemplate.convertAndSend("/topic/order/" + savedOrder.getId(), response);
        notifyAdminStats();
        return response;
    }

    @Transactional
    public OrderResponse settleOrder(Long orderId) {
        return settleOrder(orderId, null);
    }

    @Transactional
    public OrderResponse settleOrder(Long orderId, SettleOrderRequest request) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Order not found"));
        return settleOrderInternal(order, request);
    }

    @Transactional
    public OrderResponse settleOrderForTable(String tableToken, Long orderId, SettleOrderRequest request) {
        RestaurantTable table = tableRepository.findByTableToken(tableToken)
                .orElseThrow(() -> new RuntimeException("Table not found"));
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Order not found"));

        if (!Objects.equals(order.getRestaurantTable().getId(), table.getId())) {
            throw new RuntimeException("Order does not belong to this table");
        }

        return settleOrderInternal(order, request);
    }

    @Transactional
    public OrderResponse requestPaymentForTable(String tableToken, Long orderId) {
        RestaurantTable table = tableRepository.findByTableToken(tableToken)
                .orElseThrow(() -> new RuntimeException("Table not found"));
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Order not found"));

        if (!Objects.equals(order.getRestaurantTable().getId(), table.getId())) {
            throw new RuntimeException("Order does not belong to this table");
        }

        if (order.getOrderStatus() == OrderStatus.PAID || order.getOrderStatus() == OrderStatus.CANCELLED) {
            throw new RuntimeException("Order is already closed");
        }

        order.setPaymentRequested(true);
        Order savedOrder = orderRepository.saveAndFlush(order);
        OrderResponse response = mapToOrderResponse(savedOrder);

        Map<String, Object> notification = new HashMap<>();
        notification.put("eventType", "CUSTOMER_READY_TO_PAY");
        notification.put("orderId", response.getOrderId());
        notification.put("orderNumber", response.getOrderNumber());
        notification.put("tableNumber", response.getTableNumber());
        notification.put("message", "Customer is ready to pay");
        messagingTemplate.convertAndSend("/topic/admin/payments", notification);
        messagingTemplate.convertAndSend("/topic/order/" + savedOrder.getId(), response);
        publishTableSessionEvent(
                table,
                savedOrder,
                "PAYMENT_REQUESTED",
                "Customer is ready to pay"
        );
        notifyAdminStats();
        return response;
    }

    @Transactional
    public OrderResponse cancelOrderItemForTable(String tableToken, Long orderId, Long orderItemId) {
        RestaurantTable table = tableRepository.findByTableToken(tableToken)
                .orElseThrow(() -> new RuntimeException("Table not found"));
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Order not found"));

        if (!Objects.equals(order.getRestaurantTable().getId(), table.getId())) {
            throw new RuntimeException("Order does not belong to this table");
        }
        if (Boolean.TRUE.equals(order.getPaymentRequested())) {
            throw new RuntimeException("Payment is already requested for this order");
        }
        if (order.getOrderStatus() == OrderStatus.PAID || order.getOrderStatus() == OrderStatus.CANCELLED) {
            throw new RuntimeException("Order is already closed");
        }
        if (!(order.getOrderStatus() == OrderStatus.OPEN || order.getOrderStatus() == OrderStatus.PENDING)) {
            throw new RuntimeException("Order item cannot be cancelled after preparation starts");
        }

        OrderItem orderItem = order.getOrderItems().stream()
                .filter(item -> Objects.equals(item.getId(), orderItemId))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("Order item not found in this order"));

        if (orderItem.getItemStatus() == OrderItemStatus.CANCELLED) {
            throw new RuntimeException("Order item is already cancelled");
        }
        if (orderItem.getItemStatus() != OrderItemStatus.PENDING) {
            throw new RuntimeException("Only pending items can be cancelled");
        }

        MenuItem menuItem = orderItem.getMenuItem();
        int existingStock = menuItem.getStockQuantity() != null ? Math.max(0, menuItem.getStockQuantity()) : 0;
        int restoredStock = existingStock + Math.max(0, orderItem.getQuantity());
        menuItem.setStockQuantity(restoredStock);
        if (restoredStock > 0 && existingStock <= 0) {
            menuItem.setIsAvailable(true);
        }
        menuItemRepository.saveAndFlush(menuItem);
        messagingTemplate.convertAndSend("/topic/menu", mapMenuItemForBroadcast(menuItem));
        menuAutocompleteService.markDirty();

        orderItem.setItemStatus(OrderItemStatus.CANCELLED);
        reconcileOrderStatusFromItems(order);
        order.setTotalAmount(calculateActiveSubtotal(order));
        order.setServiceChargeAmount(BigDecimal.ZERO);
        order.setDiscountAmount(BigDecimal.ZERO);

        Order savedOrder = orderRepository.saveAndFlush(order);
        OrderResponse response = mapToOrderResponse(savedOrder);
        messagingTemplate.convertAndSend("/topic/order/" + savedOrder.getId(), response);
        messagingTemplate.convertAndSend("/topic/kitchen", response);
        publishTableSessionEvent(
                table,
                savedOrder,
                "ORDER_UPDATED",
                "Order item cancelled from running tab"
        );
        notifyAdminStats();
        return response;
    }

    private OrderResponse settleOrderInternal(Order order, SettleOrderRequest request) {
        if (order.getOrderStatus() == OrderStatus.CANCELLED) {
            throw new RuntimeException("Cancelled order cannot be settled");
        }

        RestaurantTable table = order.getRestaurantTable();
        BigDecimal subtotal = calculateActiveSubtotal(order);
        BigDecimal serviceCharge;
        BigDecimal discountAmount;

        Order savedOrder;
        String settledTransactionRef = null;
        BigDecimal settledAmount = order.getTotalAmount();

        if (order.getOrderStatus() == OrderStatus.PAID) {
            order.setPaymentRequested(false);
            if (table.getStatus() != TableStatus.AVAILABLE) {
                table.setStatus(TableStatus.AVAILABLE);
                tableRepository.saveAndFlush(table);
                publishTableStatusUpdate(table);
            }
            boolean hasSuccessfulTransaction = transactionRepository.existsByOrderIdAndPaymentStatus(
                    order.getId(),
                    PaymentStatus.SUCCESS
            );
            if (!hasSuccessfulTransaction) {
                PaymentMethod fallbackMethod = resolvePaymentMethod(request != null ? request.getPaymentMethod() : null);
                String fallbackRef = resolveTransactionRef(order, "ORDER-" + order.getId() + "-PAID", fallbackMethod);
                upsertTransaction(order, fallbackMethod, order.getTotalAmount(), fallbackRef);
            }
            Transaction latestTransaction = transactionRepository
                    .findFirstByOrderIdAndPaymentStatusOrderByPaidAtDesc(order.getId(), PaymentStatus.SUCCESS)
                    .orElse(null);
            if (latestTransaction != null) {
                settledTransactionRef = latestTransaction.getTransactionRef();
                settledAmount = latestTransaction.getAmount();
            }
            savedOrder = orderRepository.saveAndFlush(order);
            serviceCharge = resolveServiceCharge(order, subtotal);
            discountAmount = resolveDiscountAmount(order);
        } else {
            PaymentMethod paymentMethod = resolvePaymentMethod(request != null ? request.getPaymentMethod() : null);
            serviceCharge = subtotal.multiply(new BigDecimal("0.10"));
            BigDecimal grossTotal = subtotal.add(serviceCharge);
            discountAmount = normalizeRequestedDiscount(
                    request != null ? request.getDiscountAmount() : null,
                    grossTotal
            );
            BigDecimal finalTotal = grossTotal.subtract(discountAmount);

            order.setTotalAmount(finalTotal);
            order.setServiceChargeAmount(serviceCharge);
            order.setDiscountAmount(discountAmount);
            order.setOrderStatus(OrderStatus.PAID);
            if (order.getCompletedAt() == null) {
                order.setCompletedAt(OffsetDateTime.now());
            }
            order.setPaymentRequested(false);

            table.setStatus(TableStatus.AVAILABLE);
            tableRepository.saveAndFlush(table);
            publishTableStatusUpdate(table);

            String transactionRef = resolveTransactionRef(
                    order,
                    request != null ? request.getTransactionToken() : null,
                    paymentMethod
            );
            Transaction transaction = upsertTransaction(order, paymentMethod, finalTotal, transactionRef);
            settledTransactionRef = transaction.getTransactionRef();
            settledAmount = transaction.getAmount();
            savedOrder = orderRepository.saveAndFlush(order);
        }

        OrderResponse response = mapToOrderResponse(savedOrder);
        response.setSubtotal(subtotal);
        response.setServiceCharge(serviceCharge);
        response.setDiscountAmount(discountAmount);

        messagingTemplate.convertAndSend(
                "/topic/admin/payments",
                new AdminPaymentNotification(
                        response.getOrderId(),
                        response.getOrderNumber(),
                        response.getOrderStatus(),
                        settledTransactionRef,
                        settledAmount
                )
        );
        publishTableSessionEvent(
                table,
                savedOrder,
                "PAYMENT_SETTLED",
                "Payment completed. Session closed for new customer."
        );
        messagingTemplate.convertAndSend("/topic/order/" + savedOrder.getId(), response);
        messagingTemplate.convertAndSend("/topic/kitchen", "refresh");
        messagingTemplate.convertAndSend("/topic/admin/stats", "refresh");
        notifyAdminStats();
        return response;
    }

    @Transactional(readOnly = true)
    public BigDecimal getTotalRevenue() {
        BigDecimal revenue = orderRepository.calculateTotalRevenue();
        return revenue != null ? revenue : BigDecimal.ZERO;
    }

    @Transactional(readOnly = true)
    public List<OrderResponse> getKitchenQueue() {
        List<Order> queue = orderRepository.findByOrderStatusInOrderByPlacedAtAsc(
                Arrays.asList(OrderStatus.OPEN, OrderStatus.PENDING, OrderStatus.IN_PROGRESS)
        );
        return kitchenPriorityService.sortKitchenQueue(queue).stream()
                .map(this::mapToOrderResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<OrderResponse> getActiveOrders() {
        return orderRepository.findByOrderStatusInOrderByPlacedAtAsc(
                Arrays.asList(OrderStatus.OPEN, OrderStatus.PENDING, OrderStatus.IN_PROGRESS, OrderStatus.READY, OrderStatus.SERVED)
        ).stream().map(this::mapToOrderResponse).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<OrderResponse> getAllOrdersHistory() {
        return orderRepository.findAll().stream()
                .sorted((a, b) -> b.getPlacedAt().compareTo(a.getPlacedAt()))
                .map(this::mapToOrderResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<TransactionRecordResponse> getTransactionHistory(Integer year, Integer month) {
        List<Transaction> transactions;

        if ((year == null) != (month == null)) {
            throw new RuntimeException("Year and month must be provided together");
        }

        if (year != null && month != null) {
            if (month < 1 || month > 12) {
                throw new RuntimeException("Month must be between 1 and 12");
            }
            if (year < 2000 || year > 9999) {
                throw new RuntimeException("Year must be a valid 4-digit value");
            }

            YearMonth selectedMonth = YearMonth.of(year, month);
            ZoneId systemZone = ZoneId.systemDefault();
            OffsetDateTime start = selectedMonth.atDay(1).atStartOfDay(systemZone).toOffsetDateTime();
            OffsetDateTime end = selectedMonth.plusMonths(1).atDay(1).atStartOfDay(systemZone).toOffsetDateTime();
            transactions = transactionRepository.findByPaidAtGreaterThanEqualAndPaidAtLessThanOrderByPaidAtDescIdDesc(start, end);
        } else {
            transactions = transactionRepository.findAllByOrderByPaidAtDescIdDesc();
        }

        return transactions.stream()
                .map(this::mapToTransactionRecordResponse)
                .collect(Collectors.toList());
    }

    public void notifyAdminStats() {
        long activeCount = orderRepository.countActiveOrders();
        BigDecimal revenue = getTotalRevenue();
        long availableTables = tableRepository.countByStatus(TableStatus.AVAILABLE);

        Map<String, Object> stats = new HashMap<>();
        stats.put("activeOrders", activeCount);
        stats.put("totalRevenue", revenue);
        stats.put("availableTables", (int) availableTables);

        messagingTemplate.convertAndSend("/topic/admin/stats", stats);
    }

    private void publishTableStatusUpdate(RestaurantTable table) {
        if (table == null) {
            return;
        }

        TableResponse response = TableResponse.builder()
                .id(table.getId())
                .tableNumber(table.getTableNumber())
                .location(table.getLocation())
                .capacity(table.getCapacity())
                .status(table.getStatus())
                .tableToken(table.getTableToken())
                .build();
        messagingTemplate.convertAndSend("/topic/tables", response);
    }

    private void publishTableSessionEvent(RestaurantTable table, Order order, String eventType, String message) {
        if (table == null || table.getTableToken() == null || table.getTableToken().isBlank()) {
            return;
        }

        TableSessionEvent event = TableSessionEvent.builder()
                .eventType(eventType)
                .message(message)
                .orderId(order != null ? order.getId() : null)
                .orderNumber(order != null ? order.getOrderNumber() : null)
                .orderStatus(order != null && order.getOrderStatus() != null ? order.getOrderStatus().name() : null)
                .paymentRequested(order != null ? Boolean.TRUE.equals(order.getPaymentRequested()) : null)
                .tableToken(table.getTableToken())
                .tableNumber(table.getTableNumber())
                .tableStatus(table.getStatus())
                .occurredAt(OffsetDateTime.now())
                .build();

        messagingTemplate.convertAndSend("/topic/table/" + table.getTableToken() + "/session", event);
    }

    private OrderResponse mapToOrderResponse(Order order) {
        BigDecimal currentSubtotal = calculateActiveSubtotal(order);
        BigDecimal serviceCharge = resolveServiceCharge(order, currentSubtotal);
        BigDecimal discountAmount = resolveDiscountAmount(order);

        return OrderResponse.builder()
                .orderId(order.getId())
                .orderNumber(order.getOrderNumber())
                .tableNumber(String.valueOf(order.getRestaurantTable().getTableNumber()))
                .orderStatus(order.getOrderStatus().name())
                .totalAmount(order.getTotalAmount())
                .serviceCharge(serviceCharge)
                .discountAmount(discountAmount)
                .subtotal(currentSubtotal)
                .placedAt(order.getPlacedAt())
                .notes(order.getNotes())
                .paymentRequested(Boolean.TRUE.equals(order.getPaymentRequested()))
                .estimatedWaitTime(waitTimeService.calculateOrderWaitTime(order))
                .items(order.getOrderItems().stream()
                        .map(i -> OrderItemResponse.builder()
                                .orderItemId(i.getId())
                                .menuItemId(i.getMenuItem().getId())
                                .menuItemName(i.getMenuItem().getName())
                                .quantity(i.getQuantity())
                                .unitPrice(i.getUnitPrice())
                                .lineTotal(i.getLineTotal())
                                .itemStatus(i.getItemStatus().name())
                                .build())
                        .collect(Collectors.toList()))
                .build();
    }

    private TransactionRecordResponse mapToTransactionRecordResponse(Transaction transaction) {
        Order order = transaction.getOrder();

        return TransactionRecordResponse.builder()
                .transactionId(transaction.getId())
                .transactionRef(transaction.getTransactionRef())
                .paymentMethod(transaction.getPaymentMethod() != null ? transaction.getPaymentMethod().name() : null)
                .paymentStatus(transaction.getPaymentStatus() != null ? transaction.getPaymentStatus().name() : null)
                .paidAt(transaction.getPaidAt())
                .amount(transaction.getAmount())
                .orderId(order.getId())
                .orderNumber(order.getOrderNumber())
                .orderStatus(order.getOrderStatus() != null ? order.getOrderStatus().name() : null)
                .tableNumber(String.valueOf(order.getRestaurantTable().getTableNumber()))
                .itemCount(order.getOrderItems() != null ? order.getOrderItems().size() : 0)
                .build();
    }

    private void synchronizeItemStatuses(Order order, OrderStatus status) {
        OrderItemStatus targetStatus = switch (status) {
            case IN_PROGRESS -> OrderItemStatus.PREPARING;
            case READY -> OrderItemStatus.READY;
            case SERVED, PAID -> OrderItemStatus.SERVED;
            case CANCELLED -> OrderItemStatus.CANCELLED;
            default -> null;
        };

        if (targetStatus == null) {
            return;
        }

        order.getOrderItems().forEach(item -> item.setItemStatus(targetStatus));
    }

    private void reconcileOrderStatusFromItems(Order order) {
        List<OrderItem> items = order.getOrderItems();
        if (items == null || items.isEmpty()) {
            order.setOrderStatus(OrderStatus.OPEN);
            return;
        }

        boolean anyPreparing = items.stream().anyMatch(item -> item.getItemStatus() == OrderItemStatus.PREPARING);
        boolean allReady = items.stream().allMatch(item -> item.getItemStatus() == OrderItemStatus.READY);
        boolean allServed = items.stream().allMatch(item -> item.getItemStatus() == OrderItemStatus.SERVED);
        boolean allCancelled = items.stream().allMatch(item -> item.getItemStatus() == OrderItemStatus.CANCELLED);
        boolean allPending = items.stream().allMatch(item -> item.getItemStatus() == OrderItemStatus.PENDING);

        if (allCancelled) {
            order.setOrderStatus(OrderStatus.CANCELLED);
            order.setCompletedAt(OffsetDateTime.now());
            return;
        }

        if (allServed) {
            order.setOrderStatus(OrderStatus.SERVED);
            if (order.getCompletedAt() == null) {
                order.setCompletedAt(OffsetDateTime.now());
            }
            return;
        }

        if (allReady) {
            order.setOrderStatus(OrderStatus.READY);
            if (order.getCompletedAt() == null) {
                order.setCompletedAt(OffsetDateTime.now());
            }
            return;
        }

        if (anyPreparing) {
            order.setOrderStatus(OrderStatus.IN_PROGRESS);
            if (order.getPreparationStartedAt() == null) {
                order.setPreparationStartedAt(OffsetDateTime.now());
            }
            order.setCompletedAt(null);
            return;
        }

        if (allPending) {
            order.setOrderStatus(OrderStatus.PENDING);
            order.setCompletedAt(null);
            return;
        }

        order.setOrderStatus(OrderStatus.PENDING);
        order.setCompletedAt(null);
    }

    private MenuItemResponse mapMenuItemForBroadcast(MenuItem item) {
        return MenuItemResponse.builder()
                .id(item.getId())
                .name(item.getName())
                .description(item.getDescription())
                .price(item.getPrice())
                .avgPrepTime(item.getAvgPrepTime())
                .stockQuantity(item.getStockQuantity())
                .isAvailable(Boolean.TRUE.equals(item.getIsAvailable()) && item.getStockQuantity() > 0)
                .imageUrl(item.getImageUrl())
                .categoryId(item.getCategory() != null ? item.getCategory().getId() : null)
                .categoryName(item.getCategory() != null ? item.getCategory().getName() : "Uncategorized")
                .build();
    }

    private PaymentMethod resolvePaymentMethod(String rawPaymentMethod) {
        String normalized = rawPaymentMethod == null
                ? "CASH"
                : rawPaymentMethod.trim()
                .toUpperCase(Locale.ROOT)
                .replace(' ', '_')
                .replace('-', '_')
                .replace("/", "_");

        return switch (normalized) {
            case "CASH" -> PaymentMethod.CASH;
            case "CARD" -> PaymentMethod.CARD;
            case "MOBILE_BANKING", "MOBILEBANKING", "MOBILE", "QR", "DYNAMIC_QR", "WALLET" -> PaymentMethod.MOBILE_BANKING;
            case "KHALTI", "ONLINE" -> PaymentMethod.KHALTI;
            case "ESEWA", "ESEWAKHALTI", "ESEWA_KHALTI" -> PaymentMethod.ESEWA;
            case "UPI" -> PaymentMethod.UPI;
            default -> throw new RuntimeException("Unsupported payment method: " + rawPaymentMethod);
        };
    }

    private String resolveTransactionRef(Order order, String requestedToken, PaymentMethod method) {
        String baseRef = requestedToken == null
                ? ""
                : requestedToken.trim().replaceAll("\\s+", "");

        if (baseRef.isEmpty()) {
            baseRef = method.name() + "-" + UUID.randomUUID().toString().substring(0, 10).toUpperCase(Locale.ROOT);
        } else if (baseRef.length() > 100) {
            baseRef = baseRef.substring(0, 100);
        }

        String candidate = baseRef;
        while (true) {
            Optional<Transaction> existing = transactionRepository.findByTransactionRef(candidate);
            if (existing.isEmpty()) {
                return candidate;
            }
            if (Objects.equals(existing.get().getOrder().getId(), order.getId())) {
                return candidate;
            }
            String suffix = "-" + UUID.randomUUID().toString().substring(0, 6).toUpperCase(Locale.ROOT);
            int maxBaseLength = 100 - suffix.length();
            String trimmedBase = baseRef.length() > maxBaseLength ? baseRef.substring(0, maxBaseLength) : baseRef;
            candidate = trimmedBase + suffix;
        }
    }

    private Transaction upsertTransaction(Order order, PaymentMethod paymentMethod, BigDecimal amount, String transactionRef) {
        Transaction transaction = transactionRepository.findFirstByOrderIdAndPaymentStatusOrderByPaidAtDesc(
                        order.getId(),
                        PaymentStatus.SUCCESS
                )
                .orElseGet(() -> transactionRepository.findByTransactionRef(transactionRef)
                        .orElseGet(() -> Transaction.builder()
                                .order(order)
                                .transactionRef(transactionRef)
                                .build()));

        transaction.setOrder(order);
        transaction.setAmount(amount);
        transaction.setPaymentMethod(paymentMethod);
        transaction.setPaymentStatus(PaymentStatus.SUCCESS);
        transaction.setPaidAt(OffsetDateTime.now());

        return transactionRepository.save(transaction);
    }

    private BigDecimal normalizeRequestedDiscount(BigDecimal requestedDiscount, BigDecimal grossTotal) {
        if (requestedDiscount == null) {
            return BigDecimal.ZERO;
        }
        if (requestedDiscount.compareTo(BigDecimal.ZERO) < 0) {
            throw new RuntimeException("Discount cannot be negative");
        }
        if (grossTotal == null || grossTotal.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO;
        }
        if (requestedDiscount.compareTo(grossTotal) > 0) {
            throw new RuntimeException("Discount cannot exceed payable total");
        }
        return requestedDiscount;
    }

    private BigDecimal resolveDiscountAmount(Order order) {
        BigDecimal discount = order != null ? order.getDiscountAmount() : null;
        if (discount == null || discount.compareTo(BigDecimal.ZERO) < 0) {
            return BigDecimal.ZERO;
        }
        return discount;
    }

    private BigDecimal resolveServiceCharge(Order order, BigDecimal subtotal) {
        BigDecimal explicitServiceCharge = order != null ? order.getServiceChargeAmount() : null;
        if (explicitServiceCharge != null && explicitServiceCharge.compareTo(BigDecimal.ZERO) > 0) {
            return explicitServiceCharge;
        }
        BigDecimal derived = (order != null && order.getTotalAmount() != null ? order.getTotalAmount() : BigDecimal.ZERO)
                .add(resolveDiscountAmount(order))
                .subtract(subtotal != null ? subtotal : BigDecimal.ZERO);
        return derived.compareTo(BigDecimal.ZERO) < 0 ? BigDecimal.ZERO : derived;
    }

    private BigDecimal calculateActiveSubtotal(Order order) {
        if (order == null || order.getOrderItems() == null) {
            return BigDecimal.ZERO;
        }
        return order.getOrderItems().stream()
                .filter(item -> item.getItemStatus() != OrderItemStatus.CANCELLED)
                .map(OrderItem::getLineTotal)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
