package com.restaurant.foodsystem.service;

import com.restaurant.foodsystem.dto.MenuItemDto;
import com.restaurant.foodsystem.dto.MenuItemResponse;
import com.restaurant.foodsystem.entity.Category;
import com.restaurant.foodsystem.entity.MenuItem;
import com.restaurant.foodsystem.repository.CategoryRepository;
import com.restaurant.foodsystem.repository.MenuItemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MenuService {

    private final MenuItemRepository menuItemRepository;
    private final CategoryRepository categoryRepository; // Added for lookups
    private final SimpMessagingTemplate messagingTemplate;
    private final MenuAutocompleteService menuAutocompleteService;

    @Transactional(readOnly = true)
    public List<MenuItemResponse> getAllMenuItems() {
        return menuItemRepository.findAll().stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public MenuItemResponse createMenuItem(MenuItemDto dto) {
        // Validation logic moved from MenuItemController
        Category category = categoryRepository.findById(dto.getCategoryId())
                .orElseThrow(() -> new RuntimeException("Category not found with ID: " + dto.getCategoryId()));

        MenuItem item = MenuItem.builder()
                .name(dto.getName())
                .description(dto.getDescription())
                .price(dto.getPrice())
                .avgPrepTime(dto.getAvgPrepTime() != null ? dto.getAvgPrepTime() : 15)
                .stockQuantity(normalizeStock(dto.getStockQuantity()))
                .isAvailable(resolveAvailability(dto.getIsAvailable(), normalizeStock(dto.getStockQuantity()), true))
                .category(category)
                .imageUrl(dto.getImageUrl())
                .build();

        MenuItem savedItem = menuItemRepository.save(item);
        notifyMenuUpdated(savedItem);
        menuAutocompleteService.markDirty();
        return mapToResponse(savedItem);
    }

    @Transactional
    public MenuItemResponse updateMenuItem(Long id, MenuItemDto dto) {
        MenuItem item = menuItemRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Menu item not found with ID: " + id));

        Category category = categoryRepository.findById(dto.getCategoryId())
                .orElseThrow(() -> new RuntimeException("Category not found with ID: " + dto.getCategoryId()));

        // Field updates with session management
        item.setName(dto.getName());
        item.setDescription(dto.getDescription());
        item.setPrice(dto.getPrice());
        item.setAvgPrepTime(dto.getAvgPrepTime());
        int updatedStock = normalizeStock(dto.getStockQuantity() != null ? dto.getStockQuantity() : item.getStockQuantity());
        item.setStockQuantity(updatedStock);
        item.setIsAvailable(resolveAvailability(dto.getIsAvailable(), updatedStock, item.getIsAvailable()));
        item.setCategory(category);
        item.setImageUrl(dto.getImageUrl());

        MenuItem savedItem = menuItemRepository.save(item);
        notifyMenuUpdated(savedItem);
        menuAutocompleteService.markDirty();
        return mapToResponse(savedItem);
    }

    @Transactional
    public void deleteMenuItem(Long id) {
        if (!menuItemRepository.existsById(id)) {
            throw new RuntimeException("Cannot delete. Item not found with ID: " + id);
        }
        menuItemRepository.deleteById(id);
        messagingTemplate.convertAndSend("/topic/menu", "refresh");
        menuAutocompleteService.markDirty();
    }

    private int normalizeStock(Integer stockQuantity) {
        return Math.max(stockQuantity != null ? stockQuantity : 0, 0);
    }

    private boolean resolveAvailability(Boolean requestedAvailability, int stockQuantity, boolean fallbackAvailability) {
        if (stockQuantity <= 0) {
            return false;
        }
        if (requestedAvailability != null) {
            return requestedAvailability;
        }
        return fallbackAvailability;
    }

    private void notifyMenuUpdated(MenuItem item) {
        messagingTemplate.convertAndSend("/topic/menu", mapToResponse(item));
    }

    private MenuItemResponse mapToResponse(MenuItem item) {
        return MenuItemResponse.builder()
                .id(item.getId())
                .name(item.getName())
                .description(item.getDescription())
                .price(item.getPrice())
                .avgPrepTime(item.getAvgPrepTime())
                .stockQuantity(item.getStockQuantity())
                .isAvailable(Boolean.TRUE.equals(item.getIsAvailable()) && item.getStockQuantity() > 0)
                .imageUrl(item.getImageUrl())
                .categoryId(item.getCategory() != null ? item.getCategory().getId() : null)
                .categoryName(item.getCategory() != null ? item.getCategory().getName() : "Uncategorized")
                .build();
    }
}
