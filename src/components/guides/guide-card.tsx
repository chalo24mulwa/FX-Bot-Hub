import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import type { Guide } from "@/content/guides/types";
import { getCategory } from "@/content/guides";
import { readingMinutes } from "@/lib/guides/search";

export function GuideCard({ guide }: { guide: Guide }) {
  return (
    <article className="group relative flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">{getCategory(guide.category).name}</p>
      <h3 className="mt-2 text-lg font-semibold leading-snug text-slate-900">
        {/* Stretched link: the whole card is clickable, with one real anchor. */}
        <Link href={`/guides/${guide.slug}`} className="after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-violet-500">
          {guide.title}
        </Link>
      </h3>
      <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{guide.description}</p>
      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="inline-flex items-center gap-1.5 text-slate-500">
          <Clock className="h-4 w-4" aria-hidden="true" /> {readingMinutes(guide)} min read
        </span>
        <span className="inline-flex items-center gap-1 font-medium text-violet-700" aria-hidden="true">
          Read <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </span>
      </div>
    </article>
  );
}
