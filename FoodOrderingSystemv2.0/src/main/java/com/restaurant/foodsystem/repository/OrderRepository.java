package com.restaurant.foodsystem.repository;

import com.restaurant.foodsystem.entity.Order;
import com.restaurant.foodsystem.entity.OrderStatus;
import com.restaurant.foodsystem.entity.RestaurantTable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Repository
public interface OrderRepository extends JpaRepository<Order, Long> {

    Optional<Order> findByRestaurantTableAndOrderStatus(RestaurantTable table, OrderStatus status);
    Optional<Order> findFirstByRestaurantTableAndOrderStatusInOrderByPlacedAtDesc(RestaurantTable table, List<OrderStatus> statuses);
    List<Order> findByOrderStatusInOrderByPlacedAtAsc(List<OrderStatus> statuses);

    @Query("SELECT SUM(o.totalAmount) FROM Order o WHERE o.orderStatus IN " +
            "(com.restaurant.foodsystem.entity.OrderStatus.PAID, " +
            "com.restaurant.foodsystem.entity.OrderStatus.READY, " +
            "com.restaurant.foodsystem.entity.OrderStatus.SERVED)")
    BigDecimal calculateTotalRevenue();

    @Query("SELECT COUNT(o) FROM Order o WHERE o.orderStatus IN " +
            "(com.restaurant.foodsystem.entity.OrderStatus.PENDING, " +
            "com.restaurant.foodsystem.entity.OrderStatus.IN_PROGRESS)")
    long countActiveOrders();

    @Query(value = "SELECT TO_CHAR(placed_at, 'HH12 AM') as hour, COUNT(*) as orders " +
            "FROM orders GROUP BY hour ORDER BY hour", nativeQuery = true)
    List<Map<String, Object>> findHourlyOrderCount();

    @Query(value = "SELECT oi_other.menu_item_id, m.name, COUNT(*) as frequency " +
            "FROM order_items oi_target " +
            "JOIN order_items oi_other ON oi_target.order_id = oi_other.order_id " +
            "JOIN menu_items m ON oi_other.menu_item_id = m.id " +
            "WHERE oi_target.menu_item_id IN :cartItemIds " +
            "AND oi_other.menu_item_id NOT IN :cartItemIds " +
            "GROUP BY oi_other.menu_item_id, m.name " +
            "ORDER BY frequency DESC " +
            "LIMIT :limit", nativeQuery = true)
    List<Map<String, Object>> findFrequentlyBoughtTogether(
            @org.springframework.data.repository.query.Param("cartItemIds") List<Long> cartItemIds,
            @org.springframework.data.repository.query.Param("limit") int limit
    );
}
