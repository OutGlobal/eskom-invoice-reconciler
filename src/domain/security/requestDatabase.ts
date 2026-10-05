import { AsyncLocalStorage } from "node:async_hooks";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { setServerClientResolver } from "../../lib/supabase";

const clients = new AsyncLocalStorage<SupabaseClient>();
setServerClientResolver(() => clients.getStore());

export function withRequestDatabase<T>(request: Request, operation: () => T): T {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Database unavailable");
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: request.headers.get("authorization")! } },
  });
  return clients.run(client, operation);
}
