import { beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.fn();
const logError = vi.fn();

// The queue module opens a Redis connection on import; none of that is under test.
vi.mock("@/lib/queue/queues", () => ({ emailQueue: { add: vi.fn() } }));
vi.mock("@/lib/logger", () => ({ logger: { error: (...a: unknown[]) => logError(...a), info: vi.fn(), warn: vi.fn() } }));
vi.mock("@/lib/email", () => ({ emailProvider: { send: (...a: unknown[]) => send(...a) } }));

import { sendEmailNow } from "./send-email";

const template = { subject: "Reset your password", html: "<p>hi</p>", text: "hi" };

describe("sendEmailNow", () => {
  beforeEach(() => {
    send.mockReset();
    logError.mockReset();
  });

  it("hands the message to the configured provider and reports success", async () => {
    send.mockResolvedValue(undefined);
    await expect(sendEmailNow("user@example.com", template)).resolves.toBe(true);
    expect(send).toHaveBeenCalledWith({ to: "user@example.com", subject: "Reset your password", html: "<p>hi</p>", text: "hi" });
  });

  it("never throws when the provider fails — it logs and reports false", async () => {
    send.mockRejectedValue(new Error("Resend rejected the email: validation_error: The domain is not verified"));
    await expect(sendEmailNow("user@example.com", template)).resolves.toBe(false);
    expect(logError).toHaveBeenCalledTimes(1);
    const [message, context] = logError.mock.calls[0] as [string, Record<string, unknown>];
    expect(message).toBe("email.send_failed");
    expect(context.error).toMatch(/domain is not verified/);
  });

  it("does not put the recipient's full address in the log line", async () => {
    send.mockRejectedValue(new Error("boom"));
    await sendEmailNow("someone.private@example.com", template);
    expect(JSON.stringify(logError.mock.calls)).not.toContain("someone.private");
    expect(logError.mock.calls[0][1]).toMatchObject({ recipientDomain: "example.com" });
  });
});
