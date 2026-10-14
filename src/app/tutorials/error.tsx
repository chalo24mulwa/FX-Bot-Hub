"use client"; // Error boundaries must be Client Components

import Link from "next/link";
import { useEffect } from "react";

export default function TutorialsError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-20 text-center sm:px-6">
      <h1 className="text-2xl font-semibold text-slate-900">This tutorial page couldn&apos;t load</h1>
      <p className="mt-3 text-slate-600">Something went wrong on our side. Try again, or go back to the list of tutorials.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={() => retry()} className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-500">
          Try again
        </button>
        <Link href="/tutorials" className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50">
          All tutorials
        </Link>
      </div>
    </main>
  );
}
