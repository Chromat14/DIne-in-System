package com.restaurant.foodsystem.dto;

import com.restaurant.foodsystem.entity.TableStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TableSessionEvent {
    private String eventType;
    private String message;
    private Long orderId;
    private String orderNumber;
    private String orderStatus;
    private Boolean paymentRequested;
    private String tableToken;
    private Integer tableNumber;
    private TableStatus tableStatus;
    private OffsetDateTime occurredAt;
}
