import { supabase } from "./client";

/**
 * Invoke an Edge Function and surface the reason it returned. A failed call carries the function's HTTP
 * Response on `error.context`; read its JSON body and prefer `body.error` over the generic
 * "Edge Function returned a non-2xx status code" message, falling back to `error.message`.
 */
export async function invokeFunction(name: string, body: Record<string, unknown>): Promise<{ error: string | null }> {
  const { error } = await supabase.functions.invoke(name, { body });

  if (!error) return { error: null };

  const context = (error as { context?: { json?: () => Promise<{ error?: string }> } }).context;

  if (context?.json) {
    try {
      const failure = await context.json();

      if (failure?.error) return { error: failure.error };
    } catch {
      // Body was not readable JSON; fall back to the generic message.
    }
  }

  return { error: error.message };
}
