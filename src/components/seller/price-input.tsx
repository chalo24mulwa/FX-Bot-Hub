"use client";

import { useId, useState } from "react";
import { centsToDollarString, parseDollarsToCents } from "@/lib/pricing/price-input";

/**
 * A dollar amount field: shows "$" and two decimals ("0.00", "49.00") and reports integer cents. Used in the wizard
 * (controlled via `onCentsChange`) and in the single-page product form (submitted as the field named `name`, which the
 * server parses with the same rules). Empty or invalid input is flagged and reported as null.
 */
export function PriceInput({
  name,
  label = "Price (USD)",
  defaultCents = 0,
  onCentsChange,
  className = "",
}: {
  name?: string;
  label?: string;
  defaultCents?: number;
  onCentsChange?: (cents: number | null) => void;
  className?: string;
}) {
  const id = useId();
  const [text, setText] = useState(centsToDollarString(defaultCents));
  const cents = parseDollarsToCents(text);
  const invalid = cents === null;

  return (
    <div className={`flex flex-col gap-1 text-sm ${className}`}>
      <label htmlFor={id}>{label}</label>
      <div className="relative w-full max-w-[12rem]">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-500" aria-hidden="true">
          $
        </span>
        <input
          id={id}
          name={name}
          type="text"
          inputMode="decimal"
          required
          pattern="\$?[0-9,]*\.?[0-9]{0,2}"
          title="Enter an amount in dollars, like 49.00"
          autoComplete="off"
          value={text}
          aria-invalid={invalid}
          aria-describedby={invalid ? `${id}-error` : undefined}
          onChange={(e) => {
            setText(e.target.value);
            onCentsChange?.(parseDollarsToCents(e.target.value));
          }}
          onBlur={() => {
            if (cents !== null) setText(centsToDollarString(cents)); // "49" -> "49.00"
          }}
          className={`flex h-10 w-full rounded-md border bg-white py-2 pl-7 pr-3 text-sm tabular-nums placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
            invalid ? "border-red-400" : "border-slate-300"
          }`}
          placeholder="0.00"
        />
      </div>
      {invalid && (
        <p id={`${id}-error`} role="alert" className="text-xs text-red-600">
          Enter an amount in dollars, like 49.00.
        </p>
      )}
    </div>
  );
}
