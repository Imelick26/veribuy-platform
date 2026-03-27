/**
 * API Health Monitor
 *
 * Tracks API failures across all pricing and data sources.
 * Sends email alerts to admin when:
 *   - An API returns auth errors (401/403) — likely expired key or unpaid bill
 *   - An API has consecutive failures exceeding threshold
 *   - An API key is missing from environment
 *
 * Rate-limited: max 1 alert per API per hour to avoid spam.
 */

import { Resend } from "resend";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type APIServiceName =
  | "VehicleDatabases"
  | "VinAudit"
  | "VinAudit-History"
  | "MarketCheck"
  | "NADA"
  | "BlackBook"
  | "OpenAI"
  | "NHTSA";

export type AlertSeverity = "critical" | "warning" | "info";

interface FailureRecord {
  consecutiveFailures: number;
  lastFailureAt: number;
  lastAlertAt: number;
  lastError: string;
  lastStatusCode?: number;
}

/* ------------------------------------------------------------------ */
/*  State (in-memory — resets on deploy, which is fine)                */
/* ------------------------------------------------------------------ */

const failureRecords = new Map<APIServiceName, FailureRecord>();

/** Minimum time between alerts for the same API (1 hour) */
const ALERT_COOLDOWN_MS = 60 * 60 * 1000;

/** Number of consecutive failures before alerting */
const FAILURE_THRESHOLD = 3;

/** Admin email */
const ADMIN_EMAIL = process.env.ADMIN_ALERT_EMAIL || "isaac@notibuy.com";
const FROM_EMAIL = process.env.EMAIL_FROM || "VeriBuy <noreply@getveribuy.com>";

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Report a successful API call. Resets the failure counter.
 */
export function reportSuccess(service: APIServiceName): void {
  const record = failureRecords.get(service);
  if (record) {
    record.consecutiveFailures = 0;
  }
}

/**
 * Report a failed API call. Tracks failures and sends alerts when thresholds are hit.
 *
 * @param service    - Which API service failed
 * @param error      - Error message or Error object
 * @param statusCode - HTTP status code (401/403 trigger immediate alert)
 * @param context    - Additional context (VIN, endpoint, etc.)
 */
export async function reportFailure(
  service: APIServiceName,
  error: string | Error,
  statusCode?: number,
  context?: string,
): Promise<void> {
  const errorMsg = error instanceof Error ? error.message : error;
  const now = Date.now();

  let record = failureRecords.get(service);
  if (!record) {
    record = {
      consecutiveFailures: 0,
      lastFailureAt: 0,
      lastAlertAt: 0,
      lastError: "",
    };
    failureRecords.set(service, record);
  }

  record.consecutiveFailures++;
  record.lastFailureAt = now;
  record.lastError = errorMsg;
  record.lastStatusCode = statusCode;

  // Determine severity
  const isAuthError = statusCode === 401 || statusCode === 403;
  const isPaymentError = statusCode === 402 || statusCode === 429;
  const severity: AlertSeverity = isAuthError || isPaymentError ? "critical" : "warning";

  // Alert immediately for auth/payment errors, or after threshold for other failures
  const shouldAlert =
    (isAuthError || isPaymentError || record.consecutiveFailures >= FAILURE_THRESHOLD) &&
    (now - record.lastAlertAt > ALERT_COOLDOWN_MS);

  if (shouldAlert) {
    record.lastAlertAt = now;
    await sendAlert(service, severity, {
      error: errorMsg,
      statusCode,
      consecutiveFailures: record.consecutiveFailures,
      context,
    });
  }

  // Always log
  console.error(
    `[APIHealth] ${service} failure #${record.consecutiveFailures}: ${errorMsg}` +
    (statusCode ? ` (HTTP ${statusCode})` : "") +
    (context ? ` [${context}]` : ""),
  );
}

/**
 * Report a missing API key. Sends a one-time info alert.
 */
export async function reportMissingKey(
  service: APIServiceName,
  envVarName: string,
): Promise<void> {
  const now = Date.now();
  let record = failureRecords.get(service);
  if (!record) {
    record = {
      consecutiveFailures: 0,
      lastFailureAt: now,
      lastAlertAt: 0,
      lastError: `Missing env var: ${envVarName}`,
    };
    failureRecords.set(service, record);
  }

  // Only alert once per cooldown period for missing keys
  if (now - record.lastAlertAt > ALERT_COOLDOWN_MS) {
    record.lastAlertAt = now;
    await sendAlert(service, "info", {
      error: `API key not configured: ${envVarName}`,
      consecutiveFailures: 0,
      context: "This data source is skipped until the key is added.",
    });
  }
}

/**
 * Get current health status for all monitored APIs.
 * Useful for an admin dashboard endpoint.
 */
export function getHealthStatus(): Record<APIServiceName, {
  status: "healthy" | "degraded" | "down" | "unconfigured";
  consecutiveFailures: number;
  lastError?: string;
  lastFailureAt?: string;
}> {
  const services: APIServiceName[] = [
    "VehicleDatabases", "VinAudit", "VinAudit-History",
    "MarketCheck", "NADA", "BlackBook", "OpenAI", "NHTSA",
  ];

  const result = {} as ReturnType<typeof getHealthStatus>;

  for (const service of services) {
    const record = failureRecords.get(service);
    if (!record || record.consecutiveFailures === 0) {
      result[service] = { status: "healthy", consecutiveFailures: 0 };
    } else if (record.lastStatusCode === 401 || record.lastStatusCode === 403) {
      result[service] = {
        status: "down",
        consecutiveFailures: record.consecutiveFailures,
        lastError: record.lastError,
        lastFailureAt: new Date(record.lastFailureAt).toISOString(),
      };
    } else if (record.consecutiveFailures >= FAILURE_THRESHOLD) {
      result[service] = {
        status: "degraded",
        consecutiveFailures: record.consecutiveFailures,
        lastError: record.lastError,
        lastFailureAt: new Date(record.lastFailureAt).toISOString(),
      };
    } else {
      result[service] = {
        status: "healthy",
        consecutiveFailures: record.consecutiveFailures,
      };
    }
  }

  return result;
}

/* ------------------------------------------------------------------ */
/*  Alert Sender                                                       */
/* ------------------------------------------------------------------ */

async function sendAlert(
  service: APIServiceName,
  severity: AlertSeverity,
  details: {
    error: string;
    statusCode?: number;
    consecutiveFailures: number;
    context?: string;
  },
): Promise<void> {
  const severityEmoji = severity === "critical" ? "\u{1F6A8}" : severity === "warning" ? "\u{26A0}\u{FE0F}" : "\u{2139}\u{FE0F}";
  const severityLabel = severity.toUpperCase();

  const subject = `[VeriBuy ${severityLabel}] ${service} API Issue`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 0;">
      <h2 style="margin: 0 0 8px; color: ${severity === "critical" ? "#dc2626" : severity === "warning" ? "#d97706" : "#2563eb"};">
        ${severityEmoji} ${service} API Alert
      </h2>
      <p style="color: #555; margin: 0 0 24px;">
        ${severity === "critical"
          ? "Immediate attention required — this API is likely down or has an authentication issue."
          : severity === "warning"
            ? "This API has failed multiple times consecutively."
            : "Informational notice about API configuration."}
      </p>

      <div style="background: #f5f5f5; border-radius: 8px; padding: 20px; margin-bottom: 24px; border-left: 4px solid ${severity === "critical" ? "#dc2626" : severity === "warning" ? "#d97706" : "#2563eb"};">
        <p style="margin: 0 0 4px; font-size: 13px; color: #777;">Service</p>
        <p style="margin: 0 0 16px; font-weight: 600;">${service}</p>

        <p style="margin: 0 0 4px; font-size: 13px; color: #777;">Error</p>
        <p style="margin: 0 0 16px; font-family: monospace; font-size: 13px; color: #333; word-break: break-all;">${details.error}</p>

        ${details.statusCode ? `
          <p style="margin: 0 0 4px; font-size: 13px; color: #777;">HTTP Status</p>
          <p style="margin: 0 0 16px; font-weight: 600; color: ${details.statusCode >= 400 ? "#dc2626" : "#333"};">${details.statusCode}${details.statusCode === 401 ? " (Unauthorized — check API key)" : details.statusCode === 403 ? " (Forbidden — check permissions/billing)" : details.statusCode === 402 ? " (Payment Required)" : details.statusCode === 429 ? " (Rate Limited — check plan limits)" : ""}</p>
        ` : ""}

        ${details.consecutiveFailures > 0 ? `
          <p style="margin: 0 0 4px; font-size: 13px; color: #777;">Consecutive Failures</p>
          <p style="margin: 0 0 16px; font-weight: 600;">${details.consecutiveFailures}</p>
        ` : ""}

        ${details.context ? `
          <p style="margin: 0 0 4px; font-size: 13px; color: #777;">Context</p>
          <p style="margin: 0; font-size: 13px; color: #555;">${details.context}</p>
        ` : ""}
      </div>

      <p style="color: #555; font-size: 13px; margin: 0 0 8px;">
        <strong>What to check:</strong>
      </p>
      <ul style="color: #555; font-size: 13px; margin: 0 0 16px; padding-left: 20px;">
        ${details.statusCode === 401 || details.statusCode === 403 ? `
          <li>Verify the API key is correct in Vercel environment variables</li>
          <li>Check if the API key has expired or been revoked</li>
          <li>Confirm your account is in good standing with the provider</li>
        ` : details.statusCode === 429 ? `
          <li>You may have exceeded the API rate limit or monthly quota</li>
          <li>Consider upgrading your plan with the provider</li>
        ` : `
          <li>Check if the API provider is experiencing an outage</li>
          <li>Verify the API key is set in Vercel environment variables</li>
          <li>Check server logs for more details</li>
        `}
      </ul>

      <p style="color: #999; font-size: 12px; margin: 24px 0 0;">
        This alert is rate-limited to once per hour per API.
        &mdash; VeriBuy API Health Monitor
      </p>
    </div>
  `;

  // Try to send via Resend
  try {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      console.warn(`[APIHealth] Cannot send alert — RESEND_API_KEY not set. Alert: ${subject}`);
      return;
    }

    const resend = new Resend(key);
    await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject,
      html,
    });

    console.log(`[APIHealth] Alert sent to ${ADMIN_EMAIL}: ${subject}`);
  } catch (err) {
    // Don't let alert failures crash the app
    console.error(`[APIHealth] Failed to send alert email: ${err instanceof Error ? err.message : err}`);
  }
}
