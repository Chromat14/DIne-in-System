package com.restaurant.foodsystem.service;

import com.restaurant.foodsystem.dto.TableResponse;
import com.restaurant.foodsystem.dto.TableSessionEvent;
import com.restaurant.foodsystem.entity.RestaurantTable;
import com.restaurant.foodsystem.entity.TableStatus;
import com.restaurant.foodsystem.repository.RestaurantTableRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TableService {

    private final RestaurantTableRepository tableRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final WaitTimeService waitTimeService;

    public List<TableResponse> getAllTables() {
        return tableRepository.findAll().stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    public TableResponse registerTable(RestaurantTable table) {
        table.setStatus(TableStatus.AVAILABLE);
        table.setTableToken("TABLE_TOKEN_T" + table.getTableNumber());
        return mapToResponse(tableRepository.save(table));
    }

    @Transactional
    public TableResponse updateStatus(Long id, String status) {
        RestaurantTable table = tableRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Table not found"));

        table.setStatus(TableStatus.valueOf(status.toUpperCase()));
        RestaurantTable savedTable = tableRepository.save(table);
        TableResponse response = mapToResponse(savedTable);
        messagingTemplate.convertAndSend("/topic/tables", response);
        if (savedTable.getTableToken() != null && !savedTable.getTableToken().isBlank()) {
            TableSessionEvent event = TableSessionEvent.builder()
                    .eventType("TABLE_STATUS_CHANGED")
                    .message("Table status updated")
                    .tableToken(savedTable.getTableToken())
                    .tableNumber(savedTable.getTableNumber())
                    .tableStatus(savedTable.getStatus())
                    .occurredAt(OffsetDateTime.now())
                    .build();
            messagingTemplate.convertAndSend("/topic/table/" + savedTable.getTableToken() + "/session", event);
        }
        return response;
    }

    @Transactional
    public void deleteTable(Long id) {
        if (!tableRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Table not found");
        }
        tableRepository.deleteById(id);
    }

    public Integer getWaitTime(String token) {
        return tableRepository.findByTableToken(token)
                .map(table -> waitTimeService.calculateEstimatedWaitTime())
                .orElse(0);
    }

    public TableResponse getByToken(String token) {
        return tableRepository.findByTableToken(token)
                .map(this::mapToResponse)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Invalid Table Token: " + token));
    }

    private TableResponse mapToResponse(RestaurantTable table) {
        return TableResponse.builder()
                .id(table.getId())
                .tableNumber(table.getTableNumber())
                .location(table.getLocation())
                .capacity(table.getCapacity())
                .status(table.getStatus())
                .tableToken(table.getTableToken())
                .build();
    }
}
