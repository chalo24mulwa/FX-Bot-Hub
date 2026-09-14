"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

const TYPE_OPTIONS = [
  { value: "", label: "All types" },
  { value: "EA", label: "Expert Advisor" },
  { value: "INDICATOR", label: "Indicator" },
  { value: "SIGNAL", label: "Signal" },
  { value: "TOOL", label: "Tool" },
  { value: "OTHER", label: "Other" },
];

const PLATFORM_OPTIONS = [
  { value: "", label: "All platforms" },
  { value: "MT4", label: "MT4" },
  { value: "MT5", label: "MT5" },
  { value: "MULTI_PLATFORM", label: "Multi-platform" },
];

const PRICING_OPTIONS = [
  { value: "", label: "Free & paid" },
  { value: "FREE", label: "Free" },
  { value: "ONE_TIME", label: "One-time purchase" },
  { value: "SUBSCRIPTION", label: "Subscription" },
];

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "updated", label: "Recently updated" },
  { value: "rating", label: "Top rated" },
  { value: "popular", label: "Best sellers" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
];

function Select({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (name: string, value: string) => void;
}) {
  return (
    <select
      name={name}
      value={value}
      onChange={(e) => onChange(name, e.target.value)}
      className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

// Reusable filter toolbar — every marketplace-list surface (public
// marketplace, favorites, a future "browse by category" page) can reuse
// this since it only ever writes to URL search params, which the server
// page already parses through listProductsQuerySchema.
export function MarketplaceFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(name: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(name, value);
    else params.delete(name);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select name="type" value={searchParams.get("type") ?? ""} options={TYPE_OPTIONS} onChange={setParam} />
      <Select
        name="platform"
        value={searchParams.get("platform") ?? ""}
        options={PLATFORM_OPTIONS}
        onChange={setParam}
      />
      <Select
        name="pricingType"
        value={searchParams.get("pricingType") ?? ""}
        options={PRICING_OPTIONS}
        onChange={setParam}
      />
      <Select name="sort" value={searchParams.get("sort") ?? "newest"} options={SORT_OPTIONS} onChange={setParam} />
    </div>
  );
}
