package com.restaurant.foodsystem.recommendation.repository;

import com.restaurant.foodsystem.entity.OrderItem;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

@Repository
public interface RecommendationRepository extends JpaRepository<OrderItem, Long> {

    @Query(value = """
            SELECT 
                oi2.menu_item_id AS targetId, 
                COUNT(DISTINCT oi1.order_id) AS supportCount
            FROM order_items oi1
            JOIN orders o ON o.id = oi1.order_id
            JOIN order_items oi2 ON oi1.order_id = oi2.order_id
            WHERE oi1.menu_item_id IN :cartIds
              AND oi2.menu_item_id NOT IN :cartIds
              AND o.order_status IN ('READY', 'SERVED', 'PAID', 'COMPLETED')
            GROUP BY oi2.menu_item_id
            HAVING COUNT(*) >= 1
            ORDER BY supportCount DESC
            LIMIT :limit
            """, nativeQuery = true)
    List<Map<String, Object>> findRelatedItems(@Param("cartIds") List<Long> cartIds, @Param("limit") int limit);

    @Query(value = """
            SELECT
                oi.menu_item_id AS menuItemId,
                SUM(oi.quantity) AS unitsSold,
                COUNT(DISTINCT oi.order_id) AS orderCount
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            WHERE o.order_status IN ('READY', 'SERVED', 'PAID', 'COMPLETED')
            GROUP BY oi.menu_item_id
            ORDER BY unitsSold DESC, orderCount DESC
            LIMIT :limit
            """, nativeQuery = true)
    List<Map<String, Object>> findTopSellingItems(@Param("limit") int limit);

    @Query(value = """
            SELECT
                oi.menu_item_id AS menuItemId,
                SUM(oi.quantity) AS unitsSold,
                COUNT(DISTINCT oi.order_id) AS orderCount
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            WHERE o.order_status IN ('READY', 'SERVED', 'PAID', 'COMPLETED')
              AND o.placed_at >= :since
            GROUP BY oi.menu_item_id
            ORDER BY unitsSold DESC, orderCount DESC
            LIMIT :limit
            """, nativeQuery = true)
    List<Map<String, Object>> findTopSellingItemsSince(@Param("since") OffsetDateTime since, @Param("limit") int limit);

    @Query(value = """
            SELECT
                oi.menu_item_id AS menuItemId,
                COUNT(DISTINCT oi.order_id) AS orderCount
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            WHERE o.order_status IN ('READY', 'SERVED', 'PAID', 'COMPLETED')
              AND oi.menu_item_id IN :itemIds
            GROUP BY oi.menu_item_id
            """, nativeQuery = true)
    List<Map<String, Object>> findOrderCountsForItems(@Param("itemIds") List<Long> itemIds);

    @Query(value = """
            SELECT COUNT(DISTINCT o.id)
            FROM orders o
            WHERE o.order_status IN ('READY', 'SERVED', 'PAID', 'COMPLETED')
            """, nativeQuery = true)
    Long countCompletedOrders();

    @Query(value = """
            SELECT COUNT(DISTINCT o.id)
            FROM orders o
            WHERE o.order_status IN ('READY', 'SERVED', 'PAID', 'COMPLETED')
              AND o.placed_at >= :since
            """, nativeQuery = true)
    Long countCompletedOrdersSince(@Param("since") OffsetDateTime since);
}
