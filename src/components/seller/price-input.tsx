"use client";

import { useId, useState } from "react";
import { centsToDollarString, parseDollarsToCents } from "@/lib/pricing/price-input";

export interface PriceValue {
  /** Integer cents, or null when the field is empty or invalid. */
  cents: number | null;
  /** False only for text that isn't a dollar amount (an empty optional field is valid). */
  valid: boolean;
}

/**
 * A dollar amount field: shows "$" and two decimals ("0.00", "49.00") and reports integer cents. Used in the wizard
 * (controlled via `onValueChange`) and in the single-page product form (submitted as the field named `name`, which the
 * server parses with the same rules). `optional` fields may be left empty.
 */
export function PriceInput({
  name,
  label = "Price (USD)",
  hint,
  defaultCents = 0,
  optional = false,
  placeholder = "0.00",
  onValueChange,
  className = "",
}: {
  name?: string;
  label?: string;
  hint?: string;
  /** null = start empty (optional fields). */
  defaultCents?: number | null;
  optional?: boolean;
  placeholder?: string;
  onValueChange?: (value: PriceValue) => void;
  className?: string;
}) {
  const id = useId();
  const [text, setText] = useState(defaultCents === null ? "" : centsToDollarString(defaultCents));
  const empty = text.trim() === "";
  const cents = parseDollarsToCents(text);
  const valid = optional && empty ? true : cents !== null;

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
          required={!optional}
          pattern="\$?[0-9,]*\.?[0-9]{0,2}"
          title="Enter an amount in dollars, like 49.00"
          autoComplete="off"
          value={text}
          aria-invalid={!valid}
          aria-describedby={!valid ? `${id}-error` : hint ? `${id}-hint` : undefined}
          onChange={(e) => {
            const next = e.target.value;
            setText(next);
            const parsed = parseDollarsToCents(next);
            onValueChange?.({ cents: parsed, valid: optional && next.trim() === "" ? true : parsed !== null });
          }}
          onBlur={() => {
            if (cents !== null) setText(centsToDollarString(cents)); // "49" -> "49.00"
          }}
          className={`flex h-10 w-full rounded-md border bg-white py-2 pl-7 pr-3 text-sm tabular-nums placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
            valid ? "border-slate-300" : "border-red-400"
          }`}
          placeholder={placeholder}
        />
      </div>
      {!valid && (
        <p id={`${id}-error`} role="alert" className="text-xs text-red-600">
          Enter an amount in dollars, like 49.00.
        </p>
      )}
      {valid && hint && (
        <p id={`${id}-hint`} className="text-xs text-slate-500">
          {hint}
        </p>
      )}
    </div>
  );
}
