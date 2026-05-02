package com.restaurant.foodsystem.repository;

import com.restaurant.foodsystem.entity.MenuItem;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface MenuItemRepository extends JpaRepository<MenuItem, Long> {
    @Override
    @EntityGraph(attributePaths = {"category"})
    List<MenuItem> findAll();

    @EntityGraph(attributePaths = {"category"})
    List<MenuItem> findByIsAvailableTrue();

    // ADD THIS LINE - It is likely why your bean creation is failing
    List<MenuItem> findByCategoryId(Long categoryId);
}