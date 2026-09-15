import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isSeller, isStaff } from "@/lib/authorization/roles";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { becomeSellerAction } from "@/features/users/actions";

export const dynamic = "force-dynamic";

export default async function BecomeSellerPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/sign-in?callbackUrl=/dashboard/become-seller");
  if (isSeller(session.user.role) || isStaff(session.user.role)) redirect("/seller");

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Become a seller</h1>
      <p className="mt-1 max-w-md text-sm text-slate-500">
        List Expert Advisors, indicators, signals, or tools on FX BOT Hub. No approval
        needed to get started — your products still go through review before they go live.
      </p>
      <form action={becomeSellerAction} className="mt-6 flex max-w-sm flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Seller / business display name
          <Input name="displayName" placeholder="e.g. Apex Algo Systems" required minLength={2} />
        </label>
        <Button type="submit">Start selling</Button>
      </form>
    </div>
  );
}
