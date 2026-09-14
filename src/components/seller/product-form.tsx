import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface ProductFormCategory {
  id: string;
  name: string;
}

export interface ProductFormDefaults {
  name?: string;
  type?: string;
  platform?: string;
  pricingType?: string;
  priceCents?: number;
  currency?: string;
  categoryId?: string | null;
  shortSummary?: string;
  description?: string;
  tags?: string[];
}

export function ProductForm({
  action,
  categories,
  defaults,
  submitLabel,
}: {
  action: (formData: FormData) => void;
  categories: ProductFormCategory[];
  defaults?: ProductFormDefaults;
  submitLabel: string;
}) {
  return (
    <form action={action} className="flex max-w-xl flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Name
        <Input name="name" defaultValue={defaults?.name} required minLength={3} maxLength={120} />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Type
          <select
            name="type"
            defaultValue={defaults?.type ?? "EA"}
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
          >
            <option value="EA">Expert Advisor</option>
            <option value="INDICATOR">Indicator</option>
            <option value="SIGNAL">Signal</option>
            <option value="TOOL">Tool</option>
            <option value="OTHER">Other</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Platform
          <select
            name="platform"
            defaultValue={defaults?.platform ?? "MT5"}
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
          >
            <option value="MT4">MT4</option>
            <option value="MT5">MT5</option>
            <option value="MULTI_PLATFORM">Multi-platform</option>
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Category
        <select
          name="categoryId"
          defaultValue={defaults?.categoryId ?? ""}
          className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="">Uncategorized</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-3 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Pricing
          <select
            name="pricingType"
            defaultValue={defaults?.pricingType ?? "ONE_TIME"}
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
          >
            <option value="FREE">Free</option>
            <option value="ONE_TIME">One-time</option>
            <option value="SUBSCRIPTION">Subscription</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Price (cents)
          <Input name="priceCents" type="number" min={0} defaultValue={defaults?.priceCents ?? 0} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Currency
          <Input name="currency" defaultValue={defaults?.currency ?? "USD"} maxLength={3} />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Short summary
        <Input name="shortSummary" defaultValue={defaults?.shortSummary} required minLength={10} maxLength={200} />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Description
        <textarea
          name="description"
          defaultValue={defaults?.description}
          required
          minLength={20}
          rows={6}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Tags (comma-separated)
        <Input name="tags" defaultValue={defaults?.tags?.join(", ")} placeholder="trend, ema, scalping" />
      </label>

      <Button type="submit">{submitLabel}</Button>
    </form>
  );
}
