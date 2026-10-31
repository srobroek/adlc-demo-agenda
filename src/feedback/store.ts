/** In-memory session feedback: the ratings and comments left on each session, in insertion order. */
export interface Feedback {
  sessionId: string;
  rating: number;
  comment: string | null;
}

export interface FeedbackStore {
  forSession(sessionId: string): readonly Feedback[];
  add(feedback: Feedback): void;
}

export function createFeedbackStore(): FeedbackStore {
  const feedback = new Map<string, Feedback[]>();
  return {
    forSession: (sessionId) => feedback.get(sessionId) ?? [],
    add(entry) {
      const entries = feedback.get(entry.sessionId) ?? [];
      entries.push(entry);
      feedback.set(entry.sessionId, entries);
    },
  };
}
