import { beforeEach, describe, expect, it, vi } from "vitest";

const resendSend = vi.fn();

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: (...a: unknown[]) => resendSend(...a) };
  },
}));
vi.mock("@/lib/env", () => ({ env: { RESEND_API_KEY: "re_test", EMAIL_FROM: "fx Bot Hub <no-reply@fxbothub.com>" } }));

import { ResendEmailProvider } from "./resend-provider";

const input = { to: "user@example.com", subject: "Hello", html: "<p>hi</p>", text: "hi" };

describe("ResendEmailProvider", () => {
  beforeEach(() => resendSend.mockReset());

  it("sends from the configured sender", async () => {
    resendSend.mockResolvedValue({ data: { id: "email_1" }, error: null });
    await new ResendEmailProvider().send(input);
    expect(resendSend).toHaveBeenCalledWith(expect.objectContaining({ from: "fx Bot Hub <no-reply@fxbothub.com>", to: "user@example.com" }));
  });

  it("throws when Resend reports an API error instead of returning it silently", async () => {
    // The SDK resolves with { error } for things like an unverified sender domain —
    // treating that as success made a broken email setup look healthy.
    resendSend.mockResolvedValue({ data: null, error: { name: "validation_error", message: "The domain is not verified" } });
    await expect(new ResendEmailProvider().send(input)).rejects.toThrow(/domain is not verified/);
  });
});
