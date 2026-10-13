import Link from "next/link";
import { AlertTriangle, ExternalLink, Info } from "lucide-react";
import type { GuideBlock } from "@/content/guides/types";
import { headingId, parseGuideInline } from "@/lib/guides/inline";
import { cn } from "@/lib/utils";

/** Renders guide inline markup as React elements (never HTML strings). */
export function GuideText({ text }: { text: string }) {
  return (
    <>
      {parseGuideInline(text).map((node, i) => {
        switch (node.type) {
          case "bold":
            return (
              <strong key={i} className="font-semibold text-slate-900">
                {node.value}
              </strong>
            );
          case "code":
            return (
              <code key={i} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.85em] text-violet-700">
                {node.value}
              </code>
            );
          case "link":
            return node.external ? (
              <a
                key={i}
                href={node.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-baseline gap-0.5 font-medium text-violet-700 underline decoration-violet-300 underline-offset-2 hover:decoration-violet-600"
              >
                {node.label}
                <ExternalLink className="h-3 w-3 self-center" aria-hidden="true" />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            ) : (
              <Link
                key={i}
                href={node.href}
                className="font-medium text-violet-700 underline decoration-violet-300 underline-offset-2 hover:decoration-violet-600"
              >
                {node.label}
              </Link>
            );
          default:
            return <span key={i}>{node.value}</span>;
        }
      })}
    </>
  );
}

export function GuideBody({ blocks }: { blocks: GuideBlock[] }) {
  return (
    <div className="space-y-5 text-[17px] leading-8 text-slate-700">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "h2":
            return (
              <h2 key={i} id={headingId(block.text)} className="scroll-mt-24 pt-6 text-2xl font-semibold tracking-tight text-slate-900">
                <GuideText text={block.text} />
              </h2>
            );
          case "h3":
            return (
              <h3 key={i} id={headingId(block.text)} className="scroll-mt-24 pt-2 text-lg font-semibold text-slate-900">
                <GuideText text={block.text} />
              </h3>
            );
          case "p":
            return (
              <p key={i}>
                <GuideText text={block.text} />
              </p>
            );
          case "ul":
          case "ol": {
            const List = block.type === "ul" ? "ul" : "ol";
            return (
              <List key={i} className={cn("space-y-2 pl-6", block.type === "ul" ? "list-disc marker:text-violet-400" : "list-decimal marker:font-semibold marker:text-violet-600")}>
                {block.items.map((item, j) => (
                  <li key={j} className="pl-1">
                    <GuideText text={item} />
                  </li>
                ))}
              </List>
            );
          }
          case "steps":
            return (
              <ol key={i} className="space-y-4">
                {block.items.map((step, j) => (
                  <li key={j} className="flex gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-600 text-sm font-semibold text-white">
                      {j + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">
                        <GuideText text={step.title} />
                      </p>
                      <p className="mt-1 text-[16px] leading-7">
                        <GuideText text={step.text} />
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            );
          case "callout": {
            const warning = block.tone === "warning";
            const Icon = warning ? AlertTriangle : Info;
            return (
              <aside
                key={i}
                className={cn(
                  "flex gap-3 rounded-xl border p-4 text-[16px] leading-7",
                  warning ? "border-amber-300 bg-amber-50 text-amber-950" : "border-violet-200 bg-violet-50 text-slate-800",
                )}
              >
                <Icon className={cn("mt-1 h-5 w-5 shrink-0", warning ? "text-amber-600" : "text-violet-600")} aria-hidden="true" />
                <div className="min-w-0">
                  {block.title && <p className="font-semibold">{block.title}</p>}
                  <p>
                    <GuideText text={block.text} />
                  </p>
                </div>
              </aside>
            );
          }
          case "table":
            return (
              <div key={i} className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-[15px] leading-6">
                  <caption className="sr-only">{block.caption}</caption>
                  <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      {block.headers.map((h) => (
                        <th key={h} scope="col" className="px-4 py-3 font-semibold">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {block.rows.map((row, r) => (
                      <tr key={r} className="align-top">
                        {row.map((cell, c) => (
                          <td key={c} className={cn("px-4 py-3", c === 0 && "font-medium text-slate-900")}>
                            <GuideText text={cell} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
        }
      })}
    </div>
  );
}
