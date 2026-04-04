export default function DemoLoginSuggestion({
  title = "Demo access",
  description,
  email,
  password,
  actions = [],
}) {
  if (!email || !password) {
    return null;
  }

  return (
    <div className="rounded-[24px] border border-blue-200 bg-blue-50 p-4">
      <p className="text-sm font-semibold text-blue-700">{title}</p>
      {description ? <p className="mt-2 text-sm leading-6 text-blue-700">{description}</p> : null}
      <div className="mt-3 rounded-2xl border border-blue-100 bg-white/80 p-3 text-sm text-slate-700">
        <p>
          <span className="font-semibold">Email:</span> {email}
        </p>
        <p className="mt-1">
          <span className="font-semibold">Password:</span> {password}
        </p>
      </div>
      {actions.length ? (
        <div className="mt-4 flex flex-wrap gap-3">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              className={action.variant === "secondary" ? "secondary-button" : "primary-button"}
              onClick={action.onClick}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
