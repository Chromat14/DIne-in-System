package com.restaurant.foodsystem.dto;

import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;

@Data
@Builder
public class MenuItemResponse {
    private Long id;
    private String name;
    private String description;
    private BigDecimal price;
    private Integer avgPrepTime;
    private Integer stockQuantity;
    private Boolean isAvailable;
    private String imageUrl;
    private String categoryName;
    private Long categoryId;
}
