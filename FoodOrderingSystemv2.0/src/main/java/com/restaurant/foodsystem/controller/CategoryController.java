package com.restaurant.foodsystem.controller;

import com.restaurant.foodsystem.dto.CategoryDto;
import com.restaurant.foodsystem.dto.CategoryRequest;
import com.restaurant.foodsystem.entity.Category;
import com.restaurant.foodsystem.repository.CategoryRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/categories")
public class CategoryController {

    @Autowired
    private CategoryRepository categoryRepository;

    @GetMapping
    public List<CategoryDto> getAllCategories() {
        return categoryRepository.findAll().stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @PostMapping
    public ResponseEntity<?> createCategory(@RequestBody CategoryRequest request) {
        try {
            Category category = new Category();
            category.setName(request.getName());
            category.setDescription(request.getDescription());
            category.setDisplayOrder(request.getDisplayOrder() != null ? request.getDisplayOrder() : 0);
            category.setIsActive(true);

            Category saved = categoryRepository.save(category);
            return ResponseEntity.status(HttpStatus.CREATED).body(toDto(saved));
        } catch (DataIntegrityViolationException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body("Category name already exists.");
        }
    }

    private CategoryDto toDto(Category category) {
        CategoryDto dto = new CategoryDto();
        dto.setId(category.getId());
        dto.setName(category.getName());
        dto.setDescription(category.getDescription());
        return dto;
    }
}
