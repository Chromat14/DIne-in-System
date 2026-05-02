package com.restaurant.foodsystem.dto;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;

@Value
@Builder
public class MenuAutocompleteSuggestionResponse {
    Long id;
    String name;
    String categoryName;
    BigDecimal price;
    Integer stockQuantity;
    Boolean isAvailable;
}

