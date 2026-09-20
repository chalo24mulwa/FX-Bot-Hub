import Link from "next/link";
import { Fragment } from "react";
import { parseContent, type BlockNode, type InlineNode } from "@/lib/community/content";

// Renders member-written text. The content is parsed to an AST
// (src/lib/community/content.ts) and turned into React elements — never into
// an HTML string, never through dangerouslySetInnerHTML — so React escapes
// everything and a post can't inject markup or script. External links are
// only ever http(s) and carry rel="ugc nofollow noopener noreferrer".

function Inline({ nodes }: { nodes: InlineNode[] }) {
  return (
    <>
      {nodes.map((n, i) => {
        switch (n.type) {
          case "text":
            return (
              <Fragment key={i}>
                {n.value.split("\n").map((line, j, arr) => (
                  <Fragment key={j}>
                    {line}
                    {j < arr.length - 1 && <br />}
                  </Fragment>
                ))}
              </Fragment>
            );
          case "bold":
            return (
              <strong key={i} className="font-semibold">
                <Inline nodes={n.children} />
              </strong>
            );
          case "italic":
            return (
              <em key={i}>
                <Inline nodes={n.children} />
              </em>
            );
          case "code":
            return (
              <code key={i} className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.85em] text-slate-800">
                {n.value}
              </code>
            );
          case "link":
            return (
              <a
                key={i}
                href={n.href}
                target="_blank"
                rel="ugc nofollow noopener noreferrer"
                className="break-words text-violet-700 underline decoration-violet-300 underline-offset-2 hover:text-violet-900"
              >
                {n.label}
              </a>
            );
          case "mention":
            return (
              <Link key={i} href={`/community/u/${n.username}`} className="font-medium text-violet-700 hover:underline">
                @{n.username}
              </Link>
            );
          case "tag":
            return (
              <Link key={i} href={`/community?tag=${encodeURIComponent(n.tag)}`} className="text-sky-700 hover:underline">
                #{n.tag}
              </Link>
            );
        }
      })}
    </>
  );
}

function Block({ block }: { block: BlockNode }) {
  switch (block.type) {
    case "paragraph":
      return (
        <p className="break-words">
          <Inline nodes={block.children} />
        </p>
      );
    case "quote":
      return (
        <blockquote className="border-l-4 border-violet-300 bg-violet-50/60 px-3 py-1.5 text-slate-600">
          <Inline nodes={block.children} />
        </blockquote>
      );
    case "code":
      return (
        <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 font-mono text-xs leading-relaxed text-slate-100">
          <code>{block.value}</code>
        </pre>
      );
    case "list": {
      const items = block.items.map((item, i) => (
        <li key={i}>
          <Inline nodes={item} />
        </li>
      ));
      return block.ordered ? <ol className="list-decimal space-y-1 pl-5">{items}</ol> : <ul className="list-disc space-y-1 pl-5">{items}</ul>;
    }
  }
}

export function RichText({ text, className }: { text: string; className?: string }) {
  const blocks = parseContent(text);
  return (
    <div className={className ?? "space-y-3 text-[15px] leading-relaxed text-slate-800"}>
      {blocks.map((b, i) => (
        <Block key={i} block={b} />
      ))}
    </div>
  );
}
