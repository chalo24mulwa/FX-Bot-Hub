import { Resend } from "resend";
import { env } from "@/lib/env";
import type { EmailProvider, SendEmailInput } from "./types";

export class ResendEmailProvider implements EmailProvider {
  private client: Resend;

  constructor() {
    if (!env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is required when EMAIL_PROVIDER=resend");
    }
    this.client = new Resend(env.RESEND_API_KEY);
  }

  async send(input: SendEmailInput): Promise<void> {
    // The Resend SDK reports API failures (unverified sender domain, bad key,
    // rate limit…) in a returned `{ error }` instead of throwing — ignoring it
    // made every such failure look like a successful send.
    const { error } = await this.client.emails.send({
      from: env.EMAIL_FROM,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    if (error) throw new Error(`Resend rejected the email: ${error.name}: ${error.message}`);
  }
}
