package com.restaurant.foodsystem.dto;

import lombok.Data;

@Data
public class UpdateOrderStatusRequest {
    private String status; // Jackson will map the "status" key from JSON here
}