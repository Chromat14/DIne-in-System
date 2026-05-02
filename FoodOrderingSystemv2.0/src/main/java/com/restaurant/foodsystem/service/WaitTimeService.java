package com.restaurant.foodsystem.service;

import com.restaurant.foodsystem.entity.Order;
import com.restaurant.foodsystem.entity.OrderStatus;
import com.restaurant.foodsystem.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional; // Import this

import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class WaitTimeService {

    private final OrderRepository orderRepository;
    private final KitchenConfigService kitchenConfigService;
    private final KitchenPriorityService kitchenPriorityService = new KitchenPriorityService();

    private static final Set<OrderStatus> ACTIVE_ORDER_STATUSES = Set.of(
            OrderStatus.OPEN, OrderStatus.PENDING, OrderStatus.IN_PROGRESS
    );

    @Transactional(readOnly = true)
    public int calculateEstimatedWaitTime(int activeChefs) {
        List<Order> orders = getActiveOrdersInQueue();

        int totalPrepMinutes = orders.stream()
                .mapToInt(this::estimateRemainingWorkMinutes)
                .sum();

        if (totalPrepMinutes == 0) return 0;
        if (activeChefs <= 0) return totalPrepMinutes;

        return (int) Math.ceil((double) totalPrepMinutes / activeChefs);
    }

    @Transactional(readOnly = true)
    public int calculateEstimatedWaitTime() {
        return calculateEstimatedWaitTime(kitchenConfigService.getActiveChefs());
    }

    @Transactional(readOnly = true)
    public int calculateOrderWaitTime(Order targetOrder) {
        if (targetOrder == null || !ACTIVE_ORDER_STATUSES.contains(targetOrder.getOrderStatus())) {
            return 0;
        }

        int activeChefs = kitchenConfigService.getActiveChefs();
        List<Order> queue = getActiveOrdersInQueue();
        int backlogMinutes = 0;

        for (Order order : queue) {
            int orderWork = estimateRemainingWorkMinutes(order);
            if (order.getId().equals(targetOrder.getId())) {
                int eta = (int) Math.ceil((double) (backlogMinutes + orderWork) / Math.max(activeChefs, 1));
                return Math.max(eta, minEtaMinutes(order.getOrderStatus()));
            }
            backlogMinutes += orderWork;
        }

        return 0;
    }

    private List<Order> getActiveOrdersInQueue() {
        List<Order> activeQueue = orderRepository.findAll().stream()
                .filter(order -> order != null && order.getOrderStatus() != null && ACTIVE_ORDER_STATUSES.contains(order.getOrderStatus()))
                .toList();

        return kitchenPriorityService.sortKitchenQueue(activeQueue);
    }

    private int estimateRemainingWorkMinutes(Order order) {
        return kitchenPriorityService.estimateRemainingWorkMinutes(order);
    }

    private int minEtaMinutes(OrderStatus status) {
        if (status == OrderStatus.IN_PROGRESS) {
            return 2;
        }
        return 5;
    }
}
