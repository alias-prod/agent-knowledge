import { cn } from "@/lib/utils";

export function BrandLockup({
  compact = false,
  stacked = false,
  className,
}: {
  compact?: boolean;
  stacked?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex min-w-0",
        stacked ? "flex-col items-start gap-2" : "items-center gap-3",
        className,
      )}
    >
      <span className="font-display text-3xl leading-none tracking-[0.16em] text-foreground">
        ALIAS
      </span>
      <span
        className={cn(
          "min-w-0 text-sm leading-5 text-muted-foreground",
          !stacked && "border-l border-border pl-3",
          compact && "hidden sm:block",
        )}
      >
        <span className="block">Unified Context Engine</span>
        <span className="block">&amp; Ontology Explorer</span>
      </span>
    </span>
  );
}
