import { afterEach, describe, expect, it, vi } from "vitest";
import { readApiJson, requestApiJson } from "@/components/sentry/api/client";

afterEach(() => vi.unstubAllGlobals());

describe("typed Sentry API client", () => {
  it("preserves request completion before JSON parsing", async () => {
    const order: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async () => {
      order.push("response");
      return {
        ok: true,
        status: 200,
        json: async () => {
          order.push("json");
          return { rows: [1] };
        },
      };
    }));
    await expect(readApiJson<{ rows: number[] }>("/api/test")).resolves.toEqual({ rows: [1] });
    expect(order).toEqual(["response", "json"]);
  });

  it("does not parse failed read responses", async () => {
    const json = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json, ok: false, status: 500 }));
    await expect(readApiJson("/api/test")).resolves.toBeNull();
    expect(json).not.toHaveBeenCalled();
  });

  it("retains typed error payloads for mutation-style requests", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: async () => ({ error: "Unavailable" }),
      ok: false,
      status: 503,
    }));
    await expect(requestApiJson<{ error: string }>("/api/test")).resolves.toEqual({
      ok: false,
      payload: { error: "Unavailable" },
      status: 503,
    });
  });
});
