package com.restaurant.foodsystem.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "system_configs")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class SystemConfig {

    @Id
    @Column(name = "config_key")
    private String key; // e.g., "restaurant_name"

    @Column(name = "config_value", columnDefinition = "TEXT")
    private String value;
}