package com.restaurant.foodsystem.payment.dto;

import lombok.Data;

@Data
public class PaymentCallbackRequest {
    private String transactionRef;
    private String providerRef;
    private String status;
}