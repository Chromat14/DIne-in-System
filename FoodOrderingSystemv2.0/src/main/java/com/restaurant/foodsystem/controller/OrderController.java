package com.restaurant.foodsystem.controller;

import com.restaurant.foodsystem.dto.OrderResponse;
import com.restaurant.foodsystem.dto.PlaceOrderRequest;
import com.restaurant.foodsystem.dto.SettleOrderRequest;
import com.restaurant.foodsystem.service.OrderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/table/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;

    @PostMapping
    public ResponseEntity<OrderResponse> placeOrder(
            @RequestHeader("X-Table-Token") String tableToken,
            @Valid @RequestBody PlaceOrderRequest request) {
        OrderResponse response = orderService.placeOrder(tableToken, request);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/active")
    public ResponseEntity<OrderResponse> getActiveOrder(
            @RequestHeader("X-Table-Token") String tableToken) {
        return orderService.getActiveOrderForTable(tableToken)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.noContent().build());
    }

    @PostMapping("/{id}/settle")
    public ResponseEntity<OrderResponse> settleOrderForTable(
            @RequestHeader("X-Table-Token") String tableToken,
            @PathVariable Long id,
            @RequestBody(required = false) SettleOrderRequest request
    ) {
        return ResponseEntity.ok(orderService.settleOrderForTable(tableToken, id, request));
    }

    @PostMapping("/{id}/request-payment")
    public ResponseEntity<OrderResponse> requestPayment(
            @RequestHeader("X-Table-Token") String tableToken,
            @PathVariable Long id
    ) {
        return ResponseEntity.ok(orderService.requestPaymentForTable(tableToken, id));
    }

    @PostMapping("/{orderId}/items/{orderItemId}/cancel")
    public ResponseEntity<OrderResponse> cancelOrderItem(
            @RequestHeader("X-Table-Token") String tableToken,
            @PathVariable Long orderId,
            @PathVariable Long orderItemId
    ) {
        return ResponseEntity.ok(orderService.cancelOrderItemForTable(tableToken, orderId, orderItemId));
    }
}
