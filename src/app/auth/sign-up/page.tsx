import { SignUpForm } from "@/components/auth/sign-up-form";
import { isGoogleAuthConfigured } from "@/lib/auth-config";

// Read at request time: whether Google is configured is runtime env, and a page
// prerendered at build time would freeze whatever the build machine had.
export const dynamic = "force-dynamic";

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <SignUpForm googleEnabled={isGoogleAuthConfigured()} errorCode={error} />;
}
