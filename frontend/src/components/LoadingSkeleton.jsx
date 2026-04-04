export default function LoadingSkeleton({ cards = 3 }) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      {Array.from({ length: cards }).map((_, index) => (
        <div key={index} className="glass-panel p-5">
          <div className="skeleton h-6 w-40 animate-shimmer rounded-full" />
          <div className="skeleton mt-4 h-4 w-56 animate-shimmer rounded-full" />
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="skeleton h-20 animate-shimmer rounded-2xl" />
            <div className="skeleton h-20 animate-shimmer rounded-2xl" />
            <div className="skeleton h-20 animate-shimmer rounded-2xl" />
            <div className="skeleton h-20 animate-shimmer rounded-2xl" />
          </div>
        </div>
      ))}
    </div>
  );
}
