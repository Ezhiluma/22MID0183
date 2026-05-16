/**
 * notification_app_be/auth.ts
 * Handles authentication with the Affordmed Test Server.
 * Called before every session to get a fresh Bearer token.
 */

import { Log, setStoredToken } from "./index";

const BASE = "http://4.224.186.213/evaluation-service";

export interface Credentials {
  email: string;
  name: string;
  rollNo: string;
  accessCode: string;
  clientID: string;
  clientSecret: string;
}

/**
 * Calls POST /auth and returns a Bearer token.
 * Also stores the token in the logging middleware so logs are authenticated.
 */
export async function authenticate(creds: Credentials): Promise<string> {
  await Log("backend", "info", "auth", `Authenticating user: ${creds.email}`);

  const res = await fetch(`${BASE}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(creds),
  });

  const data: any = await res.json();

  if (!res.ok || !data.access_token) {
    await Log("backend", "error", "auth", `Authentication failed — status: ${res.status}`);
    throw new Error(`Authentication failed: ${JSON.stringify(data)}`);
  }

  // Store token so logging middleware can attach it to subsequent log calls
  setStoredToken(data.access_token);

  await Log("backend", "info", "auth", `Token obtained successfully. Expires: ${data.expires_in}`);
  return data.access_token as string;
}
