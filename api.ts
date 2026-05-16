/**
 * notification_app_fe/lib/api.ts
 * Notifications API client — authenticated with Bearer token.
 */

import { Log } from "./index";
import { authenticate } from "./auth";
import { credentials, authToken } from "./config";
import { type Notification, type FilterType } from "./utils";

const BASE_URL = "http://4.224.186.213/evaluation-service/notifications";

let cachedToken: string | null = authToken.access_token;

export async function getAuthToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  cachedToken = await authenticate(credentials);
  return cachedToken;
}

export function clearToken(): void {
  cachedToken = null;
}

export interface FetchParams {
  limit?: number;
  page?: number;
  notification_type?: FilterType;
}

export async function fetchNotifications(params: FetchParams = {}): Promise<Notification[]> {
  const url = new URL(BASE_URL);
  if (params.limit) url.searchParams.set("limit", String(params.limit));
  if (params.page)  url.searchParams.set("page",  String(params.page));
  if (params.notification_type && params.notification_type !== "All") {
    url.searchParams.set("notification_type", params.notification_type);
  }

  await Log("frontend", "info", "api", `GET ${url.toString()}`);

  try {
    const token = await getAuthToken();

    const res = await fetch(url.toString(), {
      headers: { "Authorization": `Bearer ${token}` },
    });

    // Auto-retry on token expiry
    if (res.status === 401) {
      await Log("frontend", "warn", "auth", "Token expired — refreshing and retrying");
      clearToken();
      const newToken = await getAuthToken();
      const retry = await fetch(url.toString(), {
        headers: { "Authorization": `Bearer ${newToken}` },
      });
      if (!retry.ok) {
        await Log("frontend", "error", "api", `Retry failed — HTTP ${retry.status}`);
        throw new Error(`API Error: ${retry.status}`);
      }
      const retryData: any = await retry.json();
      await Log("frontend", "info", "api", `Retry success — ${retryData.notifications?.length ?? 0} items`);
      return retryData.notifications as Notification[];
    }

    if (!res.ok) {
      await Log("frontend", "error", "api", `Notifications API error — HTTP ${res.status}`);
      throw new Error(`API Error: ${res.status}`);
    }

    const data: any = await res.json();
    const count = data.notifications?.length ?? 0;
    await Log("frontend", "info", "api", `Fetched ${count} notifications successfully`);
    return (data.notifications ?? []) as Notification[];

  } catch (err) {
    await Log("frontend", "error", "api", `fetchNotifications failed: ${String(err)}`);
    throw err;
  }
}
