import { useEffect, useState } from "react";

import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import { createPatientSosAlert, getPatientDashboard } from "../services/api";
import { getPatientUploads, getSavedHospitals, persistPatientUploads } from "../utils/storage";


function StatTile({ label, value }) {
  return (
    <div className="glass-panel p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-3 font-display text-4xl font-bold tracking-tight">{value}</p>
    </div>
  );
}


function formatFileSize(size) {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (size >= 1024) {
    return `${Math.round(size / 1024)} KB`;
  }
  return `${size} B`;
}


export default function DashboardPage({ session }) {
  const [dashboard, setDashboard] = useState({ profile: {}, stats: {}, history: [], alerts: [] });
  const [savedHospitals, setSavedHospitals] = useState([]);
  const [patientUploads, setPatientUploads] = useState(() => getPatientUploads());
  const [pendingFiles, setPendingFiles] = useState([]);
  const [uploadStatus, setUploadStatus] = useState("");
  const [pageState, setPageState] = useState({ loading: true, error: "" });
  const [sosForm, setSosForm] = useState({
    message: "",
    contact_name: session?.profile?.full_name || "",
    location_context: session?.profile?.city || "",
    urgency: "critical",
  });
  const [sosState, setSosState] = useState({ loading: false, error: "" });

  async function loadDashboard() {
    setPageState({ loading: true, error: "" });

    try {
      const data = await getPatientDashboard();
      setDashboard(data);
      setPageState({ loading: false, error: "" });
    } catch (error) {
      setPageState({
        loading: false,
        error: error?.response?.data?.detail || "Patient dashboard could not be loaded right now.",
      });
    }
  }

  useEffect(() => {
    loadDashboard();
    setSavedHospitals(getSavedHospitals());
    setPatientUploads(getPatientUploads());
  }, []);

  function handleSosChange(event) {
    const { name, value } = event.target;
    setSosForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSosSubmit(event) {
    event.preventDefault();
    setSosState({ loading: true, error: "" });

    try {
      await createPatientSosAlert(sosForm);
      setSosForm((current) => ({ ...current, message: "" }));
      setSosState({ loading: false, error: "" });
      await loadDashboard();
    } catch (error) {
      setSosState({
        loading: false,
        error: error?.response?.data?.detail || "SOS escalation could not be submitted.",
      });
    }
  }

  function handleFileSelection(event) {
    setPendingFiles(Array.from(event.target.files || []));
    setUploadStatus("");
  }

  function handleFileUpload() {
    if (!pendingFiles.length) {
      setUploadStatus("Choose at least one file first.");
      return;
    }

    const nextUploads = persistPatientUploads(pendingFiles);
    setPatientUploads(nextUploads);
    setPendingFiles([]);
    setUploadStatus(`${pendingFiles.length} file${pendingFiles.length > 1 ? "s" : ""} uploaded successfully.`);
  }

  return (
    <div className="section-shell pb-16 pt-10">
      <div className="space-y-8">
        <div>
          <p className="chip">Patient dashboard</p>
          <h1 className="mt-4 font-display text-4xl font-bold tracking-tight">
            Appointments, SOS, and follow-up tracking
          </h1>
          <p className="mt-3 text-base leading-7 text-slate-600">
            Signed in as {dashboard.profile.full_name || session?.display_name}. Track your care
            journey, review hospitals you saved, and raise an SOS request when immediate help is needed.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Appointments" value={dashboard.stats.appointments ?? 0} />
          <StatTile label="Active alerts" value={dashboard.stats.active_alerts ?? 0} />
          <StatTile label="Network hospitals" value={dashboard.stats.network_hospitals ?? 0} />
          <StatTile label="Emergency-ready hospitals" value={dashboard.stats.emergency_ready ?? 0} />
        </div>

        {pageState.loading ? (
          <div className="glass-panel p-8 text-center text-slate-500">Loading patient dashboard...</div>
        ) : null}

        {!pageState.loading && pageState.error ? (
          <ErrorState
            title="Patient dashboard unavailable"
            description={pageState.error}
            action={
              <button type="button" className="primary-button mt-6" onClick={loadDashboard}>
                Retry
              </button>
            }
          />
        ) : null}

        {!pageState.loading && !pageState.error ? (
          <>
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <section className="glass-panel p-6">
            <h2 className="font-display text-2xl font-bold tracking-tight">Saved hospitals</h2>
            <div className="mt-5 space-y-4">
              {savedHospitals.length ? (
                savedHospitals.map((hospital) => (
                  <div key={hospital.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="font-semibold text-slate-800">{hospital.hospital_name}</p>
                    <p className="mt-1 text-sm text-slate-500">{hospital.ai_reason}</p>
                  </div>
                ))
              ) : (
                <EmptyState
                  title="Nothing saved yet"
                  description="Hospitals saved during AI comparison will appear here."
                />
              )}
            </div>
          </section>

          <section className="glass-panel p-6">
            <h2 className="font-display text-2xl font-bold tracking-tight">Raise SOS</h2>
            <form onSubmit={handleSosSubmit} className="mt-5 space-y-4">
              <input
                className="field"
                name="contact_name"
                value={sosForm.contact_name}
                onChange={handleSosChange}
                placeholder="Contact name"
              />
              <input
                className="field"
                name="location_context"
                value={sosForm.location_context}
                onChange={handleSosChange}
                placeholder="Current location"
              />
              <select className="field" name="urgency" value={sosForm.urgency} onChange={handleSosChange}>
                <option value="critical">Critical</option>
                <option value="urgent">Urgent</option>
                <option value="normal">Normal</option>
              </select>
              <textarea
                className="field h-28 resize-none py-3"
                name="message"
                value={sosForm.message}
                onChange={handleSosChange}
                placeholder="Describe the emergency or access issue"
                required
              />
              <button type="submit" className="primary-button w-full bg-brand-red hover:bg-red-600">
                {sosState.loading ? "Sending SOS..." : "Send SOS Alert"}
              </button>
            </form>
            {sosState.error ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {sosState.error}
              </div>
            ) : null}
          </section>
        </div>

        <section className="glass-panel p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight">Medical Files Upload</h2>
              <p className="mt-2 text-sm text-slate-500">
                Upload reports, prescriptions, scans, and discharge documents from your device.
              </p>
            </div>
            <button type="button" className="secondary-button" onClick={handleFileUpload}>
              Upload files
            </button>
          </div>
          <input className="field mt-5 py-3" type="file" multiple onChange={handleFileSelection} />
          {uploadStatus ? <p className="mt-3 text-sm text-brand-blue">{uploadStatus}</p> : null}
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {patientUploads.length ? (
              patientUploads.map((file) => (
                <div key={file.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-semibold text-slate-800">{file.name}</p>
                    <span className="chip">{formatFileSize(file.size)}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    {file.type} | uploaded {new Date(file.uploaded_at).toLocaleString()}
                  </p>
                </div>
              ))
            ) : (
              <EmptyState
                title="No files uploaded yet"
                description="Your uploaded medical documents will appear here."
              />
            )}
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="glass-panel p-6">
            <h2 className="font-display text-2xl font-bold tracking-tight">Appointment history</h2>
            <div className="mt-5 space-y-4">
              {dashboard.history.length ? (
                dashboard.history.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-semibold text-slate-800">{item.hospital_name}</p>
                      <span className="chip">{item.status}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-500">
                      {item.doctor_name || "Doctor assignment pending"} | urgency {item.urgency}
                    </p>
                    <p className="mt-3 text-sm text-slate-600">{item.ai_summary}</p>
                  </div>
                ))
              ) : (
                <EmptyState
                  title="No appointments yet"
                  description="Appointments confirmed after AI triage will show up here."
                />
              )}
            </div>
          </section>

          <section className="glass-panel p-6">
            <h2 className="font-display text-2xl font-bold tracking-tight">Recent SOS updates</h2>
            <div className="mt-5 space-y-4">
              {dashboard.alerts.length ? (
                dashboard.alerts.map((alert) => (
                  <div key={alert.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-semibold text-slate-800">{alert.hospital_name || "Unassigned"}</p>
                      <span className="chip border-red-200 bg-red-50 text-red-700">{alert.status}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-500">{alert.location_context}</p>
                    <p className="mt-3 text-sm text-slate-600">{alert.message}</p>
                  </div>
                ))
              ) : (
                <EmptyState
                  title="No SOS updates"
                  description="Your emergency escalation history will appear here."
                />
              )}
            </div>
          </section>
        </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
