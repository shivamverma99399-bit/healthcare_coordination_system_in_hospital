import { motion } from "framer-motion";


export default function EmergencyButton({ onClick }) {
  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="relative inline-flex items-center justify-center overflow-hidden rounded-full bg-brand-red px-6 py-3 text-sm font-semibold text-white shadow-[0_16px_36px_rgba(239,68,68,0.35)]"
    >
      <span className="absolute inset-0 animate-pulse-slow rounded-full border border-white/40" />
      <span className="relative">SOS Emergency Routing</span>
    </motion.button>
  );
}
