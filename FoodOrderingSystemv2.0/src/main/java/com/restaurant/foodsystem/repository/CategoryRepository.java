package com.restaurant.foodsystem.repository;

import com.restaurant.foodsystem.entity.Category;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CategoryRepository extends JpaRepository<Category, Long> {
}