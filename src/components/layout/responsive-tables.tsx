"use client";

import { useEffect } from "react";

// Data tables on a phone. A 6-8 column admin, seller or partnership table can't be read at 320-430px: the old answer was a
// sideways scroll that hid half the columns (and with them the point of the table). Instead, below 768px every data table is
// shown as a stack of labelled cards (CSS in globals.css, keyed off the attributes this adds), so every value is on screen
// with its column name beside it.
//
// This runs everywhere rather than per page so a new table gets the behaviour for free. It only adds attributes (`data-label`
// on cells, `data-stacked` on the table, explicit ARIA roles so the table semantics survive the CSS display change); tablets
// and desktops never see a visual difference. A MutationObserver re-labels rows that React adds later (filters, refreshes).
//
// Opt out with `data-stack-skip` on a table that is deliberately a side-by-side comparison (the broker and VPS tables) or
// that has its own phone layout (the calendar).

const SELECTOR = "table:not([data-stack-skip])";

function labelsFor(table: HTMLTableElement): string[] {
  const headRows = table.querySelectorAll<HTMLTableRowElement>(":scope > thead > tr");
  const row = headRows[headRows.length - 1];
  if (!row) return [];
  const labels: string[] = [];
  for (const cell of Array.from(row.children) as HTMLTableCellElement[]) {
    const text = (cell.textContent ?? "").replace(/\s+/g, " ").trim();
    for (let i = 0; i < Math.max(1, cell.colSpan || 1); i++) labels.push(text);
  }
  return labels;
}

function enhance(root: ParentNode) {
  for (const table of Array.from(root.querySelectorAll<HTMLTableElement>(SELECTOR))) {
    const labels = labelsFor(table);
    if (labels.length === 0) continue; // no header row: nothing to label with, leave it scrolling
    if (!table.hasAttribute("data-stacked")) {
      table.setAttribute("data-stacked", "");
      if (!table.hasAttribute("role")) table.setAttribute("role", "table");
      for (const group of Array.from(table.children)) {
        const tag = group.tagName;
        if ((tag === "THEAD" || tag === "TBODY" || tag === "TFOOT") && !group.hasAttribute("role")) group.setAttribute("role", "rowgroup");
      }
    }
    for (const row of Array.from(table.querySelectorAll<HTMLTableRowElement>(":scope > tbody > tr, :scope > tfoot > tr"))) {
      if (!row.hasAttribute("role")) row.setAttribute("role", "row");
      let column = 0;
      for (const cell of Array.from(row.children) as HTMLTableCellElement[]) {
        const span = Math.max(1, cell.colSpan || 1);
        if (!cell.hasAttribute("data-label")) {
          // A cell that spans columns (a "nothing here" message, a group heading) has no single column name.
          cell.setAttribute("data-label", span === 1 ? (labels[column] ?? "") : "");
          if (!cell.hasAttribute("role")) cell.setAttribute("role", cell.tagName === "TH" ? "rowheader" : "cell");
        }
        column += span;
      }
    }
  }
}

export function ResponsiveTables() {
  useEffect(() => {
    enhance(document);
    let frame = 0;
    const observer = new MutationObserver(() => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        enhance(document);
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}
