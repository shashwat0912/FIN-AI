import React, { useRef } from "react";
import { Edit3, MoreHorizontal, Trash2 } from "lucide-react";

const toneClasses = {
  accent: "bg-accent",
  warning: "bg-warning",
  negative: "bg-negative",
  neutral: "bg-ink-muted",
} as const;

export function ProgressLine({
  value,
  tone = "accent",
  label,
}: {
  value: number;
  tone?: keyof typeof toneClasses;
  label: string;
}) {
  const width = Number.isFinite(value) ? Math.min(Math.max(value, 0), 100) : 0;

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(width)}
      className="h-1 w-full overflow-hidden rounded-status bg-ledger-border"
    >
      <div
        className={`h-full rounded-status ${toneClasses[tone]}`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

export function RowActionMenu({
  label,
  onEdit,
  onDelete,
}: {
  label: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const run = (action: () => void) => {
    detailsRef.current?.removeAttribute("open");
    action();
  };

  return (
    <details
      ref={detailsRef}
      className="relative justify-self-end transition-opacity duration-150 xl:opacity-0 xl:group-hover:opacity-100 xl:group-focus-within:opacity-100 motion-reduce:transition-none"
    >
      <summary
        className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-control text-ink-muted transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.97] hover:bg-accent-soft hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-focus [&::-webkit-details-marker]:hidden motion-reduce:transition-none"
        aria-label={label}
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
      </summary>
      <div className="absolute right-0 z-20 mt-1 w-36 rounded-popover border border-border-strong bg-surface-strong p-1">
        <button
          type="button"
          onClick={() => run(onEdit)}
          className="flex min-h-11 w-full items-center gap-2 rounded-control px-3 text-left text-sm font-medium text-ink transition-colors duration-150 hover:bg-ledger-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transition-none"
        >
          <Edit3 className="h-4 w-4" aria-hidden="true" />
          Edit
        </button>
        <button
          type="button"
          onClick={() => run(onDelete)}
          className="flex min-h-11 w-full items-center gap-2 rounded-control px-3 text-left text-sm font-medium text-negative transition-colors duration-150 hover:bg-ledger-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transition-none"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Delete
        </button>
      </div>
    </details>
  );
}
