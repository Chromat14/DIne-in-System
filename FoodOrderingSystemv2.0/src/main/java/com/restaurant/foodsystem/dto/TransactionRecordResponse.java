package com.restaurant.foodsystem.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TransactionRecordResponse {
    private Long transactionId;
    private String transactionRef;
    private String paymentMethod;
    private String paymentStatus;
    private OffsetDateTime paidAt;
    private BigDecimal amount;
    private Long orderId;
    private String orderNumber;
    private String orderStatus;
    private String tableNumber;
    private Integer itemCount;
}
