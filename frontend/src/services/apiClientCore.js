const parseResponse = async (response) => {
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
        return response.json();
    }

    const text = await response.text();
    return text ? { message: text } : null;
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

        if (body !== undefined && !headers.has("Content-Type")) {
            headers.set("Content-Type", "application/json");
        }

        if (token && !headers.has("Authorization")) {
            headers.set("Authorization", `Bearer ${token}`);
        }

        const response = await fetchImpl(getApiUrl(path), {
            ...requestOptions,
            headers,
            body:
                body !== undefined && typeof body !== "string"
                    ? JSON.stringify(body)
                    : body,
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
