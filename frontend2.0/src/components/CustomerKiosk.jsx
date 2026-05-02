import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import api from "../services/api";
import { WS_URL } from "../services/runtime";
import SockJS from "sockjs-client";
import { Stomp } from "@stomp/stompjs";
import {
    Coffee, Moon, Sun, ShoppingBag, Loader2,
    Clock, CheckCircle2, Plus, Minus, Utensils,
    Search, Sparkles, History
} from "lucide-react";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { useTheme } from "../context/ThemeContext";
import RecommendationList from "./RecommendationList";

const MAX_QTY = 20;
const SERVICE_CHARGE_RATE = 0.10;

const CustomerKiosk = () => {
    const { isDark, toggleTheme, branding } = useTheme();
    const [menu, setMenu] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchSuggestions, setSearchSuggestions] = useState([]);
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
    const [selectedCategory, setSelectedCategory] = useState("ALL");
    const [cart, setCart] = useState([]);
    const [notes, setNotes] = useState("");
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [tableData, setTableData] = useState(null);
    const [isCheckingIn, setIsCheckingIn] = useState(false);
    const [currentOrder, setCurrentOrder] = useState(null);
    const [waitTime, setWaitTime] = useState(0);
    const [settleOpen, setSettleOpen] = useState(false);
    const [isRequestingPayment, setIsRequestingPayment] = useState(false);
    const [settleNotice, setSettleNotice] = useState("");
    const [cancellingItems, setCancellingItems] = useState({});
    const currentOrderRef = useRef(null);

    const stompClient = useRef(null);
    const subscriptionRef = useRef(null);
    const menuSubscriptionRef = useRef(null);
    const tableSessionSubscriptionRef = useRef(null);
    const urlParams = new URLSearchParams(window.location.search);
    const tableToken = urlParams.get("token");

    const categories = useMemo(() => {
        const unique = Array.from(new Set(menu.map((item) => item.categoryName).filter(Boolean)));
        return ["ALL", ...unique];
    }, [menu]);

    const filteredMenu = useMemo(() => {
        const normalizedQuery = searchQuery.toLowerCase();

        return menu.filter((item) => {
            const matchesCategory = selectedCategory === "ALL" || item.categoryName === selectedCategory;
            const matchesSearch =
                item.name.toLowerCase().includes(normalizedQuery) ||
                (item.categoryName && item.categoryName.toLowerCase().includes(normalizedQuery));

            return matchesCategory && matchesSearch;
        });
    }, [menu, searchQuery, selectedCategory]);

    const fallbackSuggestions = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) {
            return [];
        }

        return menu
            .filter((item) =>
                ((item.name || "").toLowerCase().includes(query)
                    || (item.categoryName && item.categoryName.toLowerCase().includes(query)))
                && item.isAvailable !== false
                && (item.stockQuantity ?? 0) > 0
            )
            .slice(0, 6)
            .map((item) => ({
                id: item.id,
                name: item.name,
                categoryName: item.categoryName,
                price: item.price
            }));
    }, [menu, searchQuery]);

    const displayedSuggestions = searchSuggestions.length > 0 ? searchSuggestions : fallbackSuggestions;

    const trayTotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
    const normalizedAmount = (value) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    };
    const roundCurrency = (value) => Math.round(normalizedAmount(value) * 100) / 100;
    const formatCurrency = (value) => (
        `Rs. ${roundCurrency(value).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`
    );

    const runningSubtotal = roundCurrency(normalizedAmount(currentOrder?.subtotal ?? currentOrder?.totalAmount) + trayTotal);
    const backendServiceCharge = normalizedAmount(currentOrder?.serviceCharge);
    const runningServiceCharge = roundCurrency(
        backendServiceCharge > 0 ? backendServiceCharge : runningSubtotal * SERVICE_CHARGE_RATE
    );
    const runningPayableTotal = roundCurrency(runningSubtotal + runningServiceCharge);

    const resetLocalSessionState = useCallback(() => {
        setCart([]);
        setNotes("");
        setSettleOpen(false);
        setSettleNotice("");
        setSearchQuery("");
        setSearchSuggestions([]);
        setSelectedCategory("ALL");
        setIsSearchFocused(false);
        setActiveSuggestionIndex(-1);
        setWaitTime(0);
    }, []);

    const refreshKioskData = useCallback(async () => {
        const [menuRes, tableRes, activeOrderRes] = await Promise.all([
            api.get("/menu"),
            api.get(`/table/details?token=${tableToken}`),
            api.get(`/table/orders/active`, { headers: { "X-Table-Token": tableToken } }).catch(() => ({ data: null }))
        ]);

        setMenu(menuRes.data);
        setTableData(tableRes.data);

        if (activeOrderRes.data) {
            setCurrentOrder(activeOrderRes.data);
            setWaitTime(activeOrderRes.data.estimatedWaitTime || 0);
        } else {
            setCurrentOrder(null);
            setWaitTime(0);
        }

        return {
            menu: menuRes.data,
            table: tableRes.data,
            activeOrder: activeOrderRes.data
        };
    }, [tableToken]);

    const subscribeToOrderUpdates = useCallback((orderId) => {
        if (stompClient.current && stompClient.current.connected) {
            if (subscriptionRef.current) subscriptionRef.current.unsubscribe();

            subscriptionRef.current = stompClient.current.subscribe(`/topic/order/${orderId}`, async (message) => {
                const updatedOrder = JSON.parse(message.body);
                setCurrentOrder(updatedOrder);
                setWaitTime(updatedOrder.estimatedWaitTime || 0);
                if (["PAID", "CANCELLED"].includes(updatedOrder.orderStatus)) {
                    await refreshKioskData();
                }
            });
        }
    }, [refreshKioskData]);

    useEffect(() => {
        currentOrderRef.current = currentOrder;
    }, [currentOrder]);

    const handleTableSessionEvent = useCallback(async (message) => {
        try {
            const event = message?.body ? JSON.parse(message.body) : null;
            const eventType = event?.eventType;

            if (!eventType) {
                await refreshKioskData();
                return;
            }

            if (eventType === "PAYMENT_SETTLED" || eventType === "SESSION_CLOSED") {
                resetLocalSessionState();
                setSettleNotice("Payment completed. Session reset for next customer.");
                await refreshKioskData();
                return;
            }

            if (eventType === "TABLE_STATUS_CHANGED" && event?.tableStatus === "AVAILABLE") {
                resetLocalSessionState();
                await refreshKioskData();
                return;
            }

            if (eventType === "PAYMENT_REQUESTED") {
                setSettleNotice("Cashier has been notified.");
                await refreshKioskData();
                return;
            }

            if (eventType === "SESSION_STARTED" || eventType === "ORDER_UPDATED") {
                await refreshKioskData();
            }
        } catch (err) {
            console.error("Session sync event failed:", err);
            await refreshKioskData();
        }
    }, [refreshKioskData, resetLocalSessionState]);

    useEffect(() => {
        const initializeKiosk = async () => {
            if (!tableToken) {
                setError("No Table Token Found. Please scan a QR Code.");
                setLoading(false);
                return;
            }
            try {
                await refreshKioskData();
            } catch (err) {
                console.error("Initialization Error:", err);
                setError("Connection to Server Lost.");
            } finally {
                setLoading(false);
            }
        };

        initializeKiosk();

        // FIXED WEBSOCKET INITIALIZATION
        const socket = new SockJS(WS_URL);
        const client = Stomp.over(socket);
        client.debug = () => {};
        client.reconnect_delay = 5000;

        client.connect({}, () => {
            stompClient.current = client;
            if (menuSubscriptionRef.current) {
                menuSubscriptionRef.current.unsubscribe();
            }
            if (tableSessionSubscriptionRef.current) {
                tableSessionSubscriptionRef.current.unsubscribe();
            }
            menuSubscriptionRef.current = client.subscribe("/topic/menu", async () => {
                try {
                    const latestData = await refreshKioskData();
                    setCart((prev) =>
                        prev.filter((cartItem) => {
                            const latestItem = latestData.menu.find((menuItem) => menuItem.id === cartItem.id);
                            return latestItem?.isAvailable && latestItem?.stockQuantity > 0;
                        }).map((cartItem) => {
                            const latestItem = latestData.menu.find((menuItem) => menuItem.id === cartItem.id);
                            return {
                                ...cartItem,
                                qty: Math.min(cartItem.qty, latestItem.stockQuantity)
                            };
                        })
                    );
                } catch (err) {
                    console.error("Menu refresh failed:", err);
                }
            });
            tableSessionSubscriptionRef.current = client.subscribe(
                `/topic/table/${tableToken}/session`,
                handleTableSessionEvent
            );
            const activeOrderId = currentOrderRef.current?.orderId;
            if (activeOrderId) {
                subscribeToOrderUpdates(activeOrderId);
            }
        }, () => {
            console.warn("WebSocket delayed. Updates will sync on refresh.");
        });

        return () => {
            if (menuSubscriptionRef.current) menuSubscriptionRef.current.unsubscribe();
            if (tableSessionSubscriptionRef.current) tableSessionSubscriptionRef.current.unsubscribe();
            if (subscriptionRef.current) subscriptionRef.current.unsubscribe();
            if (stompClient.current) stompClient.current.disconnect();
        };
    }, [tableToken, refreshKioskData, handleTableSessionEvent, subscribeToOrderUpdates]);

    useEffect(() => {
        if (currentOrder?.orderId && stompClient.current?.connected) {
            subscribeToOrderUpdates(currentOrder.orderId);
        }
    }, [currentOrder?.orderId, subscribeToOrderUpdates]);

    useEffect(() => {
        const q = searchQuery.trim();
        if (!q) {
            setSearchSuggestions([]);
            setActiveSuggestionIndex(-1);
            return;
        }

        const debounce = setTimeout(async () => {
            try {
                const res = await api.get("/menu/autocomplete", {
                    params: { q, limit: 6, availableOnly: true }
                });
                setSearchSuggestions(Array.isArray(res.data) ? res.data : []);
            } catch (err) {
                console.error("Autocomplete fetch failed:", err);
                setSearchSuggestions([]);
            }
        }, 180);

        return () => clearTimeout(debounce);
    }, [searchQuery]);

    useEffect(() => {
        if (displayedSuggestions.length === 0) {
            setActiveSuggestionIndex(-1);
            return;
        }
        if (activeSuggestionIndex < 0 || activeSuggestionIndex >= displayedSuggestions.length) {
            setActiveSuggestionIndex(0);
        }
    }, [displayedSuggestions, activeSuggestionIndex]);

    useEffect(() => {
        if (activeSuggestionIndex < 0) {
            return;
        }
        const activeItem = document.getElementById(`kiosk-suggestion-${activeSuggestionIndex}`);
        if (activeItem) {
            activeItem.scrollIntoView({ block: "nearest" });
        }
    }, [activeSuggestionIndex]);

    useEffect(() => {
        if (!currentOrder || ["PAID", "CANCELLED"].includes(currentOrder.orderStatus)) {
            setSettleOpen(false);
            setSettleNotice("");
        }
    }, [currentOrder]);

    useEffect(() => {
        if (tableData?.status === "AVAILABLE" && !currentOrder) {
            resetLocalSessionState();
        }
    }, [tableData?.status, currentOrder, resetLocalSessionState]);

    const handleConfirmDining = async () => {
        setIsCheckingIn(true);
        try {
            await api.patch(`/table/${tableData.id}/status?status=OCCUPIED`);
            setTableData(prev => ({ ...prev, status: 'OCCUPIED' }));
        } catch {
            alert("Check-in failed. Please try again.");
        } finally {
            setIsCheckingIn(false);
        }
    };

    const handlePlaceOrder = async () => {
        if (cart.length === 0 || isSubmitting) return;

        setIsSubmitting(true);
        try {
            const payload = {
                items: cart.map(i => ({ menuItemId: i.id, quantity: i.qty })),
                notes
            };

            const res = await api.post("/table/orders", payload, {
                headers: { 'X-Table-Token': tableToken }
            });

            // UPDATE UI IMMEDIATELY
            setCurrentOrder(res.data);
            setWaitTime(res.data.estimatedWaitTime || 0);
            setCart([]);
            setNotes("");

            if (stompClient.current?.connected) {
                subscribeToOrderUpdates(res.data.orderId);
            }
        } catch (err) {
            console.error("Order Failed:", err);
            const backendMessage = err.response?.data?.message;
            const msg = backendMessage || "Failed to place order. Check your connection.";

            if (err.response?.status === 409) {
                try {
                    const latestData = await refreshKioskData();
                    setCart((prev) =>
                        prev.filter((cartItem) => {
                            const latestItem = latestData.menu.find((menuItem) => menuItem.id === cartItem.id);
                            return latestItem?.isAvailable && latestItem?.stockQuantity > 0;
                        }).map((cartItem) => {
                            const latestItem = latestData.menu.find((menuItem) => menuItem.id === cartItem.id);
                            return {
                                ...cartItem,
                                qty: Math.min(cartItem.qty, latestItem.stockQuantity)
                            };
                        })
                    );
                } catch (refreshErr) {
                    console.error("Refresh after order failure failed:", refreshErr);
                }
            }

            alert(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const requestPaymentFromAdmin = async () => {
        if (!currentOrder) return;

        setIsRequestingPayment(true);
        setSettleNotice("");
        try {
            await api.post(
                `/table/orders/${currentOrder.orderId}/request-payment`,
                {},
                { headers: { "X-Table-Token": tableToken } }
            );
            await refreshKioskData();
            setSettleNotice("Payment request sent. Cashier will handle settlement shortly.");
            setSettleOpen(false);
        } catch (err) {
            console.error("Payment request failed:", err);
            setSettleNotice(err.response?.data?.message || "Failed to notify cashier.");
        } finally {
            setIsRequestingPayment(false);
        }
    };

    const cancelOrderItem = async (orderItemId) => {
        if (!currentOrder || !orderItemId) return;
        setCancellingItems((prev) => ({ ...prev, [orderItemId]: true }));
        try {
            const res = await api.post(
                `/table/orders/${currentOrder.orderId}/items/${orderItemId}/cancel`,
                {},
                { headers: { "X-Table-Token": tableToken } }
            );
            setCurrentOrder(res.data);
            setWaitTime(res.data?.estimatedWaitTime || 0);
        } catch (err) {
            const backendMessage = err.response?.data?.message;
            alert(backendMessage || "Unable to cancel this item now.");
            await refreshKioskData();
        } finally {
            setCancellingItems((prev) => {
                const next = { ...prev };
                delete next[orderItemId];
                return next;
            });
        }
    };

    const addToTray = (item) => {
        setCart(prev => {
            const itemId = item.id || item.menuItemId;
            const availableStock = item.stockQuantity ?? MAX_QTY;

            if (item.isAvailable === false || availableStock <= 0) {
                alert(`${item.name} is currently out of stock.`);
                return prev;
            }

            const existing = prev.find(c => c.id === itemId);
            if (existing) {
                if (existing.qty >= Math.min(MAX_QTY, availableStock)) {
                    alert(`Only ${availableStock} ${item.name} available right now.`);
                    return prev;
                }
                return prev.map(c => c.id === itemId ? { ...c, qty: c.qty + 1 } : c);
            }
            return [...prev, { ...item, id: itemId, qty: 1 }];
        });
    };

    const decreaseQty = (itemId) => {
        setCart(prev => {
            const item = prev.find(c => c.id === itemId);
            if (item && item.qty > 1) return prev.map(c => c.id === itemId ? { ...c, qty: c.qty - 1 } : c);
            return prev.filter(c => c.id !== itemId);
        });
    };

    const canRequestPayment = Boolean(
        currentOrder &&
        !["PAID", "CANCELLED"].includes(currentOrder.orderStatus) &&
        !currentOrder.paymentRequested
    );
    const showCompletedBadge = Boolean(
        currentOrder && ["READY", "SERVED", "PAID"].includes(currentOrder.orderStatus)
    );
    const canCancelPendingItems = Boolean(
        currentOrder
        && ["OPEN", "PENDING"].includes(currentOrder.orderStatus)
        && !currentOrder.paymentRequested
    );

    const selectSuggestion = (suggestion) => {
        setSearchQuery(suggestion.name || "");
        if (suggestion.categoryName) {
            setSelectedCategory(suggestion.categoryName);
        }
        setIsSearchFocused(false);
        setActiveSuggestionIndex(-1);
        setSearchSuggestions([]);
    };

    const handleSearchKeyDown = (event) => {
        const hasSuggestions = displayedSuggestions.length > 0;

        if (event.key === "ArrowDown" && hasSuggestions) {
            event.preventDefault();
            setIsSearchFocused(true);
            setActiveSuggestionIndex((prev) => (prev >= displayedSuggestions.length - 1 ? 0 : prev + 1));
            return;
        }

        if (event.key === "ArrowUp" && hasSuggestions) {
            event.preventDefault();
            setIsSearchFocused(true);
            setActiveSuggestionIndex((prev) => (prev <= 0 ? displayedSuggestions.length - 1 : prev - 1));
            return;
        }

        if (event.key === "Enter" && hasSuggestions) {
            event.preventDefault();
            const indexToUse = activeSuggestionIndex >= 0 ? activeSuggestionIndex : 0;
            selectSuggestion(displayedSuggestions[indexToUse]);
            return;
        }

        if (event.key === "Escape") {
            event.preventDefault();
            setIsSearchFocused(false);
            setActiveSuggestionIndex(-1);
        }
    };

    if (loading || isSubmitting) return (
        <div className={`min-h-screen flex flex-col items-center justify-center ${isDark ? 'bg-slate-950 text-white' : 'bg-gray-50'}`}>
            <Loader2 className="animate-spin text-blue-600 mb-4" size={48} />
            <p className="font-black italic uppercase tracking-widest">
                {isSubmitting ? "Sending Order to Kitchen..." : "Syncing Kitchen..."}
            </p>
        </div>
    );

    if (error) return (
        <div className="min-h-screen flex items-center justify-center font-black uppercase text-rose-500 p-10 text-center">
            {error}
        </div>
    );

    if (tableData?.status === 'AVAILABLE') {
        return (
            <div className={`min-h-screen flex items-center justify-center p-6 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
                <div className={`max-w-md w-full p-12 rounded-[4rem] text-center shadow-2xl relative overflow-hidden transition-all ${isDark ? 'bg-slate-900 text-white border border-slate-800' : 'bg-white text-slate-900'}`}>
                    <div className="absolute top-0 left-0 w-full h-2 bg-blue-600"></div>
                    <div className="h-24 w-24 bg-blue-600 rounded-[2.5rem] flex items-center justify-center text-white mx-auto mb-8 shadow-2xl shadow-blue-600/40 rotate-6">
                        <Utensils size={48} />
                    </div>
                    <h1 className="text-5xl font-black italic tracking-tighter uppercase mb-2">Welcome</h1>
                    <p className="text-xs opacity-40 font-black tracking-[0.3em] mb-12 uppercase">Table {tableData.tableNumber}</p>
                    <button
                        onClick={handleConfirmDining}
                        disabled={isCheckingIn}
                        className="w-full py-7 bg-blue-600 text-white rounded-[2.5rem] font-black text-2xl shadow-xl hover:scale-[1.02] active:scale-95 transition-all uppercase italic tracking-tighter"
                    >
                        {isCheckingIn ? "CHECKING IN..." : "START DINING"}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={`min-h-screen pb-20 transition-colors duration-500 ${isDark ? 'bg-slate-950 text-white' : 'bg-[#F8FAFC] text-slate-900'}`}>
            <nav className={`sticky top-0 z-50 p-4 flex justify-between items-center mx-4 my-2 rounded-[2rem] shadow-xl ${isDark ? 'bg-slate-900/90' : 'bg-white/90'} backdrop-blur-md border ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                <div className="flex items-center gap-4">
                    <div className={`h-11 w-11 rounded-xl flex items-center justify-center overflow-hidden border ${branding.restaurantLogo ? 'bg-white/80 border-slate-200 dark:bg-slate-900/70 dark:border-slate-700' : 'bg-blue-600 text-white border-blue-500 shadow-lg'}`}>
                        {branding.restaurantLogo ? (
                            <img src={branding.restaurantLogo} alt="Logo" className="h-full w-full object-contain" />
                        ) : (
                            <Coffee size={20} />
                        )}
                    </div>
                    <div>
                        <span className="text-lg font-black tracking-tighter block uppercase leading-none italic">{branding.restaurantName}</span>
                        <span className="text-[10px] opacity-50 font-black uppercase tracking-widest text-blue-500">Table {tableData?.tableNumber}</span>
                    </div>
                </div>

                <div className="flex-1 max-w-md mx-8 relative hidden md:block">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30" size={18} />
                    <input
                        type="text"
                        placeholder="Search menu..."
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setActiveSuggestionIndex(-1);
                            setIsSearchFocused(true);
                        }}
                        onKeyDown={handleSearchKeyDown}
                        onFocus={() => setIsSearchFocused(true)}
                        onBlur={() => setTimeout(() => setIsSearchFocused(false), 120)}
                        className={`w-full py-3 pl-12 pr-4 rounded-2xl outline-none border transition-all ${isDark ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-600' : 'bg-slate-50 border-slate-200 focus:border-blue-600'}`}
                    />
                    {isSearchFocused && searchQuery.trim().length > 0 && (
                        <div className={`absolute left-0 right-0 mt-2 rounded-2xl border shadow-2xl overflow-hidden z-50 ${
                            isDark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"
                        }`}>
                            {displayedSuggestions.length === 0 ? (
                                <div className={`px-4 py-3 text-[11px] font-semibold ${isDark ? "text-slate-300" : "text-slate-500"}`}>
                                    No matching menu items
                                </div>
                            ) : (
                                <div className="max-h-64 overflow-y-auto custom-scrollbar">
                                    {displayedSuggestions.map((suggestion, idx) => (
                                        <button
                                            key={suggestion.id}
                                            type="button"
                                            id={`kiosk-suggestion-${idx}`}
                                            onMouseDown={() => selectSuggestion(suggestion)}
                                            className={`w-full px-4 py-3 text-left border-b last:border-b-0 transition-colors ${
                                                idx === activeSuggestionIndex
                                                    ? isDark
                                                        ? "bg-slate-800 border-slate-700"
                                                        : "bg-blue-50 border-slate-100"
                                                    : isDark
                                                        ? "border-slate-800 hover:bg-slate-800"
                                                        : "border-slate-100 hover:bg-slate-50"
                                            }`}
                                        >
                                            <p className={`text-sm font-black tracking-tight ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                                                {suggestion.name}
                                            </p>
                                            <p className={`text-[10px] font-bold uppercase tracking-[0.14em] mt-1 ${
                                                isDark ? "text-slate-400" : "text-slate-500"
                                            }`}>
                                                {suggestion.categoryName} • Rs. {suggestion.price}
                                            </p>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <button onClick={toggleTheme} className={`p-3 rounded-xl transition-colors ${isDark ? 'bg-slate-800 text-yellow-400' : 'bg-slate-100 text-slate-700'}`}>
                    {isDark ? <Sun size={20} /> : <Moon size={20} />}
                </button>
            </nav>

            <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-3 gap-10 mt-8">
                <div className="lg:col-span-2 space-y-8">
                    <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                        {categories.map((category) => (
                            <button
                                key={category}
                                onClick={() => setSelectedCategory(category)}
                                className={`px-5 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${
                                    selectedCategory === category
                                        ? "bg-blue-600 text-white shadow-lg"
                                        : isDark
                                            ? "bg-slate-900 border border-slate-800 text-slate-300"
                                            : "bg-white border border-slate-200 text-slate-500"
                                }`}
                            >
                                {category === "ALL" ? "All Items" : category}
                            </button>
                        ))}
                    </div>

                    {currentOrder && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-4 duration-500">
                                <div className={`p-8 rounded-[3rem] border-2 flex items-center justify-between relative overflow-hidden ${isDark ? 'bg-blue-600/10 border-blue-500/30' : 'bg-white border-blue-100 shadow-xl shadow-blue-500/5'}`}>
                                    <div className="z-10">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-2">Current Status</p>
                                        <p className="text-4xl font-black tracking-tighter italic uppercase leading-none">{currentOrder.orderStatus}</p>
                                        <div className="mt-4 flex items-center gap-2">
                                            <Clock size={14} className="text-blue-500" />
                                            <span className="text-xs font-bold opacity-60 uppercase">Est. {(currentOrder?.estimatedWaitTime ?? waitTime ?? 0)} Mins Remaining</span>
                                        </div>
                                    </div>
                                <div className={`h-20 w-20 rounded-[2rem] flex items-center justify-center text-white shadow-2xl overflow-hidden ${showCompletedBadge ? 'bg-emerald-500' : 'bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800/60'}`}>
                                    {showCompletedBadge ? (
                                        <CheckCircle2 size={40} />
                                    ) : (
                                        <DotLottieReact
                                            src="https://lottie.host/fcf3d210-a4ab-4177-88e0-6c178998e00d/uRLGERps5e.lottie"
                                            loop
                                            autoplay
                                            className="h-[76px] w-[76px]"
                                        />
                                    )}
                                </div>
                            </div>

                            <div className={`p-8 rounded-[3rem] border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xl shadow-slate-200/50'}`}>
                                <h3 className="text-sm font-black uppercase italic tracking-tighter mb-4 flex items-center gap-2">
                                    <History className="text-blue-600" size={18} /> Running Tab
                                </h3>
                                <div className="space-y-3 max-h-[100px] overflow-y-auto pr-2 custom-scrollbar">
                                    {currentOrder.items?.map((item, idx) => (
                                        <div key={idx} className="flex justify-between items-center py-2 border-b border-dashed border-slate-100 dark:border-slate-800 last:border-0">
                                            <div className="min-w-0 flex-1 pr-2">
                                                <p className="text-[11px] font-black uppercase opacity-70 tracking-tight truncate">{item.menuItemName}</p>
                                                <p className="text-[9px] font-bold uppercase tracking-[0.12em] opacity-40">
                                                    {item.itemStatus}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/40 text-blue-600 text-[10px] font-black rounded-lg">x{item.quantity}</span>
                                                {canCancelPendingItems && item.itemStatus === "PENDING" && (
                                                    <button
                                                        type="button"
                                                        onClick={() => cancelOrderItem(item.orderItemId)}
                                                        disabled={Boolean(cancellingItems[item.orderItemId])}
                                                        className="px-2.5 py-1 rounded-lg border border-rose-200 text-rose-600 text-[9px] font-black uppercase tracking-[0.12em] disabled:opacity-50"
                                                    >
                                                        {cancellingItems[item.orderItemId] ? "Cancelling..." : "Cancel"}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {!canCancelPendingItems && (
                                    <p className="mt-3 text-[9px] font-semibold uppercase tracking-[0.12em] opacity-50">
                                        Item cancellation is locked after kitchen preparation starts.
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {filteredMenu.map(item => (
                            <div key={item.id} className={`group p-8 rounded-[3rem] border-2 transition-all hover:border-blue-600 hover:scale-[1.02] ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-transparent shadow-md shadow-slate-200/50'}`}>
                                <div className="mb-6">
                                    <div className="h-48 rounded-[2rem] overflow-hidden mb-5 bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                        {item.imageUrl ? (
                                            <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                                        ) : (
                                            <Utensils size={38} className="opacity-20" />
                                        )}
                                    </div>
                                </div>
                                <div className="flex justify-between items-start mb-6">
                                    <div className="flex-1 pr-4">
                                        <span className="text-[9px] font-black text-blue-500 uppercase tracking-[0.2em] mb-1 block">{item.categoryName || 'Chef Special'}</span>
                                        <h3 className="text-2xl font-black italic uppercase tracking-tighter leading-tight">{item.name}</h3>
                                        {item.isAvailable === false || item.stockQuantity <= 0 ? (
                                            <span className="mt-3 inline-block text-[10px] font-black uppercase tracking-widest text-rose-500">
                                                Out of stock
                                            </span>
                                        ) : null}
                                    </div>
                                    <span className="text-2xl font-black text-slate-900 dark:text-white italic">Rs. {item.price}</span>
                                </div>
                                <button
                                    onClick={() => addToTray(item)}
                                    disabled={item.isAvailable === false || item.stockQuantity <= 0}
                                    className="w-full py-5 bg-slate-900 dark:bg-blue-600 text-white rounded-[1.5rem] font-black uppercase tracking-widest text-[11px] hover:shadow-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    {item.isAvailable === false || item.stockQuantity <= 0 ? "Unavailable" : "+ Add to Tray"}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="w-full lg:sticky lg:top-28 lg:self-start">
                    <div className={`p-8 rounded-[3.5rem] border ${isDark ? 'bg-slate-900 border-slate-800 shadow-blue-900/10' : 'bg-white border-slate-200 shadow-2xl shadow-slate-300/50'} lg:max-h-[calc(100vh-8.5rem)] lg:flex lg:flex-col`}>
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-2xl font-black flex items-center gap-3 italic uppercase tracking-tighter leading-none">
                                <ShoppingBag className="text-blue-600" /> New Items
                            </h2>
                            {cart.length > 0 && <button onClick={() => setCart([])} className="text-[10px] font-black text-rose-500 uppercase hover:underline">Clear</button>}
                        </div>

                        <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-2 custom-scrollbar">
                            <RecommendationList
                                cartItemIds={cart.map(item => item.id)}
                                onAdd={(item) => addToTray(item)}
                                isDark={isDark}
                            />

                            <div className="space-y-5 mb-8 max-h-[35vh] lg:max-h-none overflow-y-auto lg:overflow-visible pr-2 lg:pr-0 custom-scrollbar">
                                {cart.length === 0 ? (
                                    <div className="text-center py-12 opacity-20">
                                        <Sparkles size={48} className="mx-auto mb-4" />
                                        <p className="font-black uppercase text-[10px] tracking-widest">Select items to start tray</p>
                                    </div>
                                ) : cart.map(item => (
                                    <div key={item.id} className="flex justify-between items-center group animate-in slide-in-from-right-2">
                                        <div className="flex flex-col">
                                            <span className="font-black uppercase text-xs tracking-tighter leading-none mb-1">{item.name}</span>
                                            <span className="text-[10px] font-bold opacity-40 font-mono italic">Rs. {item.price}</span>
                                        </div>
                                        <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 px-2 border border-slate-200 dark:border-slate-700">
                                            <button onClick={() => decreaseQty(item.id)} className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-all"><Minus size={14} /></button>
                                            <span className="w-8 text-center text-xs font-black">{item.qty}</span>
                                            <button onClick={() => addToTray(item)} className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-all"><Plus size={14} /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className={`pt-6 border-t-2 border-dashed mb-8 ${isDark ? "border-slate-800" : "border-slate-100"}`}>
                                <div className={`rounded-2xl border p-4 space-y-2 ${isDark ? "bg-slate-950/40 border-slate-800" : "bg-slate-50 border-slate-200"}`}>
                                    <div className="flex justify-between text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                                        <span>Subtotal</span>
                                        <span className="font-mono text-slate-700 dark:text-slate-200">{formatCurrency(runningSubtotal)}</span>
                                    </div>
                                    <div className="flex justify-between text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                                        <span>Service Charge (10%)</span>
                                        <span className="font-mono text-slate-700 dark:text-slate-200">{formatCurrency(runningServiceCharge)}</span>
                                    </div>
                                    <div className="flex justify-between items-end pt-3 mt-2 border-t border-slate-200 dark:border-slate-800">
                                        <span className="text-[12px] font-black uppercase tracking-[0.16em] text-blue-600">Payable</span>
                                        <span className="text-3xl font-black text-blue-600 font-mono leading-none">{formatCurrency(runningPayableTotal)}</span>
                                    </div>
                                </div>
                            </div>

                            {currentOrder && !["PAID", "CANCELLED"].includes(currentOrder.orderStatus) && (
                                <div className={`mb-6 rounded-[2rem] border p-5 ${isDark ? "border-slate-800 bg-slate-950/60" : "border-slate-200 bg-slate-50/70"}`}>
                                    <button
                                        onClick={() => setSettleOpen((prev) => !prev)}
                                        className="w-full flex items-center justify-between text-left"
                                    >
                                        <span className="text-sm font-black uppercase tracking-[0.14em] text-blue-600">Settle Payment</span>
                                        <span className="text-[10px] font-black uppercase tracking-widest opacity-50">{settleOpen ? "Close" : "Open"}</span>
                                    </button>

                                    {settleOpen && (
                                        <div className="mt-4 space-y-3">
                                            <p className="text-[11px] font-semibold opacity-70">
                                                Request cashier for payment on this running invoice.
                                            </p>
                                            <button
                                                onClick={requestPaymentFromAdmin}
                                                disabled={!canRequestPayment || isRequestingPayment}
                                                className="w-full py-3 rounded-xl bg-blue-600 text-white text-[11px] font-black uppercase tracking-[0.16em] disabled:opacity-50"
                                            >
                                                {isRequestingPayment ? "Notifying..." : currentOrder.paymentRequested ? "Payment Requested" : "Notify Cashier"}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {settleNotice && (
                                <p className={`mb-4 text-[11px] font-semibold ${settleNotice.toLowerCase().includes("failed") ? "text-rose-500" : "text-emerald-600"}`}>
                                    {settleNotice}
                                </p>
                            )}

                            <div className="mb-4">
                                <label className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-3 block ml-2">Kitchen Note</label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="E.g. No onions, Make it hot!"
                                    className={`w-full p-5 rounded-2xl text-[11px] font-bold outline-none border transition-all focus:border-blue-600 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
                                    rows="2"
                                />
                            </div>
                        </div>

                        <button
                            onClick={handlePlaceOrder}
                            disabled={cart.length === 0 || isSubmitting}
                            className="w-full py-7 bg-blue-600 text-white rounded-[2.5rem] font-black text-2xl shadow-xl shadow-blue-500/30 hover:bg-blue-700 active:scale-95 transition-all italic tracking-tighter uppercase disabled:opacity-20 disabled:grayscale mt-6 lg:mt-4"
                        >
                            {isSubmitting ? "Placing Order..." : "Place Order"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CustomerKiosk;
