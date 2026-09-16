import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

// Server wrapper around the client form specifically so useSearchParams()
// (reading ?token=) doesn't force this whole route out of static
// generation without an explicit Suspense boundary — the Next.js-
// recommended pattern, not a workaround.
export default function ResetPasswordPage() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-1 flex-col justify-center px-6 py-16">
      <Suspense fallback={<div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10" />}>
        <ResetPasswordForm />
      </Suspense>
    </main>
  );
}
