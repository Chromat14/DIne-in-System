package com.restaurant.foodsystem.payment.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.restaurant.foodsystem.dto.OrderResponse;
import com.restaurant.foodsystem.dto.SettleOrderRequest;
import com.restaurant.foodsystem.entity.*;
import com.restaurant.foodsystem.payment.dto.NepalPaymentProvider;
import com.restaurant.foodsystem.payment.dto.PaymentCallbackRequest;
import com.restaurant.foodsystem.payment.dto.PaymentInitiateRequest;
import com.restaurant.foodsystem.payment.dto.PaymentResponse;
import com.restaurant.foodsystem.repository.OrderRepository;
import com.restaurant.foodsystem.repository.TransactionRepository;
import com.restaurant.foodsystem.service.OrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PaymentService {

    private static final String ESEWA_SIGNED_FIELDS = "total_amount,transaction_uuid,product_code";

    private final OrderRepository orderRepository;
    private final TransactionRepository transactionRepository;
    private final OrderService orderService;
    private final ObjectMapper objectMapper;

    @Value("${app.payment.khalti.verify-url:https://khalti.com/api/v2/payment/verify/}")
    private String khaltiVerifyUrl;

    @Value("${app.payment.khalti.secret-key:}")
    private String khaltiSecretKey;

    @Value("${app.payment.esewa.form-url:https://rc-epay.esewa.com.np/api/epay/main/v2/form}")
    private String esewaFormUrl;

    @Value("${app.payment.esewa.status-url:https://rc.esewa.com.np/api/epay/transaction/status/}")
    private String esewaStatusUrl;

    @Value("${app.payment.esewa.product-code:EPAYTEST}")
    private String esewaProductCode;

    @Value("${app.payment.esewa.secret-key:8gBm/:&EnhH.1/q(}")
    private String esewaSecretKey;

    @Value("${app.payment.esewa.success-url:http://localhost:8080/api/v1/table/payments/esewa/success}")
    private String esewaSuccessUrl;

    @Value("${app.payment.esewa.failure-url:http://localhost:8080/api/v1/table/payments/esewa/failure}")
    private String esewaFailureUrl;

    private final HttpClient httpClient = HttpClient.newHttpClient();

    @Transactional
    public PaymentResponse initiatePayment(PaymentInitiateRequest request) {
        Order order = orderRepository.findById(request.getOrderId())
                .orElseThrow(() -> new RuntimeException("Order not found"));

        if (order.getOrderStatus() == OrderStatus.PAID) {
            throw new RuntimeException("Order already settled");
        }

        String transactionRef = "NP-" + UUID.randomUUID().toString().substring(0, 12).toUpperCase(Locale.ROOT);
        BigDecimal payableAmount = calculatePayableAmount(order);
        PaymentMethod paymentMethod = mapProvider(request.getProvider());

        Transaction transaction = Transaction.builder()
                .order(order)
                .transactionRef(transactionRef)
                .amount(payableAmount)
                .paymentMethod(paymentMethod)
                .paymentStatus(PaymentStatus.PENDING)
                .build();
        transactionRepository.save(transaction);

        String redirectUrl = switch (request.getProvider()) {
            case ESEWA -> buildEsewaRedirectUrl(transactionRef, payableAmount);
            case KHALTI, MOBILE_BANKING, CARD, CASH, DYNAMIC_QR -> "";
        };

        return new PaymentResponse(transactionRef, redirectUrl, "Payment initiated successfully");
    }

    @Transactional
    public void completePayment(PaymentCallbackRequest request) {
        Transaction transaction = transactionRepository.findByTransactionRef(request.getTransactionRef())
                .orElseThrow(() -> new RuntimeException("Transaction not found"));

        if (request.getStatus() == null || request.getStatus().isBlank()) {
            throw new RuntimeException("Payment status is required");
        }

        if (!isSuccessStatus(request.getStatus())) {
            transaction.setPaymentStatus(PaymentStatus.FAILED);
            transactionRepository.save(transaction);
            throw new RuntimeException("Payment failed with status: " + request.getStatus());
        }

        if (transaction.getPaymentStatus() == PaymentStatus.SUCCESS && transaction.getOrder().getOrderStatus() == OrderStatus.PAID) {
            return;
        }

        boolean verified = verifyWithProvider(transaction, request.getProviderRef());
        if (!verified) {
            transaction.setPaymentStatus(PaymentStatus.FAILED);
            transactionRepository.save(transaction);
            throw new RuntimeException("Gateway verification failed");
        }

        transaction.setPaymentStatus(PaymentStatus.SUCCESS);
        transaction.setPaidAt(OffsetDateTime.now());
        transactionRepository.save(transaction);

        OrderResponse settledOrder = orderService.settleOrder(
                transaction.getOrder().getId(),
                SettleOrderRequest.builder()
                        .paymentMethod(transaction.getPaymentMethod().name())
                        .transactionToken(transaction.getTransactionRef())
                        .build()
        );

        // Unified admin payment notification is emitted by OrderService.settleOrder(...)
    }

    @Transactional
    public void completeEsewaFromRedirectData(String encodedData) {
        if (encodedData == null || encodedData.isBlank()) {
            throw new RuntimeException("Missing eSewa callback data");
        }

        try {
            byte[] decoded = Base64.getDecoder().decode(encodedData);
            String json = new String(decoded, StandardCharsets.UTF_8);
            Map<String, Object> payload = objectMapper.readValue(json, new TypeReference<>() {});

            String transactionRef = getAsString(payload, "transaction_uuid");
            String providerRef = getAsString(payload, "transaction_code");
            String status = getAsString(payload, "status");

            PaymentCallbackRequest callbackRequest = new PaymentCallbackRequest();
            callbackRequest.setTransactionRef(transactionRef);
            callbackRequest.setProviderRef(providerRef);
            callbackRequest.setStatus(status);

            completePayment(callbackRequest);
        } catch (IllegalArgumentException ex) {
            throw new RuntimeException("Invalid eSewa callback payload", ex);
        } catch (Exception ex) {
            throw new RuntimeException("Failed to process eSewa callback", ex);
        }
    }

    private boolean verifyWithProvider(Transaction transaction, String providerRef) {
        return switch (transaction.getPaymentMethod()) {
            case ESEWA -> verifyEsewa(transaction, providerRef);
            case KHALTI -> verifyKhalti(providerRef, transaction.getAmount());
            default -> true;
        };
    }

    private boolean verifyKhalti(String token, BigDecimal amount) {
        if (khaltiSecretKey == null || khaltiSecretKey.isBlank()) {
            throw new RuntimeException("Khalti secret key is not configured");
        }

        if (token == null || token.isBlank()) {
            throw new RuntimeException("Missing Khalti token");
        }

        long amountInPaisa = amount.multiply(new BigDecimal("100")).setScale(0, RoundingMode.HALF_UP).longValue();
        String body = "token=" + urlEncode(token) + "&amount=" + amountInPaisa;

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(khaltiVerifyUrl))
                .header("Authorization", "Key " + khaltiSecretKey)
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();

        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                return false;
            }

            Map<String, Object> parsed = objectMapper.readValue(response.body(), new TypeReference<>() {});
            return parsed.containsKey("idx") || parsed.containsKey("token");
        } catch (Exception ex) {
            throw new RuntimeException("Khalti verification request failed", ex);
        }
    }

    private boolean verifyEsewa(Transaction transaction, String providerRef) {
        String amount = normalizeEsewaAmount(transaction.getAmount());
        String url = esewaStatusUrl
                + "?product_code=" + urlEncode(esewaProductCode)
                + "&total_amount=" + urlEncode(amount)
                + "&transaction_uuid=" + urlEncode(transaction.getTransactionRef());

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .GET()
                .build();

        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                return false;
            }

            Map<String, Object> payload = objectMapper.readValue(response.body(), new TypeReference<>() {});
            String status = getAsString(payload, "status");
            if (!"COMPLETE".equalsIgnoreCase(status)) {
                return false;
            }

            if (providerRef != null && !providerRef.isBlank()) {
                String refId = getAsString(payload, "ref_id");
                if (refId.isBlank()) {
                    refId = getAsString(payload, "transaction_code");
                }
                if (!refId.isBlank() && !providerRef.equalsIgnoreCase(refId)) {
                    return false;
                }
            }

            return true;
        } catch (Exception ex) {
            throw new RuntimeException("eSewa verification request failed", ex);
        }
    }

    private String buildEsewaRedirectUrl(String transactionRef, BigDecimal amount) {
        String normalizedAmount = normalizeEsewaAmount(amount);
        String signatureInput = "total_amount=" + normalizedAmount
                + ",transaction_uuid=" + transactionRef
                + ",product_code=" + esewaProductCode;
        String signature = generateEsewaSignature(signatureInput, esewaSecretKey);

        Map<String, String> params = new LinkedHashMap<>();
        params.put("amount", normalizedAmount);
        params.put("tax_amount", "0");
        params.put("total_amount", normalizedAmount);
        params.put("transaction_uuid", transactionRef);
        params.put("product_code", esewaProductCode);
        params.put("product_service_charge", "0");
        params.put("product_delivery_charge", "0");
        params.put("success_url", esewaSuccessUrl);
        params.put("failure_url", esewaFailureUrl);
        params.put("signed_field_names", ESEWA_SIGNED_FIELDS);
        params.put("signature", signature);

        StringBuilder query = new StringBuilder();
        for (Map.Entry<String, String> entry : params.entrySet()) {
            if (query.length() > 0) {
                query.append("&");
            }
            query.append(urlEncode(entry.getKey())).append("=").append(urlEncode(entry.getValue()));
        }

        return esewaFormUrl + "?" + query;
    }

    private String generateEsewaSignature(String payload, String secret) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] raw = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(raw);
        } catch (Exception ex) {
            throw new RuntimeException("Failed to generate eSewa signature", ex);
        }
    }

    private BigDecimal calculatePayableAmount(Order order) {
        BigDecimal subtotal = order.getOrderItems().stream()
                .map(OrderItem::getLineTotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal serviceCharge = subtotal.multiply(new BigDecimal("0.10"));
        return subtotal.add(serviceCharge).setScale(2, RoundingMode.HALF_UP);
    }

    private boolean isSuccessStatus(String status) {
        return "SUCCESS".equalsIgnoreCase(status)
                || "COMPLETE".equalsIgnoreCase(status)
                || "PAID".equalsIgnoreCase(status);
    }

    private String normalizeEsewaAmount(BigDecimal amount) {
        return amount.setScale(2, RoundingMode.HALF_UP).stripTrailingZeros().toPlainString();
    }

    private String getAsString(Map<String, Object> map, String key) {
        Object value = map.get(key);
        return value == null ? "" : String.valueOf(value);
    }

    private String urlEncode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private PaymentMethod mapProvider(NepalPaymentProvider provider) {
        return switch (provider) {
            case ESEWA -> PaymentMethod.ESEWA;
            case KHALTI -> PaymentMethod.KHALTI;
            case MOBILE_BANKING, DYNAMIC_QR -> PaymentMethod.MOBILE_BANKING;
            case CASH -> PaymentMethod.CASH;
            case CARD -> PaymentMethod.CARD;
        };
    }
}
