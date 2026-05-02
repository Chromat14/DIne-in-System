package com.restaurant.foodsystem.controller;

import com.restaurant.foodsystem.repository.OrderRepository;
import com.restaurant.foodsystem.repository.RestaurantTableRepository;
import com.restaurant.foodsystem.service.AdminAnalyticsService;
import com.restaurant.foodsystem.entity.TableStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin/analytics")
@RequiredArgsConstructor
public class AdminAnalyticsController {

    private final AdminAnalyticsService analyticsService;
    private final OrderRepository orderRepository;
    private final RestaurantTableRepository restaurantTableRepository;

    @GetMapping("/summary")
    public ResponseEntity<Map<String, Object>> getDashboardSummary() {
        Map<String, Object> stats = new HashMap<>();

        BigDecimal revenue = orderRepository.calculateTotalRevenue();
        stats.put("totalRevenue", revenue != null ? revenue : BigDecimal.ZERO);
        stats.put("activeOrders", orderRepository.countActiveOrders());
        stats.put("availableTables", restaurantTableRepository.countByStatus(TableStatus.AVAILABLE));

        stats.put("busyHours", analyticsService.getBusyHours());
        stats.put("topSelling", analyticsService.getTopSellingItems());

        return ResponseEntity.ok(stats);
    }
}
