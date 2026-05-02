package com.restaurant.foodsystem.dto;

import lombok.Data;
import java.math.BigDecimal;

@Data
public class MenuItemRequest {
    private String name;
    private String description;
    private BigDecimal price;
    private Integer avgPrepTime;
    private Long categoryId; // This matches the ID sent from React
    private Boolean isAvailable;
}