/**
 * Human wording for the `?error=` codes Auth.js appends when it sends a failed
 * OAuth attempt back to /auth/sign-in (see `pages.error` in src/lib/auth.ts).
 * Deliberately vague where precision would help an attacker: it never says
 * whether an email has an account, or why a sign-in was refused beyond the
 * generic reasons a person can act on.
 */
export function authErrorMessage(code: string | undefined): string | null {
  if (!code) return null;
  switch (code) {
    case "AccessDenied":
      return "Google sign-in was refused. Make sure your Google email is verified, or sign in with your email and password.";
    case "OAuthAccountNotLinked":
      return "This email is already registered with another sign-in method. Sign in with your password instead.";
    case "OAuthSignin":
    case "OAuthCallback":
    case "OAuthCreateAccount":
    case "Callback":
    case "Configuration":
      return "We couldn't complete Google sign-in. Please try again, or use your email and password.";
    default:
      return "Sign-in failed. Please try again.";
  }
}
