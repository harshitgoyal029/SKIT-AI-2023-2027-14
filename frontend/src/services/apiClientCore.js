const parseResponse = async (response) => {
    const contentType = response.headers.get("content-type") || "";
    const text = await response.text();

    if (!text) {
        return null;
    }

    if (contentType.includes("application/json")) {
        try {
            return JSON.parse(text);
        } catch {
            return { message: text };
        }
    }

    return text ? { message: text } : null;
};

export const getStoredAccessToken = (storage) =>
    storage?.getItem("cvd_xai_access_token") || storage?.getItem("cvd_token") || null;

const isNativeBody = (body) => {
    if (typeof body === "string") return true;

    return [
        typeof FormData !== "undefined" && FormData,
        typeof Blob !== "undefined" && Blob,
        typeof URLSearchParams !== "undefined" && URLSearchParams,
        typeof ArrayBuffer !== "undefined" && ArrayBuffer,
    ].some((BodyType) => BodyType && body instanceof BodyType) ||
        (typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView(body));
};

export const createApiClient = ({
    baseUrl = "",
    fetchImpl = globalThis.fetch,
    getAccessToken = () => null,
    onUnauthorized = () => {},
} = {}) => {
    const normalizedBaseUrl = baseUrl.replace(/\/$/, "");

    const getApiUrl = (path) =>
        `${normalizedBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;

    const apiRequest = async (path, options = {}) => {
        const {
            headers: customHeaders = {},
            body,
            ...requestOptions
        } = options;

        const headers = new Headers(customHeaders);
        const token = getAccessToken();

        const serializeAsJson = body !== undefined && !isNativeBody(body);

        if (serializeAsJson && !headers.has("Content-Type")) {
            headers.set("Content-Type", "application/json");
        }

        if (token && !headers.has("Authorization")) {
            headers.set("Authorization", `Bearer ${token}`);
        }

        const response = await fetchImpl(getApiUrl(path), {
            ...requestOptions,
            headers,
            body: serializeAsJson ? JSON.stringify(body) : body,
        });

        const data = await parseResponse(response);

        if (!response.ok) {
            const message =
                data?.detail ||
                data?.message ||
                `Request failed with status ${response.status}.`;

            if (response.status === 401) {
                onUnauthorized();
            }

            const error = new Error(message);
            error.status = response.status;
            error.data = data;
            throw error;
        }

        return data;
    };

    return { getApiUrl, apiRequest };
};
