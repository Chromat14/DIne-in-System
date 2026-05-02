package com.restaurant.foodsystem.payment.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.math.BigDecimal;

@Getter
@AllArgsConstructor
public class AdminPaymentNotification {
    private Long orderId;
    private String orderNumber;
    private String paymentStatus;
    private String transactionRef;
    private BigDecimal amount;
}