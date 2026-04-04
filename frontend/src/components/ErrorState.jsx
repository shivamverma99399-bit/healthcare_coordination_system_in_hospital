export default function ErrorState({ title = "Something went wrong", description, action }) {
  return (
    <div className="glass-panel p-8 text-center">
      <p className="font-display text-3xl font-bold tracking-tight">{title}</p>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500">{description}</p>
      {action}
    </div>
  );
}
