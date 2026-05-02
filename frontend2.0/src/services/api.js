import axios from 'axios';
import { API_BASE_URL } from './runtime';

const api = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');

    // ONLY attach if it's a valid JWT
    if (token && token !== "undefined" && token !== "null" && token.length > 20) {
        config.headers.Authorization = `Bearer ${token}`;
    } else {
        // Essential for Kiosk users: remove Auth header so SecurityConfig .permitAll() works
        delete config.headers.Authorization;
    }
    return config;
}, (error) => Promise.reject(error));

api.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response ? error.response.status : null;
        const requestUrl = error.config?.url || "";
        const authHeader = error.config?.headers?.Authorization;
        const isAuthLoginRequest = requestUrl.includes("/auth/login");
        const isKioskPath = window.location.pathname.includes('/kiosk');

        // Keep UI state reactive: clear auth and let ProtectedRoute redirect naturally.
        if (status === 401 && authHeader && !isAuthLoginRequest && !isKioskPath) {
            localStorage.removeItem('token');
            localStorage.removeItem('role');
            window.dispatchEvent(new CustomEvent('app:unauthorized', { detail: { requestUrl } }));
        }

        if (status === 403) {
            console.warn("403 Forbidden: Ensure the endpoint is permitted in SecurityConfig.");
        }

        return Promise.reject(error);
    }
);

export default api;
