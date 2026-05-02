import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider, useAuth } from "./context/AuthContext";

import Sidebar from "./components/Sidebar";
import CustomerKiosk from "./components/CustomerKiosk";
import KitchenDashboard from "./components/KitchenDashboard";
// CHANGED: Importing AdminDashboard instead of AdminPanel
import AdminDashboard from "./components/AdminDashboard";
import MenuManager from "./pages/MenuManager";
import InventoryManager from "./pages/InventoryManager";
import TableManager from "./pages/TableManager";
import OrderHistory from "./pages/OrderHistory";
import SettingsManager from "./pages/SettingsManager";
import BrandingManager from "./pages/BrandingManager";
import Login from "./pages/Login";

const getPersistedAuth = () => {
    const token = localStorage.getItem("token");
    const storedRole = localStorage.getItem("role");

    if (!token || token === "undefined" || token === "null") {
        return null;
    }

    if (!storedRole) {
        return null;
    }

    const normalizedRole = storedRole.startsWith("ROLE_") ? storedRole : `ROLE_${storedRole}`;
    return { token, role: normalizedRole };
};

const ProtectedRoute = ({ children, role }) => {
    const { user } = useAuth();
    const activeUser = user || getPersistedAuth();

    if (!activeUser) return <Navigate to="/login" replace />;
    if (role && activeUser.role !== role) return <Navigate to="/" replace />;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 lg:flex">
            <Sidebar />
            <main className="flex-1 min-h-screen overflow-x-hidden lg:ml-64">
                <div className="p-4 sm:p-6 lg:p-8">{children}</div>
            </main>
        </div>
    );
};

function App() {
    return (
        <ThemeProvider>
            <AuthProvider>
                <BrowserRouter>
                    <Routes>
                        <Route path="/" element={<CustomerKiosk />} />
                        <Route path="/kiosk" element={<CustomerKiosk />} />
                        <Route path="/login" element={<Login />} />

                        {/* Admin Routes */}
                        {/* CHANGED: Route now uses <AdminDashboard /> */}
                        <Route path="/admin" element={
                            <ProtectedRoute role="ROLE_ADMIN">
                                <AdminDashboard />
                            </ProtectedRoute>
                        } />

                        <Route path="/admin/kitchen" element={
                            <ProtectedRoute role="ROLE_ADMIN">
                                <KitchenDashboard />
                            </ProtectedRoute>
                        } />

                        <Route path="/admin/menu" element={
                            <ProtectedRoute role="ROLE_ADMIN">
                                <MenuManager />
                            </ProtectedRoute>
                        } />
                        <Route path="/admin/inventory" element={
                            <ProtectedRoute role="ROLE_ADMIN">
                                <InventoryManager />
                            </ProtectedRoute>
                        } />
                        <Route path="/admin/tables" element={
                            <ProtectedRoute role="ROLE_ADMIN">
                                <TableManager />
                            </ProtectedRoute>
                        } />
                        <Route path="/admin/history" element={
                            <ProtectedRoute role="ROLE_ADMIN">
                                <OrderHistory />
                            </ProtectedRoute>
                        } />

                        <Route path="/admin/branding" element={
                            <ProtectedRoute role="ROLE_ADMIN">
                                <BrandingManager />
                            </ProtectedRoute>
                        } />

                        <Route path="/admin/settings" element={<Navigate to="/admin/branding" replace />} />

                        <Route path="/kitchen" element={
                            <ProtectedRoute role="ROLE_KITCHEN">
                                <KitchenDashboard />
                            </ProtectedRoute>
                        } />
                        <Route path="/kitchen/inventory" element={
                            <ProtectedRoute role="ROLE_KITCHEN">
                                <InventoryManager />
                            </ProtectedRoute>
                        } />

                        <Route path="*" element={<Navigate to="/" />} />
                    </Routes>
                </BrowserRouter>
            </AuthProvider>
        </ThemeProvider>
    );
}

export default App;
