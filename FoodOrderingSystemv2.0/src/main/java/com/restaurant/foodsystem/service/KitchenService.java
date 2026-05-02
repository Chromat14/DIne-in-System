package com.restaurant.foodsystem.service;

import com.restaurant.foodsystem.dto.KitchenStatsResponse;
import com.restaurant.foodsystem.entity.Order;
import com.restaurant.foodsystem.entity.OrderStatus;
import com.restaurant.foodsystem.repository.OrderRepository;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;

@Data
@Builder
@Service
@RequiredArgsConstructor
public class KitchenService {
    private final OrderRepository orderRepository;

    public KitchenStatsResponse getShiftStats() {
        // Define the start of the current day for the 'Shift' context
        OffsetDateTime shiftStart = OffsetDateTime.now().withHour(0).withMinute(0).withSecond(0);

        List<Order> allOrders = orderRepository.findAll();

        // 1. Shift Completed: Count orders marked READY or COMPLETED today
        long completedToday = allOrders.stream()
                .filter(o -> o.getCompletedAt() != null && o.getCompletedAt().isAfter(shiftStart))
                .count();

        // 2. Avg Prep Time: Only calculate for orders that have both timestamps
        double avgMinutes = allOrders.stream()
                .filter(o -> o.getPreparationStartedAt() != null && o.getCompletedAt() != null)
                .filter(o -> o.getCompletedAt().isAfter(shiftStart))
                .mapToLong(o -> Duration.between(o.getPreparationStartedAt(), o.getCompletedAt()).toMinutes())
                .filter(minutes -> minutes > 0 && minutes <= 120)
                .average()
                .orElse(0.0);

        // 3. Active Heat: Current OPEN, PENDING or IN_PROGRESS orders
        long activeHeat = allOrders.stream()
                .filter(o -> o.getOrderStatus() == OrderStatus.OPEN
                        || o.getOrderStatus() == OrderStatus.PENDING
                        || o.getOrderStatus() == OrderStatus.IN_PROGRESS)
                .count();

        return KitchenStatsResponse.builder()
                .ordersCompletedToday((int) completedToday)
                .averagePrepTime((int) Math.round(avgMinutes))
                .activeOrders((int) activeHeat)
                .build();
    }
}
