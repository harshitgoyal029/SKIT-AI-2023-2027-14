import { createApiClient, getStoredAccessToken } from "./apiClientCore";

const client = createApiClient({
    baseUrl: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000",
    fetchImpl: (...args) => fetch(...args),
    getAccessToken: () => getStoredAccessToken(localStorage),
    onUnauthorized: () => window.dispatchEvent(new Event("cvd-xai:unauthorized")),
});

export const { getApiUrl, apiRequest } = client;
