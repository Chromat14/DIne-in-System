package com.restaurant.foodsystem.repository;

import com.restaurant.foodsystem.entity.Transaction;
import com.restaurant.foodsystem.entity.PaymentStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

public interface TransactionRepository extends JpaRepository<Transaction, Long> {
    Optional<Transaction> findByTransactionRef(String transactionRef);
    boolean existsByTransactionRef(String transactionRef);
    boolean existsByOrderIdAndPaymentStatus(Long orderId, PaymentStatus paymentStatus);
    Optional<Transaction> findFirstByOrderIdAndPaymentStatusOrderByPaidAtDesc(Long orderId, PaymentStatus paymentStatus);
    Optional<Transaction> findFirstByOrderIdOrderByPaidAtDesc(Long orderId);
    List<Transaction> findAllByOrderByPaidAtDescIdDesc();
    List<Transaction> findByPaidAtGreaterThanEqualAndPaidAtLessThanOrderByPaidAtDescIdDesc(
            OffsetDateTime startInclusive,
            OffsetDateTime endExclusive
    );
}
