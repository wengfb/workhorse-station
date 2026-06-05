import type { ReactNode } from "react";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="app-text-faint text-xs">{label}</span>
      {children}
    </label>
  );
}

export function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="app-text-faint shrink-0">{label}</span>
      <span className="app-text truncate text-right">{value}</span>
    </div>
  );
}

export function CompactMetaPill({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`app-input app-border flex min-w-0 items-center gap-2 rounded-md border px-2.5 py-1.5 ${wide ? "max-w-full basis-full sm:basis-auto sm:max-w-[24rem]" : ""}`}>
      <span className="app-text-faint shrink-0">{label}</span>
      <span className="app-text truncate">{value}</span>
    </div>
  );
}

export function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="app-input app-border rounded-lg border p-3">
      <div className="app-text-faint text-xs">{label}</div>
      <div className="app-text mt-2 truncate">{value}</div>
    </div>
  );
}
