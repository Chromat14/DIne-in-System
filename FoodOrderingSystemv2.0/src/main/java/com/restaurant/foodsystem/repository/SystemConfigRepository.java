package com.restaurant.foodsystem.repository;

import com.restaurant.foodsystem.entity.SystemConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface SystemConfigRepository extends JpaRepository<SystemConfig, String> {
    Optional<SystemConfig> findByKey(String key);
}