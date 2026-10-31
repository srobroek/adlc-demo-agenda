import { afterAll, describe, expect, test } from "bun:test";
import { startApp } from "../support/app.ts";

const app = startApp();
afterAll(() => app.stop());

const leave = (sessionId: string, body: unknown) =>
  app.send("POST", `/sessions/${sessionId}/feedback`, body);
const summary = (sessionId: string) => app.get(`/sessions/${sessionId}/feedback/summary`);

describe("session feedback summary", () => {
  test("a known session without feedback has an empty summary", async () => {
    const response = await summary("keynote");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      sessionId: "keynote",
      count: 0,
      average: null,
      comments: [],
    });
  });

  test("averages ratings to one decimal", async () => {
    for (const rating of [4, 5, 5]) {
      expect((await leave("graphs", { rating })).status).toBe(201);
    }
    const response = await summary("graphs");
    expect(response.status).toBe(200);
    const body = (await response.json()) as { count: number; average: number | null };
    expect(body.count).toBe(3);
    expect(body.average).toBe(4.7);
  });

  test("lists only non-empty comments, newest first", async () => {
    expect((await leave("evals", { rating: 3, comment: "First" })).status).toBe(201);
    expect((await leave("evals", { rating: 4 })).status).toBe(201);
    expect((await leave("evals", { rating: 2, comment: "" })).status).toBe(201);
    expect((await leave("evals", { rating: 5, comment: "Second" })).status).toBe(201);
    expect((await leave("evals", { rating: 1, comment: "   " })).status).toBe(201);
    const response = await summary("evals");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      sessionId: "evals",
      count: 5,
      average: 3,
      comments: ["Second", "First"],
    });
  });

  test("an unknown session answers 404", async () => {
    const response = await summary("nope");
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "not_found",
      message: "session nope not found",
    });
  });
});
