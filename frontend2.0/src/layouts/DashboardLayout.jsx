import React from 'react';
import Sidebar from '../components/Sidebar';

const DashboardLayout = ({ children }) => {
    return (
        <div className="flex min-h-screen bg-ivory dark:bg-dark-bg transition-colors duration-300">
            {/* Sidebar stays fixed on the left */}
            <Sidebar />

            {/* Main content area shifts right to accommodate sidebar */}
            <main className="flex-1 ml-64 p-8">
                <div className="max-w-7xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default DashboardLayout;