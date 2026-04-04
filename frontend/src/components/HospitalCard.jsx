import { motion } from "framer-motion";

import StatusBadge from "./StatusBadge";
import { formatTag } from "../utils/hospital";


export default function HospitalCard({ hospital, isSaved, onSave, onViewDetails }) {
  return (
    <motion.article
      whileHover={{ y: -6 }}
      className="glass-panel flex h-full flex-col gap-5 p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-2xl font-bold tracking-tight">
              {hospital.hospital_name}
            </h3>
            {hospital.ai_score > 85 && (
              <span className="chip border-blue-200 bg-blue-50 text-blue-700">
                AI Recommended
              </span>
            )}
          </div>
          <p className="mt-2 text-sm text-slate-500">{hospital.location}</p>
        </div>
        <StatusBadge bedsAvailable={hospital.beds_available} />
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm text-slate-600">
        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="text-slate-400">Distance</p>
          <p className="mt-2 text-lg font-semibold text-slate-800">{hospital.distance} km</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="text-slate-400">AI score</p>
          <p className="mt-2 text-lg font-semibold text-slate-800">{hospital.ai_score}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="text-slate-400">Beds</p>
          <p className="mt-2 text-lg font-semibold text-slate-800">{hospital.beds_available}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="text-slate-400">ICU</p>
          <p className="mt-2 text-lg font-semibold text-slate-800">{hospital.icu_available}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">AI Insight</p>
        <p className="mt-2 text-sm leading-6 text-slate-600">{hospital.ai_reason}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {hospital.specialization.map((tag) => (
          <span key={tag} className="chip">
            {formatTag(tag)}
          </span>
        ))}
      </div>

      <div className="mt-auto flex gap-3">
        <button type="button" className="primary-button flex-1" onClick={onViewDetails}>
          View details
        </button>
        <button type="button" className="secondary-button" onClick={onSave}>
          {isSaved ? "Saved" : "Save"}
        </button>
      </div>
    </motion.article>
  );
}
