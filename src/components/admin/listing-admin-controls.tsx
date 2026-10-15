"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  approveListingAction,
  rejectListingAction,
  suspendListingAction,
  unpublishListingAction,
  removeListingAction,
  restoreListingAction,
  deleteListingAction,
  editListingAction,
} from "@/features/admin/control-actions";
import { ReasonAction } from "./reason-action";

export function ListingControls({ productId, status, deleteBlocked }: { productId: string; status: string; deleteBlocked: string | null }) {
  const awaiting = status === "PENDING_REVIEW" || status === "UNDER_REVIEW";
  return (
    <div className="flex flex-wrap items-start gap-2">
      {awaiting && (
        <>
          <ReasonAction label="Approve & publish" tone="success" reasonRequired={false} description="Publishes the listing and notifies the seller." action={() => approveListingAction(productId)} />
          <ReasonAction label="Request changes / reject" tone="danger" description="The seller sees this reason and can edit and resubmit." action={(reason) => rejectListingAction(productId, reason)} />
        </>
      )}
      {status === "PUBLISHED" && (
        <>
          <ReasonAction label="Suspend" tone="warning" description="Hides the listing from the marketplace for a rule or safety reason. Existing buyers keep their downloads." action={(reason) => suspendListingAction(productId, reason)} />
          <ReasonAction label="Unpublish" description="Returns the listing to the seller as a draft to fix and resubmit." action={(reason) => unpublishListingAction(productId, reason)} />
        </>
      )}
      {(status === "SUSPENDED" || status === "ARCHIVED") && (
        <ReasonAction
          label="Restore"
          tone="success"
          reasonRequired={false}
          description="Brings the listing back — published again if it was live before, otherwise to the review queue."
          action={(reason) => restoreListingAction(productId, reason)}
        />
      )}
      {status !== "ARCHIVED" && (
        <ReasonAction label="Remove" tone="danger" description="Takes the listing off the marketplace. Orders, licences and downloads for existing buyers are kept." action={(reason) => removeListingAction(productId, reason)} />
      )}
      {deleteBlocked ? (
        <p className="max-w-sm text-xs text-slate-500">Delete is unavailable: {deleteBlocked}</p>
      ) : (
        <ReasonAction label="Delete permanently" tone="danger" confirmLabel="Delete permanently" description="Nobody has bought this listing, so it can be erased. This can't be undone." action={(reason) => deleteListingAction(productId, reason)} />
      )}
    </div>
  );
}

export function ListingEditForm({
  productId,
  initial,
  categories,
}: {
  productId: string;
  initial: { name: string; shortSummary: string; description: string; categoryId: string };
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const set = (key: keyof typeof initial) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setSaved(false);
    setValues((v) => ({ ...v, [key]: e.target.value }));
  };
  const field = "w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm";

  return (
    <form
      className="grid max-w-2xl gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await editListingAction(productId, { ...values, categoryId: values.categoryId || null }, reason);
          if (!result.ok) return setError(result.error);
          setSaved(true);
          setReason("");
          router.refresh();
        });
      }}
    >
      <label className="grid gap-1 text-xs font-medium text-slate-700">
        Name
        <input className={field} value={values.name} onChange={set("name")} required minLength={3} maxLength={120} />
      </label>
      <label className="grid gap-1 text-xs font-medium text-slate-700">
        Short summary
        <input className={field} value={values.shortSummary} onChange={set("shortSummary")} required minLength={10} maxLength={240} />
      </label>
      <label className="grid gap-1 text-xs font-medium text-slate-700">
        Category
        <select className={field} value={values.categoryId} onChange={set("categoryId")}>
          <option value="">— none —</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-xs font-medium text-slate-700">
        Description
        <textarea className={field} rows={8} value={values.description} onChange={set("description")} required minLength={20} maxLength={20000} />
      </label>
      <label className="grid gap-1 text-xs font-medium text-slate-700">
        Reason for the edit (the seller is told, and it is kept in the audit log)
        <input className={field} value={reason} onChange={(e) => setReason(e.target.value)} required minLength={5} maxLength={500} />
      </label>
      <p className="text-xs text-slate-500">Price, files, the listing URL and ownership can&apos;t be changed here.</p>
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="text-xs text-emerald-700">
          Listing updated.
        </p>
      )}
      <div>
        <button type="submit" disabled={pending || reason.trim().length < 5} className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">
          {pending ? "Saving…" : "Save listing"}
        </button>
      </div>
    </form>
  );
}
