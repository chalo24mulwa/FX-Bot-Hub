"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/authorization";
import * as providerService from "./provider-service";
import * as signalService from "./signal-service";
import * as subscriptionService from "./subscription-service";
import type { SignalDirection, SignalTimeframe } from "@prisma/client";

export async function becomeSignalProviderAction(formData: FormData) {
  const session = await requireSession();
  const displayName = String(formData.get("displayName") ?? "").trim();
  if (displayName.length < 2) throw new Error("Please enter a display name.");

  await providerService.becomeSignalProvider({
    userId: session.user.id,
    displayName,
    bio: String(formData.get("bio") ?? "") || undefined,
    tradingStyle: String(formData.get("tradingStyle") ?? "") || undefined,
    markets: String(formData.get("markets") ?? "")
      .split(",")
      .map((m) => m.trim().toUpperCase())
      .filter(Boolean),
  });

  revalidatePath("/signals");
  redirect("/signals/provider/me");
}

export async function createSignalAction(formData: FormData) {
  const session = await requireSession();
  const provider = await providerService.getProviderByUserId(session.user.id);
  if (!provider) throw new Error("You are not a signal provider yet.");

  const takeProfitRaw = String(formData.get("takeProfit") ?? "");
  const takeProfit = takeProfitRaw
    .split(",")
    .map((v) => Number(v.trim()))
    .filter((v) => !Number.isNaN(v));

  await signalService.createSignal({
    providerId: provider.id,
    instrument: String(formData.get("instrument") ?? "").toUpperCase(),
    direction: String(formData.get("direction") ?? "BUY") as SignalDirection,
    timeframe: String(formData.get("timeframe") ?? "H1") as SignalTimeframe,
    entryZoneLow: numberOrUndefined(formData.get("entryZoneLow")),
    entryZoneHigh: numberOrUndefined(formData.get("entryZoneHigh")),
    stopLoss: numberOrUndefined(formData.get("stopLoss")),
    takeProfit,
    reasonMarkdown: String(formData.get("reasonMarkdown") ?? "") || undefined,
  });

  revalidatePath("/signals");
  revalidatePath("/signals/provider/me");
}

function numberOrUndefined(value: FormDataEntryValue | null): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isNaN(n) ? undefined : n;
}

export async function closeSignalAction(signalId: string, resultPips: number) {
  const session = await requireSession();
  const provider = await providerService.getProviderByUserId(session.user.id);
  if (!provider) throw new Error("You are not a signal provider.");
  await signalService.closeSignal(provider.id, signalId, resultPips);
  revalidatePath("/signals");
  revalidatePath("/signals/provider/me");
}

export async function cancelSignalAction(signalId: string) {
  const session = await requireSession();
  const provider = await providerService.getProviderByUserId(session.user.id);
  if (!provider) throw new Error("You are not a signal provider.");
  await signalService.cancelSignal(provider.id, signalId);
  revalidatePath("/signals");
}

export async function subscribeToProviderAction(providerId: string) {
  const session = await requireSession();
  const result = await subscriptionService.subscribeToProvider(session.user.id, providerId, session.user.email!);
  revalidatePath("/signals");
  return result;
}

export async function cancelSubscriptionAction(providerId: string) {
  const session = await requireSession();
  await subscriptionService.cancelSubscription(session.user.id, providerId);
  revalidatePath("/dashboard/subscriptions");
}

export async function pauseSubscriptionAction(providerId: string) {
  const session = await requireSession();
  await subscriptionService.pauseSubscription(session.user.id, providerId);
  revalidatePath("/dashboard/subscriptions");
}

export async function resumeSubscriptionAction(providerId: string) {
  const session = await requireSession();
  await subscriptionService.resumeSubscription(session.user.id, providerId);
  revalidatePath("/dashboard/subscriptions");
}
