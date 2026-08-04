export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`bg-[var(--bg-soft)] relative overflow-hidden ${className}`}
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.2s_linear_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent" />
    </div>
  );
}
