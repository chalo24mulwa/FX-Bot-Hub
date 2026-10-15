import { SignUpForm } from "@/components/auth/sign-up-form";
import { isGoogleAuthConfigured } from "@/lib/auth-config";
import { safeCallbackPath } from "@/lib/partnership/cta";

// Read at request time: whether Google is configured is runtime env, and a page
// prerendered at build time would freeze whatever the build machine had.
export const dynamic = "force-dynamic";

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ error?: string; callbackUrl?: string }> }) {
  const { error, callbackUrl } = await searchParams;
  // Only a same-site path is honoured (no open redirect); otherwise the usual default applies.
  const next = callbackUrl ? safeCallbackPath(callbackUrl, "") || undefined : undefined;
  return <SignUpForm googleEnabled={isGoogleAuthConfigured()} errorCode={error} callbackUrl={next} />;
}
