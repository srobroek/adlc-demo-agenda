import type { BunRequest } from "bun";
import { z } from "zod";
import type { Catalog } from "../agenda/catalog.ts";
import type { Feedback, FeedbackStore } from "../feedback/store.ts";
import { badRequest, json, notFound } from "../http.ts";

const LeaveFeedback = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

export function feedbackRoutes(catalog: Catalog, store: FeedbackStore) {
  return {
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
