import { Router } from "express";
import { hasSupabaseConfig, supabase, supabaseAdmin } from "../lib/supabase.js";

const router = Router();
const allowedRoles = new Set(["doctor", "pharmacy", "medical"]);
const emailRedirectTo = process.env.SUPABASE_EMAIL_REDIRECT_TO;

function canonicalizeRole(role) {
  if (role === "medical") {
    return "pharmacy";
  }

  if (role === "doctor" || role === "pharmacy") {
    return role;
  }

  return null;
}

async function persistUserRecords({ id, email, fullName, role }) {
  if (!id || !supabaseAdmin) {
    return;
  }

  const safeFullName = fullName ?? "";
  const normalizedRole = canonicalizeRole(role) ?? "doctor";
  const userRecord = {
    id,
    email: email ?? null,
    full_name: safeFullName,
    role: normalizedRole,
  };

  // Keep role/profile data accessible in app tables, not only in auth.users.
  await Promise.allSettled([
    supabaseAdmin.from("user").upsert(userRecord, { onConflict: "id" }),
    supabaseAdmin.from("users").upsert(userRecord, { onConflict: "id" }),
    supabaseAdmin.from("profiles").upsert(
      {
        id,
        full_name: safeFullName,
        role: normalizedRole,
      },
      { onConflict: "id" },
    ),
  ]);
}

async function resolveUserRole(user) {
  if (!user) {
    return null;
  }

  if (supabaseAdmin) {
    const roleTables = ["user", "users", "profiles"];

    for (const tableName of roleTables) {
      const { data } = await supabaseAdmin
        .from(tableName)
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      const tableRole = canonicalizeRole(data?.role);
      if (tableRole) {
        return tableRole;
      }
    }
  }

  const metadataRole = canonicalizeRole(user.user_metadata?.role);
  if (metadataRole) {
    return metadataRole;
  }

  return "doctor";
}

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  if (!hasSupabaseConfig || !supabase) {
    return res.status(500).json({ error: "Supabase is not configured yet" });
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    if (/email not confirmed/i.test(error.message)) {
      return res.status(401).json({
        error:
          "Email not confirmed. Check your inbox for the confirmation link or request resend.",
        code: "email_not_confirmed",
      });
    }

    return res.status(401).json({ error: error.message });
  }

  const role = await resolveUserRole(data.user);

  return res.json({ user: data.user, session: data.session, role });
});

router.post("/register", async (req, res) => {
  const { fullName, email, password, role } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  const normalizedRole = canonicalizeRole(role);

  if (!role || !normalizedRole) {
    return res.status(400).json({ error: "valid role is required" });
  }

  if (!hasSupabaseConfig || !supabase) {
    return res.status(500).json({ error: "Supabase is not configured yet" });
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName ?? "", role: normalizedRole },
      ...(emailRedirectTo ? { emailRedirectTo } : {}),
    },
  });

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  if (data.user?.id) {
    try {
      await persistUserRecords({
        id: data.user.id,
        email: data.user.email,
        fullName,
        role: normalizedRole,
      });
    } catch (persistError) {
      console.error("Failed to persist users/profiles records:", persistError);
    }
  }

  return res.json({
    user: data.user,
    session: data.session,
    role: normalizedRole,
    verificationRequired: true,
    message: "Verification email sent. Please confirm before logging in.",
  });
});

router.post("/resend-confirmation", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "email is required" });
  }

  if (!hasSupabaseConfig || !supabase) {
    return res.status(500).json({ error: "Supabase is not configured yet" });
  }

  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
  });

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.json({ ok: true, message: "Confirmation email resent" });
});

export default router;
