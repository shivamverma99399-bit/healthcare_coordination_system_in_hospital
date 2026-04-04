import { useEffect, useMemo, useState } from "react";

import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import {
  createPatientRecord,
  createTransfer,
  getAdminProfile,
  getAdminOverview,
  updateAdminProfile,
  updateAppointmentStatus,
  updateHospitalResources,
  updatePatientRecord,
} from "../services/api";
import { getAdminRecordUploads, persistAdminRecordUploads } from "../utils/storage";


function AnalyticsTile({ label, value }) {
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


export default function AdminPage({ session }) {
  const [overview, setOverview] = useState({
    profile: null,
    managed_hospital: null,
    network_hospitals: [],
    analytics: {},
    appointments: [],
    patient_records: [],
    patient_options: [],
    alerts: [],
    transfers: { outbound: [], inbound: [] },
  });
  const [resourceDraft, setResourceDraft] = useState(null);
  const [adminProfile, setAdminProfile] = useState(null);
  const [profileForm, setProfileForm] = useState({ name: "", admin_id: "", hospital: "" });
  const [recordDrafts, setRecordDrafts] = useState({});
  const [recordUploads, setRecordUploads] = useState(() => getAdminRecordUploads());
  const [pendingRecordFiles, setPendingRecordFiles] = useState({});
  const [recordUploadStatus, setRecordUploadStatus] = useState({});
  const [pageState, setPageState] = useState({ loading: true, error: "" });
  const [actionState, setActionState] = useState({ error: "", message: "" });
  const [appointmentActionId, setAppointmentActionId] = useState(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [newRecordForm, setNewRecordForm] = useState({
    patient_id: "",
    urgency: "normal",
    status: "under_review",
    symptoms: "",
    ai_summary: "",
    next_steps: "",
  });
  const [transferForm, setTransferForm] = useState({
    booking_id: "",
    target_hospital_id: "",
    share_mode: "api",
    receiving_team: "",
  });

  async function loadOverview() {
    setPageState((current) => ({ ...current, loading: true, error: "" }));

    try {
      const [data, profile] = await Promise.all([getAdminOverview(), getAdminProfile()]);
      setOverview(data);
      setAdminProfile(profile);
      setProfileForm({
        name: profile?.name || "",
        admin_id: profile?.admin_id || "",
        hospital: String(profile?.hospital_id || profile?.hospital?.id || data.managed_hospital?.id || ""),
      });
      setResourceDraft(data.managed_hospital);
      setRecordDrafts(
        Object.fromEntries(
          (data.patient_records || []).map((record) => [
            record.id,
            {
              status: record.status,
              ai_summary: record.ai_summary,
              next_steps: record.next_steps,
            },
          ]),
        ),
      );
      setPageState({ loading: false, error: "" });
    } catch (error) {
      setPageState({
        loading: false,
        error: error?.response?.data?.detail || "Admin dashboard could not be loaded right now.",
      });
    }
  }

  useEffect(() => {
    loadOverview();
  }, []);

  const recordOptions = useMemo(
    () => overview.patient_records || [],
    [overview.patient_records],
  );
  const hospitalOptions = useMemo(() => {
    const allHospitals = [overview.managed_hospital, ...(overview.network_hospitals || [])].filter(Boolean);
    return allHospitals.filter(
      (hospital, index, array) => array.findIndex((item) => item.id === hospital.id) === index,
    );
  }, [overview.managed_hospital, overview.network_hospitals]);
  const adminHospital = overview.profile?.hospital || session?.profile?.hospital || overview.managed_hospital;
  const profileIncomplete = !adminProfile?.name || !adminProfile?.admin_id || !adminProfile?.hospital_id;

  function handleResourceChange(event) {
    const { name, value, type, checked } = event.target;
    setResourceDraft((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : Number.isNaN(Number(value)) ? value : Number(value),
    }));
  }

  async function handleResourceSave() {
    setActionState({ error: "", message: "" });

    try {
      await updateHospitalResources(resourceDraft.id, {
        available_beds: Number(resourceDraft.available_beds),
        available_icu: Number(resourceDraft.available_icu),
        avg_wait_time: Number(resourceDraft.avg_wait_time),
        emergency_available: !!resourceDraft.emergency_available,
      });
      setActionState({ error: "", message: "Hospital resources updated." });
      await loadOverview();
    } catch (error) {
      setActionState({
        error: error?.response?.data?.detail || "Hospital resources could not be updated.",
        message: "",
      });
    }
  }

  function handleProfileChange(event) {
    const { name, value } = event.target;
    setProfileForm((current) => ({ ...current, [name]: value }));
  }

  async function handleProfileSave(event) {
    event.preventDefault();
    setProfileSaving(true);
    setActionState({ error: "", message: "" });

    try {
      const updated = await updateAdminProfile({
        name: profileForm.name,
        admin_id: profileForm.admin_id,
        hospital: Number(profileForm.hospital),
      });
      setAdminProfile(updated);
      setActionState({ error: "", message: "Admin profile saved." });
      await loadOverview();
    } catch (error) {
      setActionState({
        error: error?.response?.data?.detail || "Admin profile could not be updated.",
        message: "",
      });
    } finally {
      setProfileSaving(false);
    }
  }

  function updateRecordDraft(recordId, key, value) {
    setRecordDrafts((current) => ({
      ...current,
      [recordId]: {
        ...current[recordId],
        [key]: value,
      },
    }));
  }

  async function handleRecordSave(recordId) {
    setActionState({ error: "", message: "" });

    try {
      await updatePatientRecord(recordId, recordDrafts[recordId]);
      setActionState({ error: "", message: "Patient record updated." });
      await loadOverview();
    } catch (error) {
      setActionState({
        error: error?.response?.data?.detail || "Patient record could not be updated.",
        message: "",
      });
    }
  }

  function handleRecordFileSelection(recordId, event) {
    setPendingRecordFiles((current) => ({
      ...current,
      [recordId]: Array.from(event.target.files || []),
    }));
    setRecordUploadStatus((current) => ({
      ...current,
      [recordId]: "",
    }));
  }

  async function handleRecordUpload(recordId) {
    const files = pendingRecordFiles[recordId] || [];
    if (!files.length) {
      setRecordUploadStatus((current) => ({
        ...current,
        [recordId]: "Choose at least one file first.",
      }));
      return;
    }

    try {
      const nextUploads = await persistAdminRecordUploads(recordId, files);
      setRecordUploads(nextUploads);
      setPendingRecordFiles((current) => ({
        ...current,
        [recordId]: [],
      }));
      setRecordUploadStatus((current) => ({
        ...current,
        [recordId]: `${files.length} PDF file${files.length > 1 ? "s" : ""} uploaded and shared with the patient dashboard.`,
      }));
    } catch (error) {
      setRecordUploadStatus((current) => ({
        ...current,
        [recordId]: error?.message || "Files could not be uploaded right now.",
      }));
    }
  }

  function handleTransferChange(event) {
    const { name, value } = event.target;
    setTransferForm((current) => ({ ...current, [name]: value }));
  }

  function handleNewRecordChange(event) {
    const { name, value } = event.target;
    setNewRecordForm((current) => ({ ...current, [name]: value }));
  }

  async function handleNewRecordSubmit(event) {
    event.preventDefault();
    setActionState({ error: "", message: "" });

    try {
      await createPatientRecord({
        patient_id: Number(newRecordForm.patient_id),
        urgency: newRecordForm.urgency,
        status: newRecordForm.status,
        symptoms: newRecordForm.symptoms,
        ai_summary: newRecordForm.ai_summary,
        next_steps: newRecordForm.next_steps,
      });
      setNewRecordForm({
        patient_id: "",
        urgency: "normal",
        status: "under_review",
        symptoms: "",
        ai_summary: "",
        next_steps: "",
      });
      setActionState({ error: "", message: "Patient record created." });
      await loadOverview();
    } catch (error) {
      setActionState({
        error: error?.response?.data?.detail || "Patient record could not be created.",
        message: "",
      });
    }
  }

  async function handleTransferSubmit(event) {
    event.preventDefault();
    setActionState({ error: "", message: "" });

    try {
      await createTransfer({
        booking_id: Number(transferForm.booking_id),
        target_hospital_id: Number(transferForm.target_hospital_id),
        share_mode: transferForm.share_mode,
        receiving_team: transferForm.receiving_team,
      });
      setTransferForm({
        booking_id: "",
        target_hospital_id: "",
        share_mode: "api",
        receiving_team: "",
      });
      setActionState({ error: "", message: "Transfer report shared successfully." });
      await loadOverview();
    } catch (error) {
      setActionState({
        error: error?.response?.data?.detail || "Transfer report could not be shared.",
        message: "",
      });
    }
  }

  async function handleAppointmentStatus(appointmentId, statusValue) {
    setAppointmentActionId(appointmentId);
    setActionState({ error: "", message: "" });

    try {
      await updateAppointmentStatus(appointmentId, statusValue);
      setActionState({
        error: "",
        message: `Appointment ${statusValue}.`,
      });
      await loadOverview();
    } catch (error) {
      setActionState({
        error: error?.response?.data?.detail || "Appointment status could not be updated.",
        message: "",
      });
    } finally {
      setAppointmentActionId(null);
    }
  }

  return (
    <div className="section-shell pb-16 pt-10">
      <div className="space-y-8">
        <div>
          <p className="chip border-amber-200 bg-amber-50 text-amber-700">Hospital admin workflow</p>
          <h1 className="mt-4 font-display text-4xl font-bold tracking-tight">
            Hospital Admin Portal
          </h1>
          <p className="mt-3 text-base leading-7 text-slate-600">
            {adminHospital?.name} admin access for
            live capacity updates, SOS monitoring, patient-record management, analytics, and
            inter-hospital collaboration.
          </p>
          {adminHospital ? (
            <div className="mt-5 inline-flex flex-wrap items-center gap-3 rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <span className="font-semibold">Logged in as admin for:</span>
              <span>{adminHospital.name}</span>
              <span className="text-amber-600">|</span>
              <span>{adminHospital.location}</span>
            </div>
          ) : null}
        </div>

        <section className="glass-panel p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight">Admin Profile</h2>
              <p className="mt-2 text-sm text-slate-500">
                {profileIncomplete
                  ? "Complete your admin profile to keep hospital mapping accurate."
                  : "Profile details are stored in the backend and used for hospital-scoped access."}
              </p>
            </div>
            {adminProfile ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <p><span className="font-semibold text-slate-800">Name:</span> {adminProfile.name || "Not set"}</p>
                <p className="mt-1"><span className="font-semibold text-slate-800">Admin ID:</span> {adminProfile.admin_id || "Not set"}</p>
                <p className="mt-1"><span className="font-semibold text-slate-800">Hospital:</span> {adminProfile.hospital_name || adminProfile.hospital?.name || "Not set"}</p>
              </div>
            ) : null}
          </div>
          <form onSubmit={handleProfileSave} className="mt-5 grid gap-4 md:grid-cols-3">
            <input
              className="field"
              name="name"
              value={profileForm.name}
              onChange={handleProfileChange}
              placeholder="Admin name"
              required
            />
            <input
              className="field"
              name="admin_id"
              value={profileForm.admin_id}
              onChange={handleProfileChange}
              placeholder="Admin ID"
              required
            />
            <select
              className="field"
              name="hospital"
              value={profileForm.hospital}
              onChange={handleProfileChange}
              required
            >
              <option value="">Select hospital</option>
              {hospitalOptions.map((hospital) => (
                <option key={hospital.id} value={hospital.id}>
                  {hospital.name}
                </option>
              ))}
            </select>
            <div className="md:col-span-3">
              <button type="submit" className="primary-button" disabled={profileSaving}>
                {profileSaving ? "Saving profile..." : profileIncomplete ? "Complete profile" : "Update profile"}
              </button>
            </div>
          </form>
        </section>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <AnalyticsTile label="Active records" value={overview.analytics.active_records ?? 0} />
          <AnalyticsTile label="Appointments" value={overview.analytics.appointments ?? 0} />
          <AnalyticsTile label="Active SOS alerts" value={overview.analytics.active_sos_alerts ?? 0} />
          <AnalyticsTile label="Outbound transfers" value={overview.analytics.outbound_transfers ?? 0} />
        </div>

        {actionState.message ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            {actionState.message}
          </div>
        ) : null}
        {actionState.error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {actionState.error}
          </div>
        ) : null}

        {pageState.loading ? (
          <div className="glass-panel p-8 text-center text-slate-500">Loading admin dashboard...</div>
        ) : null}

        {!pageState.loading && pageState.error ? (
          <ErrorState
            title="Admin dashboard unavailable"
            description={pageState.error}
            action={
              <button type="button" className="primary-button mt-6" onClick={loadOverview}>
                Retry
              </button>
            }
          />
        ) : null}

        {!pageState.loading && !pageState.error ? (
          <>
        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="glass-panel p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-2xl font-bold tracking-tight">Managed Hospital Resources</h2>
                <p className="mt-2 text-sm text-slate-500">Doctors, beds, ICU, and emergency readiness.</p>
              </div>
              <button type="button" className="primary-button" onClick={handleResourceSave} disabled={!resourceDraft}>
                Save hospital state
              </button>
            </div>

            {resourceDraft ? (
              <div className="mt-6">
                <div className="mb-4 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">Capacity, ICU, and Emergency Controls</p>
                  <p className="mt-1 text-sm text-slate-500">
                    This section is for live bed count, ICU updates, average wait time, and emergency availability.
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <input
                    className="field"
                    name="available_beds"
                    type="number"
                    value={resourceDraft.available_beds ?? ""}
                    onChange={handleResourceChange}
                    placeholder="Available beds"
                  />
                  <input
                    className="field"
                    name="available_icu"
                    type="number"
                    value={resourceDraft.available_icu ?? ""}
                    onChange={handleResourceChange}
                    placeholder="Available ICU"
                  />
                  <input
                    className="field"
                    name="avg_wait_time"
                    type="number"
                    value={resourceDraft.avg_wait_time ?? ""}
                    onChange={handleResourceChange}
                    placeholder="Avg wait time"
                  />
                  <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4">
                    <span className="text-sm text-slate-600">Emergency ready</span>
                    <input
                      type="checkbox"
                      name="emergency_available"
                      checked={!!resourceDraft.emergency_available}
                      onChange={handleResourceChange}
                      className="h-4 w-4 accent-brand-blue"
                    />
                  </label>
                </div>
              </div>
            ) : (
              <EmptyState title="No managed hospital" description="Admin hospital data is unavailable." />
            )}
          </section>

          <section className="glass-panel p-6">
            <h2 className="font-display text-2xl font-bold tracking-tight">SOS Inbox</h2>
            <div className="mt-5 space-y-4">
              {overview.alerts.length ? (
                overview.alerts.map((alert) => (
                  <div key={alert.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-semibold text-slate-900">{alert.patient_name || alert.hospital_name || "General alert"}</p>
                      <span className="chip border-red-200 bg-red-50 text-red-700">{alert.status}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-500">{alert.location_context}</p>
                    <p className="mt-3 text-sm text-slate-600">{alert.message}</p>
                  </div>
                ))
              ) : (
                <EmptyState title="No SOS alerts" description="Incoming emergency alerts will appear here." />
              )}
            </div>
          </section>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="glass-panel p-6">
            <h2 className="font-display text-2xl font-bold tracking-tight">Patient Records</h2>
            <div className="mt-5 space-y-5">
              {overview.patient_records.length ? (
                overview.patient_records.map((record) => (
                  <div key={record.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{record.patient_full_name || record.patient_name}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {record.doctor_name || "Doctor pending"} | urgency {record.urgency} | {new Date(record.appointment_date).toLocaleDateString()}
                        </p>
                      </div>
                      <button type="button" className="secondary-button" onClick={() => handleRecordSave(record.id)}>
                        Save record
                      </button>
                    </div>
                    <div className="mt-4 grid gap-3">
                      <select
                        className="field"
                        value={recordDrafts[record.id]?.status || ""}
                        onChange={(event) => updateRecordDraft(record.id, "status", event.target.value)}
                      >
                        <option value="pending">Pending</option>
                        <option value="accepted">Accepted</option>
                        <option value="rejected">Rejected</option>
                        <option value="cancelled">Cancelled</option>
                        <option value="scheduled">Scheduled</option>
                        <option value="under_review">Under review</option>
                        <option value="transferred">Transferred</option>
                        <option value="completed">Completed</option>
                      </select>
                      <textarea
                        className="field h-24 resize-none py-3"
                        value={recordDrafts[record.id]?.ai_summary || ""}
                        onChange={(event) => updateRecordDraft(record.id, "ai_summary", event.target.value)}
                        placeholder="Diagnosis or clinical summary"
                      />
                      <textarea
                        className="field h-24 resize-none py-3"
                        value={recordDrafts[record.id]?.next_steps || ""}
                        onChange={(event) => updateRecordDraft(record.id, "next_steps", event.target.value)}
                        placeholder="Reports, notes, or next steps"
                      />
                    </div>
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-sm font-semibold text-slate-700">Symptoms</p>
                      <p className="mt-2 text-sm text-slate-600">{record.symptoms || "No symptoms recorded yet."}</p>
                    </div>
                    <div className="mt-5 rounded-[24px] border border-slate-200 bg-white p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">Add files from device</p>
                          <p className="mt-1 text-sm text-slate-500">
                            Upload prescriptions, scans, reports, or discharge notes for this patient.
                          </p>
                        </div>
                        <button type="button" className="secondary-button" onClick={() => handleRecordUpload(record.id)}>
                          Upload files
                        </button>
                      </div>
                      <input
                        className="field mt-4 py-3"
                        type="file"
                        accept="application/pdf"
                        multiple
                        onChange={(event) => handleRecordFileSelection(record.id, event)}
                      />
                      {recordUploadStatus[record.id] ? (
                        <p className="mt-3 text-sm text-brand-blue">{recordUploadStatus[record.id]}</p>
                      ) : null}
                      <div className="mt-4 space-y-3">
                        {(recordUploads[record.id] || []).length ? (
                          recordUploads[record.id].map((file) => (
                            <div key={file.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <p className="font-medium text-slate-800">{file.name}</p>
                                <span className="chip">{formatFileSize(file.size)}</span>
                              </div>
                              <p className="mt-2 text-sm text-slate-500">
                                {file.type} | uploaded {new Date(file.uploaded_at).toLocaleString()}
                              </p>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-slate-500">No files uploaded for this patient record yet.</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState title="No patient records" description="Appointments and incoming patients will appear here." />
              )}
            </div>
          </section>

          <section className="space-y-6">
            <div className="glass-panel p-6">
              <h2 className="font-display text-2xl font-bold tracking-tight">Appointments</h2>
              <div className="mt-5 space-y-4">
                {overview.appointments.length ? (
                  overview.appointments.map((appointment) => (
                    <div key={appointment.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="font-semibold text-slate-900">
                          {appointment.patient_full_name || appointment.patient_name}
                        </p>
                        <span className="chip">{appointment.status}</span>
                      </div>
                      <p className="mt-2 text-sm text-slate-500">
                        {appointment.doctor_name || "Doctor pending"} | token {appointment.token_number || "Pending"}
                      </p>
                      <p className="mt-2 text-sm text-slate-500">
                        Appointment date {new Date(appointment.appointment_date).toLocaleDateString()}
                      </p>
                      <p className="mt-3 text-sm text-slate-600">{appointment.symptoms || "No symptoms provided."}</p>
                      {appointment.status === "pending" ? (
                        <div className="mt-4 flex flex-wrap gap-3">
                          <button
                            type="button"
                            className="primary-button"
                            onClick={() => handleAppointmentStatus(appointment.id, "accepted")}
                            disabled={appointmentActionId === appointment.id}
                          >
                            {appointmentActionId === appointment.id ? "Updating..." : "Accept"}
                          </button>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => handleAppointmentStatus(appointment.id, "rejected")}
                            disabled={appointmentActionId === appointment.id}
                          >
                            {appointmentActionId === appointment.id ? "Updating..." : "Reject"}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <EmptyState title="No appointments" description="Booked patient appointments will appear here." />
                )}
              </div>
            </div>

            <div className="glass-panel p-6">
              <h2 className="font-display text-2xl font-bold tracking-tight">Add Patient Record</h2>
              <p className="mt-2 text-sm text-slate-500">
                Create a clinical record for a patient already associated with this hospital.
              </p>
              <form onSubmit={handleNewRecordSubmit} className="mt-5 space-y-4">
                <select
                  className="field"
                  name="patient_id"
                  value={newRecordForm.patient_id}
                  onChange={handleNewRecordChange}
                  required
                >
                  <option value="">Select patient</option>
                  {overview.patient_options.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.full_name}{patient.phone ? ` | ${patient.phone}` : ""}
                    </option>
                  ))}
                </select>
                <div className="grid gap-4 md:grid-cols-2">
                  <select className="field" name="urgency" value={newRecordForm.urgency} onChange={handleNewRecordChange}>
                    <option value="normal">Normal</option>
                    <option value="urgent">Urgent</option>
                    <option value="critical">Critical</option>
                  </select>
                  <select className="field" name="status" value={newRecordForm.status} onChange={handleNewRecordChange}>
                    <option value="pending">Pending</option>
                    <option value="accepted">Accepted</option>
                    <option value="rejected">Rejected</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="under_review">Under review</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="completed">Completed</option>
                    <option value="transferred">Transferred</option>
                  </select>
                </div>
                <textarea
                  className="field h-24 resize-none py-3"
                  name="symptoms"
                  value={newRecordForm.symptoms}
                  onChange={handleNewRecordChange}
                  placeholder="Symptoms or presenting complaint"
                />
                <textarea
                  className="field h-24 resize-none py-3"
                  name="ai_summary"
                  value={newRecordForm.ai_summary}
                  onChange={handleNewRecordChange}
                  placeholder="Diagnosis or record details"
                />
                <textarea
                  className="field h-24 resize-none py-3"
                  name="next_steps"
                  value={newRecordForm.next_steps}
                  onChange={handleNewRecordChange}
                  placeholder="Reports, treatment plan, or next steps"
                />
                <button type="submit" className="primary-button w-full" disabled={!overview.patient_options.length}>
                  Create patient record
                </button>
              </form>
            </div>

            <div className="glass-panel p-6">
              <h2 className="font-display text-2xl font-bold tracking-tight">Inter-Hospital Coordination</h2>
              <p className="mt-2 text-sm text-slate-500">
                Generate a PDF-style clinical report and grant limited access to a receiving hospital.
              </p>
              <form onSubmit={handleTransferSubmit} className="mt-5 space-y-4">
                <select
                  className="field"
                  name="booking_id"
                  value={transferForm.booking_id}
                  onChange={handleTransferChange}
                  required
                >
                  <option value="">Select patient record</option>
                  {recordOptions.map((record) => (
                    <option key={record.id} value={record.id}>
                      {record.patient_name} | {record.status}
                    </option>
                  ))}
                </select>
                <select
                  className="field"
                  name="target_hospital_id"
                  value={transferForm.target_hospital_id}
                  onChange={handleTransferChange}
                  required
                >
                  <option value="">Receiving hospital</option>
                  {overview.network_hospitals.map((hospital) => (
                    <option key={hospital.id} value={hospital.id}>
                      {hospital.name}
                    </option>
                  ))}
                </select>
                <select
                  className="field"
                  name="share_mode"
                  value={transferForm.share_mode}
                  onChange={handleTransferChange}
                >
                  <option value="api">Secure API</option>
                  <option value="email">Encrypted Email</option>
                </select>
                <input
                  className="field"
                  name="receiving_team"
                  value={transferForm.receiving_team}
                  onChange={handleTransferChange}
                  placeholder="Receiving desk or team"
                />
                <button type="submit" className="primary-button w-full">
                  Generate and share report
                </button>
              </form>
            </div>

            <div className="glass-panel p-6">
              <h2 className="font-display text-2xl font-bold tracking-tight">Outbound Reports</h2>
              <div className="mt-5 space-y-4">
                {overview.transfers.outbound.length ? (
                  overview.transfers.outbound.map((transfer) => (
                    <div key={transfer.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="font-semibold text-slate-900">{transfer.patient_name}</p>
                        <span className="chip">{transfer.status}</span>
                      </div>
                      <p className="mt-2 text-sm text-slate-500">
                        {transfer.source_hospital_name} to {transfer.target_hospital_name}
                      </p>
                      <p className="mt-3 text-sm text-slate-600">{transfer.summary}</p>
                    </div>
                  ))
                ) : (
                  <EmptyState title="No shared reports" description="Shared inter-hospital reports will appear here." />
                )}
              </div>
            </div>

            <div className="glass-panel p-6">
              <h2 className="font-display text-2xl font-bold tracking-tight">Inbound Access</h2>
              <div className="mt-5 space-y-4">
                {overview.transfers.inbound.length ? (
                  overview.transfers.inbound.map((transfer) => (
                    <div key={transfer.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="font-semibold text-slate-900">{transfer.patient_name}</p>
                        <span className="chip">{transfer.status}</span>
                      </div>
                      <p className="mt-2 text-sm text-slate-500">{transfer.source_hospital_name}</p>
                      <p className="mt-3 text-sm text-slate-600">{transfer.summary}</p>
                    </div>
                  ))
                ) : (
                  <EmptyState title="No inbound access" description="Incoming hospital reports will appear here." />
                )}
              </div>
            </div>
          </section>
        </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
