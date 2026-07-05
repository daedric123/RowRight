import { createClient } from "@supabase/supabase-js";

// Runs daily to prevent Supabase free-tier auto-pause (pauses after ~7 days idle).
export const config = { schedule: "0 12 * * *" };

export const handler = async () => {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const { error } = await supabase.from("teams").select("id").limit(1);

  if (error) {
    console.error("[keep-alive] ping failed:", error.message);
    return { statusCode: 500, body: error.message };
  }

  console.log("[keep-alive] ping ok");
  return { statusCode: 200, body: "ok" };
};
