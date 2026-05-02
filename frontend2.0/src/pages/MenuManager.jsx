import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Plus, Trash2, Edit3, Pizza, X, Save, Loader2, ImagePlus, Search } from 'lucide-react';

const MenuManager = () => {
    const [menu, setMenu] = useState([]);
    const [categories, setCategories] = useState([]);
    const [showDrawer, setShowDrawer] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchSuggestions, setSearchSuggestions] = useState([]);
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        price: '',
        categoryId: '',
        avgPrepTime: 15,
        stockQuantity: 0,
        isAvailable: true,
        imageUrl: ''
    });

    useEffect(() => { loadData(); }, []);

    useEffect(() => {
        const q = searchQuery.trim();
        if (!q) {
            setSearchSuggestions([]);
            setActiveSuggestionIndex(-1);
            return;
        }

        const debounce = setTimeout(async () => {
            try {
                const res = await api.get('/menu/autocomplete', {
                    params: { q, limit: 8, availableOnly: false }
                });
                const suggestions = Array.isArray(res.data) ? res.data : [];
                if (suggestions.length > 0) {
                    setSearchSuggestions(suggestions);
                    return;
                }

                const localFallback = menu
                    .filter((item) =>
                        (item.name || '').toLowerCase().includes(q.toLowerCase())
                        || (item.categoryName || '').toLowerCase().includes(q.toLowerCase())
                    )
                    .slice(0, 8)
                    .map((item) => ({
                        id: item.id,
                        name: item.name,
                        categoryName: item.categoryName,
                        price: item.price
                    }));
                setSearchSuggestions(localFallback);
            } catch (err) {
                console.error('Admin autocomplete failed:', err);
                const localFallback = menu
                    .filter((item) =>
                        (item.name || '').toLowerCase().includes(q.toLowerCase())
                        || (item.categoryName || '').toLowerCase().includes(q.toLowerCase())
                    )
                    .slice(0, 8)
                    .map((item) => ({
                        id: item.id,
                        name: item.name,
                        categoryName: item.categoryName,
                        price: item.price
                    }));
                setSearchSuggestions(localFallback);
            }
        }, 180);

        return () => clearTimeout(debounce);
    }, [searchQuery, menu]);

    const filteredMenu = menu.filter((item) => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) {
            return true;
        }
        return (item.name || '').toLowerCase().includes(query)
            || (item.categoryName || '').toLowerCase().includes(query);
    });

    const fallbackSuggestions = filteredMenu.slice(0, 8).map((item) => ({
        id: item.id,
        name: item.name,
        categoryName: item.categoryName,
        price: item.price
    }));

    const displayedSuggestions = searchSuggestions.length > 0 ? searchSuggestions : fallbackSuggestions;

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
        const activeItem = document.getElementById(`admin-suggestion-${activeSuggestionIndex}`);
        if (activeItem) {
            activeItem.scrollIntoView({ block: 'nearest' });
        }
    }, [activeSuggestionIndex]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [menuRes, catRes] = await Promise.all([
                api.get('/menu'),
                api.get('/categories')
            ]);
            setMenu(menuRes.data);
            setCategories(catRes.data);
        } catch (err) {
            console.error("Fetch error:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddCategory = async () => {
        const name = prompt("Enter new category name:");
        if (!name) return;
        try {
            await api.post('/categories', {
                name: name,
                description: "Menu Category"
            });
            loadData();
        } catch {
            alert("Failed to add category. Please check if it already exists.");
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        const payload = {
            ...formData,
            price: parseFloat(formData.price),
            categoryId: parseInt(formData.categoryId),
            avgPrepTime: parseInt(formData.avgPrepTime),
            stockQuantity: parseInt(formData.stockQuantity),
            imageUrl: formData.imageUrl || null
        };

        try {
            if (editingId) {
                await api.put(`/menu/${editingId}`, payload);
            } else {
                await api.post('/menu', payload);
            }
            closeDrawer();
            loadData();
        } catch (err) {
            alert(`Save failed: ${err.response?.data?.message || "Check your data"}`);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Delete this dish?")) return;
        try {
            await api.delete(`/menu/${id}`);
            setMenu(prev => prev.filter(item => item.id !== id));
        } catch {
            alert("Delete failed.");
        }
    };

    const closeDrawer = () => {
        setShowDrawer(false);
        setEditingId(null);
        setFormData({ name: '', description: '', price: '', categoryId: '', avgPrepTime: 15, stockQuantity: 0, isAvailable: true, imageUrl: '' });
    };

    const handleImageUpload = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            setFormData((prev) => ({ ...prev, imageUrl: reader.result }));
        };
        reader.readAsDataURL(file);
    };

    if (loading) return <div className="h-96 flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={40} /></div>;

    const selectSuggestion = (suggestion) => {
        setSearchQuery(suggestion.name || '');
        setIsSearchFocused(false);
        setActiveSuggestionIndex(-1);
        setSearchSuggestions([]);
    };

    const handleSearchKeyDown = (event) => {
        const hasSuggestions = displayedSuggestions.length > 0;

        if (event.key === 'ArrowDown' && hasSuggestions) {
            event.preventDefault();
            setIsSearchFocused(true);
            setActiveSuggestionIndex((prev) => (prev >= displayedSuggestions.length - 1 ? 0 : prev + 1));
            return;
        }

        if (event.key === 'ArrowUp' && hasSuggestions) {
            event.preventDefault();
            setIsSearchFocused(true);
            setActiveSuggestionIndex((prev) => (prev <= 0 ? displayedSuggestions.length - 1 : prev - 1));
            return;
        }

        if (event.key === 'Enter' && hasSuggestions) {
            event.preventDefault();
            const indexToUse = activeSuggestionIndex >= 0 ? activeSuggestionIndex : 0;
            selectSuggestion(displayedSuggestions[indexToUse]);
            return;
        }

        if (event.key === 'Escape') {
            event.preventDefault();
            setIsSearchFocused(false);
            setActiveSuggestionIndex(-1);
        }
    };

    const fieldClass = "w-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/70 text-slate-800 dark:text-slate-100 font-semibold outline-none focus:border-blue-500";
    const labelClass = "text-[10px] font-black uppercase tracking-[0.18em] text-slate-400";

    return (
        <div className="ops-page space-y-6">
            <header className="ops-header-card">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-5">
                    <div className="space-y-2">
                        <p className="ops-kicker">Menu Control</p>
                        <h1 className="ops-title">Menu Manager</h1>
                        <p className="ops-subtitle">{filteredMenu.length} of {menu.length} dishes shown</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                        <div className="relative w-full sm:w-80">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setActiveSuggestionIndex(-1);
                                    setIsSearchFocused(true);
                                }}
                                onFocus={() => setIsSearchFocused(true)}
                                onBlur={() => setTimeout(() => setIsSearchFocused(false), 120)}
                                onKeyDown={handleSearchKeyDown}
                                placeholder="Search dishes..."
                                className="w-full pl-10 pr-3.5 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/70 text-slate-800 dark:text-slate-100 font-semibold outline-none focus:border-blue-500"
                            />
                            {isSearchFocused && searchQuery.trim().length > 0 && (
                                <div className="absolute left-0 right-0 mt-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden z-30">
                                    {displayedSuggestions.length === 0 ? (
                                        <div className="px-4 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-300">
                                            No matching menu items
                                        </div>
                                    ) : (
                                        <div className="max-h-64 overflow-y-auto custom-scrollbar">
                                            {displayedSuggestions.map((suggestion, idx) => (
                                                <button
                                                    key={suggestion.id}
                                                    id={`admin-suggestion-${idx}`}
                                                    type="button"
                                                    onMouseDown={() => selectSuggestion(suggestion)}
                                                    className={`w-full px-4 py-3 text-left border-b last:border-b-0 border-slate-100 dark:border-slate-800 transition-colors ${
                                                        activeSuggestionIndex === idx
                                                            ? 'bg-slate-100 dark:bg-slate-800'
                                                            : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                                                    }`}
                                                >
                                                    <p className="text-sm font-black tracking-tight text-slate-900 dark:text-slate-100">
                                                        {suggestion.name}
                                                    </p>
                                                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] mt-1 text-slate-500 dark:text-slate-400">
                                                        {suggestion.categoryName} | Rs. {suggestion.price}
                                                    </p>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <button onClick={() => setShowDrawer(true)} className="ops-btn-primary px-5 py-3 inline-flex items-center justify-center gap-2 w-full md:w-auto">
                            <Plus size={16}/> Add Dish
                        </button>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {filteredMenu.map(item => (
                    <div key={item.id} className="ops-panel overflow-hidden transition-all hover:-translate-y-0.5">
                        <div className="h-44 bg-slate-100 dark:bg-slate-800/70 flex items-center justify-center relative overflow-hidden">
                            {item.imageUrl ? (
                                <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                            ) : (
                                <Pizza size={42} className="text-slate-300 dark:text-slate-600" />
                            )}
                            <div className="absolute top-4 right-4 bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 px-3 py-1 rounded-xl font-extrabold text-blue-600 text-xs">
                                Rs. {item.price}
                            </div>
                        </div>
                        <div className="p-5 space-y-3">
                            <span className="inline-flex text-[10px] font-black text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2.5 py-1 rounded-lg uppercase tracking-widest border border-blue-100 dark:border-blue-900/60">
                                {item.categoryName}
                            </span>
                            <h3 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 truncate">{item.name}</h3>
                            <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-[0.16em] pt-1">
                                <span className={item.isAvailable ? "text-emerald-600" : "text-rose-500"}>
                                    {item.isAvailable ? "Available" : "Unavailable"}
                                </span>
                                <span className="text-slate-400">{item.stockQuantity} units</span>
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button onClick={() => { setEditingId(item.id); setFormData({...item, categoryId: item.categoryId, stockQuantity: item.stockQuantity ?? 0, imageUrl: item.imageUrl || ''}); setShowDrawer(true); }} className="ops-btn-secondary flex-1 p-3 flex justify-center">
                                    <Edit3 size={18}/>
                                </button>
                                <button onClick={() => handleDelete(item.id)} className="flex-1 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 border border-rose-100 dark:border-rose-900/40 hover:bg-rose-600 hover:text-white transition-all flex justify-center">
                                    <Trash2 size={18}/>
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {filteredMenu.length === 0 && (
                <div className="ops-panel p-10 text-center">
                    <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">No dishes matched your search.</p>
                </div>
            )}

            {showDrawer && (
                <>
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]" onClick={closeDrawer} />
                    <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-[#101826] border-l border-slate-200 dark:border-slate-700 shadow-2xl z-[70] p-6 md:p-8 overflow-y-auto">
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">{editingId ? 'Edit Dish' : 'Add Dish'}</h2>
                            <button onClick={closeDrawer} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"><X size={22} /></button>
                        </div>
                        <form onSubmit={handleSave} className="space-y-6">
                            <div className="space-y-2">
                                <label className={labelClass}>Dish Name</label>
                                <input required className={fieldClass} value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                            </div>
                            <div className="space-y-3">
                                <label className={labelClass}>Food Image</label>
                                <label className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-5 cursor-pointer hover:border-blue-500 transition-all">
                                    <ImagePlus size={18} />
                                    <span className="text-xs font-black uppercase tracking-widest text-slate-500">Upload Photo</span>
                                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                                </label>
                                {formData.imageUrl ? (
                                    <div className="rounded-[1.2rem] overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                                        <img src={formData.imageUrl} alt="Preview" className="w-full h-44 object-cover" />
                                    </div>
                                ) : null}
                            </div>
                            <div className="flex gap-4">
                                <div className="w-1/2 space-y-2">
                                    <label className={labelClass}>Price</label>
                                    <input type="number" required className={fieldClass} value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} />
                                </div>
                                <div className="w-1/2 space-y-2">
                                    <div className="flex justify-between items-center">
                                        <label className={labelClass}>Category</label>
                                        <button type="button" onClick={handleAddCategory} className="text-blue-600 text-[10px] font-bold uppercase tracking-[0.12em]">New</button>
                                    </div>
                                    <select required className={fieldClass} value={formData.categoryId} onChange={(e) => setFormData({...formData, categoryId: e.target.value})}>
                                        <option value="">Select...</option>
                                        {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <div className="w-1/2 space-y-2">
                                    <label className={labelClass}>Prep Time</label>
                                    <input type="number" min="1" required className={fieldClass} value={formData.avgPrepTime} onChange={(e) => setFormData({...formData, avgPrepTime: e.target.value})} />
                                </div>
                                <div className="w-1/2 space-y-2">
                                    <label className={labelClass}>Opening Stock</label>
                                    <input type="number" min="0" required className={fieldClass} value={formData.stockQuantity} onChange={(e) => setFormData({...formData, stockQuantity: e.target.value})} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className={labelClass}>Description</label>
                                <textarea rows="3" className={fieldClass} value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
                            </div>
                            <label className="flex items-center justify-between rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 p-4 cursor-pointer">
                                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Allow Ordering</span>
                                <input type="checkbox" checked={formData.isAvailable} onChange={(e) => setFormData({...formData, isAvailable: e.target.checked})} />
                            </label>
                            <button type="submit" className="ops-btn-primary w-full p-4 flex items-center justify-center gap-3 hover:opacity-95 transition-all">
                                <Save size={18} /> {editingId ? 'Update Item' : 'Save To Menu'}
                            </button>
                        </form>
                    </div>
                </>
            )}
        </div>
    );
};

export default MenuManager;
