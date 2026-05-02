package com.restaurant.foodsystem.entity;

import com.fasterxml.jackson.annotation.JsonManagedReference;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
@Entity
@Table(name = "orders")
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class Order {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "order_number", nullable = false, unique = true, length = 50)
    private String orderNumber;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "restaurant_table_id", nullable = false)
    private RestaurantTable restaurantTable;

    @Enumerated(EnumType.STRING)
    @Column(name = "order_status", nullable = false, length = 30)
    private OrderStatus orderStatus;

    @Builder.Default
    @Column(name = "total_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalAmount = BigDecimal.ZERO;

    @Builder.Default
    @Column(name = "service_charge_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal serviceChargeAmount = BigDecimal.ZERO;

    @Builder.Default
    @Column(name = "discount_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal discountAmount = BigDecimal.ZERO;

    @Column(name = "placed_at", nullable = false)
    private OffsetDateTime placedAt;

    @Column(name = "preparation_started_at")
    private OffsetDateTime preparationStartedAt;

    @Column(name = "completed_at")
    private OffsetDateTime completedAt;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Builder.Default
    @Column(name = "payment_requested")
    private Boolean paymentRequested = false;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @Builder.Default
    @JsonManagedReference // Parent side
    private List<OrderItem> orderItems = new ArrayList<>();

    public Long getActualPrepTimeMinutes() {
        if (preparationStartedAt != null && completedAt != null) {
            return Duration.between(preparationStartedAt, completedAt).toMinutes();
        }
        return 0L;
    }
}
