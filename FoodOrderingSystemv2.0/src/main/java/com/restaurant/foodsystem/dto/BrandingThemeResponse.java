package com.restaurant.foodsystem.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BrandingThemeResponse {
    private String restaurantName;
    private String tagline;
    private String defaultThemeMode;
    private boolean darkModeEnabled;
    private String primaryColor;
    private String accentColor;
    private String surfaceColor;
}
