import React, { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { Search, Download, Calendar, Hash, CreditCard } from 'lucide-react';

const formatDateTime = (rawValue) => {
    if (!rawValue) {
        return '-';
    }
    const parsed = new Date(rawValue);
    if (Number.isNaN(parsed.getTime())) {
        return '-';
    }
    return parsed.toLocaleString();
};

const toCsvCell = (value) => {
    const normalized = value === null || value === undefined ? '' : String(value);
    return `"${normalized.replace(/"/g, '""')}"`;
};

const OrderHistory = () => {
    const [history, setHistory] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [monthFilter, setMonthFilter] = useState('');
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        const fetchHistory = async () => {
            setLoading(true);
            setErrorMessage('');

            try {
                const params = {};
                if (monthFilter) {
                    const [year, month] = monthFilter.split('-');
                    params.year = Number(year);
                    params.month = Number(month);
                }

                const response = await api.get('/admin/transactions', { params });
                setHistory(Array.isArray(response.data) ? response.data : []);
            } catch (err) {
                console.error('Transaction history fetch failed', err);
                setHistory([]);
                setErrorMessage('Unable to load transaction records right now.');
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, [monthFilter]);

    const filteredHistory = useMemo(() => {
        const keyword = searchTerm.trim().toLowerCase();
        if (!keyword) {
            return history;
        }

        return history.filter((record) => {
            const orderNumber = (record.orderNumber || '').toLowerCase();
            const tableNumber = String(record.tableNumber || '').toLowerCase();
            const transactionRef = (record.transactionRef || '').toLowerCase();
            const paymentMethod = (record.paymentMethod || '').toLowerCase();

            return (
                orderNumber.includes(keyword) ||
                tableNumber.includes(keyword) ||
                transactionRef.includes(keyword) ||
                paymentMethod.includes(keyword)
            );
        });
    }, [history, searchTerm]);

    const exportCsv = () => {
        if (filteredHistory.length === 0) {
            return;
        }

        const header = [
            'Order Number',
            'Table',
            'Transaction Ref',
            'Payment Method',
            'Payment Status',
            'Order Status',
            'Items',
            'Amount',
            'Paid At'
        ];

        const rows = filteredHistory.map((record) => [
            record.orderNumber || '-',
            record.tableNumber || '-',
            record.transactionRef || '-',
            record.paymentMethod || '-',
            record.paymentStatus || '-',
            record.orderStatus || '-',
            record.itemCount ?? 0,
            record.amount ?? 0,
            formatDateTime(record.paidAt)
        ]);

        const csv = [header, ...rows]
            .map((row) => row.map((value) => toCsvCell(value)).join(','))
            .join('\n');

        const csvWithBom = `\uFEFF${csv}`;
        const blob = new Blob([csvWithBom], { type: 'text/csv;charset=utf-8;' });
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = `transactions-${monthFilter || 'all'}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(objectUrl);
    };

    return (
        <div className="ops-page space-y-6 animate-in fade-in duration-500">
            <header className="ops-header-card">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-2">
                        <p className="ops-kicker">Financial Logs</p>
                        <h1 className="ops-title">Transaction Records</h1>
                        <p className="ops-subtitle">{filteredHistory.length} records matched</p>
                    </div>
                    <button
                        onClick={exportCsv}
                        disabled={filteredHistory.length === 0}
                        className="ops-btn-secondary px-4 py-3 inline-flex items-center gap-2 w-full md:w-auto justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Download size={16} className="text-blue-600" /> Export Sheet
                    </button>
                </div>
            </header>

            <div className="ops-panel p-4 space-y-3">
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={18} />
                    <input
                        type="text"
                        value={searchTerm}
                        placeholder="Search by Order, Table, Ref, or Method"
                        className="w-full pl-11 pr-4 py-3.5 bg-white dark:bg-slate-900/70 rounded-xl border border-slate-200 dark:border-slate-700 focus:border-blue-500 outline-none text-sm font-semibold text-slate-800 dark:text-slate-100 transition-all"
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-slate-400" />
                    <input
                        type="month"
                        value={monthFilter}
                        onChange={(e) => setMonthFilter(e.target.value)}
                        className="px-3 py-2 bg-white dark:bg-slate-900/70 rounded-lg border border-slate-200 dark:border-slate-700 outline-none text-sm font-semibold text-slate-700 dark:text-slate-200"
                    />
                    {monthFilter && (
                        <button
                            type="button"
                            onClick={() => setMonthFilter('')}
                            className="text-xs font-black uppercase tracking-wider text-blue-600 hover:underline"
                        >
                            Clear Month
                        </button>
                    )}
                </div>
                {errorMessage && (
                    <p className="text-sm font-semibold text-rose-500">{errorMessage}</p>
                )}
            </div>

            <div className="ops-panel overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[1100px]">
                        <thead>
                            <tr className="bg-slate-50/70 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700">
                                <th className="p-5 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400"><span className="flex items-center gap-2"><Hash size={14}/> Order</span></th>
                                <th className="p-5 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Location</th>
                                <th className="p-5 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Txn Ref</th>
                                <th className="p-5 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Method</th>
                                <th className="p-5 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Items</th>
                                <th className="p-5 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400"><span className="flex items-center gap-2"><CreditCard size={14}/> Amount</span></th>
                                <th className="p-5 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Status</th>
                                <th className="p-5 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400"><span className="flex items-center gap-2"><Calendar size={14}/> Paid At</span></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {!loading && filteredHistory.map((record) => (
                                <tr key={record.transactionId} className="hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors">
                                    <td className="p-5">
                                        <p className="font-mono font-bold text-blue-600">{record.orderNumber || '-'}</p>
                                        <p className="text-[10px] uppercase font-black tracking-widest text-slate-400 mt-1">{record.orderStatus || '-'}</p>
                                    </td>
                                    <td className="p-5 font-semibold text-slate-800 dark:text-slate-200">Table {record.tableNumber || '-'}</td>
                                    <td className="p-5 text-sm font-semibold text-slate-600 dark:text-slate-300">{record.transactionRef || '-'}</td>
                                    <td className="p-5">
                                        <span className="px-3 py-1.5 rounded-full text-[10px] font-black tracking-[0.14em] uppercase border bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700">
                                            {record.paymentMethod || '-'}
                                        </span>
                                    </td>
                                    <td className="p-5 text-slate-500 dark:text-slate-400 text-sm">
                                        {record.itemCount ?? 0} {(record.itemCount ?? 0) === 1 ? 'item' : 'items'}
                                    </td>
                                    <td className="p-5 font-extrabold text-slate-900 dark:text-white">Rs. {Number(record.amount || 0).toLocaleString()}</td>
                                    <td className="p-5">
                                        <span className={`px-3 py-1.5 rounded-full text-[10px] font-black tracking-[0.14em] uppercase border ${
                                            record.paymentStatus === 'SUCCESS'
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40'
                                                : 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/40'
                                        }`}>
                                            {record.paymentStatus || '-'}
                                        </span>
                                    </td>
                                    <td className="p-5 text-slate-500 dark:text-slate-400 text-sm font-medium">
                                        {formatDateTime(record.paidAt)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {!loading && filteredHistory.length === 0 && (
                    <div className="py-20 text-center">
                        <div className="bg-slate-100 dark:bg-slate-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Search size={24} className="text-slate-400" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-500 dark:text-slate-400">No matching records</h3>
                    </div>
                )}

                {loading && (
                    <div className="py-20 text-center text-slate-500 dark:text-slate-400 font-semibold">
                        Loading transaction records...
                    </div>
                )}
            </div>
        </div>
    );
};

export default OrderHistory;
