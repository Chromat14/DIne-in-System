package com.restaurant.foodsystem.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class WaitTimeResponse {
    private int estimatedMinutes;
    private int activeChefs;
}