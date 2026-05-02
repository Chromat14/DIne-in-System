package com.restaurant.foodsystem.service;

import com.restaurant.foodsystem.dto.BusyHourDto;
import com.restaurant.foodsystem.dto.TopSellingItemDto;
import com.restaurant.foodsystem.repository.OrderRepository;
import com.restaurant.foodsystem.repository.OrderItemAnalyticsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AdminAnalyticsService {

    private final OrderRepository orderRepository;
    private final OrderItemAnalyticsRepository orderItemAnalyticsRepository;

    public List<BusyHourDto> getBusyHours() {
        List<Map<String, Object>> rawData = orderRepository.findHourlyOrderCount();
        return rawData.stream()
                .map(row -> new BusyHourDto(
                        (String) row.get("hour"),
                        ((Number) row.get("orders")).longValue()
                ))
                .toList();
    }

    public List<TopSellingItemDto> getTopSellingItems() {
        return orderItemAnalyticsRepository.findTopSellingItems()
                .stream()
                .map(p -> new TopSellingItemDto(p.getItemName(), p.getTotalSold()))
                .toList();
    }
}