export default function AvailabilityPanel({
  doctor,
  bookingForm,
  onChange,
  onSubmit,
  bookingState,
}) {
  if (!doctor) {
    return (
      <div className="glass-panel p-6">
        <p className="text-sm text-slate-500">Choose a doctor to view appointment slots.</p>
      </div>
    );
  }

  return (
    <div className="glass-panel p-6">
      <h3 className="font-display text-2xl font-bold tracking-tight">Availability Panel</h3>
      <p className="mt-2 text-sm text-slate-500">
        Select a time and confirm the appointment in one step.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-600">Time slot</label>
          <select
            className="field"
            name="time"
            value={bookingForm.time}
            onChange={onChange}
            required
          >
            <option value="">Select a slot</option>
            {doctor.time_slots.map((slot) => (
              <option key={slot} value={slot}>
                {slot}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-600">Patient name</label>
          <input
            className="field"
            name="patient_name"
            value={bookingForm.patient_name}
            onChange={onChange}
            placeholder="Enter patient name"
            required
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-600">Phone</label>
          <input
            className="field"
            name="phone"
            value={bookingForm.phone}
            onChange={onChange}
            placeholder="Enter contact number"
          />
        </div>

        <button type="submit" className="primary-button w-full">
          {bookingState.loading ? "Booking..." : "Book appointment"}
        </button>

        {bookingState.message ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            {bookingState.message}
          </div>
        ) : null}

        {bookingState.error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {bookingState.error}
          </div>
        ) : null}
      </form>
    </div>
  );
}
