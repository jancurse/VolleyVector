import { beforeEach, describe, expect, test, vi } from "vitest";

import { invokeFunction } from "../../src/supabase/invokeFunction";

// The helper unwraps an Edge Function failure: it reads the function's HTTP Response body and prefers
// `body.error`, falling back to the generic `error.message` when the body has no error or is unreadable.
// The Supabase client (the one external dependency) is mocked to return the success or failure per test.
let invokeResult: { error: unknown };
const invokeCalls: { name: string; body: unknown }[] = [];

vi.mock("../../src/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: (name: string, opts: { body: unknown }) => {
        invokeCalls.push({ name, body: opts.body });

        return Promise.resolve(invokeResult);
      },
    },
  },
}));

beforeEach(() => {
  invokeResult = { error: null };
  invokeCalls.length = 0;
});

describe("invokeFunction", () => {
  test("forwards the name and body and returns no error on success", async () => {
    expect(await invokeFunction("do-thing", { userId: "u1" })).toEqual({ error: null });
    expect(invokeCalls).toEqual([{ name: "do-thing", body: { userId: "u1" } }]);
  });

  test("prefers the body.error from the function's Response over the generic message", async () => {
    invokeResult = {
      error: {
        message: "Edge Function returned a non-2xx status code",
        context: { json: () => Promise.resolve({ error: "Server says no" }) },
      },
    };

    expect(await invokeFunction("do-thing", {})).toEqual({ error: "Server says no" });
  });

  test("falls back to error.message when the body has no error field", async () => {
    invokeResult = { error: { message: "Network down", context: { json: () => Promise.resolve({}) } } };

    expect(await invokeFunction("do-thing", {})).toEqual({ error: "Network down" });
  });

  test("falls back to error.message when there is no readable response body", async () => {
    invokeResult = { error: { message: "No context" } };

    expect(await invokeFunction("do-thing", {})).toEqual({ error: "No context" });
  });

  test("falls back to error.message when the response body is not readable JSON", async () => {
    invokeResult = {
      error: { message: "Bad body", context: { json: () => Promise.reject(new Error("not json")) } },
    };

    expect(await invokeFunction("do-thing", {})).toEqual({ error: "Bad body" });
  });
});
