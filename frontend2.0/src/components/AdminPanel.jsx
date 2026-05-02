import React, { useEffect, useState } from "react";
import api from "../services/api";
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, BarChart, Bar, Cell
} from "recharts";

const AdminPanel = () => {
    const [analytics, setAnalytics] = useState({
        topSellingItems: [],
        peakBusyHours: [],
        stats: { totalRevenue: 0, activeOrders: 0, availableTables: 0 }
    });
    const [loading, setLoading] = useState(true);

    const BRAND_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                // MATCHING YOUR BACKEND: Changing endpoint to /admin/analytics
                // Ensure your Java controller @GetMapping matches this path.
                const response = await api.get("/admin/analytics");

                // Safety check: fill with empty arrays if backend data is missing
                setAnalytics({
                    stats: response.data.stats || { totalRevenue: 0, activeOrders: 0, availableTables: 0 },
                    topSellingItems: response.data.topSellingItems || [],
                    peakBusyHours: response.data.peakBusyHours || []
                });
            } catch (error) {
                console.error("Failed to fetch analytics:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchAnalytics();
    }, []);

    if (loading) return (
        <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
            <div className="text-center animate-pulse">
                <div className="text-blue-600 font-black text-4xl mb-2">FOS PRO</div>
                <div className="text-gray-500 font-bold tracking-widest uppercase text-xs">Loading Executive Insights...</div>
            </div>
        </div>
    );

    return (
        <div className="p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 bg-gray-50 dark:bg-gray-900 min-h-screen">
            {/* Header */}
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-4xl font-black tracking-tighter text-gray-900 dark:text-white">Executive Dashboard</h2>
                    <p className="text-gray-500 dark:text-gray-400 font-medium">Real-time performance metrics for your restaurant.</p>
                </div>
                <div className="hidden md:block">
                    <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border border-green-200 dark:border-green-800">
                        Live System
                    </span>
                </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                    { label: "Total Revenue", value: `Rs. ${analytics.stats.totalRevenue?.toLocaleString()}`, color: "text-green-600" },
                    { label: "Active Orders", value: analytics.stats.activeOrders, color: "text-blue-600" },
                    { label: "Tables Available", value: analytics.stats.availableTables, color: "text-orange-500" }
                ].map((stat, i) => (
                    <div key={i} className="bg-white dark:bg-gray-800 p-8 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700 transition-all hover:shadow-xl hover:-translate-y-1">
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest">{stat.label}</p>
                        <h3 className={`text-4xl font-black mt-2 ${stat.color}`}>{stat.value || 0}</h3>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Chart 1: Traffic */}
                <div className="bg-white dark:bg-gray-800 p-8 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700">
                    <h3 className="text-xl font-black mb-8 text-gray-900 dark:text-white flex items-center gap-2">
                        <span className="w-2 h-6 bg-blue-600 rounded-full"></span> Order Traffic
                    </h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={analytics.peakBusyHours}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ccc" opacity={0.1} />
                                <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12, fontWeight: 'bold'}} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#111827', borderRadius: '16px', border: 'none', color: '#fff', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)' }}
                                    itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                                />
                                <Line type="monotone" dataKey="orders" stroke="#2563eb" strokeWidth={6} dot={{ r: 0 }} activeDot={{ r: 8, stroke: '#fff', strokeWidth: 4 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Chart 2: Top Selling */}
                <div className="bg-white dark:bg-gray-800 p-8 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700">
                    <h3 className="text-xl font-black mb-8 text-gray-900 dark:text-white flex items-center gap-2">
                        <span className="w-2 h-6 bg-emerald-500 rounded-full"></span> Best Sellers
                    </h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={analytics.topSellingItems} layout="vertical">
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={100} axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 11, fontWeight: 'black'}} />
                                <Tooltip cursor={{fill: 'rgba(156, 163, 175, 0.1)'}} contentStyle={{ borderRadius: '12px', border: 'none' }} />
                                <Bar dataKey="salesCount" radius={[0, 12, 12, 0]} barSize={14}>
                                    {analytics.topSellingItems.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={BRAND_COLORS[index % BRAND_COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminPanel;