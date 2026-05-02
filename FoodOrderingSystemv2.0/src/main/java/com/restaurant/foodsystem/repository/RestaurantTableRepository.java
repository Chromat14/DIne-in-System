package com.restaurant.foodsystem.repository;

import com.restaurant.foodsystem.entity.RestaurantTable;
import com.restaurant.foodsystem.entity.TableStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface RestaurantTableRepository extends JpaRepository<RestaurantTable, Long> {

    // Kiosk lookup
    Optional<RestaurantTable> findByTableToken(String tableToken);

    // For the Dashboard: "Tables Available" card
    long countByStatus(TableStatus status);
}