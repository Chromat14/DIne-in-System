import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api';

const ThemeContext = createContext();

const DEFAULT_THEME = {
    restaurantName: 'FOS PRO',
    tagline: 'Fresh service from table to kitchen',
    defaultThemeMode: 'system',
    darkModeEnabled: true,
    primaryColor: '#3971b8',
    accentColor: '#7b9e59',
    surfaceColor: '#fbfcee'
};

const STORAGE_KEY = 'theme_mode_override';
const DEFAULT_BRANDING = {
    restaurantName: DEFAULT_THEME.restaurantName,
    tagline: DEFAULT_THEME.tagline,
    restaurantLogo: ''
};

const getSystemDarkMode = () => {
    if (typeof window === 'undefined' || !window.matchMedia) {
        return false;
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
};

export const ThemeProvider = ({ children }) => {
    const [themeSettings, setThemeSettings] = useState(DEFAULT_THEME);
    const [branding, setBranding] = useState(DEFAULT_BRANDING);
    const [modeOverride, setModeOverride] = useState(() => localStorage.getItem(STORAGE_KEY));
    const [systemPrefersDark, setSystemPrefersDark] = useState(getSystemDarkMode);
    const [loadingTheme, setLoadingTheme] = useState(true);

    const resolvedMode = modeOverride || themeSettings.defaultThemeMode || 'system';

    const isDark = useMemo(() => {
        if (!themeSettings.darkModeEnabled) {
            return false;
        }
        if (resolvedMode === 'dark') {
            return true;
        }
        if (resolvedMode === 'light') {
            return false;
        }
        return systemPrefersDark;
    }, [resolvedMode, systemPrefersDark, themeSettings.darkModeEnabled]);

    useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia) {
            return undefined;
        }

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const onChange = (event) => setSystemPrefersDark(event.matches);
        mediaQuery.addEventListener('change', onChange);

        return () => mediaQuery.removeEventListener('change', onChange);
    }, []);

    useEffect(() => {
        const root = window.document.documentElement;

        root.style.setProperty('--color-celtic-blue', themeSettings.primaryColor || DEFAULT_THEME.primaryColor);
        root.style.setProperty('--color-tea-green', themeSettings.accentColor || DEFAULT_THEME.accentColor);
        root.style.setProperty('--color-ivory', themeSettings.surfaceColor || DEFAULT_THEME.surfaceColor);

        if (isDark) {
            root.classList.add('dark');
            root.style.colorScheme = 'dark';
        } else {
            root.classList.remove('dark');
            root.style.colorScheme = 'light';
        }
    }, [isDark, themeSettings]);

    const refreshTheme = async () => {
        try {
            const [brandingResponse, themeResponse] = await Promise.all([
                api.get('/admin/branding').catch(() => ({ data: {} })),
                api.get('/admin/branding/theme').catch(() => ({ data: {} }))
            ]);

            const brandingMap = brandingResponse.data || {};
            const nextTheme = { ...DEFAULT_THEME, ...themeResponse.data };
            setThemeSettings(nextTheme);
            setBranding({
                restaurantName: brandingMap.restaurant_name || nextTheme.restaurantName || DEFAULT_BRANDING.restaurantName,
                tagline: brandingMap.restaurant_tagline || nextTheme.tagline || DEFAULT_BRANDING.tagline,
                restaurantLogo: brandingMap.restaurant_logo || ''
            });

            if (!nextTheme.darkModeEnabled) {
                localStorage.removeItem(STORAGE_KEY);
                setModeOverride(null);
            }
        } catch (error) {
            console.error('Failed to load theme config:', error);
        } finally {
            setLoadingTheme(false);
        }
    };

    useEffect(() => {
        refreshTheme();
    }, []);

    useEffect(() => {
        if (modeOverride) {
            localStorage.setItem(STORAGE_KEY, modeOverride);
        } else {
            localStorage.removeItem(STORAGE_KEY);
        }
    }, [modeOverride]);

    const toggleTheme = () => {
        if (!themeSettings.darkModeEnabled) {
            return;
        }
        setModeOverride(isDark ? 'light' : 'dark');
    };

    return (
        <ThemeContext.Provider
            value={{
                isDark,
                toggleTheme,
                themeSettings,
                branding,
                refreshTheme,
                loadingTheme
            }}
        >
            {children}
        </ThemeContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => useContext(ThemeContext);
