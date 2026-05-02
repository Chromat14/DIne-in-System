package com.restaurant.foodsystem.repository;

import com.restaurant.foodsystem.entity.OrderItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface OrderItemAnalyticsRepository extends JpaRepository<OrderItem, Long> {

    @Query(value = """
            SELECT mi.name AS itemName,
                   SUM(oi.quantity) AS totalSold
            FROM order_items oi
            JOIN menu_items mi ON mi.id = oi.menu_item_id
            GROUP BY mi.name
            ORDER BY totalSold DESC
            LIMIT 10
            """, nativeQuery = true)
    List<TopSellingItemProjection> findTopSellingItems();
}