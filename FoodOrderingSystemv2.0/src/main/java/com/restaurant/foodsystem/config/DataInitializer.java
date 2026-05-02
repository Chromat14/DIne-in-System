package com.restaurant.foodsystem.config;

import com.restaurant.foodsystem.entity.*;
import com.restaurant.foodsystem.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final AppUserRepository appUserRepository;
    private final CategoryRepository categoryRepository;
    private final MenuItemRepository menuItemRepository;
    private final RestaurantTableRepository restaurantTableRepository;
    private final SystemConfigRepository systemConfigRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    @Transactional
    public void run(String... args) {
        seedUsers();
        seedTables();
        seedSystemConfigs();
        seedMenu();
    }

    private void seedUsers() {
        if (appUserRepository.count() > 0) return;

        appUserRepository.saveAll(List.of(
                AppUser.builder().username("admin").passwordHash(passwordEncoder.encode("admin123"))
                        .fullName("System Admin").role(UserRole.ADMIN).isActive(true).build(),
                AppUser.builder().username("kitchen").passwordHash(passwordEncoder.encode("kitchen123"))
                        .fullName("Kitchen Staff").role(UserRole.KITCHEN).isActive(true).build()
        ));
    }

    private void seedTables() {
        if (restaurantTableRepository.count() > 0) return;

        restaurantTableRepository.saveAll(List.of(
                RestaurantTable.builder().tableNumber(1).location("Ground Floor").capacity(4).status(TableStatus.AVAILABLE).tableToken("T1-ABC").build(),
                RestaurantTable.builder().tableNumber(2).location("Ground Floor").capacity(2).status(TableStatus.AVAILABLE).tableToken("T2-DEF").build()
        ));
    }

    private void seedMenu() {
        if (categoryRepository.count() > 0) return;

        Category starters = categoryRepository.save(Category.builder().name("Starters").displayOrder(1).build());
        Category mainCourse = categoryRepository.save(Category.builder().name("Main Course").displayOrder(2).build());

        menuItemRepository.saveAll(List.of(
                MenuItem.builder().category(starters).name("French Fries").price(new BigDecimal("150.00")).avgPrepTime(5).stockQuantity(30).isAvailable(true).build(),
                MenuItem.builder().category(mainCourse).name("Chicken Burger").price(new BigDecimal("350.00")).avgPrepTime(12).stockQuantity(20).isAvailable(true).build()
        ));
    }

    private void seedSystemConfigs() {
        if (systemConfigRepository.findByKey("kitchen_active_chefs").isPresent()) {
            return;
        }

        systemConfigRepository.saveAll(List.of(
                SystemConfig.builder().key("kitchen_active_chefs").value("2").build(),
                SystemConfig.builder().key("restaurant_name").value("Aangan Bistro").build(),
                SystemConfig.builder().key("restaurant_tagline").value("Balanced dining for every shift").build(),
                SystemConfig.builder().key("theme_mode").value("system").build(),
                SystemConfig.builder().key("dark_mode_enabled").value("true").build(),
                SystemConfig.builder().key("theme_primary_color").value("#c75b12").build(),
                SystemConfig.builder().key("theme_accent_color").value("#1f7a6b").build(),
                SystemConfig.builder().key("theme_surface_color").value("#fffaf4").build()
        ));
    }
}
