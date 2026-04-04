const specializationOptions = [
  { value: "", label: "All specializations" },
  { value: "general", label: "General physician" },
  { value: "cardio", label: "Cardiologist" },
  { value: "neuro", label: "Neurologist" },
  { value: "pulmo", label: "Pulmonologist" },
  { value: "ortho", label: "Orthopedic" },
  { value: "derma", label: "Dermatologist" },
];


export default function FilterSidebar({ filters, onChange, onReset }) {
  return (
    <aside className="glass-panel h-fit p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-800">Filters</p>
          <p className="mt-1 text-sm text-slate-500">Connected directly to backend query params.</p>
        </div>
        <button type="button" className="text-sm font-medium text-brand-blue" onClick={onReset}>
          Reset
        </button>
      </div>

      <div className="mt-6 space-y-5">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-600">Distance radius</span>
          <input
            type="range"
            min="2"
            max="25"
            step="1"
            name="distance"
            value={filters.distance}
            onChange={onChange}
            className="w-full accent-brand-blue"
          />
          <div className="mt-2 text-sm text-slate-500">Up to {filters.distance} km</div>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-600">Specialization</span>
          <select className="field" name="specialization" value={filters.specialization} onChange={onChange}>
            {specializationOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <span>Only hospitals with ICU</span>
          <input
            type="checkbox"
            name="icu"
            checked={filters.icu}
            onChange={onChange}
            className="h-4 w-4 accent-brand-blue"
          />
        </label>
      </div>
    </aside>
  );
}
