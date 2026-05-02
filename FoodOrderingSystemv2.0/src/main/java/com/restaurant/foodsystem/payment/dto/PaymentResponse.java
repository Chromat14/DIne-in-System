package com.restaurant.foodsystem.payment.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class PaymentResponse {
    private String transactionRef;
    private String redirectUrl;
    private String message;
}