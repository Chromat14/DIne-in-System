package com.restaurant.foodsystem.recommendation.service;

import com.restaurant.foodsystem.entity.MenuItem;
import com.restaurant.foodsystem.recommendation.dto.RecommendationDto;
import com.restaurant.foodsystem.recommendation.repository.RecommendationRepository;
import com.restaurant.foodsystem.repository.MenuItemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Stream;

@Service
@RequiredArgsConstructor
public class RecommendationService {

    private static final int RECENT_WINDOW_DAYS = 14;
    private static final int CANDIDATE_MULTIPLIER = 6;
    private static final int MIN_CANDIDATE_POOL = 12;
    private static final double MAX_LIFT = 4.0;
    private static final double EPS = 1e-9;

    private final RecommendationRepository recommendationRepository;
    private final MenuItemRepository menuItemRepository;

    @Transactional(readOnly = true)
    public List<RecommendationDto> recommendFrequentlyBoughtTogether(List<Long> cartItemIds, int limit) {
        int safeLimit = Math.max(limit, 1);
        List<Long> cartIds = sanitizeIds(cartItemIds);
        Set<Long> cartSet = new HashSet<>(cartIds);

        int candidateLimit = Math.max(safeLimit * CANDIDATE_MULTIPLIER, MIN_CANDIDATE_POOL);
        OffsetDateTime since = OffsetDateTime.now().minusDays(RECENT_WINDOW_DAYS);

        List<Map<String, Object>> pairingRows = cartIds.isEmpty()
                ? List.of()
                : recommendationRepository.findRelatedItems(cartIds, candidateLimit);

        List<Map<String, Object>> allTimeRows = recommendationRepository.findTopSellingItems(candidateLimit);
        List<Map<String, Object>> recentRows = recommendationRepository.findTopSellingItemsSince(since, candidateLimit);

        long completedOrders = Math.max(Optional.ofNullable(recommendationRepository.countCompletedOrders()).orElse(0L), 1L);
        long recentCompletedOrders = Math.max(Optional.ofNullable(recommendationRepository.countCompletedOrdersSince(since)).orElse(0L), 1L);

        Map<Long, Long> cartOrderCounts = cartIds.isEmpty()
                ? Map.of()
                : toLongMap(recommendationRepository.findOrderCountsForItems(cartIds), "menuItemId", "orderCount");

        Map<Long, Long> allOrderCounts = toLongMap(allTimeRows, "menuItemId", "orderCount");
        Map<Long, Long> recentOrderCounts = toLongMap(recentRows, "menuItemId", "orderCount");
        Map<Long, Long> allUnitsSold = toLongMap(allTimeRows, "menuItemId", "unitsSold");
        Map<Long, Long> recentUnitsSold = toLongMap(recentRows, "menuItemId", "unitsSold");

        CartContext cartContext = buildCartContext(cartIds);
        Map<Long, MenuItem> candidateItems = loadCandidateItems(pairingRows, allTimeRows, recentRows);
        Map<Long, RecommendationDto> ranked = new LinkedHashMap<>();

        if (!cartIds.isEmpty()) {
            pairingRows.stream()
                    .map(row -> mapPairedRecommendation(
                            row,
                            cartOrderCounts,
                            allOrderCounts,
                            recentOrderCounts,
                            completedOrders,
                            recentCompletedOrders,
                            candidateItems,
                            cartContext
                    ))
                    .filter(Objects::nonNull)
                    .filter(item -> !cartSet.contains(item.getMenuItemId()))
                    .forEach(item -> mergeByBestScore(ranked, item));
        }

        Stream.concat(recentRows.stream(), allTimeRows.stream())
                .map(row -> mapTopSellerRecommendation(
                        row,
                        allOrderCounts,
                        recentOrderCounts,
                        allUnitsSold,
                        recentUnitsSold,
                        completedOrders,
                        recentCompletedOrders,
                        candidateItems,
                        cartContext
                ))
                .filter(Objects::nonNull)
                .filter(item -> !cartSet.contains(item.getMenuItemId()))
                .forEach(item -> mergeByBestScore(ranked, item));

        if (ranked.isEmpty()) {
            return getFallbackRecommendations(safeLimit);
        }

        List<RecommendationDto> sorted = ranked.values().stream()
                .sorted(Comparator.comparingLong(RecommendationDto::getScore).reversed())
                .toList();

        return diversifyAndLimit(sorted, safeLimit, cartContext.cartCategories());
    }

    private RecommendationDto mapPairedRecommendation(
            Map<String, Object> row,
            Map<Long, Long> cartOrderCounts,
            Map<Long, Long> allOrderCounts,
            Map<Long, Long> recentOrderCounts,
            long completedOrders,
            long recentCompletedOrders,
            Map<Long, MenuItem> candidateItems,
            CartContext cartContext
    ) {
        Long id = longValue(row.get("targetId"));
        long supportCount = longValue(row.get("supportCount"));
        MenuItem item = candidateItems.get(id);

        if (!isRecommendable(item)) {
            return null;
        }

        long baseCartSupport = Math.max(cartOrderCounts.values().stream().mapToLong(Long::longValue).max().orElse(1L), 1L);
        long allCount = Math.max(allOrderCounts.getOrDefault(id, supportCount), 0L);
        long recentCount = Math.max(recentOrderCounts.getOrDefault(id, 0L), 0L);

        double confidence = clamp01(supportCount / (double) baseCartSupport);
        double popularity = normalizedCount(allCount, completedOrders);
        double trendMomentum = trendMomentum(recentCount, recentCompletedOrders, allCount, completedOrders);
        double liftNorm = liftScore(confidence, allCount, completedOrders);
        double priceAffinity = priceAffinity(item.getPrice(), cartContext.referencePrice());
        double diversityBoost = diversityBoost(item.getCategory() != null ? item.getCategory().getName() : null, cartContext.cartCategories());

        double scoreNorm =
                (0.42 * confidence) +
                (0.20 * liftNorm) +
                (0.14 * popularity) +
                (0.14 * trendMomentum) +
                (0.06 * priceAffinity) +
                (0.04 * diversityBoost);

        long score = Math.round(clamp01(scoreNorm) * 10_000);
        String reason = pairingReason(confidence, liftNorm, trendMomentum);

        return new RecommendationDto(
                id,
                item.getName(),
                item.getPrice(),
                item.getCategory() != null ? item.getCategory().getName() : "Uncategorized",
                reason,
                "PAIRING",
                score
        );
    }

    private RecommendationDto mapTopSellerRecommendation(
            Map<String, Object> row,
            Map<Long, Long> allOrderCounts,
            Map<Long, Long> recentOrderCounts,
            Map<Long, Long> allUnitsSold,
            Map<Long, Long> recentUnitsSold,
            long completedOrders,
            long recentCompletedOrders,
            Map<Long, MenuItem> candidateItems,
            CartContext cartContext
    ) {
        Long id = longValue(row.get("menuItemId"));
        MenuItem item = candidateItems.get(id);

        if (!isRecommendable(item)) {
            return null;
        }

        long allCount = Math.max(allOrderCounts.getOrDefault(id, 0L), 0L);
        long recentCount = Math.max(recentOrderCounts.getOrDefault(id, 0L), 0L);
        long allUnits = Math.max(allUnitsSold.getOrDefault(id, 0L), 0L);
        long recentUnits = Math.max(recentUnitsSold.getOrDefault(id, 0L), 0L);

        double allPopularity = normalizedCount(allCount, completedOrders);
        double recentPopularity = normalizedCount(recentCount, recentCompletedOrders);
        double trendMomentum = trendMomentum(recentCount, recentCompletedOrders, allCount, completedOrders);
        double unitStrength = normalizedCount(recentUnits > 0 ? recentUnits : allUnits, Math.max(recentCompletedOrders, completedOrders));
        double priceAffinity = priceAffinity(item.getPrice(), cartContext.referencePrice());
        double diversityBoost = diversityBoost(item.getCategory() != null ? item.getCategory().getName() : null, cartContext.cartCategories());

        double scoreNorm =
                (0.38 * recentPopularity) +
                (0.27 * allPopularity) +
                (0.17 * trendMomentum) +
                (0.11 * unitStrength) +
                (0.04 * priceAffinity) +
                (0.03 * diversityBoost);

        long score = Math.round(clamp01(scoreNorm) * 10_000);
        String recommendationType = trendMomentum >= 0.60 ? "TRENDING" : "TOP_SELLER";
        String reason = topSellerReason(recommendationType, recentCount, recentCompletedOrders, allCount, completedOrders);

        return new RecommendationDto(
                id,
                item.getName(),
                item.getPrice() != null ? item.getPrice() : BigDecimal.ZERO,
                item.getCategory() != null ? item.getCategory().getName() : "Uncategorized",
                reason,
                recommendationType,
                score
        );
    }

    private List<RecommendationDto> diversifyAndLimit(List<RecommendationDto> ranked, int limit, Set<String> cartCategories) {
        if (ranked.isEmpty()) {
            return List.of();
        }

        List<RecommendationDto> selected = new ArrayList<>();
        Set<Long> selectedIds = new HashSet<>();
        Map<String, Integer> categoryCounts = new HashMap<>();

        for (RecommendationDto candidate : ranked) {
            String categoryKey = normalizeCategory(candidate.getCategoryName());
            int cap = cartCategories.contains(categoryKey) ? 2 : 1;
            int used = categoryCounts.getOrDefault(categoryKey, 0);

            if (used >= cap) {
                continue;
            }

            selected.add(candidate);
            selectedIds.add(candidate.getMenuItemId());
            categoryCounts.put(categoryKey, used + 1);

            if (selected.size() >= limit) {
                return selected;
            }
        }

        for (RecommendationDto candidate : ranked) {
            if (selected.size() >= limit) {
                break;
            }
            if (selectedIds.add(candidate.getMenuItemId())) {
                selected.add(candidate);
            }
        }

        return selected;
    }

    private List<RecommendationDto> getFallbackRecommendations(int limit) {
        return menuItemRepository.findAll().stream()
                .filter(this::isRecommendable)
                .sorted(Comparator.comparing(MenuItem::getName))
                .limit(limit)
                .map(item -> new RecommendationDto(
                        item.getId(),
                        item.getName(),
                        item.getPrice(),
                        item.getCategory() != null ? item.getCategory().getName() : "Uncategorized",
                        "Popular with other tables",
                        "TRENDING",
                        1L
                ))
                .toList();
    }

    private CartContext buildCartContext(List<Long> cartIds) {
        if (cartIds == null || cartIds.isEmpty()) {
            return new CartContext(Set.of(), -1d);
        }

        List<MenuItem> items = menuItemRepository.findAllById(cartIds);
        Set<String> categories = new LinkedHashSet<>();
        double averagePrice = items.stream()
                .map(MenuItem::getPrice)
                .filter(Objects::nonNull)
                .mapToDouble(BigDecimal::doubleValue)
                .average()
                .orElse(-1d);

        items.stream()
                .map(MenuItem::getCategory)
                .filter(Objects::nonNull)
                .map(category -> normalizeCategory(category.getName()))
                .forEach(categories::add);

        return new CartContext(categories, averagePrice);
    }

    private List<Long> sanitizeIds(List<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return List.of();
        }
        return ids.stream()
                .filter(Objects::nonNull)
                .filter(id -> id > 0)
                .distinct()
                .toList();
    }

    private void mergeByBestScore(Map<Long, RecommendationDto> ranked, RecommendationDto candidate) {
        RecommendationDto existing = ranked.get(candidate.getMenuItemId());
        if (existing == null || candidate.getScore() > existing.getScore()) {
            ranked.put(candidate.getMenuItemId(), candidate);
        }
    }

    private Map<Long, Long> toLongMap(List<Map<String, Object>> rows, String keyName, String valueName) {
        Map<Long, Long> mapped = new HashMap<>();
        for (Map<String, Object> row : rows) {
            mapped.put(longValue(row.get(keyName)), longValue(row.get(valueName)));
        }
        return mapped;
    }

    private Map<Long, MenuItem> loadCandidateItems(
            List<Map<String, Object>> pairingRows,
            List<Map<String, Object>> allTimeRows,
            List<Map<String, Object>> recentRows
    ) {
        Set<Long> ids = new HashSet<>();
        pairingRows.forEach(row -> ids.add(longValue(row.get("targetId"))));
        allTimeRows.forEach(row -> ids.add(longValue(row.get("menuItemId"))));
        recentRows.forEach(row -> ids.add(longValue(row.get("menuItemId"))));

        return menuItemRepository.findAllById(ids).stream()
                .collect(HashMap::new, (map, item) -> map.put(item.getId(), item), HashMap::putAll);
    }

    private boolean isRecommendable(MenuItem item) {
        return item != null && Boolean.TRUE.equals(item.getIsAvailable()) && item.getStockQuantity() > 0;
    }

    private double liftScore(double confidence, long allCount, long totalOrders) {
        double baseRate = Math.max(allCount / (double) Math.max(totalOrders, 1L), EPS);
        double lift = confidence / baseRate;
        return clamp01(Math.min(lift, MAX_LIFT) / MAX_LIFT);
    }

    private double trendMomentum(long recentCount, long recentTotal, long allCount, long allTotal) {
        if (recentCount <= 0 && allCount <= 0) {
            return 0d;
        }

        double recentRate = recentCount / (double) Math.max(recentTotal, 1L);
        double allRate = allCount / (double) Math.max(allTotal, 1L);

        if (allRate <= EPS) {
            return recentRate > 0 ? 1d : 0d;
        }

        double ratio = recentRate / allRate;
        return clamp01(Math.min(ratio, 2d) / 2d);
    }

    private double normalizedCount(long count, long total) {
        if (count <= 0 || total <= 0) {
            return 0d;
        }
        return clamp01(Math.log1p(count) / Math.log1p(total));
    }

    private double priceAffinity(BigDecimal itemPrice, double referencePrice) {
        if (itemPrice == null || referencePrice <= 0d) {
            return 0.5d;
        }

        double ratio = Math.max(itemPrice.doubleValue(), EPS) / referencePrice;
        double distance = Math.abs(Math.log(ratio));
        return clamp01(1d - Math.min(distance / 1.2d, 1d));
    }

    private double diversityBoost(String category, Set<String> cartCategories) {
        if (cartCategories == null || cartCategories.isEmpty()) {
            return 0.5d;
        }
        return cartCategories.contains(normalizeCategory(category)) ? 0.2d : 1d;
    }

    private String pairingReason(double confidence, double liftNorm, double trendNorm) {
        int confidencePercent = (int) Math.round(confidence * 100);

        if (liftNorm >= 0.65d) {
            return confidencePercent > 0
                    ? "Strong pair in " + confidencePercent + "% of similar trays"
                    : "Strongly paired with your current tray";
        }

        if (trendNorm >= 0.70d) {
            return "Pairing trend is rising in recent orders";
        }

        return confidencePercent > 0
                ? "Paired in " + confidencePercent + "% of similar trays"
                : "Frequently paired with your selected items";
    }

    private String topSellerReason(String type, long recentCount, long recentTotal, long allCount, long allTotal) {
        if ("TRENDING".equals(type) && recentCount > 0) {
            int recentPercent = (int) Math.round((recentCount * 100.0) / Math.max(recentTotal, 1L));
            return recentPercent > 0
                    ? "Picked by " + recentPercent + "% of recent completed tables"
                    : "Trending right now";
        }

        int allPercent = (int) Math.round((allCount * 100.0) / Math.max(allTotal, 1L));
        return allPercent > 0
                ? "Chosen by " + allPercent + "% of completed tables"
                : "Best seller right now";
    }

    private String normalizeCategory(String category) {
        if (category == null || category.isBlank()) {
            return "uncategorized";
        }
        return category.trim().toLowerCase();
    }

    private long longValue(Object value) {
        if (value == null) {
            return 0L;
        }
        if (value instanceof Number number) {
            return number.longValue();
        }
        return Long.parseLong(value.toString());
    }

    private double clamp01(double value) {
        return Math.max(0d, Math.min(1d, value));
    }

    private record CartContext(Set<String> cartCategories, double referencePrice) { }
}
