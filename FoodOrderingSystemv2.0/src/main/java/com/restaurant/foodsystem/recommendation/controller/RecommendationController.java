package com.restaurant.foodsystem.recommendation.controller;

import com.restaurant.foodsystem.recommendation.dto.RecommendationDto;
import com.restaurant.foodsystem.recommendation.service.RecommendationService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/table/recommendations")
@RequiredArgsConstructor
public class RecommendationController {

    private final RecommendationService recommendationService;

    @PostMapping("/checkout")
    public List<RecommendationDto> getCheckoutRecommendations(@RequestBody List<Long> cartItemIds) {
        return recommendationService.recommendFrequentlyBoughtTogether(cartItemIds, 5);
    }
}