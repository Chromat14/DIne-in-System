package com.restaurant.foodsystem.controller;

import com.restaurant.foodsystem.dto.MenuItemDto;
import com.restaurant.foodsystem.dto.MenuAutocompleteSuggestionResponse;
import com.restaurant.foodsystem.dto.MenuItemResponse;
import com.restaurant.foodsystem.service.MenuService;
import com.restaurant.foodsystem.service.MenuAutocompleteService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/menu")
@RequiredArgsConstructor
public class MenuController {

    private final MenuService menuService;
    private final MenuAutocompleteService menuAutocompleteService;

    @GetMapping
    public List<MenuItemResponse> getMenu() {
        return menuService.getAllMenuItems();
    }

    @GetMapping("/autocomplete")
    public List<MenuAutocompleteSuggestionResponse> autocomplete(
            @RequestParam("q") String query,
            @RequestParam(name = "limit", defaultValue = "8") int limit,
            @RequestParam(name = "availableOnly", defaultValue = "true") boolean availableOnly
    ) {
        return menuAutocompleteService.suggest(query, limit, availableOnly);
    }

    @PostMapping
    public MenuItemResponse createItem(@RequestBody MenuItemDto dto) {
        return menuService.createMenuItem(dto);
    }

    @PutMapping("/{id}")
    public MenuItemResponse updateItem(@PathVariable Long id, @RequestBody MenuItemDto dto) {
        return menuService.updateMenuItem(id, dto);
    }

    @DeleteMapping("/{id}")
    public void deleteItem(@PathVariable Long id) {
        menuService.deleteMenuItem(id);
    }
}
