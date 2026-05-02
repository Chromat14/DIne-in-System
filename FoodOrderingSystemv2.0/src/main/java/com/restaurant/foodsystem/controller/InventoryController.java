package com.restaurant.foodsystem.controller;

import com.restaurant.foodsystem.dto.InventoryUpdateRequest;
import com.restaurant.foodsystem.dto.MenuItemResponse;
import com.restaurant.foodsystem.service.InventoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/inventory")
@RequiredArgsConstructor
public class InventoryController {

    private final InventoryService inventoryService;

    @GetMapping("/items")
    public List<MenuItemResponse> getInventoryItems() {
        return inventoryService.getInventoryItems();
    }

    @PatchMapping("/items/{menuItemId}")
    public MenuItemResponse updateInventory(
            @PathVariable Long menuItemId,
            @RequestBody InventoryUpdateRequest request) {
        return inventoryService.updateInventory(menuItemId, request);
    }
}
