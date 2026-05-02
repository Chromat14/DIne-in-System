package com.restaurant.foodsystem.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MenuItemDto {
    private Long id;
    private String name;
    private String description;
    private BigDecimal price;
    private Integer avgPrepTime;
    private Integer stockQuantity;
    private Boolean isAvailable;
    private String imageUrl;
    private Long categoryId;
    private String categoryName;
}
