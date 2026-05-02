package com.restaurant.foodsystem.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SettleOrderRequest {
    private String paymentMethod;
    private String transactionToken;
    private BigDecimal discountAmount;
}
