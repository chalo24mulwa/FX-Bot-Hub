import { db } from "@/lib/db";
import { dispatchSignalPublished, dispatchSignalClosed } from "@/features/alerts/dispatch-service";
import type { SignalDirection, SignalTimeframe } from "@prisma/client";

export class SignalError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export interface CreateSignalInput {
  providerId: string;
  instrument: string;
  direction: SignalDirection;
  timeframe: SignalTimeframe;
  entryZoneLow?: number;
  entryZoneHigh?: number;
  stopLoss?: number;
  takeProfit?: number[];
  reasonMarkdown?: string;
}

export async function createSignal(input: CreateSignalInput) {
  const provider = await db.signalProviderProfile.findUnique({ where: { id: input.providerId } });
  if (!provider) throw new SignalError("Provider profile not found.", 404);

  const signal = await db.signal.create({ data: input });
  void dispatchSignalPublished(signal, provider);
  return signal;
}

export async function closeSignal(providerId: string, signalId: string, resultPips: number) {
  const signal = await db.signal.findUnique({ where: { id: signalId } });
  if (!signal || signal.providerId !== providerId) throw new SignalError("Signal not found.", 404);
  if (signal.status !== "ACTIVE") throw new SignalError("Signal is not active.", 409);

  const updated = await db.signal.update({
    where: { id: signalId },
    data: { status: "CLOSED", resultPips, closedAt: new Date() },
  });

  const provider = await db.signalProviderProfile.findUniqueOrThrow({ where: { id: providerId } });
  void dispatchSignalClosed(updated, provider);
  return updated;
}

export async function cancelSignal(providerId: string, signalId: string) {
  const signal = await db.signal.findUnique({ where: { id: signalId } });
  if (!signal || signal.providerId !== providerId) throw new SignalError("Signal not found.", 404);
  return db.signal.update({ where: { id: signalId }, data: { status: "CANCELLED", closedAt: new Date() } });
}

export interface ListSignalsQuery {
  instrument?: string;
  direction?: SignalDirection;
  status?: "ACTIVE" | "CLOSED" | "CANCELLED";
  providerId?: string;
  page?: number;
  pageSize?: number;
}

export async function listSignals(query: ListSignalsQuery) {
  const page = query.page ?? 1;
  const pageSize = Math.min(query.pageSize ?? 20, 50);
  const where = {
    instrument: query.instrument,
    direction: query.direction,
    status: query.status,
    providerId: query.providerId,
  };

  const [items, total] = await Promise.all([
    db.signal.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { provider: { select: { displayName: true, slug: true, verified: true, pricingType: true } } },
    }),
    db.signal.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

export async function getSignal(id: string) {
  return db.signal.findUnique({
    where: { id },
    include: { provider: { select: { displayName: true, slug: true, verified: true, pricingType: true, userId: true } } },
  });
}

export async function listProviderSignals(providerId: string, page: number, pageSize: number) {
  return listSignals({ providerId, page, pageSize });
}
