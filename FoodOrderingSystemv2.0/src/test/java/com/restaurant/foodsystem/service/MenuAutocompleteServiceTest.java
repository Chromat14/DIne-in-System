package com.restaurant.foodsystem.service;

import com.restaurant.foodsystem.dto.MenuAutocompleteSuggestionResponse;
import com.restaurant.foodsystem.entity.Category;
import com.restaurant.foodsystem.entity.MenuItem;
import com.restaurant.foodsystem.repository.MenuItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MenuAutocompleteServiceTest {

    @Mock
    private MenuItemRepository menuItemRepository;

    private MenuAutocompleteService menuAutocompleteService;

    private final AtomicReference<List<MenuItem>> currentItems = new AtomicReference<>();

    @BeforeEach
    void setUp() {
        menuAutocompleteService = new MenuAutocompleteService(menuItemRepository);

        when(menuItemRepository.findAll()).thenAnswer(invocation -> currentItems.get());
        when(menuItemRepository.findAllById(any())).thenAnswer(invocation -> {
            Iterable<Long> ids = invocation.getArgument(0);
            HashSet<Long> idSet = new HashSet<>();
            ids.forEach(idSet::add);
            return currentItems.get().stream()
                    .filter(item -> idSet.contains(item.getId()))
                    .toList();
        });
    }

    @Test
    void suggest_returnsPrefixMatchesAndFiltersUnavailableWhenRequested() {
        currentItems.set(new ArrayList<>(List.of(
                item(1L, "Chicken Burger", 12, 8, true, "Main"),
                item(2L, "Chicken Momo", 15, 0, true, "Main"),
                item(3L, "Chocolate Shake", 7, 10, true, "Beverage")
        )));

        menuAutocompleteService.rebuildIndex();
        List<MenuAutocompleteSuggestionResponse> result = menuAutocompleteService.suggest("chi", 5, true);

        assertEquals(List.of(1L), result.stream().map(MenuAutocompleteSuggestionResponse::getId).toList());
    }

    @Test
    void suggest_rebuildsOnDirtyAndUsesLatestMenuSnapshot() {
        currentItems.set(new ArrayList<>(List.of(
                item(11L, "Veg Momo", 12, 5, true, "Main")
        )));
        menuAutocompleteService.rebuildIndex();

        List<MenuAutocompleteSuggestionResponse> first = menuAutocompleteService.suggest("veg", 5, true);
        assertEquals(List.of(11L), first.stream().map(MenuAutocompleteSuggestionResponse::getId).toList());

        currentItems.set(new ArrayList<>(List.of(
                item(22L, "Cold Coffee", 5, 9, true, "Beverage")
        )));
        menuAutocompleteService.markDirty();

        List<MenuAutocompleteSuggestionResponse> second = menuAutocompleteService.suggest("cof", 5, true);
        assertEquals(List.of(22L), second.stream().map(MenuAutocompleteSuggestionResponse::getId).toList());
    }

    private MenuItem item(Long id, String name, int prepTime, int stock, boolean available, String categoryName) {
        Category category = Category.builder()
                .id(id + 1000)
                .name(categoryName)
                .build();

        return MenuItem.builder()
                .id(id)
                .name(name)
                .avgPrepTime(prepTime)
                .stockQuantity(stock)
                .isAvailable(available)
                .price(new BigDecimal("100.00"))
                .category(category)
                .build();
    }
}

