package com.restaurant.foodsystem.controller;

import com.restaurant.foodsystem.dto.OrderResponse;
import com.restaurant.foodsystem.dto.KitchenStatsResponse;
import com.restaurant.foodsystem.dto.UpdateOrderItemStatusRequest;
import com.restaurant.foodsystem.service.OrderService;
import com.restaurant.foodsystem.service.KitchenService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/kitchen")
@RequiredArgsConstructor
public class KitchenController {

    private final OrderService orderService;
    private final KitchenService kitchenService;

    @GetMapping("/orders/active")
    public List<OrderResponse> getActiveQueue() {
        return orderService.getKitchenQueue();
    }

    @GetMapping("/orders/history")
    public List<OrderResponse> getHistory() {
        return orderService.getAllOrdersHistory();
    }

    @GetMapping("/stats")
    public KitchenStatsResponse getKitchenStats() {
        return kitchenService.getShiftStats();
    }

    @PutMapping("/orders/{orderId}/status")
    public OrderResponse updateOrderStatus(@PathVariable Long orderId,
                                           @RequestParam String status) {
        return orderService.updateOrderStatus(orderId, status);
    }

    @PutMapping("/orders/items/{orderItemId}/status")
    public OrderResponse updateOrderItemStatus(@PathVariable Long orderItemId,
                                               @RequestBody UpdateOrderItemStatusRequest request) {
        return orderService.updateOrderItemStatus(orderItemId, request.getStatus());
    }
}
