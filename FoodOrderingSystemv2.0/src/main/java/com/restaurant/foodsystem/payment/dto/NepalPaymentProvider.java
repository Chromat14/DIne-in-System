package com.restaurant.foodsystem.payment.dto;

public enum NepalPaymentProvider {
    ESEWA,
    KHALTI,
    DYNAMIC_QR, // For the FonePay/eSewa QR flow
    CASH,
    CARD,
    MOBILE_BANKING


}