package com.restaurant.foodsystem.service;

import com.restaurant.foodsystem.dto.OrderResponse;
import com.restaurant.foodsystem.entity.MenuItem;
import com.restaurant.foodsystem.entity.Order;
import com.restaurant.foodsystem.entity.OrderItem;
import com.restaurant.foodsystem.entity.OrderItemStatus;
import com.restaurant.foodsystem.entity.OrderStatus;
import com.restaurant.foodsystem.entity.RestaurantTable;
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
import java.util.ArrayList;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrderServiceCancelOrderItemTest {

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
    void cancelOrderItemForTable_restoresStockAndExcludesCancelledItemFromTotals() {
        RestaurantTable table = RestaurantTable.builder()
                .id(10L)
                .tableNumber(7)
                .tableToken("token-7")
                .build();

        MenuItem menuItem = MenuItem.builder()
                .id(20L)
                .name("Momo")
                .stockQuantity(0)
                .isAvailable(false)
                .build();

        Order order = Order.builder()
                .id(30L)
                .orderNumber("ORD-30")
                .restaurantTable(table)
                .orderStatus(OrderStatus.PENDING)
                .totalAmount(new BigDecimal("300.00"))
                .placedAt(OffsetDateTime.now().minusMinutes(5))
                .orderItems(new ArrayList<>())
                .paymentRequested(false)
                .build();

        OrderItem orderItem = OrderItem.builder()
                .id(40L)
                .order(order)
                .menuItem(menuItem)
                .quantity(2)
                .unitPrice(new BigDecimal("150.00"))
                .lineTotal(new BigDecimal("300.00"))
                .itemStatus(OrderItemStatus.PENDING)
                .build();
        order.getOrderItems().add(orderItem);

        when(tableRepository.findByTableToken("token-7")).thenReturn(Optional.of(table));
        when(orderRepository.findById(30L)).thenReturn(Optional.of(order));
        when(menuItemRepository.saveAndFlush(menuItem)).thenReturn(menuItem);
        when(orderRepository.saveAndFlush(order)).thenReturn(order);
        when(waitTimeService.calculateOrderWaitTime(order)).thenReturn(0);

        OrderResponse response = orderService.cancelOrderItemForTable("token-7", 30L, 40L);

        assertEquals(OrderItemStatus.CANCELLED, orderItem.getItemStatus());
        assertEquals(OrderStatus.CANCELLED, order.getOrderStatus());
        assertEquals(new BigDecimal("0"), order.getTotalAmount());
        assertEquals(2, menuItem.getStockQuantity());
        assertEquals(true, menuItem.getIsAvailable());
        assertEquals(new BigDecimal("0"), response.getSubtotal());
        assertEquals(new BigDecimal("0"), response.getTotalAmount());
    }

    @Test
    void cancelOrderItemForTable_rejectsWhenOrderIsAlreadyInProgress() {
        RestaurantTable table = RestaurantTable.builder()
                .id(11L)
                .tableNumber(9)
                .tableToken("token-9")
                .build();

        MenuItem menuItem = MenuItem.builder()
                .id(21L)
                .name("Chowmein")
                .stockQuantity(8)
                .isAvailable(true)
                .build();

        Order order = Order.builder()
                .id(31L)
                .orderNumber("ORD-31")
                .restaurantTable(table)
                .orderStatus(OrderStatus.IN_PROGRESS)
                .totalAmount(new BigDecimal("240.00"))
                .placedAt(OffsetDateTime.now().minusMinutes(12))
                .orderItems(new ArrayList<>())
                .paymentRequested(false)
                .build();

        OrderItem orderItem = OrderItem.builder()
                .id(41L)
                .order(order)
                .menuItem(menuItem)
                .quantity(1)
                .unitPrice(new BigDecimal("240.00"))
                .lineTotal(new BigDecimal("240.00"))
                .itemStatus(OrderItemStatus.PENDING)
                .build();
        order.getOrderItems().add(orderItem);

        when(tableRepository.findByTableToken("token-9")).thenReturn(Optional.of(table));
        when(orderRepository.findById(31L)).thenReturn(Optional.of(order));

        RuntimeException ex = assertThrows(
                RuntimeException.class,
                () -> orderService.cancelOrderItemForTable("token-9", 31L, 41L)
        );

        assertEquals("Order item cannot be cancelled after preparation starts", ex.getMessage());
    }
}
