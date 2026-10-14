import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Referral / recruitment codes and the signed cookies that carry them.
 * Pure (the secret and clock are passed in) and unit-tested in
 * partnership.test.ts.
 */

// No 0/O/1/I/L — codes get read aloud and typed from screenshots.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 8;
const CODE_PATTERN = /^[A-Z0-9]{6,16}$/;

/** A random code. `random` is injectable for tests. */
export function generateCode(random: (size: number) => Uint8Array = (n) => randomBytes(n)): string {
  const bytes = random(CODE_LENGTH);
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

/** Trims and upper-cases user input; returns null for anything that can't be a code. */
export function normalizeCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toUpperCase();
  return CODE_PATTERN.test(code) ? code : null;
}

export const REFERRAL_COOKIE = "fxbh_ref";
export const RECRUIT_COOKIE = "fxbh_recruit";
export const VISITOR_COOKIE = "fxbh_vid";

export interface SignedCode {
  code: string;
  issuedAt: Date;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/** `CODE.issuedAtMs.signature` — the signature stops anyone extending the window or inventing a click time. */
export function signCodeCookie(code: string, issuedAt: Date, secret: string): string {
  const payload = `${code}.${issuedAt.getTime()}`;
  return `${payload}.${sign(payload, secret)}`;
}

/**
 * Verifies a cookie value. Returns null when it is malformed, tampered with,
 * issued in the future, or older than `maxAgeDays`.
 */
export function verifyCodeCookie(value: string | undefined | null, secret: string, now: Date, maxAgeDays: number): SignedCode | null {
  if (!value || !secret) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [rawCode, rawTs, signature] = parts;
  const code = normalizeCode(rawCode);
  const issuedMs = Number(rawTs);
  if (!code || code !== rawCode || !Number.isSafeInteger(issuedMs)) return null;

  const expected = Buffer.from(sign(`${rawCode}.${rawTs}`, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  const age = now.getTime() - issuedMs;
  if (age < -60_000 || age > maxAgeDays * 86_400_000) return null;
  return { code, issuedAt: new Date(issuedMs) };
}
