import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(url, anonKey);

async function test() {
  console.log("Connecting to Supabase at:", url);
  try {
    const { data, error } = await supabase.from("profiles").select("count", { count: "exact", head: true });
    if (error && error.code !== "PGRST116" && error.code !== "42P01") {
      console.log("Supabase Connection Response:", error.message, "(Code:", error.code + ")");
    } else {
      console.log("Supabase Connection: SUCCESS");
    }
  } catch (e) {
    console.error("Connection error:", e.message);
  }
}

test();
