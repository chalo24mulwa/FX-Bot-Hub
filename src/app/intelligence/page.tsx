import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { listUpcomingHighImpact } from "@/services/calendar/calendar-service";
import { listLatestNews } from "@/features/news/news-service";
import { listSignals } from "@/features/signals/signal-service";
import { listProviders } from "@/features/signals/provider-service";
import { listNewestProducts } from "@/server/services/product-service";
import { Badge } from "@/components/ui/badge";
import { ProductCard } from "@/components/marketplace/product-card";
import { SignalCard } from "@/components/signals/signal-card";

export const metadata: Metadata = { title: "Market Intelligence" };
export const dynamic = "force-dynamic";

export default async function IntelligenceDashboardPage() {
  const [events, news, { items: signals }, { items: providers }, newProducts, stats] = await Promise.all([
    listUpcomingHighImpact(6),
    listLatestNews(6),
    listSignals({ status: "ACTIVE", pageSize: 6 }),
    listProviders(1, 5),
    listNewestProducts(4),
    Promise.all([
      db.product.count({ where: { status: "PUBLISHED" } }),
      db.signalProviderProfile.count(),
      db.newsArticle.count({ where: { status: "PUBLISHED" } }),
      db.economicEvent.count({ where: { eventTime: { gte: new Date() } } }),
    ]),
  ]);

  const [productCount, providerCount, articleCount, upcomingEventCount] = stats;

  return (
    <main className="mx-auto max-w-6xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold text-slate-900">Market Intelligence</h1>
      <p className="mt-1 text-sm text-slate-500">A snapshot of the calendar, news, signals, and marketplace.</p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Published products" value={productCount} />
        <Stat label="Signal providers" value={providerCount} />
        <Stat label="News articles" value={articleCount} />
        <Stat label="Upcoming events" value={upcomingEventCount} />
      </div>

      <Widget title="Upcoming high-impact events" viewAllHref="/calendar">
        {events.length === 0 ? (
          <Empty />
        ) : (
          <ul className="divide-y divide-slate-100">
            {events.map((event) => (
              <li key={event.id} className="flex items-center justify-between gap-4 py-2">
                <Link href={`/calendar/event/${event.id}`} className="text-sm font-medium text-slate-900 hover:underline">
                  {event.title}
                </Link>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Badge>{event.currency}</Badge>
                  {event.eventTime.toISOString().slice(0, 16).replace("T", " ")} UTC
                </div>
              </li>
            ))}
          </ul>
        )}
      </Widget>

      <Widget title="Latest Forex news" viewAllHref="/news">
        {news.length === 0 ? (
          <Empty />
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {news.map((article) => (
              <li key={article.id}>
                <Link href={`/news/${article.slug}`} className="text-sm font-medium text-slate-900 hover:underline">
                  {article.title}
                </Link>
                <p className="text-xs text-slate-400">{article.sourceName}</p>
              </li>
            ))}
          </ul>
        )}
      </Widget>

      <Widget title="Active signals" viewAllHref="/signals">
        {signals.length === 0 ? (
          <Empty />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {signals.map((signal) => (
              <SignalCard key={signal.id} signal={signal} />
            ))}
          </div>
        )}
      </Widget>

      <Widget title="Top signal providers" viewAllHref="/signals">
        {providers.length === 0 ? (
          <Empty />
        ) : (
          <ul className="divide-y divide-slate-100">
            {providers.map((provider) => (
              <li key={provider.id} className="flex items-center justify-between gap-4 py-2">
                <Link href={`/signals/provider/${provider.slug}`} className="text-sm font-medium text-slate-900 hover:underline">
                  {provider.displayName}
                  {provider.verified && <span className="ml-1 text-blue-600">✓</span>}
                </Link>
                <span className="text-xs text-slate-500">
                  {provider._count.signals} signals · {provider._count.subscriptions} subscribers
                </span>
              </li>
            ))}
          </ul>
        )}
      </Widget>

      <Widget title="New marketplace products" viewAllHref="/marketplace?sort=newest">
        {newProducts.length === 0 ? (
          <Empty />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            {newProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </Widget>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-slate-200 p-3 text-center">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function Widget({ title, viewAllHref, children }: { title: string; viewAllHref: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <Link href={viewAllHref} className="text-sm text-blue-600 hover:underline">
          View all
        </Link>
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Empty() {
  return <p className="text-sm text-slate-500">Nothing here yet.</p>;
}
