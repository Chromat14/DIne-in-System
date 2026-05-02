package com.restaurant.foodsystem.service;

import com.restaurant.foodsystem.entity.MenuItem;
import com.restaurant.foodsystem.entity.Order;
import com.restaurant.foodsystem.entity.OrderItem;
import com.restaurant.foodsystem.entity.OrderItemStatus;
import com.restaurant.foodsystem.entity.OrderStatus;
import com.restaurant.foodsystem.repository.OrderRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.OffsetDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WaitTimeServiceTest {

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private KitchenConfigService kitchenConfigService;

    @InjectMocks
    private WaitTimeService waitTimeService;

    @Test
    void calculateEstimatedWaitTime_dividesByActiveChefsAndRoundsUp() {
        Order openOrder = order(
                1L,
                OrderStatus.OPEN,
                OffsetDateTime.now().minusMinutes(4),
                null,
                List.of(orderItem(10, 1, OrderItemStatus.PENDING))
        );

        Order inProgressOrder = order(
                2L,
                OrderStatus.IN_PROGRESS,
                OffsetDateTime.now().minusMinutes(3),
                OffsetDateTime.now().minusMinutes(5),
                List.of(orderItem(6, 2, OrderItemStatus.PREPARING))
        );

        Order paidOrder = order(
                3L,
                OrderStatus.PAID,
                OffsetDateTime.now().minusMinutes(1),
                null,
                List.of(orderItem(30, 1, OrderItemStatus.SERVED))
        );

        when(orderRepository.findAll()).thenReturn(List.of(openOrder, inProgressOrder, paidOrder));

        int result = waitTimeService.calculateEstimatedWaitTime(2);

        assertEquals(9, result);
    }

    @Test
    void calculateOrderWaitTime_includesBacklogAndAppliesMinimumForPending() {
        Order first = order(
                11L,
                OrderStatus.IN_PROGRESS,
                OffsetDateTime.now().minusMinutes(10),
                OffsetDateTime.now().minusMinutes(20),
                List.of(orderItem(10, 1, OrderItemStatus.PREPARING))
        );

        Order target = order(
                12L,
                OrderStatus.PENDING,
                OffsetDateTime.now().minusMinutes(8),
                null,
                List.of(orderItem(5, 1, OrderItemStatus.PENDING))
        );

        when(kitchenConfigService.getActiveChefs()).thenReturn(2);
        when(orderRepository.findAll()).thenReturn(List.of(target, first));

        int result = waitTimeService.calculateOrderWaitTime(target);

        assertEquals(5, result);
    }

    @Test
    void calculateOrderWaitTime_returnsZeroForInactiveOrderStatus() {
        Order readyOrder = order(
                21L,
                OrderStatus.READY,
                OffsetDateTime.now().minusMinutes(2),
                null,
                List.of(orderItem(12, 1, OrderItemStatus.READY))
        );

        int result = waitTimeService.calculateOrderWaitTime(readyOrder);

        assertEquals(0, result);
    }

    @Test
    void calculateEstimatedWaitTime_returnsZeroWhenNoActiveOrders() {
        Order paidOrder = order(
                31L,
                OrderStatus.PAID,
                OffsetDateTime.now().minusMinutes(2),
                null,
                List.of(orderItem(7, 1, OrderItemStatus.SERVED))
        );

        when(orderRepository.findAll()).thenReturn(List.of(paidOrder));

        int result = waitTimeService.calculateEstimatedWaitTime(2);

        assertEquals(0, result);
    }

    private Order order(
            Long id,
            OrderStatus status,
            OffsetDateTime placedAt,
            OffsetDateTime preparationStartedAt,
            List<OrderItem> items
    ) {
        return Order.builder()
                .id(id)
                .orderStatus(status)
                .placedAt(placedAt)
                .preparationStartedAt(preparationStartedAt)
                .orderItems(items)
                .build();
    }

    private OrderItem orderItem(int prepTime, int qty, OrderItemStatus itemStatus) {
        MenuItem menuItem = MenuItem.builder()
                .avgPrepTime(prepTime)
                .build();
        return OrderItem.builder()
                .menuItem(menuItem)
                .quantity(qty)
                .itemStatus(itemStatus)
                .build();
    }
}
