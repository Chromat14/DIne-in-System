package com.restaurant.foodsystem.controller;

import com.restaurant.foodsystem.dto.OrderResponse;
import com.restaurant.foodsystem.dto.SettleOrderRequest;
import com.restaurant.foodsystem.dto.TransactionRecordResponse;
import com.restaurant.foodsystem.entity.TableStatus;
import com.restaurant.foodsystem.repository.RestaurantTableRepository;
import com.restaurant.foodsystem.service.OrderService;
import com.restaurant.foodsystem.service.AdminAnalyticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
public class AdminController {

    private final OrderService orderService;
    private final AdminAnalyticsService analyticsService;
    private final RestaurantTableRepository tableRepository;

    @GetMapping("/analytics")
    public ResponseEntity<Map<String, Object>> getAnalytics() {
        Map<String, Object> data = new HashMap<>();

        long availableTables = tableRepository.countByStatus(TableStatus.AVAILABLE);

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalRevenue", orderService.getTotalRevenue());
        stats.put("activeOrders", orderService.getKitchenQueue().size());
        stats.put("availableTables", availableTables);
        data.put("stats", stats);

        data.put("peakBusyHours", analyticsService.getBusyHours());
        data.put("topSellingItems", analyticsService.getTopSellingItems());

        data.put("activeOrdersList", orderService.getKitchenQueue());

        return ResponseEntity.ok(data);
    }

    @GetMapping("/orders/active")
    public ResponseEntity<List<OrderResponse>> getActiveOrders() {
        return ResponseEntity.ok(orderService.getActiveOrders());
    }

    @PostMapping("/orders/{id}/settle")
    public ResponseEntity<OrderResponse> settleOrder(
            @PathVariable Long id,
            @RequestBody(required = false) SettleOrderRequest request
    ) {
        OrderResponse response = orderService.settleOrder(id, request);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/orders/history")
    public ResponseEntity<List<OrderResponse>> getOrderHistory() {
        return ResponseEntity.ok(orderService.getAllOrdersHistory());
    }

    @GetMapping("/transactions")
    public ResponseEntity<List<TransactionRecordResponse>> getTransactionHistory(
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) Integer month
    ) {
        return ResponseEntity.ok(orderService.getTransactionHistory(year, month));
    }
}
