type Props = {
  lines?: number;
};

export function AiSkeleton({ lines = 3 }: Props) {
  return (
    <div className="space-y-2" aria-busy="true" aria-live="polite">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-3 animate-pulse rounded bg-slate-200/70"
          style={{ width: `${80 - i * 12}%` }}
        />
      ))}
    </div>
  );
}
