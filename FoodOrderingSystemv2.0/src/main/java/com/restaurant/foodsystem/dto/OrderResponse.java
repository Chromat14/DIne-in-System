package com.restaurant.foodsystem.dto;

import lombok.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderResponse {
    private Long orderId;
    private String orderNumber;
    private String tableNumber;
    private String orderStatus;
    private BigDecimal totalAmount;
    private BigDecimal serviceCharge; // Added for the Admin Receipt
    private BigDecimal discountAmount;
    private BigDecimal subtotal;      // Changed from subTotal to subtotal to match setter calls
    private OffsetDateTime placedAt;
    private String notes;
    private Boolean paymentRequested;
    private List<OrderItemResponse> items;
    private Integer estimatedWaitTime;
}
