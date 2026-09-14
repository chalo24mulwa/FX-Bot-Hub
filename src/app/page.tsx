import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function HomePage() {
  return (
    <main className="mx-auto flex max-w-5xl flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
        FX Bot Market
      </h1>
      <p className="max-w-2xl text-lg text-slate-600">
        A marketplace for Expert Advisors, indicators, and trading tools — with an
        integrated economic calendar to trade around.
      </p>
      <div className="flex gap-3">
        <Link href="/marketplace" className={cn(buttonVariants())}>
          Browse the marketplace
        </Link>
        <Link href="/calendar" className={cn(buttonVariants({ variant: "outline" }))}>
          Economic calendar
        </Link>
      </div>
    </main>
  );
}
