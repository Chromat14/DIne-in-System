package com.restaurant.foodsystem.service;

import com.restaurant.foodsystem.entity.OrderItemStatus;
import com.restaurant.foodsystem.entity.Order;
import com.restaurant.foodsystem.entity.OrderStatus;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Set;

@Service
public class KitchenPriorityService {

    private static final int DEFAULT_PREP_MINUTES = 5;
    private static final int MIN_IN_PROGRESS_WORK_MINUTES = 2;
    private static final int MIN_QUEUED_WORK_MINUTES = 5;
    private static final Set<OrderItemStatus> ACTIVE_ITEM_STATUSES = Set.of(
            OrderItemStatus.PENDING, OrderItemStatus.PREPARING
    );

    public List<Order> sortKitchenQueue(List<Order> orders) {
        OffsetDateTime now = OffsetDateTime.now();
        return orders.stream()
                .filter(order -> order != null)
                .sorted(Comparator.<Order>comparingDouble(order -> score(order, now)).reversed())
                .toList();
    }

    public int estimateRemainingWorkMinutes(Order order) {
        List<com.restaurant.foodsystem.entity.OrderItem> items = order != null && order.getOrderItems() != null
                ? order.getOrderItems()
                : Collections.emptyList();

        int baseWork = items.stream()
                .filter(item -> item != null && item.getItemStatus() != null && ACTIVE_ITEM_STATUSES.contains(item.getItemStatus()))
                .mapToInt(item -> {
                    int prepTime = item.getMenuItem() != null && item.getMenuItem().getAvgPrepTime() != null
                            ? item.getMenuItem().getAvgPrepTime()
                            : DEFAULT_PREP_MINUTES;
                    int quantity = Math.max(item.getQuantity(), 1);
                    return Math.max(prepTime, 1) * quantity;
                })
                .sum();

        if (baseWork == 0) {
            baseWork = items.stream()
                    .mapToInt(item -> {
                        int prepTime = item.getMenuItem() != null && item.getMenuItem().getAvgPrepTime() != null
                                ? item.getMenuItem().getAvgPrepTime()
                                : DEFAULT_PREP_MINUTES;
                        int quantity = Math.max(item.getQuantity(), 1);
                        return Math.max(prepTime, 1) * quantity;
                    })
                    .sum();
        }

        if (order != null && order.getOrderStatus() == OrderStatus.IN_PROGRESS && order.getPreparationStartedAt() != null) {
            long elapsedMinutes = Math.max(Duration.between(order.getPreparationStartedAt(), OffsetDateTime.now()).toMinutes(), 0);
            baseWork -= (int) elapsedMinutes;
        }

        OrderStatus status = order != null ? order.getOrderStatus() : null;
        int minWork = status == OrderStatus.IN_PROGRESS
                ? MIN_IN_PROGRESS_WORK_MINUTES
                : MIN_QUEUED_WORK_MINUTES;
        return Math.max(baseWork, minWork);
    }

    private double score(Order order, OffsetDateTime now) {
        OffsetDateTime placedAt = order.getPlacedAt() != null ? order.getPlacedAt() : now;
        long waitingMinutes = Math.max(Duration.between(placedAt, now).toMinutes(), 0);
        int remainingWorkMinutes = estimateRemainingWorkMinutes(order);
        OrderStatus status = order.getOrderStatus();
        double statusBoost = switch (status != null ? status : OrderStatus.OPEN) {
            case IN_PROGRESS -> 35.0;
            case PENDING -> 20.0;
            case OPEN -> 10.0;
            default -> 0.0;
        };

        // Higher score means earlier execution in kitchen queue.
        return statusBoost + (waitingMinutes * 2.0) - (remainingWorkMinutes * 1.25);
    }

}
