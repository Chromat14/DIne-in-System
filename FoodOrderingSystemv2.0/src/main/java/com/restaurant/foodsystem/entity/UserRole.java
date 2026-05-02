package com.restaurant.foodsystem.entity;

import com.fasterxml.jackson.annotation.JsonCreator;

public enum UserRole {
    ADMIN,
    KITCHEN,
    USER;

    @JsonCreator
    public static UserRole fromString(String value) {
        if (value == null) return null;
        // Strips "ROLE_" if it exists and converts to uppercase
        return UserRole.valueOf(value.replace("ROLE_", "").toUpperCase());
    }
}