import Link from "next/link";

/**
 * A link when there is somewhere to go, otherwise the same content without one
 * (e.g. a document row while document pages are hidden, src/lib/features.ts).
 */
export function MaybeLink({
  href,
  className,
  children,
}: {
  href: string | null;
  className?: string;
  children: React.ReactNode;
}) {
  if (href) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  // No hover look on something that can't be clicked
  const still = className?.split(/\s+/).filter((c) => !c.startsWith("hover:")).join(" ");
  return <div className={still}>{children}</div>;
}
