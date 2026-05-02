import React, { useEffect, useState } from "react";
import api from "../services/api";
import { WS_URL } from "../services/runtime";
import SockJS from "sockjs-client";
import { Stomp } from "@stomp/stompjs";
import {
    ArrowLeft,
    Bell,
    Boxes,
    CheckCircle,
    ChefHat,
    Clock,
    Flame,
    History
} from "lucide-react";
import { toast } from "react-hot-toast";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

const KitchenDashboard = () => {
    const { user } = useAuth();
    const { branding } = useTheme();
    const [orders, setOrders] = useState([]);
    const [historyOrders, setHistoryOrders] = useState([]);
    const [showHistory, setShowHistory] = useState(false);
    const [stats, setStats] = useState({ ordersCompletedToday: 0, averagePrepTime: 0, activeOrders: 0 });
    const [loading, setLoading] = useState(true);
    const [updatingKey, setUpdatingKey] = useState(null);

    const fetchData = async () => {
        try {
            const [queueRes, statsRes, historyRes] = await Promise.all([
                api.get("/kitchen/orders/active"),
                api.get("/kitchen/stats"),
                api.get("/kitchen/orders/history").catch(() => ({ data: [] }))
            ]);
            setOrders(queueRes.data);
            setStats(statsRes.data);
            setHistoryOrders(historyRes.data);
        } catch (err) {
            console.error("Data fetch failed", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();

        const socket = new SockJS(WS_URL);
        const client = Stomp.over(socket);
        client.debug = () => {};
        client.reconnect_delay = 5000;
        client.connect({}, () => {
            client.subscribe("/topic/kitchen", (message) => {
                if (!message.body || message.body === "refresh") {
                    fetchData();
                    return;
                }

                try {
                    const updatedOrder = JSON.parse(message.body);
                    if (["OPEN", "PENDING"].includes(updatedOrder.orderStatus)) {
                        toast.success(`New Order: Table ${updatedOrder.tableNumber}`);
                    }
                } catch {
                    // Ignore malformed websocket payloads; pull fresh queue from API below.
                }

                fetchData();
            });
        });

        return () => client.disconnect();
    }, []);

    const handleItemStatusUpdate = async (orderItemId, nextStatus) => {
        setUpdatingKey(`${orderItemId}:${nextStatus}`);
        try {
            await api.put(`/kitchen/orders/items/${orderItemId}/status`, {
                status: nextStatus
            });
            toast.success(`Item moved to ${nextStatus}`);
        } catch (err) {
            toast.error(err.response?.data?.message || "Item update failed");
        } finally {
            setUpdatingKey(null);
        }
    };

    const handleOrderStatusUpdate = async (orderId, nextStatus) => {
        setUpdatingKey(`order:${orderId}:${nextStatus}`);
        try {
            await api.put(`/kitchen/orders/${orderId}/status`, null, {
                params: { status: nextStatus.toUpperCase() }
            });
            toast.success(`Order moved to ${nextStatus}`);
        } catch (err) {
            toast.error(err.response?.data?.message || "Order update failed");
        } finally {
            setUpdatingKey(null);
        }
    };

    if (loading) {
        return <div className="h-screen flex items-center justify-center font-black italic uppercase">Syncing Kitchen...</div>;
    }

    const incoming = orders.filter((order) => ["OPEN", "PENDING"].includes(order.orderStatus));
    const inProgress = orders.filter((order) => order.orderStatus === "IN_PROGRESS");
    const readyToServe = orders.filter((order) => order.orderStatus === "READY");

    return (
        <div className="ops-page flex flex-col p-5 md:p-6 transition-colors">
            <div className="ops-header-card mb-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <p className="ops-kicker">{branding.restaurantName}</p>
                        <h1 className="ops-title">Kitchen Dashboard</h1>
                        <p className="ops-subtitle">{stats.activeOrders} Active Tickets</p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={() => setShowHistory(!showHistory)}
                            className="ops-btn-primary px-5 py-3 flex items-center gap-2"
                        >
                            {showHistory ? <><ArrowLeft size={14} /> Back</> : <><History size={14} /> History</>}
                        </button>

                        <Link
                            to={user?.role === "ROLE_ADMIN" ? "/admin/inventory" : "/kitchen/inventory"}
                            className="ops-btn-secondary px-5 py-3 flex items-center gap-2"
                        >
                            <Boxes size={14} /> Inventory
                        </Link>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full mt-5">
                    <StatCard label="Shift Completed" value={stats.ordersCompletedToday} icon={<CheckCircle className="text-emerald-500" />} />
                    <StatCard label="Avg Prep Time" value={`${stats.averagePrepTime}m`} icon={<Clock className="text-blue-500" />} />
                    <StatCard label="Active Orders" value={stats.activeOrders} icon={<Flame className="text-orange-500" />} />
                </div>
            </div>

            {showHistory ? (
                <div className="flex-1 overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {historyOrders.map((order) => (
                            <OrderCard key={order.orderId} order={order} isHistory />
                        ))}
                    </div>
                </div>
            ) : (
                <div className="flex-1 grid grid-cols-1 xl:grid-cols-3 gap-8 overflow-hidden">
                    <Column title="Incoming" count={incoming.length} icon={<Bell className="text-blue-500" />}>
                        {incoming.length === 0 ? (
                            <EmptyState message="No waiting tickets" />
                        ) : (
                            incoming.map((order) => (
                                <OrderCard
                                    key={order.orderId}
                                    order={order}
                                    onOrderMove={() => handleOrderStatusUpdate(order.orderId, "IN_PROGRESS")}
                                    onItemMove={handleItemStatusUpdate}
                                    updatingKey={updatingKey}
                                    nextOrderAction="Start Full Order"
                                />
                            ))
                        )}
                    </Column>

                    <Column title="Currently Cooking" count={inProgress.length} icon={<Flame className="text-orange-500" />} isCooking>
                        {inProgress.length === 0 ? (
                            <EmptyState message="Cooking lane is clear" />
                        ) : (
                            inProgress.map((order) => (
                                <OrderCard
                                    key={order.orderId}
                                    order={order}
                                    onOrderMove={() => handleOrderStatusUpdate(order.orderId, "READY")}
                                    onItemMove={handleItemStatusUpdate}
                                    updatingKey={updatingKey}
                                    nextOrderAction="Mark Whole Order Ready"
                                    isCooking
                                />
                            ))
                        )}
                    </Column>

                    <Column title="Ready To Serve" count={readyToServe.length} icon={<CheckCircle className="text-emerald-500" />}>
                        {readyToServe.length === 0 ? (
                            <EmptyState message="Nothing waiting to be served" />
                        ) : (
                            readyToServe.map((order) => (
                                <OrderCard
                                    key={order.orderId}
                                    order={order}
                                    onOrderMove={() => handleOrderStatusUpdate(order.orderId, "SERVED")}
                                    onItemMove={handleItemStatusUpdate}
                                    updatingKey={updatingKey}
                                    nextOrderAction="Mark Whole Order Served"
                                />
                            ))
                        )}
                    </Column>
                </div>
            )}
        </div>
    );
};

const Column = ({ title, count, children, icon, isCooking }) => (
    <div className="flex flex-col gap-4 overflow-hidden">
        <div className="flex justify-between items-center px-2">
            <h2 className="text-xs font-extrabold uppercase tracking-[0.16em] flex items-center gap-2 text-slate-700 dark:text-slate-200">{icon} {title}</h2>
            <span className={`px-3 py-1 rounded-full text-[10px] font-black ${isCooking ? "bg-orange-500 text-white" : "bg-blue-600 text-white"}`}>{count}</span>
        </div>
        <div className="flex-1 overflow-y-auto space-y-4 pb-10 custom-scrollbar">{children}</div>
    </div>
);

const StatCard = ({ icon, label, value }) => (
    <div className="ops-stat-card p-4 flex items-center gap-4 min-w-[160px]">
        <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl">{icon}</div>
        <div>
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
            <p className="text-xl font-extrabold text-slate-900 dark:text-slate-100">{value}</p>
        </div>
    </div>
);

const OrderCard = ({ order, onOrderMove, onItemMove, updatingKey, nextOrderAction, isCooking, isHistory }) => (
    <div className={`ops-panel p-5 border-2 transition-all ${isCooking ? "border-orange-500/20 shadow-lg" : "border-transparent shadow-sm"} ${isHistory ? "opacity-70" : ""}`}>
        <div className="flex justify-between items-start mb-4">
            <div>
                <span className="text-[10px] font-black bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full uppercase mb-2 inline-block">Table {order.tableNumber}</span>
                <h3 className="text-lg font-extrabold uppercase tracking-tight text-slate-900 dark:text-slate-100">#{order.orderNumber || order.orderId}</h3>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mt-2">{order.orderStatus}</p>
            </div>
            <p className="font-mono font-bold text-orange-500">{order.estimatedWaitTime ?? 0}m</p>
        </div>

        <div className="space-y-3 mb-6">
            {order.items?.map((item) => (
                <div key={item.orderItemId || `${item.menuItemId}-${item.menuItemName}`} className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl">
                    <div className="flex justify-between items-start gap-3">
                        <div>
                            <p className="font-bold uppercase text-xs text-slate-900 dark:text-slate-100">
                                <span className="text-blue-500 mr-2">x{item.quantity}</span>
                                {item.menuItemName}
                            </p>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] mt-2 text-slate-400">{item.itemStatus}</p>
                        </div>
                        {!isHistory && (
                            <div className="flex flex-col items-end gap-2 min-w-[132px]">
                                {getNextItemAction(item.itemStatus) ? (
                                    <ItemActionButton
                                        label={getNextItemAction(item.itemStatus).label}
                                        disabled={updatingKey === `${item.orderItemId}:${getNextItemAction(item.itemStatus).status}`}
                                        onClick={() => onItemMove(item.orderItemId, getNextItemAction(item.itemStatus).status)}
                                    />
                                ) : (
                                    <span className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600">
                                        Done
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>

        {!isHistory && onOrderMove && (
            <button
                onClick={onOrderMove}
                className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-2 ${isCooking ? "bg-green-600 text-white" : "bg-slate-900 dark:bg-white dark:text-black text-white"}`}
            >
                {isCooking ? <CheckCircle size={14} /> : <ChefHat size={14} />} {nextOrderAction}
            </button>
        )}
    </div>
);

const ItemActionButton = ({ label, disabled, onClick }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all bg-blue-600 text-white disabled:opacity-40"
    >
        {label}
    </button>
);

const EmptyState = ({ message }) => (
    <div className="flex flex-col items-center justify-center py-20 opacity-30">
        <Clock size={48} className="mb-4" />
        <p className="font-black uppercase tracking-tighter">{message}</p>
    </div>
);

const getNextItemAction = (currentStatus) => {
    const actions = {
        PENDING: { status: "PREPARING", label: "Start Prep" },
        PREPARING: { status: "READY", label: "Mark Ready" },
        READY: { status: "SERVED", label: "Mark Served" }
    };

    return actions[currentStatus] || null;
};

export default KitchenDashboard;
