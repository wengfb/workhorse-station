import type { ReactNode } from "react";

export function Modal({ title, description, children, onClose }: { title: string; description?: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="app-panel app-border w-full max-w-2xl rounded-xl border p-5 shadow-2xl">
        <div className="app-border flex items-center justify-between border-b pb-3">
          <div>
            <div className="text-base font-semibold">{title}</div>
            {description ? <div className="app-text-muted mt-1 text-xs">{description}</div> : null}
          </div>
          <button type="button" onClick={onClose} className="app-button-secondary rounded-md border px-2 py-1 text-sm" aria-label="关闭">✕</button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
