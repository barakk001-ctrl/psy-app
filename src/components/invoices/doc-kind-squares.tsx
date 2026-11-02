import Link from "next/link";
import { docKindSquares, type DocKind } from "@/lib/billing-docs";
import { cn } from "@/lib/utils";

const squareClass = (selected: boolean) =>
  cn(
    "rounded-xl border px-3 py-2.5 text-start transition-colors",
    selected
      ? "border-sage-500 bg-sage-50 ring-2 ring-sage-500/20"
      : "border-cream-300 bg-white/60 hover:bg-white",
  );

/**
 * The document-type squares, the one place they are drawn. With `onPick` they
 * are a choice ("מסמך חדש"); without it, links that open "מסמך חדש" on that
 * type (top of /invoices). Four sit 2×2 on a phone; an exempt business has
 * just the receipt.
 */
export function DocKindSquares({
  vatLiable,
  selected,
  onPick,
}: {
  vatLiable: boolean;
  selected?: DocKind;
  onPick?: (kind: DocKind) => void;
}) {
  const squares = docKindSquares(vatLiable);
  const gridClass =
    squares.length > 1 ? "grid grid-cols-2 sm:grid-cols-4 gap-2" : "grid sm:grid-cols-3 gap-2";

  const items = squares.map((k) => {
    const text = (
      <>
        <div className="font-medium text-ink text-sm">{k.label}</div>
        <div className="text-xs text-ink-muted mt-0.5 leading-snug">{k.hint}</div>
      </>
    );
    return onPick ? (
      <button
        key={k.kind}
        type="button"
        role="radio"
        aria-checked={selected === k.kind}
        onClick={() => onPick(k.kind)}
        className={squareClass(selected === k.kind)}
      >
        {text}
      </button>
    ) : (
      <Link key={k.kind} href={`/invoices/new?kind=${k.kind}`} className={squareClass(false)}>
        {text}
      </Link>
    );
  });

  return onPick ? (
    <div role="radiogroup" aria-label="סוג המסמך" className={gridClass}>
      {items}
    </div>
  ) : (
    <div className={gridClass}>{items}</div>
  );
}
