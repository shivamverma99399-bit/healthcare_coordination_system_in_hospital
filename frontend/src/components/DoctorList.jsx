import { motion } from "framer-motion";


export default function DoctorList({ doctors, selectedDoctorId, onSelectDoctor }) {
  return (
    <div className="grid gap-4">
      {doctors.map((doctor) => (
        <motion.button
          key={doctor.id}
          type="button"
          whileHover={{ y: -3 }}
          onClick={() => onSelectDoctor(doctor)}
          className={[
            "glass-panel p-5 text-left transition",
            selectedDoctorId === doctor.id ? "ring-2 ring-brand-blue" : "hover:border-blue-100",
          ].join(" ")}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="font-display text-2xl font-bold tracking-tight">{doctor.name}</h3>
              <p className="mt-2 text-sm text-slate-500">{doctor.specialization}</p>
              <p className="mt-3 text-sm text-slate-600">Timing: {doctor.timing}</p>
            </div>
            <span
              className={[
                "chip",
                doctor.available
                  ? "border-green-200 bg-green-50 text-green-700"
                  : "border-red-200 bg-red-50 text-red-700",
              ].join(" ")}
            >
              {doctor.available ? "Available" : "Unavailable"}
            </span>
          </div>
        </motion.button>
      ))}
    </div>
  );
}
