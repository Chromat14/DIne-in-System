import React, { createContext, useContext, useEffect, useState } from 'react';

const AuthContext = createContext();

const normalizeRole = (rawRole) => {
    if (!rawRole || typeof rawRole !== 'string') {
        return null;
    }
    const trimmed = rawRole.trim();
    if (!trimmed) {
        return null;
    }
    return trimmed.startsWith('ROLE_') ? trimmed : `ROLE_${trimmed}`;
};

const decodeJwtPayload = (token) => {
    try {
        const segments = token.split('.');
        if (segments.length < 2) return null;
        const payload = segments[1].replace(/-/g, '+').replace(/_/g, '/');
        const padded = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), '=');
        return JSON.parse(atob(padded));
    } catch {
        return null;
    }
};

const extractRoleFromToken = (token) => {
    const payload = decodeJwtPayload(token);
    if (!payload || typeof payload !== 'object') {
        return null;
    }

    const rolesClaim = payload.roles || payload.role || payload.authorities;
    if (Array.isArray(rolesClaim) && rolesClaim.length > 0) {
        return normalizeRole(String(rolesClaim[0]));
    }
    if (typeof rolesClaim === 'string' && rolesClaim.trim()) {
        return normalizeRole(rolesClaim.split(',')[0].trim());
    }

    return null;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(() => {
        const token = localStorage.getItem('token');
        const storedRole = localStorage.getItem('role');

        if (token && token !== "undefined" && token !== "null") {
            const normalizedRole = normalizeRole(storedRole) || extractRoleFromToken(token);
            if (normalizedRole) {
                localStorage.setItem('role', normalizedRole);
                return { token, role: normalizedRole };
            }
        }
        return null;
    });

    const login = (accessToken, rawRole) => {
        const normalizedRole = normalizeRole(rawRole) || extractRoleFromToken(accessToken);
        if (!normalizedRole) {
            throw new Error("Role is missing from login response and token payload");
        }

        localStorage.setItem('token', accessToken);
        localStorage.setItem('role', normalizedRole);
        setUser({ token: accessToken, role: normalizedRole });
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        setUser(null);
    };

    useEffect(() => {
        const handleUnauthorized = () => {
            localStorage.removeItem('token');
            localStorage.removeItem('role');
            setUser(null);
        };

        const handleStorage = () => {
            const token = localStorage.getItem('token');
            const storedRole = localStorage.getItem('role');

            if (!token || token === "undefined" || token === "null") {
                setUser(null);
                return;
            }

            const normalizedRole = normalizeRole(storedRole) || extractRoleFromToken(token);
            if (!normalizedRole) {
                setUser(null);
                return;
            }

            setUser({ token, role: normalizedRole });
        };

        window.addEventListener('app:unauthorized', handleUnauthorized);
        window.addEventListener('storage', handleStorage);
        return () => {
            window.removeEventListener('app:unauthorized', handleUnauthorized);
            window.removeEventListener('storage', handleStorage);
        };
    }, []);

    return (
        <AuthContext.Provider value={{ user, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
