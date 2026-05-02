import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    TrendingUp, Users, Receipt, X, ArrowUpRight, Printer,
    CreditCard, Clock, Wallet, Banknote, Globe, QrCode, CheckCircle2
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import KhaltiCheckout from "khalti-checkout-web";
import SockJS from "sockjs-client";
import { Stomp } from "@stomp/stompjs";
import api from '../services/api';
import { WS_URL } from '../services/runtime';
import { toast } from 'react-hot-toast';
import { useTheme } from '../context/ThemeContext';

const AdminDashboard = () => {
    const { branding } = useTheme();
    const [stats, setStats] = useState({ totalRevenue: 0, activeOrders: 0, availableTables: 0, busyHours: [] });
    const [activeTabs, setActiveTabs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedTab, setSelectedTab] = useState(null);
    const [paymentMethod, setPaymentMethod] = useState('CASH');
    const [transactionId, setTransactionId] = useState('');
    const [discountInput, setDiscountInput] = useState('');
    const [showReceipt, setShowReceipt] = useState(true);
    const stompRef = useRef(null);
    const SERVICE_CHARGE_RATE = 0.10;

    const normalizeAmount = (value) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    };

    const roundCurrency = (value) => Math.round(normalizeAmount(value) * 100) / 100;

    const formatCurrency = (value) => (
        `Rs. ${roundCurrency(value).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`
    );

    const getTabSubtotal = (tab) => {
        if (!tab) {
            return 0;
        }
        if (tab.subtotal !== null && tab.subtotal !== undefined) {
            return normalizeAmount(tab.subtotal);
        }
        if (!Array.isArray(tab.items)) {
            return normalizeAmount(tab.totalAmount);
        }
        return tab.items.reduce((sum, item) => sum + normalizeAmount(item?.lineTotal), 0);
    };

    const getTabBreakdown = (tab, requestedDiscount = null) => {
        const subtotal = roundCurrency(getTabSubtotal(tab));
        const backendTotal = roundCurrency(tab?.totalAmount);
        const backendServiceCharge = tab?.serviceCharge;
        const backendDiscount = roundCurrency(tab?.discountAmount);

        let serviceCharge = 0;
        let grossTotal = 0;

        if (backendServiceCharge !== null && backendServiceCharge !== undefined && normalizeAmount(backendServiceCharge) > 0) {
            serviceCharge = roundCurrency(backendServiceCharge);
            grossTotal = roundCurrency(subtotal + serviceCharge);
        } else if (backendTotal > subtotal) {
            serviceCharge = roundCurrency(backendTotal - subtotal);
            grossTotal = backendTotal;
        } else {
            serviceCharge = roundCurrency(subtotal * SERVICE_CHARGE_RATE);
            grossTotal = roundCurrency(subtotal + serviceCharge);
        }

        const discount = roundCurrency(
            requestedDiscount !== null && requestedDiscount !== undefined
                ? requestedDiscount
                : backendDiscount
        );
        const safeDiscount = Math.min(Math.max(discount, 0), grossTotal);
        const payableTotal = roundCurrency(grossTotal - safeDiscount);

        return {
            subtotal,
            serviceCharge,
            discount: safeDiscount,
            payableTotal
        };
    };

    const requestedDiscount = Math.max(0, roundCurrency(discountInput));
    const selectedBreakdown = getTabBreakdown(selectedTab, requestedDiscount);

    const loadData = useCallback(async () => {
        try {
            const [analyticsRes, activeRes] = await Promise.all([
                api.get('/admin/analytics'),
                api.get('/admin/orders/active')
            ]);
            setStats({
                totalRevenue: analyticsRes.data.stats?.totalRevenue || 0,
                activeOrders: analyticsRes.data.stats?.activeOrders || 0,
                availableTables: analyticsRes.data.stats?.availableTables || 0,
                busyHours: analyticsRes.data.peakBusyHours || []
            });
            setActiveTabs(
                (activeRes.data || [])
                    .filter(tab => ['READY', 'SERVED', 'IN_PROGRESS', 'OPEN', 'PENDING'].includes(tab.orderStatus))
                    .sort((a, b) => {
                        const bPaymentRequested = b.paymentRequested === true;
                        const aPaymentRequested = a.paymentRequested === true;
                        if (bPaymentRequested !== aPaymentRequested) {
                            return bPaymentRequested ? 1 : -1;
                        }
                        const etaA = Number(a.estimatedWaitTime || 0);
                        const etaB = Number(b.estimatedWaitTime || 0);
                        if (etaB !== etaA) {
                            return etaB - etaA;
                        }
                        return new Date(a.placedAt || 0).getTime() - new Date(b.placedAt || 0).getTime();
                    })
            );
        } catch (err) { console.error(err); }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    useEffect(() => {
        const socket = new SockJS(WS_URL);
        const client = Stomp.over(socket);
        client.debug = () => {};
        client.reconnect_delay = 5000;

        client.connect({}, () => {
            stompRef.current = client;
            client.subscribe("/topic/admin/payments", (message) => {
                try {
                    const payload = message.body ? JSON.parse(message.body) : null;
                    if (payload?.eventType === "CUSTOMER_READY_TO_PAY") {
                        toast.success(`Customer is ready to pay: Table ${payload.tableNumber}`);
                    } else if (payload?.paymentStatus === "PAID" || payload?.paymentStatus === "SUCCESS") {
                        toast.success(`Payment completed: ${payload.orderNumber || payload.orderId}`);
                    }
                } catch {
                    // ignore parse issues and still refresh list
                }
                loadData();
            });
            client.subscribe("/topic/kitchen", () => {
                loadData();
            });
            client.subscribe("/topic/admin/stats", () => {
                loadData();
            });
            client.subscribe("/topic/tables", () => {
                loadData();
            });
        }, () => {
            console.warn("Admin dashboard websocket disconnected. Retrying...");
        });

        return () => {
            if (stompRef.current) {
                stompRef.current.disconnect();
            }
        };
    }, [loadData]);

    const handlePrint = () => {
        if (!selectedTab) {
            return;
        }
        window.print();
    };

    const handleSettleAction = () => {
        if (!selectedTab) return;
        if (paymentMethod === 'ONLINE') {
            const config = {
                publicKey: "test_public_key_your_key_here",
                productIdentity: selectedTab.orderId.toString(),
                productName: `Table ${selectedTab.tableNumber} Order`,
                productUrl: window.location.origin,
                eventHandler: {
                    onSuccess(payload) { finalizeSettlement('ONLINE', payload.token); },
                    onError() { toast.error("Khalti Gateway Error"); }
                },
                paymentPreference: ["KHALTI", "EBANKING", "CONNECT_IPS"],
            };
            const checkout = new KhaltiCheckout(config);
            checkout.show({ amount: Math.round(selectedBreakdown.payableTotal * 100) });
        } else {
            finalizeSettlement(paymentMethod, transactionId);
        }
    };

    const finalizeSettlement = async (method, refId = null) => {
        setLoading(true);
        try {
            await api.post(`/admin/orders/${selectedTab.orderId}/settle`, {
                paymentMethod: method,
                transactionToken: refId,
                discountAmount: selectedBreakdown.discount > 0 ? selectedBreakdown.discount : null
            });
            toast.success(`Bill Settled via ${method}`);
            setSelectedTab(null);
            setTransactionId('');
            setDiscountInput('');
            setShowReceipt(true);
            loadData();
        } catch {
            toast.error("Settlement sync failed.");
        } finally {
            setLoading(false);
        }
    };

    const paymentRequests = activeTabs.filter(tab => tab.paymentRequested).length;

    return (
        <div className="ops-page p-5 md:p-6 space-y-6 transition-colors">
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    body * { visibility: hidden; }
                    .print-section, .print-section * { visibility: visible; }
                    .invoice-modal-overlay {
                        position: static !important;
                        inset: auto !important;
                        background: transparent !important;
                        backdrop-filter: none !important;
                        padding: 0 !important;
                        display: block !important;
                    }
                    .invoice-modal-card {
                        width: 100% !important;
                        max-width: 100% !important;
                        max-height: none !important;
                        border-radius: 0 !important;
                        border: none !important;
                        box-shadow: none !important;
                        overflow: visible !important;
                    }
                    .print-section {
                        position: static !important;
                        width: 100% !important;
                        max-height: none !important;
                        overflow: visible !important;
                        margin: 0 auto !important;
                        padding: 24px !important;
                    }
                    .no-print { display: none !important; }
                }
                .custom-scrollbar::-webkit-scrollbar { display: none; }
                .custom-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}} />

            <header className="ops-header-card no-print">
                <div className="flex justify-between items-start gap-5">
                    <div className="space-y-2">
                        <span className="ops-kicker inline-flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-blue-500" />
                            {branding.restaurantName}
                        </span>
                        <h1 className="ops-title">
                            Executive <span className="text-blue-600">Dashboard</span>
                        </h1>
                        <p className="ops-subtitle">{activeTabs.length} Active Billing Sessions</p>
                    </div>

                    <div className="hidden md:flex items-center gap-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 px-4 py-3">
                        <div className={`h-12 w-12 rounded-xl overflow-hidden flex items-center justify-center border ${branding.restaurantLogo ? 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-700 p-1.5' : 'bg-blue-600 text-white border-blue-500'}`}>
                            {branding.restaurantLogo ? (
                                <img src={branding.restaurantLogo} alt="Restaurant Logo" className="h-full w-full object-contain" />
                            ) : (
                                <Receipt size={20} />
                            )}
                        </div>
                        <div className="leading-tight">
                            <p className="text-[10px] uppercase tracking-widest font-black text-slate-400">Branding Synced</p>
                            <p className="text-sm font-black text-slate-800 dark:text-slate-100">{branding.tagline || "Restaurant operations"}</p>
                        </div>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 no-print">
                <StatCard label="Live Revenue" value={`Rs. ${stats.totalRevenue}`} icon={<TrendingUp />} color="blue" />
                <StatCard label="Ready To Pay" value={paymentRequests} icon={<Wallet />} color="emerald" />
                <StatCard label="Free Tables" value={stats.availableTables} icon={<Users />} color="orange" />
            </div>

            <section className="ops-panel p-6 md:p-8 no-print">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {activeTabs.map(tab => (
                        <div key={tab.orderId} className="p-6 bg-slate-50 dark:bg-[#1E293B]/50 rounded-[1.6rem] border border-slate-200 dark:border-slate-700/50 hover:border-blue-500 transition-all group">
                            <div className="flex justify-between mb-6">
                                <span className="text-[10px] font-black uppercase text-blue-500 bg-blue-50 dark:bg-blue-900/20 px-3 py-1 rounded-full border border-blue-100 dark:border-blue-800">Table {tab.tableNumber}</span>
                                <p className="text-xl font-black text-emerald-500">{formatCurrency(getTabBreakdown(tab).payableTotal)}</p>
                            </div>
                            <h4 className="text-[10px] font-bold text-slate-400 mb-4 font-mono tracking-tighter">{tab.orderNumber}</h4>
                            {tab.paymentRequested ? (
                                <div className="mb-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-[10px] font-black uppercase tracking-[0.14em] border border-amber-100 dark:border-amber-900/40">
                                    Customer is ready to pay
                                </div>
                            ) : null}
                            <button
                                onClick={() => {
                                    setSelectedTab(tab);
                                    setPaymentMethod('CASH');
                                    setShowReceipt(true);
                                    setDiscountInput('');
                                }}
                                className="w-full py-4 bg-slate-900 dark:bg-blue-600 text-white rounded-xl font-black uppercase text-xs tracking-[0.16em] group-hover:bg-blue-700 transition-colors"
                            >
                                View Invoice
                            </button>
                        </div>
                    ))}
                </div>
            </section>

            {selectedTab && (
                <div className="invoice-modal-overlay fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="invoice-modal-card bg-white dark:bg-[#111A2E] w-full max-w-lg max-h-[90vh] rounded-[3.5rem] shadow-2xl overflow-hidden relative border border-slate-200 dark:border-slate-800 flex flex-col">
                        <button
                            onClick={() => {
                                setSelectedTab(null);
                                setDiscountInput('');
                            }}
                            className="absolute top-8 right-8 text-slate-400 hover:text-red-500 z-50 transition-colors"
                        >
                            <X size={24} />
                        </button>

                        <div className="flex flex-col flex-grow overflow-hidden">
                            {/* Receipt View */}
                            <div className={`p-10 w-full flex flex-col flex-grow print-section ${!showReceipt ? 'hidden' : 'block animate-in zoom-in-95 duration-300'}`}>
                                <div className="text-center mb-6">
                                    <h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase italic tracking-tighter">{branding.restaurantName}</h2>
                                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em] mt-1">{branding.tagline || 'Invoice Summary'}</p>
                                </div>

                                <div className="border-y-2 border-dashed border-slate-200 dark:border-slate-800 py-4 mb-4 grid grid-cols-3 gap-3 items-center font-mono">
                                    <div className="space-y-1">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Table</p>
                                        <p className="text-base font-black text-slate-900 dark:text-white">{selectedTab.tableNumber}</p>
                                    </div>
                                    <div className="text-center space-y-1">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Generated</p>
                                        <p className="text-xs font-black text-slate-900 dark:text-white">{new Date().toLocaleString()}</p>
                                    </div>
                                    <div className="text-right space-y-1">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Invoice</p>
                                        <p className="text-base font-black text-slate-900 dark:text-white">#{selectedTab.orderNumber?.slice(-6)?.toUpperCase() || 'N/A'}</p>
                                    </div>
                                </div>

                                {/* SCROLLABLE ITEMS LIST */}
                                <div className="flex-grow overflow-y-auto pr-2 mb-6 space-y-4 custom-scrollbar">
                                    {selectedTab.items?.map((item, idx) => (
                                        <div key={idx} className="group">
                                            <div className="flex justify-between items-baseline mb-2">
                                                <div className="flex flex-col">
                                                    <span className="text-sm text-slate-900 dark:text-slate-100 font-black uppercase tracking-tight">
                                                        {item.menuItemName}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                                                        {item.quantity} x {formatCurrency(item.unitPrice)}
                                                    </span>
                                                </div>
                                                <span className="font-mono font-black text-slate-900 dark:text-white text-sm">
                                                    {formatCurrency(item.lineTotal)}
                                                </span>
                                            </div>
                                            <div className="w-full border-b border-slate-100 dark:border-slate-800/50" />
                                        </div>
                                    ))}
                                </div>

                                {/* FIXED FOOTER SECTION */}
                                <div className="mt-auto">
                                    <div className="bg-slate-50 dark:bg-slate-900/40 rounded-3xl p-6 space-y-3">
                                        <div className="flex justify-between text-xs font-black text-slate-400 uppercase tracking-widest">
                                            <span>Subtotal</span>
                                            <span className="font-mono">{formatCurrency(selectedBreakdown.subtotal)}</span>
                                        </div>
                                        <div className="flex justify-between text-xs font-black text-slate-400 uppercase tracking-widest">
                                            <span>Service Charge (10%)</span>
                                            <span className="font-mono">{formatCurrency(selectedBreakdown.serviceCharge)}</span>
                                        </div>
                                        {selectedBreakdown.discount > 0 && (
                                            <div className="flex justify-between text-xs font-black text-rose-500 uppercase tracking-widest">
                                                <span>Discount</span>
                                                <span className="font-mono">- {formatCurrency(selectedBreakdown.discount)}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between text-3xl font-black text-slate-900 dark:text-white italic pt-4 border-t-2 border-white dark:border-[#111A2E]">
                                            <span>Payable Total</span>
                                            <span className="text-emerald-500 font-mono">{formatCurrency(selectedBreakdown.payableTotal)}</span>
                                        </div>
                                    </div>
                                    <p className="mt-3 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                                        Service charge is shown explicitly for billing transparency.
                                    </p>

                                    <div className="mt-6 flex gap-3 no-print">
                                        <button onClick={handlePrint} className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                                            <Printer size={18}/> Print
                                        </button>
                                        <button onClick={() => setShowReceipt(false)} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all">
                                            Pay <ArrowUpRight size={18}/>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Payment View */}
                            {!showReceipt && (
                                <div className="p-10 w-full flex flex-col flex-grow bg-slate-50 dark:bg-[#0B1120]/50 animate-in slide-in-from-right duration-300">
                                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase italic mb-8 flex items-center gap-2">
                                        <CreditCard size={20} className="text-blue-500"/> Settlement
                                    </h3>

                                    <div className="grid grid-cols-2 gap-3 mb-8">
                                        {[
                                            {id:'CASH', icon:<Banknote size={20}/>},
                                            {id:'QR', icon:<QrCode size={20}/>},
                                            {id:'ONLINE', icon:<Globe size={20}/>},
                                            {id:'CARD', icon:<CreditCard size={20}/>}
                                        ].map(m => (
                                            <button
                                                key={m.id}
                                                onClick={() => { setPaymentMethod(m.id); setTransactionId(''); }}
                                                className={`p-4 rounded-3xl border-2 flex flex-col items-center gap-2 transition-all ${paymentMethod === m.id ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-600 shadow-lg' : 'border-white dark:border-slate-800 text-slate-400 hover:border-slate-200'}`}
                                            >
                                                {m.icon} <span className="text-[10px] font-black uppercase">{m.id}</span>
                                            </button>
                                        ))}
                                    </div>

                                    <div className="mb-6 space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Optional Discount (Rs.)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={discountInput}
                                            onChange={(e) => setDiscountInput(e.target.value)}
                                            placeholder="0.00"
                                            className="w-full bg-white dark:bg-[#111A2E] border border-slate-200 dark:border-slate-700 rounded-2xl px-6 py-4 text-sm font-bold outline-none focus:border-blue-500 dark:text-white transition-all shadow-inner"
                                        />
                                        <p className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-[0.12em]">
                                            Final payable: {formatCurrency(selectedBreakdown.payableTotal)}
                                        </p>
                                    </div>

                                    <div className="flex-grow overflow-y-auto custom-scrollbar">
                                        {paymentMethod === 'QR' && (
                                            <div className="flex flex-col items-center animate-in zoom-in">
                                                <div className="bg-white p-3 rounded-3xl border-4 border-slate-100 mb-3 shadow-inner">
                                                    <QRCodeCanvas value={`fonepay://pay?amt=${selectedBreakdown.payableTotal}`} size={120} />
                                                </div>
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Scan: <span className="text-slate-900 dark:text-white text-xs font-mono">{formatCurrency(selectedBreakdown.payableTotal)}</span></p>
                                            </div>
                                        )}

                                        {paymentMethod !== 'CASH' && (
                                            <div className="space-y-2 mt-4">
                                                <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Transaction Reference</label>
                                                <input
                                                    type="text" placeholder="REF# 123456" value={transactionId}
                                                    onChange={(e) => setTransactionId(e.target.value)}
                                                    className="w-full bg-white dark:bg-[#111A2E] border border-slate-200 dark:border-slate-700 rounded-2xl px-6 py-4 text-sm font-bold outline-none focus:border-blue-500 dark:text-white transition-all shadow-inner"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    <div className="mt-6 space-y-3">
                                        <button
                                            onClick={handleSettleAction}
                                            disabled={loading}
                                            className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black uppercase text-xs tracking-[0.25em] shadow-2xl shadow-emerald-500/30 hover:bg-emerald-500 transition-all disabled:opacity-50"
                                        >
                                            {loading ? 'Processing...' : paymentMethod === 'ONLINE' ? 'Launch Gateway' : 'Confirm'}
                                        </button>
                                        <button onClick={() => setShowReceipt(true)} className="w-full text-[10px] font-black text-slate-400 uppercase py-2 hover:text-slate-600 tracking-widest">
                                            {"<- Back to Invoice"}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const StatCard = ({ label, value, icon, color }) => {
    const themes = {
        blue: "text-blue-600 bg-blue-50 dark:bg-blue-900/20",
        emerald: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20",
        orange: "text-orange-600 bg-orange-50 dark:bg-orange-900/20"
    };
    return (
        <div className="ops-stat-card p-6 transition-transform hover:-translate-y-0.5">
            <div className={`inline-block p-4 rounded-2xl mb-4 ${themes[color]}`}>{icon}</div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{label}</p>
            <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">{value}</h3>
        </div>
    );
};

export default AdminDashboard;
