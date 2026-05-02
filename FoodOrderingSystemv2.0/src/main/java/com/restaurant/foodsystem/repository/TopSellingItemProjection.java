package com.restaurant.foodsystem.repository;

public interface TopSellingItemProjection {
    String getItemName();
    Long getTotalSold();
}