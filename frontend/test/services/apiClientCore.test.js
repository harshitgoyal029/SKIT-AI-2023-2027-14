import assert from "node:assert/strict";
import test from "node:test";
import { createApiClient } from "../../src/services/apiClientCore.js";

test("normalizes the API base URL and request path", () => {
    const client = createApiClient({ baseUrl: "http://api.example.test/" });

    assert.equal(client.getApiUrl("/api/patients"), "http://api.example.test/api/patients");
    assert.equal(client.getApiUrl("api/patients"), "http://api.example.test/api/patients");
});

test("sends JSON and the stored bearer token", async () => {
    let request;
    const client = createApiClient({
        baseUrl: "http://api.example.test",
        getAccessToken: () => "test-token",
        fetchImpl: async (url, options) => {
            request = { url, options };
            return Response.json({ id: "patient-1" });
        },
    });

    const data = await client.apiRequest("/api/patients", {
        method: "POST",
        body: { name: "Example" },
    });

    assert.deepEqual(data, { id: "patient-1" });
    assert.equal(request.url, "http://api.example.test/api/patients");
    assert.equal(request.options.headers.get("authorization"), "Bearer test-token");
    assert.equal(request.options.headers.get("content-type"), "application/json");
    assert.equal(request.options.body, JSON.stringify({ name: "Example" }));
});

test("uses a caller-provided authorization header", async () => {
    let headers;
    const client = createApiClient({
        getAccessToken: () => "stored-token",
        fetchImpl: async (_url, options) => {
            headers = options.headers;
            return Response.json({ ok: true });
        },
    });

    await client.apiRequest("/api/auth/me", {
        headers: { authorization: "Bearer override-token" },
    });

    assert.equal(headers.get("authorization"), "Bearer override-token");
});

test("parses API errors and signals unauthorized responses", async () => {
    let unauthorized = false;
    const client = createApiClient({
        onUnauthorized: () => { unauthorized = true; },
        fetchImpl: async () => Response.json({ detail: "Sign in again." }, { status: 401 }),
    });

    await assert.rejects(client.apiRequest("/api/auth/me"), (error) => {
        assert.equal(error.message, "Sign in again.");
        assert.equal(error.status, 401);
        assert.deepEqual(error.data, { detail: "Sign in again." });
        return true;
    });
    assert.equal(unauthorized, true);
});
