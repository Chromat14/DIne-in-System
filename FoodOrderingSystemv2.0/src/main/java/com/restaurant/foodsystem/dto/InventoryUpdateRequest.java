package com.restaurant.foodsystem.dto;

import lombok.Data;

@Data
public class InventoryUpdateRequest {
    private Integer stockQuantity;
    private Integer stockAdjustment;
    private Boolean isAvailable;
}
