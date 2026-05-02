const state = {
    theme: "system",
    themeSettings: null
};

const nodes = {
    body: document.body,
    themeToggle: document.getElementById("theme-toggle"),
    themeLabel: document.getElementById("theme-label"),
    restaurantName: document.getElementById("restaurant-name"),
    restaurantTagline: document.getElementById("restaurant-tagline"),
    themeTokens: document.getElementById("theme-tokens"),
    tables: document.getElementById("tables"),
    menu: document.getElementById("menu"),
    orders: document.getElementById("orders"),
    metricMenu: document.getElementById("metric-menu"),
    metricTables: document.getElementById("metric-tables"),
    metricOrders: document.getElementById("metric-orders")
};

async function loadJson(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Request failed for ${url}: ${response.status}`);
    }
    if (response.status === 204) {
        return null;
    }
    return response.json();
}

function renderEmpty(target, message) {
    target.innerHTML = `<div class="empty-state">${message}</div>`;
}

function applyTheme(theme) {
    state.theme = theme;
    nodes.body.dataset.theme = theme;
    nodes.themeLabel.textContent = `Theme: ${theme}`;
}

function cycleTheme() {
    const sequence = ["system", "light", "dark"];
    const nextTheme = sequence[(sequence.indexOf(state.theme) + 1) % sequence.length];
    applyTheme(nextTheme);
}

function applyThemeTokens(themeSettings) {
    state.themeSettings = themeSettings;
    nodes.restaurantName.textContent = themeSettings.restaurantName;
    nodes.restaurantTagline.textContent = themeSettings.tagline;

    const root = document.documentElement;
    root.style.setProperty("--primary", themeSettings.primaryColor);
    root.style.setProperty("--accent", themeSettings.accentColor);
    root.style.setProperty("--bg-elevated", themeSettings.surfaceColor);

    const selectedTheme = themeSettings.darkModeEnabled ? themeSettings.defaultThemeMode : "light";
    applyTheme(selectedTheme);

    nodes.themeTokens.innerHTML = [
        ["Restaurant", themeSettings.restaurantName],
        ["Default mode", themeSettings.defaultThemeMode],
        ["Dark mode", themeSettings.darkModeEnabled ? "Enabled" : "Disabled"],
        ["Primary", themeSettings.primaryColor],
        ["Accent", themeSettings.accentColor],
        ["Surface", themeSettings.surfaceColor]
    ].map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join("");
}

function renderTables(tables) {
    nodes.metricTables.textContent = tables.filter(table => table.status === "AVAILABLE").length;
    if (!tables.length) {
        renderEmpty(nodes.tables, "No tables available.");
        return;
    }

    nodes.tables.innerHTML = tables.map(table => `
        <article class="table-card">
            <strong>Table ${table.tableNumber}</strong>
            <p>${table.location || "Dining floor"}</p>
            <p>Capacity: ${table.capacity ?? "-"}</p>
            <span class="table-status">${table.status}</span>
        </article>
    `).join("");
}

function renderMenu(menuItems) {
    nodes.metricMenu.textContent = menuItems.length;
    if (!menuItems.length) {
        renderEmpty(nodes.menu, "No menu items found.");
        return;
    }

    nodes.menu.innerHTML = menuItems.map(item => `
        <article class="menu-card">
            <strong>${item.name}</strong>
            <p>${item.categoryName || "Uncategorized"}</p>
            <p>${item.description || "No description provided."}</p>
            <p>Rs. ${item.price}</p>
            <p>${item.isAvailable ? "Available" : "Unavailable"} · Stock ${item.stockQuantity}</p>
        </article>
    `).join("");
}

function renderOrders(orders) {
    nodes.metricOrders.textContent = orders.length;
    if (!orders.length) {
        renderEmpty(nodes.orders, "No active kitchen orders.");
        return;
    }

    nodes.orders.innerHTML = orders.map(order => `
        <article class="order-card">
            <strong>${order.orderNumber}</strong>
            <p>Table ${order.tableNumber}</p>
            <p>Status: ${order.orderStatus}</p>
            <p>Items: ${order.items.map(item => `${item.menuItemName} x${item.quantity}`).join(", ")}</p>
        </article>
    `).join("");
}

async function bootstrap() {
    nodes.themeToggle.addEventListener("click", cycleTheme);

    try {
        const [themeSettings, tables, menuItems, orders] = await Promise.all([
            loadJson("/api/v1/admin/branding/theme"),
            loadJson("/api/v1/table/all"),
            loadJson("/api/v1/menu"),
            loadJson("/api/v1/kitchen/orders/active")
        ]);

        applyThemeTokens(themeSettings);
        renderTables(tables);
        renderMenu(menuItems);
        renderOrders(orders);
    } catch (error) {
        renderEmpty(nodes.themeTokens, "Theme data failed to load.");
        renderEmpty(nodes.tables, "Table data failed to load.");
        renderEmpty(nodes.menu, "Menu data failed to load.");
        renderEmpty(nodes.orders, "Order data failed to load.");
        console.error(error);
    }
}

bootstrap();
