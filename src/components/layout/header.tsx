"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { PRIMARY_NAV, COMMUNITY_HREF } from "@/config/navigation";
import { isSeller, isStaff } from "@/lib/authorization/roles";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Header() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = new FormData(e.currentTarget).get("q");
    router.push(`/marketplace${q ? `?q=${encodeURIComponent(String(q))}` : ""}`);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="group shrink-0 inline-flex items-center gap-1.5 text-lg font-bold tracking-tight text-slate-900"
        >
          <span className="inline-flex items-center rounded-md bg-gradient-to-br from-blue-600 via-violet-500 to-emerald-500 px-1.5 py-0.5 text-xs font-black italic text-white shadow-sm transition-transform group-hover:scale-105 motion-reduce:transition-none">
            fx
          </span>
          <span className="bg-gradient-to-r from-indigo-600 via-violet-500 to-emerald-500 bg-clip-text italic text-transparent">
            Bot
          </span>
          <span className="text-amber-600">Hub</span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
          {PRIMARY_NAV.map((group) => (
            <div
              key={group.label}
              className="relative"
              onMouseEnter={() => setOpenGroup(group.label)}
              onMouseLeave={() => setOpenGroup(null)}
            >
              <button
                type="button"
                className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                aria-expanded={openGroup === group.label}
              >
                {group.label}
              </button>
              {openGroup === group.label && (
                <div className="absolute left-0 top-full w-56 rounded-md border border-slate-200 bg-white py-1 shadow-lg">
                  {group.links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
          <Link
            href={COMMUNITY_HREF}
            className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Community
          </Link>
        </nav>

        <form onSubmit={handleSearch} className="ml-auto hidden max-w-xs flex-1 sm:block">
          <Input name="q" type="search" placeholder="Search products…" aria-label="Search marketplace" />
        </form>

        <div className="hidden items-center gap-2 lg:flex">
          <Link href="/cart" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))} aria-label="Cart">
            Cart
          </Link>
          {status === "authenticated" && session.user ? (
            <>
              {isSeller(session.user.role) && (
                <Link href="/seller" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
                  Seller
                </Link>
              )}
              {isStaff(session.user.role) && (
                <Link href="/admin" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
                  Admin
                </Link>
              )}
              <Link href="/dashboard" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                Account
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/auth/sign-in" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
                Sign in
              </Link>
              <Link href="/auth/sign-up" className={cn(buttonVariants({ size: "sm" }))}>
                Sign up
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          className="ml-auto rounded-md border border-slate-200 px-3 py-1.5 text-sm lg:hidden"
          onClick={() => setMobileOpen((v) => !v)}
          aria-expanded={mobileOpen}
          aria-label="Toggle menu"
        >
          Menu
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-slate-200 px-4 py-3 lg:hidden">
          <form onSubmit={handleSearch} className="mb-3">
            <Input name="q" type="search" placeholder="Search products…" aria-label="Search marketplace" />
          </form>
          {PRIMARY_NAV.map((group) => (
            <div key={group.label} className="mb-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {group.label}
              </p>
              <div className="flex flex-col gap-1">
                {group.links.map((link) => (
                  <Link key={link.href} href={link.href} className="py-1 text-sm text-slate-700">
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
          <Link href={COMMUNITY_HREF} className="block py-1 text-sm text-slate-700">
            Community
          </Link>
          <Link href="/cart" className="block py-1 text-sm text-slate-700">
            Cart
          </Link>
          <div className="mt-3 flex gap-2 border-t border-slate-200 pt-3">
            {status === "authenticated" ? (
              <Link href="/dashboard" className={cn(buttonVariants({ size: "sm" }))}>
                Account
              </Link>
            ) : (
              <>
                <Link href="/auth/sign-in" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                  Sign in
                </Link>
                <Link href="/auth/sign-up" className={cn(buttonVariants({ size: "sm" }))}>
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
