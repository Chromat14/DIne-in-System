import React, { useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const pickRole = (value) => {
    if (!value) return null;
    const role = String(value).trim();
    if (!role) return null;
    return role.startsWith("ROLE_") ? role : `ROLE_${role}`;
};

const decodeRoleFromToken = (token) => {
    try {
        const parts = token.split(".");
        if (parts.length < 2) return null;
        const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const padded = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), "=");
        const parsed = JSON.parse(atob(padded));
        const claim = parsed?.roles || parsed?.role || parsed?.authorities;
        if (Array.isArray(claim) && claim.length > 0) return pickRole(claim[0]);
        if (typeof claim === "string" && claim.trim()) return pickRole(claim.split(",")[0].trim());
        return null;
    } catch {
        return null;
    }
};

const Login = () => {
    const [creds, setCreds] = useState({ username: '', password: '' });
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await api.post('/auth/login', creds);

            const accessToken = res.data?.accessToken || res.data?.token;
            const resolvedRole = pickRole(res.data?.role) || decodeRoleFromToken(accessToken || "");

            if (accessToken) {
                login(accessToken, resolvedRole);

                if (resolvedRole && resolvedRole.includes('ADMIN')) {
                    navigate('/admin', { replace: true });
                } else {
                    navigate('/kitchen', { replace: true });
                }
            } else {
                alert("Login failed: invalid auth response.");
            }
        } catch (err) {
            console.error("Login Error:", err.response?.data);
            alert(err.response?.data?.message || "Login Failed: Check credentials");
        }
    };

    return (
        <div className="flex items-center justify-center min-h-[70vh]">
            <div className="bg-white dark:bg-gray-800 p-10 rounded-3xl shadow-2xl w-full max-w-md border border-gray-100 dark:border-gray-700">
                <div className="text-center mb-8">
                    <h2 className="text-3xl font-black text-blue-600">Staff Access</h2>
                </div>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <input
                        type="text" placeholder="Username" required
                        className="w-full p-4 rounded-xl border dark:bg-gray-900 outline-none focus:ring-2 focus:ring-blue-600"
                        onChange={(e) => setCreds({...creds, username: e.target.value})}
                    />
                    <input
                        type="password" placeholder="Password" required
                        className="w-full p-4 rounded-xl border dark:bg-gray-900 outline-none focus:ring-2 focus:ring-blue-600"
                        onChange={(e) => setCreds({...creds, password: e.target.value})}
                    />
                    <button type="submit" className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold">
                        Sign In
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Login;
