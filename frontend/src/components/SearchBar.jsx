import { motion } from "framer-motion";


const urgencyOptions = [
  { value: "normal", label: "Normal" },
  { value: "urgent", label: "Urgent" },
  { value: "critical", label: "Critical" },
];


export default function SearchBar({
  values,
  onChange,
  onSubmit,
  submitLabel = "Find care",
  compact = false,
  chatbot = false,
}) {
  return (
    <motion.form
      onSubmit={onSubmit}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      className={[
        chatbot ? "w-full" : "glass-panel w-full p-4 sm:p-5",
        compact ? "max-w-5xl" : "max-w-6xl",
      ].join(" ")}
    >
      <div
        className={
          chatbot
            ? "grid gap-3"
            : "grid gap-3 lg:grid-cols-[1.8fr_1fr_0.8fr_auto]"
        }
      >
        <textarea
          className={[
            "field resize-none py-3",
            chatbot ? "h-28" : "h-28 lg:h-12 lg:py-3",
          ].join(" ")}
          placeholder="Describe symptoms, pain points, or warning signs"
          name="symptoms"
          value={values.symptoms}
          onChange={onChange}
          required
        />
        <div className={chatbot ? "grid gap-3 sm:grid-cols-2" : "contents"}>
          <input
            className="field"
            placeholder="Enter city or area"
            name="location"
            value={values.location}
            onChange={onChange}
            required
          />
          <select className="field" name="urgency" value={values.urgency} onChange={onChange}>
            {urgencyOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className={["primary-button h-12 whitespace-nowrap", chatbot ? "w-full" : ""].join(" ")}
        >
          {submitLabel}
        </button>
      </div>
    </motion.form>
  );
}
