/**
 * Minimal structured logging — Phase 5 (docs/PHASE5_AUDIT.md): before this,
 * every worker/route logged via raw console.error with no consistent shape,
 * making it impossible to filter/aggregate in any log platform (Datadog,
 * CloudWatch, etc.) that ingests JSON lines. This does NOT integrate an
 * error-monitoring SERVICE (Sentry or similar) — that needs a real
 * account/DSN this environment doesn't have; see docs/OBSERVABILITY.md for
 * the integration point once one exists. What this gives you now: every
 * log line is one JSON object with a consistent shape, so piping stdout
 * into any log aggregator already works.
 */
export type LogContext = Record<string, unknown>;

function write(level: "info" | "warn" | "error", message: string, context?: LogContext) {
  const line = {
    level,
    message,
    time: new Date().toISOString(),
    ...context,
  };
  const out = JSON.stringify(line);
  if (level === "error") console.error(out);
  else if (level === "warn") console.warn(out);
  else console.log(out);
}

export const logger = {
  info: (message: string, context?: LogContext) => write("info", message, context),
  warn: (message: string, context?: LogContext) => write("warn", message, context),
  error: (message: string, context?: LogContext) => write("error", message, context),
};
