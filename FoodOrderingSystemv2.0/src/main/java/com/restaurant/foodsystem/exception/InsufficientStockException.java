package com.restaurant.foodsystem.exception;

public class InsufficientStockException extends RuntimeException {
    public InsufficientStockException(String itemName, int requested, int available) {
        super("Insufficient stock for '" + itemName + "'. Requested: " + requested + ", Available: " + available);
    }
}