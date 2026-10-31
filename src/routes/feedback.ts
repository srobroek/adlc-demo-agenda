import type { BunRequest } from "bun";
import { z } from "zod";
import type { Catalog } from "../agenda/catalog.ts";
import type { Feedback, FeedbackStore } from "../feedback/store.ts";
import { badRequest, json, notFound } from "../http.ts";

const LeaveFeedback = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

/** Rating count, average to one decimal (null without feedback) and non-empty comments, newest first. */
export function feedbackSummary(sessionId: string, entries: readonly Feedback[]) {
  const count = entries.length;
  const total = entries.reduce((sum, entry) => sum + entry.rating, 0);
  const average = count === 0 ? null : Math.round((total / count) * 10) / 10;
  const comments = entries
    .map((entry) => entry.comment)
    .filter((comment): comment is string => comment !== null && comment.trim() !== "")
    .reverse();
  return { sessionId, count, average, comments };
}

export function feedbackRoutes(catalog: Catalog, store: FeedbackStore) {
  return {
    "/sessions/:id/feedback/summary": {
      GET: (req: BunRequest<"/sessions/:id/feedback/summary">) => {
        const sessionId = req.params.id;
        if (catalog.session(sessionId) === undefined) return notFound(`session ${sessionId}`);
        return json(feedbackSummary(sessionId, store.forSession(sessionId)));
      },
    },
    "/sessions/:id/feedback": {
      POST: async (req: BunRequest<"/sessions/:id/feedback">) => {
        const sessionId = req.params.id;
        if (catalog.session(sessionId) === undefined) return notFound(`session ${sessionId}`);
        const parsed = LeaveFeedback.safeParse(await req.json().catch(() => undefined));
        if (!parsed.success) {
          return badRequest(
            'body must be {"rating": integer 1-5, "comment"?: string of at most 500 characters}',
          );
        }
        const feedback: Feedback = {
          sessionId,
          rating: parsed.data.rating,
          comment: parsed.data.comment ?? null,
        };
        store.add(feedback);
        return json(feedback, 201);
      },
    },
  };
}
