package com.restaurant.foodsystem.recommendation.repository;

public interface FrequentPairProjection {
    Long getItemA();
    Long getItemB();
    Long getSupportCount();
}