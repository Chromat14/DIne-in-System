package com.restaurant.foodsystem.service;

import com.restaurant.foodsystem.entity.MenuItem;
import com.restaurant.foodsystem.entity.Order;
import com.restaurant.foodsystem.entity.OrderItem;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;

class KitchenPriorityServiceTest {

    private final KitchenPriorityService kitchenPriorityService = new KitchenPriorityService();

    @Test
    void sortKitchenQueue_prioritizesOlderOrderWhenPrepIsSimilar() {
        Order olderOrder = order(
                1L,
                OffsetDateTime.now().minusMinutes(20),
                List.of(orderItem(5, 1))
        );
        Order newerOrder = order(
                2L,
                OffsetDateTime.now().minusMinutes(5),
                List.of(orderItem(5, 1))
        );

        List<Order> sorted = kitchenPriorityService.sortKitchenQueue(List.of(newerOrder, olderOrder));

        assertEquals(List.of(1L, 2L), sorted.stream().map(Order::getId).toList());
    }

    @Test
    void sortKitchenQueue_penalizesVeryLongPrepOrder() {
        Order shortPrepOrder = order(
                10L,
                OffsetDateTime.now().minusMinutes(3),
                List.of(orderItem(3, 1))
        );
        Order longPrepOrder = order(
                11L,
                OffsetDateTime.now().minusMinutes(4),
                List.of(orderItem(30, 2))
        );

        List<Order> sorted = kitchenPriorityService.sortKitchenQueue(List.of(longPrepOrder, shortPrepOrder));

        assertEquals(List.of(10L, 11L), sorted.stream().map(Order::getId).toList());
    }

    @Test
    void sortKitchenQueue_handlesMissingPlacedAtAndPrepTime() {
        Order missingFieldsOrder = order(
                100L,
                null,
                List.of(orderItem(null, 1))
        );
        Order normalOrder = order(
                101L,
                OffsetDateTime.now().minusMinutes(1),
                List.of(orderItem(5, 1))
        );

        assertDoesNotThrow(() ->
                kitchenPriorityService.sortKitchenQueue(List.of(missingFieldsOrder, normalOrder))
        );
    }

    private Order order(Long id, OffsetDateTime placedAt, List<OrderItem> items) {
        return Order.builder()
                .id(id)
                .placedAt(placedAt)
                .orderItems(items)
                .build();
    }

    private OrderItem orderItem(Integer prepTime, int quantity) {
        MenuItem menuItem = MenuItem.builder()
                .avgPrepTime(prepTime)
                .build();
        return OrderItem.builder()
                .menuItem(menuItem)
                .quantity(quantity)
                .build();
    }
}
