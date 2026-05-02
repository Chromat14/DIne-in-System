package com.restaurant.foodsystem.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class BusyHourDto {
    private String hour;
    private Long orders;
}