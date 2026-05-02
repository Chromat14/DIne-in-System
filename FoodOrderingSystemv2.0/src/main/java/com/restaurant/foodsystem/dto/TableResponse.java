package com.restaurant.foodsystem.dto;

import com.restaurant.foodsystem.entity.TableStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TableResponse {
    private Long id;
    private Integer tableNumber;
    private String location;
    private Integer capacity;
    private TableStatus status;
    private String tableToken;
}
