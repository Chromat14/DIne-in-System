package com.restaurant.foodsystem.dto;

import lombok.Data;

@Data
public class CategoryRequest {
    private String name;
    private String description;
    private Integer displayOrder;
}