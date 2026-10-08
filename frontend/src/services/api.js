const API_BASE_URL = (
    import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"
).replace(/\/$/, "");

const parseResponse = async (response) => {
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
        return response.json();
    }

    const text = await response.text();
    return text ? { message: text } : null;
};

export const getApiUrl = (path) =>
    `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

export const apiRequest = async (path, options = {}) => {
    const {
        headers: customHeaders = {},
        body,
        ...requestOptions
    } = options;

    const token = localStorage.getItem("cvd_xai_access_token");
    const headers = {
        ...customHeaders,
    };

    if (body !== undefined && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
    }

    if (token && !headers.Authorization) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(getApiUrl(path), {
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
            window.dispatchEvent(new Event("cvd-xai:unauthorized"));
        }

        const error = new Error(message);
        error.status = response.status;
        error.data = data;
        throw error;
    }

    return data;
};
