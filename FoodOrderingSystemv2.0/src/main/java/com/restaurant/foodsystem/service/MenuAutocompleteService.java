package com.restaurant.foodsystem.service;

import com.restaurant.foodsystem.dto.MenuAutocompleteSuggestionResponse;
import com.restaurant.foodsystem.entity.MenuItem;
import com.restaurant.foodsystem.repository.MenuItemRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.locks.ReadWriteLock;
import java.util.concurrent.locks.ReentrantReadWriteLock;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class MenuAutocompleteService {

    private static final int MAX_NODE_CANDIDATES = 40;
    private static final int MAX_LIMIT = 20;
    private static final Pattern NORMALIZE_PATTERN = Pattern.compile("[^a-z0-9\\s]");
    private static final Pattern MULTI_SPACE_PATTERN = Pattern.compile("\\s+");

    private final MenuItemRepository menuItemRepository;

    private final ReadWriteLock trieLock = new ReentrantReadWriteLock();
    private final AtomicBoolean dirty = new AtomicBoolean(true);
    private volatile TrieNode root = new TrieNode();

    @PostConstruct
    public void initialize() {
        rebuildIndex();
    }

    public void markDirty() {
        dirty.set(true);
    }

    @Transactional(readOnly = true)
    public List<MenuAutocompleteSuggestionResponse> suggest(String rawQuery, int requestedLimit, boolean availableOnly) {
        String query = normalize(rawQuery);
        if (query.isBlank()) {
            return List.of();
        }

        ensureFreshIndex();

        List<Long> candidateIds = findCandidateIds(query);
        if (candidateIds.isEmpty()) {
            return List.of();
        }

        int safeLimit = Math.max(1, Math.min(requestedLimit, MAX_LIMIT));
        int fetchLimit = Math.min(candidateIds.size(), safeLimit * 3);
        List<Long> idsToFetch = candidateIds.subList(0, fetchLimit);

        Map<Long, MenuItem> itemById = menuItemRepository.findAllById(idsToFetch).stream()
                .collect(HashMap::new, (map, item) -> map.put(item.getId(), item), HashMap::putAll);

        List<MenuAutocompleteSuggestionResponse> result = new ArrayList<>();
        for (Long id : idsToFetch) {
            MenuItem item = itemById.get(id);
            if (item == null) {
                continue;
            }
            if (availableOnly && !isRecommendable(item)) {
                continue;
            }

            result.add(MenuAutocompleteSuggestionResponse.builder()
                    .id(item.getId())
                    .name(item.getName())
                    .categoryName(item.getCategory() != null ? item.getCategory().getName() : "Uncategorized")
                    .price(item.getPrice())
                    .stockQuantity(item.getStockQuantity() != null ? item.getStockQuantity() : 0)
                    .isAvailable(Boolean.TRUE.equals(item.getIsAvailable()) && (item.getStockQuantity() == null || item.getStockQuantity() > 0))
                    .build());

            if (result.size() >= safeLimit) {
                break;
            }
        }
        return result;
    }

    @Transactional(readOnly = true)
    public void rebuildIndex() {
        List<MenuItem> items = menuItemRepository.findAll().stream()
                .sorted(Comparator
                        .comparing((MenuItem item) -> !isRecommendable(item))
                        .thenComparing((MenuItem item) -> item.getStockQuantity() != null ? item.getStockQuantity() : 0, Comparator.reverseOrder())
                        .thenComparing(item -> normalize(item.getName()))
                        .thenComparing(MenuItem::getId))
                .toList();

        TrieNode nextRoot = new TrieNode();
        for (MenuItem item : items) {
            if (item.getId() == null || item.getName() == null || item.getName().isBlank()) {
                continue;
            }
            String normalizedName = normalize(item.getName());
            if (normalizedName.isBlank()) {
                continue;
            }
            for (String term : indexTerms(normalizedName)) {
                insert(nextRoot, term, item.getId());
            }
        }

        trieLock.writeLock().lock();
        try {
            root = nextRoot;
            dirty.set(false);
        } finally {
            trieLock.writeLock().unlock();
        }
    }

    private void ensureFreshIndex() {
        if (dirty.get()) {
            rebuildIndex();
        }
    }

    private List<Long> findCandidateIds(String query) {
        trieLock.readLock().lock();
        try {
            TrieNode node = root;
            for (char ch : query.toCharArray()) {
                node = node.children().get(ch);
                if (node == null) {
                    return List.of();
                }
            }
            return new ArrayList<>(node.candidateIds());
        } finally {
            trieLock.readLock().unlock();
        }
    }

    private Set<String> indexTerms(String normalizedName) {
        LinkedHashSet<String> terms = new LinkedHashSet<>();
        terms.add(normalizedName);
        Arrays.stream(normalizedName.split(" "))
                .filter(token -> token != null && !token.isBlank())
                .forEach(terms::add);
        return terms;
    }

    private void insert(TrieNode trieRoot, String term, Long menuItemId) {
        TrieNode node = trieRoot;
        for (char ch : term.toCharArray()) {
            node = node.children().computeIfAbsent(ch, key -> new TrieNode());
            node.addCandidate(menuItemId);
        }
    }

    private boolean isRecommendable(MenuItem item) {
        return item != null
                && Boolean.TRUE.equals(item.getIsAvailable())
                && (item.getStockQuantity() == null || item.getStockQuantity() > 0);
    }

    private String normalize(String value) {
        if (value == null) {
            return "";
        }
        String lower = value.toLowerCase(Locale.ROOT).trim();
        String sanitized = NORMALIZE_PATTERN.matcher(lower).replaceAll(" ");
        return MULTI_SPACE_PATTERN.matcher(sanitized).replaceAll(" ").trim();
    }

    private static final class TrieNode {
        private final Map<Character, TrieNode> children = new HashMap<>();
        private final LinkedHashSet<Long> candidateIds = new LinkedHashSet<>();

        Map<Character, TrieNode> children() {
            return children;
        }

        LinkedHashSet<Long> candidateIds() {
            return candidateIds;
        }

        void addCandidate(Long menuItemId) {
            if (menuItemId == null || candidateIds.contains(menuItemId)) {
                return;
            }
            if (candidateIds.size() >= MAX_NODE_CANDIDATES) {
                return;
            }
            candidateIds.add(menuItemId);
        }
    }
}

