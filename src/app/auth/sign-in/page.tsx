import { SignInForm } from "@/components/auth/sign-in-form";
import { isGoogleAuthConfigured } from "@/lib/auth-config";

// Read at request time: whether Google is configured is runtime env, and a page
// prerendered at build time would freeze whatever the build machine had.
export const dynamic = "force-dynamic";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <SignInForm googleEnabled={isGoogleAuthConfigured()} errorCode={error} />;
}
