import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { WS_URL } from '../services/runtime';
import SockJS from "sockjs-client";
import { Stomp } from "@stomp/stompjs";
import { LayoutGrid, Users, Plus, Trash2, CheckCircle2, XCircle, Loader2, QrCode, ExternalLink } from 'lucide-react';

const TableManager = () => {
    const [tables, setTables] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newTable, setNewTable] = useState({ tableNumber: '', capacity: 4 });
    const stompClient = useRef(null);

    useEffect(() => {
        fetchTables();

        // Establish WebSocket connection for real-time table status updates
        const socket = new SockJS(WS_URL);
        const client = Stomp.over(socket);
        client.debug = () => {}; // Keeps the console clean
        client.reconnect_delay = 5000;

        client.connect({}, () => {
            stompClient.current = client;
            // Listen for any table updates (from Kiosk or other Admin actions)
            client.subscribe("/topic/tables", (message) => {
                try {
                    const updatedTable = JSON.parse(message.body);
                    setTables(prev => prev.map(t =>
                        t.id === updatedTable.id ? updatedTable : t
                    ));
                } catch {
                    fetchTables();
                }
            });
        }, (err) => {
            console.error("WebSocket Connection Error:", err);
        });

        return () => {
            if (stompClient.current) stompClient.current.disconnect();
        };
    }, []);

    const fetchTables = async () => {
        try {
            setLoading(true);
            const res = await api.get('/table/all');
            setTables(res.data);
        } catch (err) {
            console.error("Fetch error:", err);
        } finally {
            setLoading(false);
        }
    };

    const toggleStatus = async (id, currentStatus) => {
        const nextStatus = currentStatus === 'AVAILABLE' ? 'OCCUPIED' : 'AVAILABLE';
        try {
            // This call triggers the backend updateStatus() which broadcasts to /topic/tables
            await api.patch(`/table/${id}/status?status=${nextStatus}`);
            // Note: We don't strictly need to setTables here because the
            // WebSocket subscription will handle the update for us instantly.
        } catch {
            alert("Status update failed.");
        }
    };

    const handleAddTable = async (e) => {
        e.preventDefault();
        try {
            const res = await api.post('/table/register', newTable);
            setTables(prev => [...prev, res.data]);
            setShowAddModal(false);
            setNewTable({ tableNumber: '', capacity: 4 });
        } catch {
            alert("Registration failed.");
        }
    };

    const deleteTable = async (id) => {
        if (!window.confirm("Delete this table?")) return;
        try {
            await api.delete(`/table/${id}`);
            setTables(prev => prev.filter(t => t.id !== id));
        } catch {
            alert("Delete failed");
        }
    };

    const getStatusStyles = (status) => {
        switch (status) {
            case 'AVAILABLE': return 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/40 dark:text-emerald-400';
            case 'OCCUPIED': return 'bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/40 dark:text-rose-400';
            default: return 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/70 dark:border-slate-700 dark:text-slate-300';
        }
    };

    if (loading) return <div className="h-96 flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={40} /></div>;

    return (
        <div className="ops-page space-y-6">
            <header className="ops-header-card">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-5">
                    <div className="space-y-2">
                        <p className="ops-kicker">Floor Operations</p>
                        <h1 className="ops-title">Table Manager</h1>
                        <p className="ops-subtitle">{tables.length} tables with live occupancy sync</p>
                    </div>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="ops-btn-primary px-5 py-3 inline-flex items-center justify-center gap-2 w-full md:w-auto"
                    >
                        <Plus size={16}/> Add Table
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {tables.map(table => (
                    <div key={table.id} className="ops-panel p-5 space-y-5 transition-all">
                        <div className="flex justify-between items-start">
                            <div className="space-y-1">
                                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Table</span>
                                <h3 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">#{table.tableNumber}</h3>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.16em] border ${getStatusStyles(table.status)}`}>
                                {table.status}
                            </span>
                        </div>

                        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-4 space-y-3">
                            <div className="flex items-center justify-between text-slate-700 dark:text-slate-200">
                                <span className="flex items-center gap-2 text-sm font-bold">
                                    <Users size={16} />
                                    {table.capacity} Seats
                                </span>
                                <LayoutGrid size={18} className="text-slate-400" />
                            </div>
                            <div className="flex items-center gap-2 overflow-hidden">
                                <QrCode size={16} className="shrink-0 text-slate-400" />
                                <span className="text-[10px] font-mono font-bold truncate text-slate-500 dark:text-slate-400">{table.tableToken}</span>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            <div className="flex gap-2">
                                <button
                                    onClick={() => toggleStatus(table.id, table.status)}
                                    className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-[0.16em] flex items-center justify-center gap-2 transition-all ${table.status === 'AVAILABLE' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}
                                >
                                    {table.status === 'AVAILABLE' ? <CheckCircle2 size={16}/> : <XCircle size={16}/>}
                                    {table.status === 'AVAILABLE' ? 'Occupy' : 'Clear'}
                                </button>
                                <button onClick={() => deleteTable(table.id)} className="ops-btn-secondary p-3.5 text-rose-600 border-rose-100 dark:border-rose-900/50 dark:bg-rose-950/20">
                                    <Trash2 size={18}/>
                                </button>
                            </div>

                            <button
                                onClick={() => window.open(`/?token=${table.tableToken}`, '_blank')}
                                className="ops-btn-secondary w-full py-3 flex items-center justify-center gap-2"
                            >
                                <ExternalLink size={14}/> Open Kiosk
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {showAddModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
                    <div className="ops-panel p-7 md:p-8 w-full max-w-md space-y-6 shadow-2xl">
                        <h2 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">Register Table</h2>
                        <form onSubmit={handleAddTable} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Table Number</label>
                                <input required type="number" className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 text-slate-800 dark:text-slate-100 font-semibold outline-none focus:border-blue-500" value={newTable.tableNumber} onChange={e => setNewTable({...newTable, tableNumber: e.target.value})} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Capacity</label>
                                <input required type="number" className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 text-slate-800 dark:text-slate-100 font-semibold outline-none focus:border-blue-500" value={newTable.capacity} onChange={e => setNewTable({...newTable, capacity: e.target.value})} />
                            </div>
                            <div className="flex gap-4 pt-4">
                                <button type="button" onClick={() => setShowAddModal(false)} className="ops-btn-secondary flex-1 p-3">Cancel</button>
                                <button type="submit" className="ops-btn-primary flex-[1.6] p-3">Register</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TableManager;
