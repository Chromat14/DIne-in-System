package com.restaurant.foodsystem.auth.controller;

import com.restaurant.foodsystem.auth.dto.AuthRequest;
import com.restaurant.foodsystem.auth.dto.AuthResponse;
import com.restaurant.foodsystem.auth.service.JwtService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
@Slf4j
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;

    @PostMapping("/login")
    public AuthResponse login(@RequestBody AuthRequest request) {
        try {
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.getUsername(), request.getPassword())
            );

            UserDetails userDetails = (UserDetails) authentication.getPrincipal();

            // Extract the role string to return to the frontend
            String role = userDetails.getAuthorities().iterator().next().getAuthority();

            // FIXED: Only pass userDetails. The service extracts roles internally now.
            String token = jwtService.generateToken(userDetails);

            return new AuthResponse(token, role);

        } catch (Exception e) {
            log.error("AUTH_ERROR: Login failed for '{}'. Reason: {}", request.getUsername(), e.getMessage());
            throw e;
        }
    }
}