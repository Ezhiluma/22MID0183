/**
 * notification_app_be/register.ts
 *
 * Run ONCE to obtain your clientID and clientSecret.
 * ⚠️  Save the response — you cannot retrieve credentials again!
 *
 * Usage: npx ts-node register.ts
 */

import { Log, setStoredToken } from "./index";

const BASE = "http://4.224.186.213/evaluation-service";

// ─── Fill in your details ─────────────────────────────────────────────────────
const PAYLOAD = {
  email:          "YOUR_EMAIL@college.edu",   // ← college email
  name:           "YOUR FULL NAME",           // ← your name
  mobileNo:       "9999999999",               // ← your mobile number
  githubUsername: "YOUR_GITHUB_USERNAME",     // ← GitHub username only (not URL)
  rollNo:         "YOUR_ROLL_NUMBER",         // ← your roll number
  accessCode:     "YOUR_ACCESS_CODE",         // ← from Affordmed email
};

async function main() {
  await Log("backend", "info", "auth", `Starting registration for ${PAYLOAD.email}`);

  const res = await fetch(`${BASE}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(PAYLOAD),
  });

  const data = await res.json();

  if (!res.ok) {
    await Log("backend", "error", "auth", `Registration failed: ${JSON.stringify(data)}`);
    console.error("❌ Registration failed:", data);
    process.exit(1);
  }

  await Log("backend", "info", "auth", "Registration successful");

  console.log("\n✅ REGISTRATION SUCCESSFUL — COPY AND SAVE THESE:\n");
  console.log(JSON.stringify(data, null, 2));
  console.log("\n⚠️  You cannot register again. Store clientID and clientSecret now!\n");
}

main().catch(console.error);
