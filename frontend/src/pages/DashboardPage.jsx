import { useEffect, useState } from "react";

import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import {
  cancelPatientAppointment,
  createPatientSosAlert,
  deletePatientDocument,
  deletePatientSosAlert,
  deletePatientRecord,
  downloadDocument,
  getPatientDashboard,
  uploadPatientDocuments,
} from "../services/api";
import { getSavedHospitals } from "../utils/storage";


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
  const [dashboard, setDashboard] = useState({
    profile: {},
    stats: {},
    history: [],
    alerts: [],
    documents: [],
  });
  const [savedHospitals, setSavedHospitals] = useState([]);
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
  const [recordActionState, setRecordActionState] = useState({ loadingId: null, error: "" });

  async function loadDashboard() {
    setPageState({ loading: true, error: "" });

    try {
      const data = await getPatientDashboard();
      setDashboard(data);
      setPageState({ loading: false, error: "" });
    } catch (error) {
      setPageState({
        loading: false,
        error: error?.message || "Patient dashboard could not be loaded right now.",
      });
    }
  }

  useEffect(() => {
    loadDashboard();
    setSavedHospitals(getSavedHospitals());
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
        error: error?.message || "SOS escalation could not be submitted.",
      });
    }
  }

  async function handleDeleteSosUpdate(alertId) {
    try {
      await deletePatientSosAlert(alertId);
      await loadDashboard();
    } catch (error) {
      setSosState({
        loading: false,
        error: error?.message || "SOS update could not be deleted.",
      });
    }
  }

  function handleFileSelection(event) {
    setPendingFiles(Array.from(event.target.files || []).filter((file) => file.type === "application/pdf"));
    setUploadStatus("");
  }

  async function handleFileUpload() {
    if (!pendingFiles.length) {
      setUploadStatus("Choose at least one PDF file first.");
      return;
    }

    try {
      await uploadPatientDocuments(pendingFiles);
      setPendingFiles([]);
      setUploadStatus(`${pendingFiles.length} PDF file${pendingFiles.length > 1 ? "s" : ""} uploaded successfully.`);
      await loadDashboard();
    } catch (error) {
      setUploadStatus(error?.message || "PDF upload failed.");
    }
  }

  async function handleViewFile(file) {
    try {
      const blob = await downloadDocument(file.id);
      const blobUrl = URL.createObjectURL(blob);
      const openedWindow = window.open(blobUrl, "_blank");
      if (!openedWindow) {
        URL.revokeObjectURL(blobUrl);
        throw new Error("Browser blocked the PDF tab. Allow pop-ups for this site and try again.");
      }
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
      setUploadStatus("");
    } catch (error) {
      setUploadStatus(error?.message || "PDF could not be opened.");
    }
  }

  async function handleDeleteFile(uploadId) {
    try {
      await deletePatientDocument(uploadId);
      setUploadStatus("PDF removed successfully.");
      await loadDashboard();
    } catch (error) {
      setUploadStatus(error?.message || "PDF could not be removed.");
    }
  }

  async function handleCancelAppointment(bookingId) {
    setRecordActionState({ loadingId: bookingId, error: "" });
    try {
      await cancelPatientAppointment(bookingId);
      await loadDashboard();
      setRecordActionState({ loadingId: null, error: "" });
    } catch (error) {
      setRecordActionState({
        loadingId: null,
        error: error?.message || "Appointment could not be cancelled.",
      });
    }
  }

  async function handleDeleteRecord(bookingId) {
    setRecordActionState({ loadingId: bookingId, error: "" });
    try {
      await deletePatientRecord(bookingId);
      await loadDashboard();
      setRecordActionState({ loadingId: null, error: "" });
    } catch (error) {
      setRecordActionState({
        loadingId: null,
        error: error?.message || "Record could not be deleted.",
      });
    }
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
                Upload PDF reports, prescriptions, scans, and discharge documents to the backend.
              </p>
            </div>
            <button type="button" className="secondary-button" onClick={handleFileUpload}>
              Upload files
            </button>
          </div>
          <input className="field mt-5 py-3" type="file" accept="application/pdf" multiple onChange={handleFileSelection} />
          {uploadStatus ? <p className="mt-3 text-sm text-brand-blue">{uploadStatus}</p> : null}
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {dashboard.documents.length ? (
              dashboard.documents.map((file) => (
                <div key={file.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      className="text-left font-semibold text-brand-blue underline-offset-2 hover:underline"
                      onClick={() => handleViewFile(file)}
                    >
                      {file.name}
                    </button>
                    <div className="flex items-center gap-3">
                      <span className="chip">{formatFileSize(file.size)}</span>
                      {file.can_delete ? (
                        <button
                          type="button"
                          className="text-sm font-medium text-red-600 hover:text-red-700"
                          onClick={() => handleDeleteFile(file.id)}
                          aria-label={`Delete ${file.name}`}
                        >
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    Uploaded {new Date(file.uploaded_at).toLocaleString()}
                  </p>
                  {file.source === "admin" ? (
                    <p className="mt-1 text-sm text-brand-blue">
                      Shared by your hospital admin
                    </p>
                  ) : null}
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
            {recordActionState.error ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {recordActionState.error}
              </div>
            ) : null}
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
                    <div className="mt-4 flex flex-wrap gap-3">
                      {!["cancelled", "completed", "rejected", "transferred"].includes(item.status) ? (
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => handleCancelAppointment(item.id)}
                          disabled={recordActionState.loadingId === item.id}
                        >
                          {recordActionState.loadingId === item.id ? "Updating..." : "Cancel Appointment"}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => handleDeleteRecord(item.id)}
                        disabled={recordActionState.loadingId === item.id}
                      >
                        {recordActionState.loadingId === item.id ? "Updating..." : "Delete Record"}
                      </button>
                    </div>
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
                        <div className="flex items-center gap-3">
                          <span className="chip border-red-200 bg-red-50 text-red-700">{alert.status}</span>
                          <button
                            type="button"
                            className="text-sm font-medium text-red-600 hover:text-red-700"
                            onClick={() => handleDeleteSosUpdate(alert.id)}
                            aria-label={`Delete SOS update ${alert.id}`}
                          >
                            Delete
                          </button>
                        </div>
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
