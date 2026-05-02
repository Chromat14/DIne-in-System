package com.restaurant.foodsystem.recommendation.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class RecommendationDto {
    private Long menuItemId;
    private String menuItemName;
    private java.math.BigDecimal price;
    private String categoryName;
    private String reason;
    private String recommendationType;
    private Long score;
}
