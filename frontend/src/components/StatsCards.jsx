export default function StatsCards({ stats }) {
  const items = [
    { label: "Connected hospitals", value: stats.hospital_count ?? 18 },
    { label: "Live bookings", value: stats.active_bookings ?? 24 },
    { label: "Emergency-ready", value: stats.emergency_ready ?? 9 },
    { label: "Active SOS alerts", value: stats.active_sos_alerts ?? 2 },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="glass-panel p-5">
          <p className="text-sm text-slate-500">{item.label}</p>
          <p className="mt-3 font-display text-4xl font-bold tracking-tight">{item.value}</p>
        </div>
      ))}
    </div>
  );
}
