package com.restaurant.foodsystem.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import lombok.Data;
import java.util.List;

@Data
public class PlaceOrderRequest {

    @NotEmpty
    @Valid
    // Changed from PlaceOrderItemRequest to OrderItemRequest
    private List<OrderItemRequest> items;

    private String notes;
}