package com.restaurant.foodsystem.payment.dto;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class PaymentInitiateRequest {
    private Long orderId;
    private NepalPaymentProvider provider;
    private BigDecimal amount;
}