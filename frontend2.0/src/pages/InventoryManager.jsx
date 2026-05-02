import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { WS_URL } from "../services/runtime";
import SockJS from "sockjs-client";
import { Stomp } from "@stomp/stompjs";
import {
    Boxes,
    Loader2,
    RefreshCw,
    Search,
    ShieldCheck,
    TriangleAlert
} from "lucide-react";

const LOW_STOCK_THRESHOLD = 5;

const InventoryManager = () => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [savingId, setSavingId] = useState(null);

    const loadInventory = useCallback(async () => {
        try {
            const response = await api.get("/inventory/items");
            setItems(response.data);
        } catch (err) {
            console.error("Inventory load failed", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadInventory();

        const socket = new SockJS(WS_URL);
        const client = Stomp.over(socket);
        client.debug = () => {};

        client.connect({}, () => {
            client.subscribe("/topic/menu", () => {
                loadInventory();
            });
        });

        return () => client.disconnect();
    }, [loadInventory]);

    const filteredItems = useMemo(() => {
        return items.filter((item) =>
            item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.categoryName?.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [items, searchQuery]);

    const stats = useMemo(() => {
        const totalItems = items.length;
        const availableItems = items.filter((item) => item.isAvailable && item.stockQuantity > 0).length;
        const lowStockItems = items.filter((item) => item.stockQuantity > 0 && item.stockQuantity <= LOW_STOCK_THRESHOLD).length;
        const outOfStockItems = items.filter((item) => item.stockQuantity <= 0 || item.isAvailable === false).length;

        return { totalItems, availableItems, lowStockItems, outOfStockItems };
    }, [items]);

    const updateInventory = async (itemId, payload) => {
        setSavingId(itemId);
        try {
            const response = await api.patch(`/inventory/items/${itemId}`, payload);
            setItems((prev) => prev.map((item) => item.id === itemId ? response.data : item));
        } catch (err) {
            alert(err.response?.data?.message || "Inventory update failed.");
        } finally {
            setSavingId(null);
        }
    };

    const handleAdjust = (item, adjustment) => {
        const nextStock = Math.max(0, item.stockQuantity + adjustment);
        updateInventory(item.id, {
            stockAdjustment: adjustment,
            isAvailable: nextStock > 0 ? true : false
        });
    };

    const handleSetStock = (item, stockQuantity) => {
        const parsed = Number.parseInt(stockQuantity, 10);
        if (Number.isNaN(parsed) || parsed < 0) {
            return;
        }

        updateInventory(item.id, {
            stockQuantity: parsed,
            isAvailable: parsed > 0 ? item.isAvailable !== false : false
        });
    };

    const handleToggleAvailability = (item) => {
        if (item.stockQuantity <= 0) {
            alert("Restock the item before marking it available.");
            return;
        }

        updateInventory(item.id, {
            stockQuantity: item.stockQuantity,
            isAvailable: !item.isAvailable
        });
    };

    if (loading) {
        return (
            <div className="h-96 flex items-center justify-center">
                <Loader2 className="animate-spin text-blue-600" size={40} />
            </div>
        );
    }

    return (
        <div className="ops-page space-y-6">
            <header className="ops-header-card">
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
                    <div className="space-y-2">
                        <p className="ops-kicker">Stock Intelligence</p>
                        <h1 className="ops-title">Inventory Manager</h1>
                        <p className="ops-subtitle">
                            {items.length} tracked menu items
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto">
                        <div className="relative flex-1 min-w-0 sm:w-72">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search stock"
                                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/70 text-slate-800 dark:text-slate-100 font-semibold outline-none focus:border-blue-500"
                            />
                        </div>
                        <button
                            onClick={loadInventory}
                            className="ops-btn-secondary px-4 py-3 flex items-center justify-center gap-2"
                        >
                            <RefreshCw size={14} /> Refresh
                        </button>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard label="Tracked Items" value={stats.totalItems} icon={<Boxes className="text-blue-600" />} />
                <StatCard label="Available" value={stats.availableItems} icon={<ShieldCheck className="text-emerald-600" />} />
                <StatCard label="Low Stock" value={stats.lowStockItems} icon={<TriangleAlert className="text-amber-500" />} />
                <StatCard label="Unavailable" value={stats.outOfStockItems} icon={<TriangleAlert className="text-rose-500" />} />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                {filteredItems.map((item) => {
                    const lowStock = item.stockQuantity > 0 && item.stockQuantity <= LOW_STOCK_THRESHOLD;
                    const unavailable = item.stockQuantity <= 0 || item.isAvailable === false;

                    return (
                        <div key={item.id} className="ops-panel p-5 space-y-5">
                            <div className="flex justify-between gap-4">
                                <div>
                                    <span className="text-[10px] font-black text-blue-600 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-900/50 px-2.5 py-1 rounded-lg uppercase tracking-[0.16em]">
                                        {item.categoryName}
                                    </span>
                                    <h3 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-3">{item.name}</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 font-semibold mt-1">Rs. {item.price}</p>
                                </div>

                                <div className="text-right">
                                    <div className={`inline-flex px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.16em] border ${
                                        unavailable
                                            ? "bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/40 dark:text-rose-400"
                                            : lowStock
                                                ? "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/40 dark:text-amber-400"
                                                : "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/40 dark:text-emerald-400"
                                    }`}>
                                        {unavailable ? "Unavailable" : lowStock ? "Low Stock" : "Available"}
                                    </div>
                                    <p className="text-4xl font-extrabold text-slate-900 dark:text-slate-100 mt-3">{item.stockQuantity}</p>
                                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Units</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-4 gap-2">
                                {[-5, -1, 1, 5].map((value) => (
                                    <button
                                        key={value}
                                        onClick={() => handleAdjust(item, value)}
                                        disabled={savingId === item.id || (value < 0 && item.stockQuantity === 0)}
                                        className="ops-btn-secondary py-2.5 disabled:opacity-40"
                                    >
                                        {value > 0 ? `+${value}` : value}
                                    </button>
                                ))}
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
                                <div className="flex-1">
                                    <label className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 block mb-2">Set Exact Stock</label>
                                    <input
                                        type="number"
                                        min="0"
                                        defaultValue={item.stockQuantity}
                                        onBlur={(e) => handleSetStock(item, e.target.value)}
                                        className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/70 text-slate-800 dark:text-slate-100 font-semibold outline-none focus:border-blue-500"
                                    />
                                </div>
                                <button
                                    onClick={() => handleToggleAvailability(item)}
                                    disabled={savingId === item.id}
                                    className={`py-3 px-5 rounded-xl font-black uppercase text-[10px] tracking-[0.16em] ${
                                        item.isAvailable ? "bg-slate-900 dark:bg-slate-200 dark:text-slate-900 text-white" : "bg-emerald-600 text-white"
                                    } disabled:opacity-40`}
                                >
                                    {item.isAvailable ? "Pause Item" : "Enable Item"}
                                </button>
                            </div>

                            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                                <span>{item.avgPrepTime} min prep</span>
                                <span>{savingId === item.id ? "Saving..." : "Live sync on"}</span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {filteredItems.length === 0 && (
                <div className="ops-panel p-12 text-center">
                    <p className="text-slate-500 dark:text-slate-400 font-semibold">No stock items match this filter.</p>
                </div>
            )}
        </div>
    );
};

const StatCard = ({ label, value, icon }) => (
    <div className="ops-stat-card p-5">
        <div className="inline-flex p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 mb-3">{icon}</div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{label}</p>
        <h3 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">{value}</h3>
    </div>
);

export default InventoryManager;
