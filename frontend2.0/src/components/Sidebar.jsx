import React from 'react';
import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard, Utensils, LogOut, Coffee, Moon, Sun,
    History, Users, Pizza, Settings, Boxes
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const Sidebar = () => {
    const { logout, user } = useAuth();
    const { isDark, toggleTheme, branding } = useTheme();

    const menuItems = user?.role === 'ROLE_ADMIN'
        ? [
            { name: 'Dashboard', path: '/admin', icon: <LayoutDashboard size={22}/> },
            { name: 'Kitchen Queue', path: '/admin/kitchen', icon: <Utensils size={22}/> },
            { name: 'History', path: '/admin/history', icon: <History size={22}/> },
            { name: 'Menu Manager', path: '/admin/menu', icon: <Pizza size={22}/> },
            { name: 'Inventory', path: '/admin/inventory', icon: <Boxes size={22}/> },
            { name: 'Table Manager', path: '/admin/tables', icon: <Users size={22}/> },
            { name: 'Branding Manager', path: '/admin/branding', icon: <Settings size={22}/> }
        ]
        : [
            { name: 'Kitchen', path: '/kitchen', icon: <Utensils size={22}/> },
            { name: 'Inventory', path: '/kitchen/inventory', icon: <Boxes size={22}/> }
        ];

    const hasLogo = Boolean(branding.restaurantLogo);

    return (
        <aside className="w-full lg:w-64 lg:h-screen lg:fixed top-0 left-0 bg-white/95 dark:bg-dark-card/95 backdrop-blur-xl border-b lg:border-r border-gray-100 dark:border-dark-border flex flex-col p-4 lg:p-6 z-50">
            <div className="mb-5 lg:mb-6">
                <div className="flex items-center gap-3">
                    <div className={`h-14 w-14 rounded-2xl flex items-center justify-center overflow-hidden shrink-0 p-1.5 border ${hasLogo ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700' : 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-600/30'}`}>
                        {hasLogo ? (
                            <img src={branding.restaurantLogo} alt="Logo" className="h-full w-full object-contain" />
                        ) : (
                            <Coffee size={22} strokeWidth={2.5}/>
                        )}
                    </div>
                    <div className="min-w-0">
                        <span className="text-[1.45rem] font-black tracking-tight dark:text-white block leading-tight whitespace-normal break-words">
                            {branding.restaurantName || "FOS PRO"}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mt-1 leading-tight">
                            {branding.tagline || "Restaurant operations"}
                        </span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2 lg:hidden">
                <button onClick={toggleTheme} className="p-3 rounded-xl font-bold text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all">
                    {isDark ? <Sun className="text-yellow-400" size={20}/> : <Moon size={20}/>}
                </button>
                <button onClick={logout} className="p-3 text-red-500 font-bold hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-all">
                    <LogOut size={20}/>
                </button>
            </div>

            <nav className="flex-1 overflow-x-auto lg:overflow-y-auto">
                <div className="flex lg:flex-col gap-2 min-w-max lg:min-w-0 pb-2">
                    {menuItems.map(item => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({isActive}) => `flex items-center gap-3 p-3.5 rounded-xl font-bold transition-all shrink-0 ${
                                isActive ? 'bg-blue-600 text-white shadow-lg lg:translate-x-1' : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                            }`}
                        >
                            {item.icon} <span className="text-md whitespace-nowrap">{item.name}</span>
                        </NavLink>
                    ))}
                </div>
            </nav>

            <div className="pt-6 border-t dark:border-dark-border space-y-1 hidden lg:block">
                <button onClick={toggleTheme} className="w-full flex items-center gap-3 p-3.5 rounded-xl font-bold text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all">
                    {isDark ? <Sun className="text-yellow-400" size={20}/> : <Moon size={20}/>}
                    <span className="text-md">{isDark ? 'Day Mode' : 'Night Mode'}</span>
                </button>
                <button onClick={logout} className="w-full flex items-center gap-3 p-3.5 text-red-500 font-bold hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-all">
                    <LogOut size={20}/> <span className="text-md">Sign Out</span>
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
