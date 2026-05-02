package com.restaurant.foodsystem.payment.controller;

import com.restaurant.foodsystem.payment.dto.PaymentCallbackRequest;
import com.restaurant.foodsystem.payment.dto.PaymentInitiateRequest;
import com.restaurant.foodsystem.payment.dto.PaymentResponse;
import com.restaurant.foodsystem.payment.service.PaymentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/table/payments")
@RequiredArgsConstructor
public class PaymentController {

    private final PaymentService paymentService;

    @PostMapping("/initiate")
    public ResponseEntity<PaymentResponse> initiate(@RequestBody PaymentInitiateRequest request) {
        return ResponseEntity.ok(paymentService.initiatePayment(request));
    }

    @PostMapping("/callback")
    public ResponseEntity<String> callback(@RequestBody PaymentCallbackRequest request) {
        paymentService.completePayment(request);
        return ResponseEntity.ok("Payment processed");
    }

    @GetMapping(value = "/esewa/success", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> esewaSuccess(@RequestParam(name = "data", required = false) String data) {
        paymentService.completeEsewaFromRedirectData(data);
        return ResponseEntity.ok("""
                <!DOCTYPE html>
                <html>
                <head><title>eSewa Payment</title></head>
                <body style="font-family:Arial,sans-serif;padding:32px;">
                  <h2>Payment Successful</h2>
                  <p>Your eSewa sandbox payment has been verified. You can close this window.</p>
                </body>
                </html>
                """);
    }

    @GetMapping(value = "/esewa/failure", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> esewaFailure() {
        return ResponseEntity.ok("""
                <!DOCTYPE html>
                <html>
                <head><title>eSewa Payment</title></head>
                <body style="font-family:Arial,sans-serif;padding:32px;">
                  <h2>Payment Not Completed</h2>
                  <p>The payment was cancelled or failed. Return to kiosk to retry.</p>
                </body>
                </html>
                """);
    }
}
