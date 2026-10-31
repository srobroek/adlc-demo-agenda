import { afterAll, describe, expect, test } from "bun:test";
import { createApp } from "../../src/app.ts";
import { conference } from "../../src/data/conference.ts";
import { createFeedbackStore } from "../../src/feedback/store.ts";
import { createScheduleStore } from "../../src/schedule/store.ts";
import { startApp } from "../support/app.ts";

const app = startApp();
const store = createFeedbackStore();
const server = Bun.serve({
  port: 0,
  routes: createApp(conference, createScheduleStore(), store),
  fetch: () => new Response(null, { status: 404 }),
});
afterAll(() => {
  app.stop();
  server.stop(true);
});

const post = (body: unknown, sessionId = "graphs") =>
  app.send("POST", `/sessions/${sessionId}/feedback`, body);

const postRaw = (init: RequestInit, sessionId = "graphs") =>
  fetch(new URL(`/sessions/${sessionId}/feedback`, server.url), { method: "POST", ...init });

describe("session feedback", () => {
  test("accepts a rating with a comment", async () => {
    const response = await post({ rating: 4, comment: "Great" });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ sessionId: "graphs", rating: 4, comment: "Great" });
  });

  test("answers comment null when absent", async () => {
    const response = await post({ rating: 5 });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ sessionId: "graphs", rating: 5, comment: null });
  });

  test("rejects an unknown session", async () => {
    expect((await post({ rating: 4 }, "nope")).status).toBe(404);
  });

  for (const rating of [0, 6, 3.5, "4", null, true]) {
    test(`rejects rating ${JSON.stringify(rating)}`, async () => {
      expect((await post({ rating })).status).toBe(400);
    });
  }

  test("rejects a missing rating", async () => {
    expect((await post({ comment: "Great" })).status).toBe(400);
  });

  test("accepts a comment of exactly 500 characters", async () => {
    const comment = "x".repeat(500);
    const response = await post({ rating: 3, comment });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ sessionId: "graphs", rating: 3, comment });
  });

  test("rejects a comment longer than 500 characters", async () => {
    expect((await post({ rating: 3, comment: "x".repeat(501) })).status).toBe(400);
  });

  test("rejects a non-string comment", async () => {
    expect((await post({ rating: 3, comment: 42 })).status).toBe(400);
  });

  test("rejects a non-JSON body", async () => {
    const response = await postRaw({
      headers: { "content-type": "application/json" },
      body: "rating=4",
    });
    expect(response.status).toBe(400);
  });

  test("rejects a missing body", async () => {
    expect((await postRaw({})).status).toBe(400);
  });

  test("keeps feedback in the injected store", async () => {
    const response = await postRaw(
      {
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rating: 2, comment: "Too fast" }),
      },
      "evals",
    );
    expect(response.status).toBe(201);
    await postRaw({ body: JSON.stringify({ rating: 0 }) }, "evals");
    expect(store.forSession("evals")).toEqual([
      { sessionId: "evals", rating: 2, comment: "Too fast" },
    ]);
  });
});
