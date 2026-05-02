package com.restaurant.foodsystem.service;

import com.restaurant.foodsystem.dto.OrderResponse;
import com.restaurant.foodsystem.dto.SettleOrderRequest;
import com.restaurant.foodsystem.entity.MenuItem;
import com.restaurant.foodsystem.entity.Order;
import com.restaurant.foodsystem.entity.OrderItem;
import com.restaurant.foodsystem.entity.OrderItemStatus;
import com.restaurant.foodsystem.entity.OrderStatus;
import com.restaurant.foodsystem.entity.RestaurantTable;
import com.restaurant.foodsystem.entity.TableStatus;
import com.restaurant.foodsystem.entity.Transaction;
import com.restaurant.foodsystem.repository.MenuItemRepository;
import com.restaurant.foodsystem.repository.OrderItemRepository;
import com.restaurant.foodsystem.repository.OrderRepository;
import com.restaurant.foodsystem.repository.RestaurantTableRepository;
import com.restaurant.foodsystem.repository.TransactionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrderServiceKitchenQueueTest {

    @Mock
    private OrderRepository orderRepository;
    @Mock
    private OrderItemRepository orderItemRepository;
    @Mock
    private MenuItemRepository menuItemRepository;
    @Mock
    private RestaurantTableRepository tableRepository;
    @Mock
    private TransactionRepository transactionRepository;
    @Mock
    private SimpMessagingTemplate messagingTemplate;
    @Mock
    private WaitTimeService waitTimeService;
    @Mock
    private KitchenPriorityService kitchenPriorityService;
    @Mock
    private MenuAutocompleteService menuAutocompleteService;

    @InjectMocks
    private OrderService orderService;

    @Test
    void getKitchenQueue_usesPrioritySortingAndReturnsSortedResponses() {
        Order orderA = buildOrder(1L, "ORD-A", 1);
        Order orderB = buildOrder(2L, "ORD-B", 2);

        List<Order> repositoryOrder = List.of(orderA, orderB);
        List<Order> prioritySorted = List.of(orderB, orderA);

        when(orderRepository.findByOrderStatusInOrderByPlacedAtAsc(anyList())).thenReturn(repositoryOrder);
        when(kitchenPriorityService.sortKitchenQueue(repositoryOrder)).thenReturn(prioritySorted);
        when(waitTimeService.calculateOrderWaitTime(orderA)).thenReturn(7);
        when(waitTimeService.calculateOrderWaitTime(orderB)).thenReturn(4);

        List<OrderResponse> result = orderService.getKitchenQueue();

        assertEquals(List.of(2L, 1L), result.stream().map(OrderResponse::getOrderId).toList());
        verify(kitchenPriorityService).sortKitchenQueue(repositoryOrder);
    }

    @Test
    void settleOrder_preservesExistingCompletedAtTimestamp() {
        OffsetDateTime existingCompletedAt = OffsetDateTime.now().minusMinutes(18);
        Order order = buildOrder(20L, "ORD-SETTLE", 7);
        order.setOrderStatus(OrderStatus.READY);
        order.setCompletedAt(existingCompletedAt);
        order.setPaymentRequested(true);
        order.getRestaurantTable().setStatus(TableStatus.OCCUPIED);

        when(orderRepository.findById(20L)).thenReturn(Optional.of(order));
        when(orderRepository.saveAndFlush(order)).thenReturn(order);
        when(tableRepository.saveAndFlush(order.getRestaurantTable())).thenReturn(order.getRestaurantTable());
        when(waitTimeService.calculateOrderWaitTime(order)).thenReturn(0);
        when(transactionRepository.findByTransactionRef(anyString())).thenReturn(Optional.empty());
        when(transactionRepository.save(org.mockito.ArgumentMatchers.any(Transaction.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        OrderResponse response = orderService.settleOrder(
                20L,
                SettleOrderRequest.builder()
                        .paymentMethod("CASH")
                        .transactionToken("TS-LOCK-COMPLETE")
                        .build()
        );

        assertEquals(OrderStatus.PAID.name(), response.getOrderStatus());
        assertEquals(existingCompletedAt, order.getCompletedAt());
        assertEquals(TableStatus.AVAILABLE, order.getRestaurantTable().getStatus());
    }

    @Test
    void settleOrder_appliesOptionalDiscountToFinalAmount() {
        Order order = buildOrder(22L, "ORD-DISCOUNT", 4);
        order.setOrderStatus(OrderStatus.READY);
        order.setPaymentRequested(true);
        order.getRestaurantTable().setStatus(TableStatus.OCCUPIED);

        when(orderRepository.findById(22L)).thenReturn(Optional.of(order));
        when(orderRepository.saveAndFlush(order)).thenReturn(order);
        when(tableRepository.saveAndFlush(order.getRestaurantTable())).thenReturn(order.getRestaurantTable());
        when(waitTimeService.calculateOrderWaitTime(order)).thenReturn(0);
        when(transactionRepository.findByTransactionRef(anyString())).thenReturn(Optional.empty());
        when(transactionRepository.save(org.mockito.ArgumentMatchers.any(Transaction.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        OrderResponse response = orderService.settleOrder(
                22L,
                SettleOrderRequest.builder()
                        .paymentMethod("CASH")
                        .transactionToken("TS-DISCOUNT-22")
                        .discountAmount(new BigDecimal("20.00"))
                        .build()
        );

        assertEquals(0, response.getTotalAmount().compareTo(new BigDecimal("255.00")));
        assertEquals(0, response.getServiceCharge().compareTo(new BigDecimal("25.00")));
        assertEquals(0, response.getDiscountAmount().compareTo(new BigDecimal("20.00")));
        assertEquals(0, order.getTotalAmount().compareTo(new BigDecimal("255.00")));
    }

    @Test
    void settleOrder_rejectsDiscountHigherThanPayableTotal() {
        Order order = buildOrder(23L, "ORD-DISCOUNT-ERR", 5);
        order.setOrderStatus(OrderStatus.READY);
        order.setPaymentRequested(true);
        order.getRestaurantTable().setStatus(TableStatus.OCCUPIED);

        when(orderRepository.findById(23L)).thenReturn(Optional.of(order));

        RuntimeException ex = assertThrows(
                RuntimeException.class,
                () -> orderService.settleOrder(
                        23L,
                        SettleOrderRequest.builder()
                                .paymentMethod("CASH")
                                .transactionToken("TS-DISCOUNT-23")
                                .discountAmount(new BigDecimal("500.00"))
                                .build()
                )
        );

        assertEquals("Discount cannot exceed payable total", ex.getMessage());
    }

    private Order buildOrder(Long id, String orderNumber, int tableNumber) {
        RestaurantTable table = RestaurantTable.builder()
                .id((long) tableNumber)
                .tableNumber(tableNumber)
                .build();

        MenuItem menuItem = MenuItem.builder()
                .id(100L + id)
                .name("Item " + id)
                .avgPrepTime(10)
                .build();

        Order order = Order.builder()
                .id(id)
                .orderNumber(orderNumber)
                .restaurantTable(table)
                .orderStatus(OrderStatus.PENDING)
                .placedAt(OffsetDateTime.now().minusMinutes(10))
                .totalAmount(new BigDecimal("250.00"))
                .orderItems(new java.util.ArrayList<>())
                .build();

        OrderItem item = OrderItem.builder()
                .id(1000L + id)
                .order(order)
                .menuItem(menuItem)
                .quantity(1)
                .unitPrice(new BigDecimal("250.00"))
                .lineTotal(new BigDecimal("250.00"))
                .itemStatus(OrderItemStatus.PENDING)
                .build();

        order.getOrderItems().add(item);
        return order;
    }
}
