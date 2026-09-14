import { env } from "@/lib/env";
import type { EmailProvider } from "./types";
import { ConsoleEmailProvider } from "./console-provider";
import { ResendEmailProvider } from "./resend-provider";

export type { EmailProvider, SendEmailInput } from "./types";

function createEmailProvider(): EmailProvider {
  switch (env.EMAIL_PROVIDER) {
    case "resend":
      return new ResendEmailProvider();
    case "console":
    default:
      return new ConsoleEmailProvider();
  }
}

export const emailProvider: EmailProvider = createEmailProvider();
