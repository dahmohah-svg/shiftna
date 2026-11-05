// Shown at once when a tab or link is tapped, while the next screen loads.
// It also lets Next.js prefetch these screens before the tap.
export default function Loading() {
  return (
    <div className="flex animate-pulse flex-col gap-4" aria-busy="true" aria-live="polite">
      <div className="h-8 w-2/5 rounded-lg bg-line/70" />
      <div className="h-14 rounded-2xl bg-line/50" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
          <div className="flex justify-between gap-3">
            <div className="h-5 w-1/2 rounded bg-line/70" />
            <div className="h-5 w-1/5 rounded bg-line/70" />
          </div>
          <div className="h-4 w-1/3 rounded bg-line/50" />
          <div className="h-3 rounded-full bg-line/50" />
          <div className="flex gap-2">
            <div className="h-6 w-16 rounded-full bg-line/50" />
            <div className="h-6 w-20 rounded-full bg-line/50" />
          </div>
        </div>
      ))}
    </div>
  );
}
