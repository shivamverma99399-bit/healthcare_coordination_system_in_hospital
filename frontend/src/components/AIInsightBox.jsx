export default function AIInsightBox({ hospital }) {
  return (
    <div className="glass-panel p-6">
      <div className="flex flex-wrap items-center gap-3">
        <p className="chip border-blue-200 bg-blue-50 text-blue-700">AI Insight</p>
        <p className="chip">Score {hospital.ai_score}</p>
        {hospital.care_pathway ? <p className="chip">{hospital.care_pathway}</p> : null}
      </div>
      <p className="mt-4 text-base leading-7 text-slate-600">{hospital.ai_reason}</p>
      {hospital.score_breakdown ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {Object.entries(hospital.score_breakdown).map(([key, value]) => (
            <div key={key} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                {key.replaceAll("_", " ")}
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-800">{value}</p>
            </div>
          ))}
        </div>
      ) : null}
      {hospital.next_steps?.length ? (
        <div className="mt-5 space-y-3">
          {hospital.next_steps.map((step) => (
            <div key={step} className="rounded-2xl border border-slate-200 bg-white/80 p-3 text-sm text-slate-600">
              {step}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
