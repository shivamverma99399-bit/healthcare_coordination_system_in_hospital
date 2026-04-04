export default function EmptyState({ title, description }) {
  return (
    <div className="glass-panel p-10 text-center">
      <p className="font-display text-3xl font-bold tracking-tight">{title}</p>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}
