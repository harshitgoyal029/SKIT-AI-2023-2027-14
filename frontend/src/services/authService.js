import { apiRequest } from "./api";

const TOKEN_KEY = "cvd_xai_access_token";
const USER_KEY = "cvd_xai_user";

export const login = async (email, password) => {
    const data = await apiRequest("/api/auth/login", {
        method: "POST",
        body: { email: email.trim().toLowerCase(), password },
    });

    localStorage.setItem(TOKEN_KEY, data.access_token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));

    return data;
};

export const register = async ({ name, email, password }) =>
    apiRequest("/api/auth/register", {
        method: "POST",
        body: {
            full_name: name.trim(),
            email: email.trim().toLowerCase(),
            password,
        },
    });

export const getCurrentUser = async () => {
    const token = localStorage.getItem(TOKEN_KEY);

    if (!token) {
        return null;
    }

    try {
        const user = await apiRequest("/api/auth/me");
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        return user;
    } catch (error) {
        if (error.status === 401) {
            logout();
            return null;
        }

        throw error;
    }
};

export const getStoredUser = () => {
    try {
        const value = localStorage.getItem(USER_KEY);
        return value ? JSON.parse(value) : null;
    } catch {
        return null;
    }
};

export const getAccessToken = () => localStorage.getItem(TOKEN_KEY);

export const isAuthenticated = () => Boolean(getAccessToken());

export const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem("cvd_xai_patient");
};
