package com.restaurant.foodsystem.service;

import com.restaurant.foodsystem.dto.InventoryUpdateRequest;
import com.restaurant.foodsystem.dto.MenuItemResponse;
import com.restaurant.foodsystem.entity.MenuItem;
import com.restaurant.foodsystem.repository.MenuItemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class InventoryService {

    private final MenuItemRepository menuItemRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final MenuAutocompleteService menuAutocompleteService;

    @Transactional(readOnly = true)
    public List<MenuItemResponse> getInventoryItems() {
        return menuItemRepository.findAll().stream()
                .sorted(Comparator.comparing(MenuItem::getName, String.CASE_INSENSITIVE_ORDER))
                .map(this::mapToResponse)
                .toList();
    }

    @Transactional
    public MenuItemResponse updateInventory(Long menuItemId, InventoryUpdateRequest request) {
        MenuItem item = menuItemRepository.findById(menuItemId)
                .orElseThrow(() -> new RuntimeException("Menu item not found with ID: " + menuItemId));

        int currentStock = item.getStockQuantity() != null ? item.getStockQuantity() : 0;
        int nextStock = currentStock;

        if (request.getStockQuantity() != null) {
            nextStock = request.getStockQuantity();
        } else if (request.getStockAdjustment() != null) {
            nextStock = currentStock + request.getStockAdjustment();
        }

        if (nextStock < 0) {
            throw new RuntimeException("Stock quantity cannot be negative.");
        }

        item.setStockQuantity(nextStock);
        item.setIsAvailable(resolveAvailability(request.getIsAvailable(), nextStock, item.getIsAvailable()));

        MenuItem savedItem = menuItemRepository.save(item);
        MenuItemResponse response = mapToResponse(savedItem);
        messagingTemplate.convertAndSend("/topic/menu", response);
        menuAutocompleteService.markDirty();
        return response;
    }

    private Boolean resolveAvailability(Boolean requestedAvailability, int stockQuantity, Boolean currentAvailability) {
        if (stockQuantity <= 0) {
            return false;
        }
        if (requestedAvailability != null) {
            return requestedAvailability;
        }
        return currentAvailability != null ? currentAvailability : true;
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
