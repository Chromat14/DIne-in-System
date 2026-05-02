//package com.restaurant.foodsystem.config;
//
//import org.springframework.context.annotation.Configuration;
//import org.springframework.web.servlet.config.annotation.CorsRegistry;
//import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
//
//@Configuration
//public class WebConfig implements WebMvcConfigurer {
//
//    @Override
//    public void addCorsMappings(CorsRegistry registry) {
//        // Updated to support SaaS-level interactions like file uploads and pre-flight checks
//        registry.addMapping("/api/**")
//                .allowedOrigins("http://localhost:5173") // Your React/Vite dev server
//                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH")
//                .allowedHeaders("*")
//                .exposedHeaders("Authorization") // Crucial if you add JWT/Auth later
//                .allowCredentials(true)
//                .maxAge(3600); // Caches the CORS response for 1 hour for better performance
//    }
//}