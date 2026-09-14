import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateSellerProfileAction } from "@/features/seller/actions";

export const dynamic = "force-dynamic";

export default async function SellerProfilePage() {
  const session = await auth();
  const profile = await db.sellerProfile.findUnique({ where: { userId: session!.user.id } });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Seller profile</h1>
      <form action={updateSellerProfileAction} className="mt-6 flex max-w-md flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Display name
          <Input name="displayName" defaultValue={profile?.displayName} required />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Bio
          <textarea
            name="bio"
            defaultValue={profile?.bio ?? ""}
            rows={4}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Website
          <Input name="websiteUrl" defaultValue={profile?.websiteUrl ?? ""} placeholder="https://…" />
        </label>
        <Button type="submit" className="self-start">
          Save
        </Button>
      </form>
    </div>
  );
}
