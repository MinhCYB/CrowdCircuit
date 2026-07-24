import { describe, it, expect, afterAll } from "vitest";
import { buildApp } from "../src/index.js";

describe("GET /api/v1/health", () => {
  const app = buildApp();

  afterAll(async () => {
    await (await app).close();
  });

  it("returns status ok", async () => {
    const server = await app;
    const response = await server.inject({
      method: "GET",
      url: "/api/v1/health",
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.status).toBe("ok");
    expect(body.product).toBe("CrowdCircuit");
    expect(body.version).toBe("0.1.0");
    expect(body.timestamp).toBeDefined();
  });

  it("returns valid ISO timestamp", async () => {
    const server = await app;
    const response = await server.inject({
      method: "GET",
      url: "/api/v1/health",
    });

    const body = response.json();
    const date = new Date(body.timestamp);
    expect(date.toISOString()).toBe(body.timestamp);
  });
});
