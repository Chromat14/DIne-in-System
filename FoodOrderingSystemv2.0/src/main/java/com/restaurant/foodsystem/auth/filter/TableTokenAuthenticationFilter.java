package com.restaurant.foodsystem.auth.filter;

import com.restaurant.foodsystem.entity.RestaurantTable;
import com.restaurant.foodsystem.repository.RestaurantTableRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
@RequiredArgsConstructor
public class TableTokenAuthenticationFilter extends OncePerRequestFilter {

    private final RestaurantTableRepository restaurantTableRepository;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        if (!request.getRequestURI().startsWith("/api/v1/table/")) {
            filterChain.doFilter(request, response);
            return;
        }

        if (SecurityContextHolder.getContext().getAuthentication() != null) {
            filterChain.doFilter(request, response);
            return;
        }

        String tableToken = request.getHeader("X-Table-Token");

        if (tableToken != null && !tableToken.isBlank()) {
            restaurantTableRepository.findByTableToken(tableToken).ifPresent(table -> {
                UsernamePasswordAuthenticationToken authentication =
                        new UsernamePasswordAuthenticationToken(
                                table.getTableNumber(),
                                null,
                                List.of(new SimpleGrantedAuthority("ROLE_TABLE"))
                        );

                SecurityContextHolder.getContext().setAuthentication(authentication);
                request.setAttribute("authenticatedTable", table);
            });
        }

        filterChain.doFilter(request, response);
    }
}