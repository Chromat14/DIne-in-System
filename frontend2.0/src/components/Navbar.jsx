import React from 'react';
import { Search, HelpCircle, Upload, Menu } from 'lucide-react';

const Navbar = ({ onSearch, restaurantLogo }) => {
    return (
        <nav className="glass sticky top-0 z-50 px-6 py-4 flex items-center justify-between mb-8 rounded-b-[2rem]">
            <div className="flex items-center gap-4">
                {restaurantLogo ? (
                    <img src={restaurantLogo} alt="Logo" className="h-10 w-10 rounded-lg object-cover" />
                ) : (
                    <div className="h-10 w-10 bg-celtic-blue rounded-lg flex items-center justify-center text-white font-black">F</div>
                )}
                <span className="text-xl font-black hidden md:block">FOS SaaS</span>
            </div>

            <div className="flex-1 max-w-md mx-8 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                    type="text"
                    placeholder="Search for momo, burgers..."
                    onChange={(e) => onSearch(e.target.value)}
                    className="w-full bg-gray-100 dark:bg-gray-800 border-none rounded-2xl py-3 pl-12 pr-4 focus:ring-2 focus:ring-celtic-blue transition-all"
                />
            </div>

            <div className="flex items-center gap-4">
                <button className="p-3 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors text-gray-500">
                    <HelpCircle size={22} />
                </button>
                <label className="cursor-pointer p-3 bg-celtic-blue/10 text-celtic-blue hover:bg-celtic-blue hover:text-white rounded-xl transition-all">
                    <Upload size={22} />
                    <input type="file" className="hidden" onChange={() => alert('Logo Upload Logic Here')} />
                </label>
            </div>
        </nav>
    );
};

export default Navbar;