import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useTheme } from '../context/ThemeContext';

const SettingsManager = () => {
    const [restaurantName, setRestaurantName] = useState('FOS PRO');
    const [logoBase64, setLogoBase64] = useState('');
    const [themeMode, setThemeMode] = useState('system');
    const [darkModeEnabled, setDarkModeEnabled] = useState(true);
    const [primaryColor, setPrimaryColor] = useState('#3971b8');
    const [accentColor, setAccentColor] = useState('#7b9e59');
    const [surfaceColor, setSurfaceColor] = useState('#fbfcee');
    const [loading, setLoading] = useState(false);
    const { refreshTheme } = useTheme();

    useEffect(() => {
        Promise.all([
            api.get('/admin/branding'),
            api.get('/admin/branding/theme')
        ])
            .then(([brandingRes, themeRes]) => {
                const branding = brandingRes.data || {};
                const theme = themeRes.data || {};

                if (branding.restaurant_name) setRestaurantName(branding.restaurant_name);
                if (branding.restaurant_logo) setLogoBase64(branding.restaurant_logo);
                if (theme.defaultThemeMode) setThemeMode(theme.defaultThemeMode);
                if (typeof theme.darkModeEnabled === 'boolean') setDarkModeEnabled(theme.darkModeEnabled);
                if (theme.primaryColor) setPrimaryColor(theme.primaryColor);
                if (theme.accentColor) setAccentColor(theme.accentColor);
                if (theme.surfaceColor) setSurfaceColor(theme.surfaceColor);
            })
            .catch(err => console.error("Error loading branding", err));
    }, []);

    const handleLogoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setLogoBase64(reader.result);
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            await api.post('/admin/branding/update', {
                restaurant_name: restaurantName,
                restaurant_logo: logoBase64,
                theme_mode: themeMode,
                dark_mode_enabled: String(darkModeEnabled),
                theme_primary_color: primaryColor,
                theme_accent_color: accentColor,
                theme_surface_color: surfaceColor
            });
            await refreshTheme();
            alert('Branding updated successfully!');
        } catch (err) {
            console.error("Update failed:", err);
            if (err.response?.status === 403) {
                alert('Access Denied: Please log in again as Admin.');
            } else {
                alert('Failed to update. Check backend logs.');
            }
        } finally {
            setLoading(false);
        }
    };

    const labelClass = "block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-[0.16em]";
    const inputClass = "w-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/70 text-slate-800 dark:text-slate-100 font-semibold outline-none focus:border-blue-500 transition-all";

    return (
        <div className="ops-page space-y-6">
            <header className="ops-header-card">
                <div className="space-y-2">
                    <p className="ops-kicker">Tenant Branding</p>
                    <h1 className="ops-title">Branding Manager</h1>
                    <p className="ops-subtitle">Name, logo and theme settings for all modules</p>
                </div>
            </header>

            <div className="ops-panel p-6 md:p-8 max-w-3xl">
                <div className="space-y-7">
                    <div>
                        <label className={labelClass}>Restaurant Name</label>
                        <input
                            type="text"
                            className={inputClass}
                            value={restaurantName}
                            onChange={(e) => setRestaurantName(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className={labelClass}>Brand Logo</label>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-dashed border-slate-300 dark:border-slate-700">
                            <div className="h-24 w-24 rounded-2xl flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-2">
                                {logoBase64 ? <img src={logoBase64} alt="Preview" className="h-full w-full object-contain" /> : <span className="text-[9px] font-black tracking-[0.12em] opacity-40 text-center">NO LOGO</span>}
                            </div>
                            <input type="file" accept="image/*" onChange={handleLogoChange} className="text-xs font-semibold text-slate-500 dark:text-slate-400" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label className={labelClass}>Default Theme</label>
                            <select
                                value={themeMode}
                                onChange={(e) => setThemeMode(e.target.value)}
                                className={inputClass}
                            >
                                <option value="system">System</option>
                                <option value="light">Light</option>
                                <option value="dark">Dark</option>
                            </select>
                        </div>
                        <div className="flex items-end">
                            <label className="w-full flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-3.5">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.16em]">Dark Mode Enabled</span>
                                <input type="checkbox" checked={darkModeEnabled} onChange={(e) => setDarkModeEnabled(e.target.checked)} />
                            </label>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <ColorField label="Primary Color" value={primaryColor} onChange={setPrimaryColor} />
                        <ColorField label="Accent Color" value={accentColor} onChange={setAccentColor} />
                        <ColorField label="Surface Color" value={surfaceColor} onChange={setSurfaceColor} />
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="ops-btn-primary w-full py-4 disabled:opacity-50"
                    >
                        {loading ? 'Processing...' : 'Apply Branding'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const ColorField = ({ label, value, onChange }) => (
    <div>
        <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-[0.16em]">{label}</label>
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 p-3 bg-white dark:bg-slate-900/60">
            <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-10 rounded-lg border-0 bg-transparent p-0" />
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full bg-transparent font-semibold uppercase outline-none text-slate-700 dark:text-slate-100"
            />
        </div>
    </div>
);

export default SettingsManager;
