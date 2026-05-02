package com.restaurant.foodsystem.service;

import com.restaurant.foodsystem.dto.BrandingThemeResponse;
import com.restaurant.foodsystem.entity.SystemConfig;
import com.restaurant.foodsystem.repository.SystemConfigRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class BrandingService {

    private final SystemConfigRepository repository;

    public Map<String, String> getAllConfigs() {
        return repository.findAll().stream()
                .collect(Collectors.toMap(SystemConfig::getKey, SystemConfig::getValue));
    }

    public BrandingThemeResponse getThemeSettings() {
        Map<String, String> configs = getAllConfigs();
        return BrandingThemeResponse.builder()
                .restaurantName(configs.getOrDefault("restaurant_name", "Food Ordering System"))
                .tagline(configs.getOrDefault("restaurant_tagline", "Fresh service from table to kitchen"))
                .defaultThemeMode(normalizeThemeMode(configs.getOrDefault("theme_mode", "system")))
                .darkModeEnabled(Boolean.parseBoolean(configs.getOrDefault("dark_mode_enabled", "true")))
                .primaryColor(configs.getOrDefault("theme_primary_color", "#c75b12"))
                .accentColor(configs.getOrDefault("theme_accent_color", "#1f7a6b"))
                .surfaceColor(configs.getOrDefault("theme_surface_color", "#fffaf4"))
                .build();
    }

    public void updateConfig(String key, String value) {
        SystemConfig config = repository.findByKey(key)
                .orElse(new SystemConfig(key, value));
        config.setValue(value);
        repository.save(config);
    }

    private String normalizeThemeMode(String mode) {
        return switch (mode == null ? "system" : mode.toLowerCase()) {
            case "light", "dark", "system" -> mode.toLowerCase();
            default -> "system";
        };
    }
}
