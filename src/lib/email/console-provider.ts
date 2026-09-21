import type { EmailProvider, SendEmailInput } from "./types";

// Default provider outside production: logs instead of sending, so local
// dev and CI never depend on a real email account or API key.
export class ConsoleEmailProvider implements EmailProvider {
  async send(input: SendEmailInput): Promise<void> {
    if (process.env.NODE_ENV === "production") {
      // Not a real send. Say so loudly — otherwise a production site running with
      // the default EMAIL_PROVIDER looks fine while no email (password resets
      // included) ever leaves the server.
      console.warn(
        `[email:console] NOT SENT to=${input.to} subject="${input.subject}" — set EMAIL_PROVIDER=resend and RESEND_API_KEY to deliver email`,
      );
      return;
    }
    console.log(`[email:console] to=${input.to} subject="${input.subject}"`);
  }
}
