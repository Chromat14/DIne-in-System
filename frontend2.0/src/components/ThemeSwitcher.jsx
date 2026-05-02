import React from "react";
import { useTheme } from "../context/ThemeContext";

const ThemeSwitcher = () => {
    const { isDark, toggleTheme } = useTheme();

    return (
        <button
            onClick={toggleTheme}
            className="px-4 py-2 bg-celtic-blue text-white dark:bg-tea-green dark:text-drab-dark-brown rounded-lg font-bold transition-all hover:opacity-90"
        >
            {isDark ? "☀️ Light Mode" : "🌙 Dark Mode"}
        </button>
    );
};

export default ThemeSwitcher;