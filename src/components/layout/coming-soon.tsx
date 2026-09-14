export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <main className="mx-auto flex max-w-2xl flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
      <p className="mt-2 text-slate-600">{description}</p>
      <p className="mt-1 text-sm text-slate-400">Coming in a later phase.</p>
    </main>
  );
}
