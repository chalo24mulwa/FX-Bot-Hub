"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ContactSellerButton({ productId }: { productId: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function send() {
    setStatus("sending");
    const res = await fetch(`/api/products/${productId}/contact-seller`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    setStatus(res.ok ? "sent" : "error");
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        Contact seller
      </Button>
    );
  }

  if (status === "sent") {
    return <p className="text-sm text-emerald-600">Message sent.</p>;
  }

  return (
    <div className="flex max-w-sm flex-col gap-2">
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Ask the seller a question…"
        rows={3}
        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
      {status === "error" && <p className="text-xs text-red-600">Could not send your message.</p>}
      <div className="flex gap-2">
        <Button type="button" size="sm" disabled={status === "sending" || message.length < 5} onClick={send}>
          {status === "sending" ? "Sending…" : "Send"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
