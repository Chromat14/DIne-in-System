package com.restaurant.foodsystem.controller;

import com.restaurant.foodsystem.dto.BrandingThemeResponse;
import com.restaurant.foodsystem.service.BrandingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin/branding")
@RequiredArgsConstructor
public class BrandingController {

    private final BrandingService brandingService;

    @GetMapping
    public ResponseEntity<Map<String, String>> getBranding() {
        return ResponseEntity.ok(brandingService.getAllConfigs());
    }

    @GetMapping("/theme")
    public ResponseEntity<BrandingThemeResponse> getThemeSettings() {
        return ResponseEntity.ok(brandingService.getThemeSettings());
    }

    @PostMapping("/update")
    public ResponseEntity<String> updateBranding(@RequestBody Map<String, String> configs) {
        configs.forEach(brandingService::updateConfig);
        return ResponseEntity.ok("Branding updated successfully");
    }
}
