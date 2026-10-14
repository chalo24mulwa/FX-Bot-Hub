import Link from "next/link";
import { ArrowRight, Clock, ListOrdered } from "lucide-react";
import type { Difficulty, Tutorial } from "@/content/tutorials/types";
import { difficultyName, getTutorialCategory } from "@/content/tutorials";
import { cn } from "@/lib/utils";

const DIFFICULTY_STYLES: Record<Difficulty, string> = {
  beginner: "border-emerald-200 bg-emerald-50 text-emerald-800",
  intermediate: "border-amber-200 bg-amber-50 text-amber-800",
  advanced: "border-rose-200 bg-rose-50 text-rose-800",
};

export function DifficultyBadge({ difficulty, className }: { difficulty: Difficulty; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", DIFFICULTY_STYLES[difficulty], className)}>
      {difficultyName(difficulty)}
    </span>
  );
}

/** "About 15 min" — always worded as an estimate, never a promise. */
export function EstimatedTime({ minutes, className }: { minutes: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)} title="Estimated time — it varies with your computer and connection">
      <Clock className="h-4 w-4" aria-hidden="true" /> About {minutes} min
      <span className="sr-only">(estimate)</span>
    </span>
  );
}

export function TutorialCard({ tutorial }: { tutorial: Tutorial }) {
  return (
    <article className="group relative flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-violet-700">{getTutorialCategory(tutorial.category).name}</span>
        <DifficultyBadge difficulty={tutorial.difficulty} />
      </div>
      <h3 className="mt-2 text-lg font-semibold leading-snug text-slate-900">
        {/* Stretched link: the whole card is clickable, with one real anchor. */}
        <Link
          href={`/tutorials/${tutorial.slug}`}
          className="after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-violet-500"
        >
          {tutorial.title}
        </Link>
      </h3>
      <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{tutorial.description}</p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-500">
          <EstimatedTime minutes={tutorial.estimatedMinutes} />
          <span className="inline-flex items-center gap-1.5">
            <ListOrdered className="h-4 w-4" aria-hidden="true" /> {tutorial.steps.length} steps
          </span>
        </span>
        <span className="inline-flex items-center gap-1 font-medium text-violet-700" aria-hidden="true">
          Start <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </span>
      </div>
    </article>
  );
}
