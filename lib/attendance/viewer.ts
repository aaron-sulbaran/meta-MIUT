// A stable random id per browser, standing in for an account in the demo.
// Client only: call it from event handlers or effects, not during render.

const VIEWER_ID_KEY = "campus-events-viewer-id";

let sessionFallbackId: string | null = null;

function randomId(): string {
  return crypto.randomUUID().replaceAll("-", "");
}

export function getViewerId(): string {
  try {
    const stored = window.localStorage.getItem(VIEWER_ID_KEY);
    if (stored && /^[A-Za-z0-9_-]{8,64}$/.test(stored)) return stored;
    const created = randomId();
    window.localStorage.setItem(VIEWER_ID_KEY, created);
    return created;
  } catch {
    // Private mode or blocked storage: keep one id for this page session.
    sessionFallbackId ??= randomId();
    return sessionFallbackId;
  }
}
