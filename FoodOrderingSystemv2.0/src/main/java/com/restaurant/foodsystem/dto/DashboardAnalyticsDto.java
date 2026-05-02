package com.restaurant.foodsystem.dto;

import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Data
@Builder
public class DashboardAnalyticsDto {
    private BigDecimal totalRevenue;
    private long activeOrders;
    private long tablesAvailable;
    private List<BestSellerDto> bestSellers;
    private Map<String, Long> hourlyTraffic; // e.g., {"10:00": 5, "12:00": 15}

    @Data
    @Builder
    public static class BestSellerDto {
        private String name;
        private long count;
    }
}