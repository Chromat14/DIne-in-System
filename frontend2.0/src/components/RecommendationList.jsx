import React, { useState, useEffect } from "react";
import api from "../services/api";
import { Sparkles, Plus } from "lucide-react";


const RecommendationList = ({ cartItemIds, onAdd, isDark }) => {
    const [recommendations, setRecommendations] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const getRecs = async () => {
            setLoading(true);
            try {
                const res = await api.post("/table/recommendations/checkout", cartItemIds);
                setRecommendations(res.data);
            } catch (err) {
                console.error("Rec Error:", err);
            } finally {
                setLoading(false);
            }
        };

        getRecs();
    }, [cartItemIds]); // Re-fetch whenever an item is added/removed from cart

    if (recommendations.length === 0 && !loading) return null;

    const hasCartItems = cartItemIds.length > 0;

    return (
        <div className={`mt-8 mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700 rounded-[2rem] border p-4 ${
            isDark
                ? 'bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/25 border-slate-700/70'
                : 'bg-gradient-to-br from-amber-50/90 via-rose-50/80 to-orange-50/90 border-amber-200/80'
        }`}>
            <div className="flex items-center justify-between mb-4">
                <h3 className={`text-[10px] font-black uppercase tracking-[0.22em] flex items-center gap-2 ${isDark ? 'text-amber-300' : 'text-orange-700'}`}>
                    <Sparkles size={13} />
                    {hasCartItems ? "You might also like" : "Popular right now"}
                </h3>
                <span className={`text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-[0.16em] ${
                    isDark
                        ? 'bg-amber-500/20 text-amber-200 border border-amber-500/30'
                        : 'bg-white/80 text-orange-700 border border-orange-200'
                }`}>
                    Smart Picks
                </span>
            </div>

            <div className="space-y-3.5">
                {recommendations.slice(0, 3).map((item) => (
                    <div
                        key={item.menuItemId}
                        className={`group p-4 rounded-2xl border flex justify-between items-center transition-all hover:translate-x-0.5 hover:-translate-y-0.5 ${
                            isDark
                                ? 'bg-slate-800/75 border-slate-700 hover:border-amber-500/40'
                                : 'bg-white/90 border-orange-200/80 shadow-sm hover:shadow-md hover:border-orange-300'
                        }`}
                    >
                        <div className="min-w-0 pr-3">
                            <p className={`text-[9px] font-black uppercase tracking-[0.2em] mb-1 ${isDark ? 'text-amber-300' : 'text-orange-600'}`}>
                                {item.recommendationType === "PAIRING" ? "Perfect Pair" : "Trending Pick"}
                            </p>
                            <p className={`text-[16px] font-black tracking-tight leading-tight ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                                {item.menuItemName}
                            </p>
                            <p className={`text-[12px] font-bold mt-1 ${isDark ? 'text-orange-200' : 'text-orange-700'}`}>Rs. {item.price || "---"}</p>
                            <p className={`text-[12px] font-semibold mt-1.5 leading-snug ${isDark ? 'text-slate-300/90' : 'text-slate-600'}`}>{item.reason}</p>
                        </div>
                        <button
                            onClick={() => onAdd(item)}
                            className={`h-10 w-10 shrink-0 rounded-xl flex items-center justify-center border transition-all ${
                                isDark
                                    ? 'bg-slate-900 border-slate-600 text-amber-200 group-hover:bg-orange-500 group-hover:border-orange-400 group-hover:text-white'
                                    : 'bg-orange-50 border-orange-200 text-orange-700 group-hover:bg-orange-500 group-hover:border-orange-400 group-hover:text-white'
                            }`}
                            aria-label={`Add ${item.menuItemName}`}
                        >
                            <Plus size={18} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default RecommendationList;
