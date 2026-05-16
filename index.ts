/**
 * logging_middleware/index.ts
 *
 * Reusable logging package — POSTs to Affordmed Test Server on every call.
 *
 * Constraints (STRICT — server rejects invalid values):
 *   stack   : "backend" | "frontend"
 *   level   : "debug" | "info" | "warn" | "error" | "fatal"
 *   package : see ALLOWED_PACKAGES below — backend and frontend have different sets
 *   message : any descriptive string
 *
 * Usage:
 *   Log(stack, level, package, message)
 *   e.g. Log("backend", "error", "handler", "received string, expected bool")
 *        Log("frontend", "info", "api", "Fetched 10 notifications")
 */

const LOG_API_URL = "http://4.224.186.213/evaluation-service/logs";

// ─── Allowed Values (must be lowercase) ──────────────────────────────────────

export type Stack = "backend" | "frontend";

export type Level = "debug" | "info" | "warn" | "error" | "fatal";

// Backend-only packages
type BackendPackage = "cache" | "controller" | "cron_job" | "db" | "domain"
                   | "handler" | "repository" | "route" | "service";

// Frontend-only packages
type FrontendPackage = "api" | "component" | "hook" | "page" | "state" | "style";

// Shared packages (both stacks)
type SharedPackage = "auth" | "config" | "middleware" | "utils";

export type Package = BackendPackage | FrontendPackage | SharedPackage;

// ─── Token store (shared across the app) ─────────────────────────────────────

let _token: string | null = null;

export function setStoredToken(token: string): void {
  _token = token;
}

export function getStoredToken(): string | null {
  return _token;
}

// ─── Core Log Function ────────────────────────────────────────────────────────

export interface LogResponse {
  logID: string;
  message: string;
}

/**
 * Log(stack, level, package, message)
 * Sends a structured log entry to the Affordmed Test Server.
 * Returns the logID from the server on success, or null on failure.
 */
export async function Log(
  stack: Stack,
  level: Level,
  pkg: Package,
  message: string
): Promise<string | null> {
  // Echo locally so developers can see logs during development
  const ts = new Date().toISOString();
  const local = `[${level.toUpperCase()}] ${ts} | ${stack}/${pkg} | ${message}`;
  if (level === "error" || level === "fatal") console.error(local);
  else if (level === "warn")  console.warn(local);
  else if (level === "debug") console.debug(local);
  else                        console.info(local);

  const body = {
    stack,
    level,
    package: pkg,
    message,
  };

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    const token = getStoredToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(LOG_API_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      // Never throw from logger — just warn locally
      console.warn(`[LOGGER] Server rejected log (${res.status}):`, body);
      return null;
    }

    const data: any = await res.json();
    return data.logID;

  } catch {
    // Never let logging failures affect the main application
    console.warn("[LOGGER] Could not reach log server:", body);
    return null;
  }
}

// ─── Convenience Helpers ──────────────────────────────────────────────────────

/**
 * Backend logger — use inside notification_app_be
 * Allowed packages: cache, controller, cron_job, db, domain,
 *                   handler, repository, route, service,
 *                   auth, config, middleware, utils
 */
export const backendLogger = {
  debug: (pkg: BackendPackage | SharedPackage, msg: string) => Log("backend", "debug", pkg, msg),
  info:  (pkg: BackendPackage | SharedPackage, msg: string) => Log("backend", "info",  pkg, msg),
  warn:  (pkg: BackendPackage | SharedPackage, msg: string) => Log("backend", "warn",  pkg, msg),
  error: (pkg: BackendPackage | SharedPackage, msg: string) => Log("backend", "error", pkg, msg),
  fatal: (pkg: BackendPackage | SharedPackage, msg: string) => Log("backend", "fatal", pkg, msg),
};

/**
 * Frontend logger — use inside notification_app_fe
 * Allowed packages: api, component, hook, page, state, style,
 *                   auth, config, middleware, utils
 */
export const frontendLogger = {
  debug: (pkg: FrontendPackage | SharedPackage, msg: string) => Log("frontend", "debug", pkg, msg),
  info:  (pkg: FrontendPackage | SharedPackage, msg: string) => Log("frontend", "info",  pkg, msg),
  warn:  (pkg: FrontendPackage | SharedPackage, msg: string) => Log("frontend", "warn",  pkg, msg),
  error: (pkg: FrontendPackage | SharedPackage, msg: string) => Log("frontend", "error", pkg, msg),
  fatal: (pkg: FrontendPackage | SharedPackage, msg: string) => Log("frontend", "fatal", pkg, msg),
};
