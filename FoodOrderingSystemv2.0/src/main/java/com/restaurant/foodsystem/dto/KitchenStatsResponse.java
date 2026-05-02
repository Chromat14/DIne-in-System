package com.restaurant.foodsystem.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class KitchenStatsResponse {
    private int ordersCompletedToday;
    private int averagePrepTime;
    private int activeOrders;
}