import type { ReactNode } from "react";
import { X } from "lucide-react";
import { IconButton } from "../../components/shared/IconButton";

export function Modal({
  title,
  description,
  children,
  footer,
  onClose
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="app-panel app-border flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border shadow-2xl">
        <div className="app-border flex shrink-0 items-center justify-between gap-4 border-b px-5 py-4">
          <div>
            <div className="text-base font-semibold">{title}</div>
            {description ? <div className="app-text-muted mt-1 text-xs">{description}</div> : null}
          </div>
          <IconButton icon={X} label="关闭" onClick={onClose} size="md" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <div className="app-border shrink-0 border-t px-5 py-4">{footer}</div> : null}
      </div>
    </div>
  );
}
