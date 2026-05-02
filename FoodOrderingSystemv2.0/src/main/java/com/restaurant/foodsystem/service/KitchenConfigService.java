package com.restaurant.foodsystem.service;

import com.restaurant.foodsystem.entity.SystemConfig;
import com.restaurant.foodsystem.repository.SystemConfigRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class KitchenConfigService {

    private static final int DEFAULT_ACTIVE_CHEFS = 2;
    private final SystemConfigRepository systemConfigRepository;

    @Transactional(readOnly = true)
    public int getActiveChefs() {
        return systemConfigRepository.findByKey("kitchen_active_chefs")
                .map(SystemConfig::getValue)
                .map(this::parsePositiveInt)
                .orElse(DEFAULT_ACTIVE_CHEFS);
    }

    private int parsePositiveInt(String value) {
        try {
            int parsed = Integer.parseInt(value);
            return parsed > 0 ? parsed : DEFAULT_ACTIVE_CHEFS;
        } catch (NumberFormatException ex) {
            return DEFAULT_ACTIVE_CHEFS;
        }
    }
}
