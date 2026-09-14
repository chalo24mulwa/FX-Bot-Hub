import type { EmailProvider, SendEmailInput } from "./types";

// Default provider outside production: logs instead of sending, so local
// dev and CI never depend on a real email account or API key.
export class ConsoleEmailProvider implements EmailProvider {
  async send(input: SendEmailInput): Promise<void> {
    console.log(`[email:console] to=${input.to} subject="${input.subject}"`);
  }
}
