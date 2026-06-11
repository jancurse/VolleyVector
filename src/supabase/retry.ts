// The awaited commit path retries a failed write before its error ever reaches the user, so a
// transient network failure (e.g. Safari's "Load failed" after a sleep) saves on a later attempt.
const RETRY_DELAYS_MS = [500, 1500];

/** Run a write, retrying transient failures with a short backoff. Resolves to null on success, or to
 *  the final error message once the retries are exhausted. Each attempt calls `write` afresh, so a
 *  retry issues a brand-new request. */
export async function writeWithRetries(
  write: () => PromiseLike<{ error: { message: string } | null }>
): Promise<string | null> {
  for (let attempt = 0; ; attempt++) {
    let message: string;

    try {
      const { error } = await write();

      if (!error) return null;

      message = error.message;
    } catch (caught) {
      message = caught instanceof Error ? caught.message : String(caught);
    }

    if (attempt === RETRY_DELAYS_MS.length) return message;

    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
  }
}
