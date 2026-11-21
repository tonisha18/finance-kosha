import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { seedDemoDataForUser } from "@/lib/seed-demo";

export async function POST() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Supabase service configuration missing" },
        { status: 500 }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const demoEmail = "demo@moneymodel.app";
    const demoPassword = "DemoUser123!";

    // Check if user already exists
    const { data: userList, error: listError } = await adminClient.auth.admin.listUsers();
    if (listError) {
      return NextResponse.json({ error: listError.message }, { status: 500 });
    }

    let demoUser = userList.users.find((u) => u.email === demoEmail);

    if (!demoUser) {
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email: demoEmail,
        password: demoPassword,
        email_confirm: true,
        user_metadata: { name: "Demo User" },
      });

      if (createError) {
        return NextResponse.json({ error: createError.message }, { status: 500 });
      }
      demoUser = newUser.user;
    } else {
      // Ensure email is confirmed and password is set
      await adminClient.auth.admin.updateUserById(demoUser.id, {
        email_confirm: true,
        password: demoPassword,
      });
    }

    // Check if user has transactions; if empty, seed demo data immediately
    const { count } = await adminClient
      .from("transactions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", demoUser.id);

    if (!count || count === 0) {
      await seedDemoDataForUser(adminClient, demoUser.id);
    }

    return NextResponse.json({
      success: true,
      email: demoEmail,
      password: demoPassword,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to setup demo" }, { status: 500 });
  }
}
