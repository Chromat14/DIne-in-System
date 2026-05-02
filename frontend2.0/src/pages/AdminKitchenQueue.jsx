import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { CheckCircle, Clock, UtensilsCrossed } from 'lucide-react';
import SockJS from 'sockjs-client';
import { Stomp } from '@stomp/stompjs';
import { WS_URL } from '../services/runtime';

const AdminKitchenQueue = () => {
    const [queue, setQueue] = useState([]);

    useEffect(() => {
        // Fetch initially
        api.get('/kitchen/orders/active').then(res => setQueue(res.data));

        // Live updates via WebSocket
        const socket = new SockJS(WS_URL);
        const client = Stomp.over(socket);
        client.debug = () => {};
        client.connect({}, () => {
            client.subscribe("/topic/kitchen", (message) => {
                if (!message.body || message.body === "refresh") {
                    api.get('/kitchen/orders/active').then(res => setQueue(res.data));
                    return;
                }
                api.get('/kitchen/orders/active').then(res => setQueue(res.data));
            });
        });
        return () => client.disconnect();
    }, []);

    const handleSettle = async (orderId) => {
        try {
            await api.post(`/admin/orders/${orderId}/settle`);
            setQueue(queue.filter(o => o.orderId !== orderId));
        } catch (err) {
            console.error("Settlement failed", err);
        }
    };

    return (
        <div className="ops-page space-y-6 animate-in fade-in duration-500">
            <header className="ops-header-card">
                <div className="space-y-2">
                    <p className="ops-kicker">Kitchen Billing Bridge</p>
                    <h1 className="ops-title">Kitchen Queue</h1>
                    <p className="ops-subtitle">{queue.length} active kitchen tickets</p>
                </div>
            </header>

            <div className="grid gap-4">
                {queue.map(order => (
                    <div key={order.orderId} className="ops-panel p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-l-4 border-blue-500">
                        <div className="space-y-2">
                            <div className="flex items-center gap-3">
                                <span className="bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 text-blue-600 px-3 py-1 rounded-lg font-mono font-bold text-xs">{order.orderNumber}</span>
                                <span className="text-slate-400 dark:text-slate-500 flex items-center gap-1 text-xs font-semibold"><Clock size={14}/> {new Date(order.placedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            </div>
                            <h3 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">Table {order.tableNumber}</h3>
                            <div className="flex flex-wrap gap-2 mt-2">
                                {order.items.map((item, idx) => (
                                    <span key={idx} className="bg-slate-100 dark:bg-slate-800/90 px-3 py-1 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200">
                                        {item.quantity}x {item.menuItemName}
                                    </span>
                                ))}
                            </div>
                        </div>

                        <div className="mt-6 md:mt-0 flex items-center gap-4 w-full md:w-auto">
                            <div className="text-right hidden md:block mr-4">
                                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Total Bill</p>
                                <p className="text-xl font-extrabold text-slate-900 dark:text-white">Rs. {order.totalAmount}</p>
                            </div>
                            {order.orderStatus === 'READY' ? (
                                <button onClick={() => handleSettle(order.orderId)} className="ops-btn-primary flex-1 md:flex-none px-6 py-3 bg-emerald-600">
                                    Settle & Close
                                </button>
                            ) : (
                                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold px-4 py-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-xl text-xs uppercase tracking-[0.14em]">
                                    <UtensilsCrossed size={18}/> Cooking...
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AdminKitchenQueue;
