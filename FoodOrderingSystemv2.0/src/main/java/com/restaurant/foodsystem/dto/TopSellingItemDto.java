package com.restaurant.foodsystem.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class TopSellingItemDto {
    private String itemName;
    private Long totalSold;
}