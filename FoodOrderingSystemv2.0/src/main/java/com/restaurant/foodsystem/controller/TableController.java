package com.restaurant.foodsystem.controller;

import com.restaurant.foodsystem.dto.TableResponse;
import com.restaurant.foodsystem.entity.RestaurantTable;
import com.restaurant.foodsystem.service.TableService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/table")
@RequiredArgsConstructor
public class TableController {

    private final TableService tableService;

    @GetMapping("/all")
    public ResponseEntity<List<TableResponse>> getAllTables() {
        return ResponseEntity.ok(tableService.getAllTables());
    }

    @GetMapping("/details")
    public ResponseEntity<TableResponse> getTableDetails(@RequestParam String token) {
        return ResponseEntity.ok(tableService.getByToken(token));
    }

    @PostMapping("/register")
    public ResponseEntity<TableResponse> registerTable(@RequestBody RestaurantTable request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(tableService.registerTable(request));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<?> updateStatus(@PathVariable Long id, @RequestParam String status) {
        return ResponseEntity.ok(tableService.updateStatus(id, status));
    }

    @GetMapping("/wait-time")
    public ResponseEntity<Integer> getWaitTime(@RequestParam String token) {
        return ResponseEntity.ok(tableService.getWaitTime(token));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteTable(@PathVariable Long id) {
        tableService.deleteTable(id);
        return ResponseEntity.noContent().build();
    }
}
