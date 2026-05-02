package com.restaurant.foodsystem.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import lombok.Data;

@Entity
@Data

public class RestaurantSettings {

        @Id
        private Long id = 1L; // Always use ID 1 for global settings
        private String restaurantName;
        private String logoUrl;
        private String contactEmail;
        private String address;
    }

