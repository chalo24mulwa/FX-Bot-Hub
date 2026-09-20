import { listDataSources } from "@/repositories/data-source-repository";
import { getCalendarProvider } from "@/services/calendar/providers";

// The visible credit a calendar provider's terms require next to its data
// (Finance Calendar: "a visible link to financecalendar.com"). Driven by the
// provider registry, not hard-coded: each provider declares its own
// `attribution`, and this renders one for every calendar DataSource that
// exists — including a *disabled* one, since its already-stored events stay
// on the calendar after an admin switches providers. So moving to Trading
// Economics later changes the credit with no edit here.
export async function CalendarAttribution({ className = "" }: { className?: string }) {
  let credits: { name: string; url: string }[] = [];
  try {
    const sources = await listDataSources("CALENDAR");
    const seen = new Set<string>();
    for (const source of sources) {
      const attribution = getCalendarProvider(source.providerKey)?.attribution;
      if (attribution && !seen.has(attribution.url)) {
        seen.add(attribution.url);
        credits.push(attribution);
      }
    }
  } catch {
    // Attribution is a footnote — never let a lookup failure break the page.
    credits = [];
  }
  if (credits.length === 0) return null;

  return (
    <p className={`text-xs text-slate-500 ${className}`}>
      Economic data provided by{" "}
      {credits.map((credit, i) => (
        <span key={credit.url}>
          {i > 0 && ", "}
          <a href={credit.url} target="_blank" rel="noopener" className="underline hover:text-slate-700">
            {credit.name}
          </a>
        </span>
      ))}
      .
    </p>
  );
}
