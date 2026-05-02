package com.restaurant.foodsystem.entity;

public enum OrderStatus {
    OPEN,        // Session started
    PENDING,     // Items added, not yet cooking
    IN_PROGRESS, // Cooking (Maps to 'PREPARING' in Frontend)
    READY,       // Ready for pick up
    SERVED,      // Delivered to table
    COMPLETED,   // Finished eating
    PAID,        // Bill settled
    CANCELLED
}