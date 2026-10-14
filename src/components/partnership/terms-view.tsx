import { GuideText } from "@/components/guides/guide-content";
import { headingId } from "@/lib/guides/inline";
import { parseTerms } from "@/lib/partnership/terms";

/** Renders programme terms (admin-editable text) as React elements — never as HTML. */
export function TermsView({ text }: { text: string }) {
  return (
    <div className="space-y-4 text-[16px] leading-7 text-slate-700">
      {parseTerms(text).map((b, i) => {
        if (b.type === "h2")
          return (
            <h2 key={i} id={headingId(b.text)} className="scroll-mt-24 pt-4 text-xl font-semibold text-slate-900">
              <GuideText text={b.text} />
            </h2>
          );
        if (b.type === "ul")
          return (
            <ul key={i} className="list-disc space-y-1.5 pl-5 marker:text-violet-400">
              {b.items.map((item, j) => (
                <li key={j}>
                  <GuideText text={item} />
                </li>
              ))}
            </ul>
          );
        return (
          <p key={i}>
            <GuideText text={b.text} />
          </p>
        );
      })}
    </div>
  );
}
