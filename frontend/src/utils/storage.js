const SAVED_HOSPITALS_KEY = "medpulse:saved-hospitals";
const SESSION_KEY = "medpulse:session";
const RECOMMENDATIONS_KEY = "medpulse:last-recommendations";
const ADMIN_RECORD_UPLOADS_KEY = "medpulse:admin-record-uploads";
const PATIENT_UPLOADS_KEY = "medpulse:patient-uploads";
const PATIENT_BOOKINGS_KEY = "medpulse:patient-bookings";
const PATIENT_ALERTS_KEY = "medpulse:patient-alerts";
const ADMIN_TRANSFERS_KEY = "medpulse:admin-transfers";


function readJson(key) {
  try {
    return JSON.parse(window.localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}


function readObject(key) {
  try {
    return JSON.parse(window.localStorage.getItem(key) || "{}");
  } catch {
    return {};
  }
}


function serializeFiles(files = []) {
  return Array.from(files).map((file, index) => ({
    id: `${Date.now()}-${index}-${file.name}`,
    name: file.name,
    size: file.size,
    type: file.type || "Unknown",
    uploaded_at: new Date().toISOString(),
  }));
}


function serializeBooking(booking) {
  return {
    id: booking.id || Date.now(),
    patient_name: booking.patient_name || "Demo Patient",
    hospital_name: booking.hospital_name || "Hospital pending",
    doctor_name: booking.doctor_name || "Doctor pending",
    urgency: booking.urgency || "normal",
    status: booking.status || "scheduled",
    ai_summary: booking.ai_summary || "",
    next_steps: booking.next_steps || "",
    created_at: booking.created_at || new Date().toISOString(),
  };
}


function serializeAlert(alert) {
  return {
    id: alert.id || Date.now(),
    hospital_name: alert.hospital_name || "",
    location_context: alert.location_context || "",
    message: alert.message || "",
    status: alert.status || "active",
    urgency: alert.urgency || "critical",
    created_at: alert.created_at || new Date().toISOString(),
  };
}


export function getSavedHospitals() {
  return readJson(SAVED_HOSPITALS_KEY);
}


export function toggleSavedHospital(hospital) {
  const existing = getSavedHospitals();
  const alreadySaved = existing.some((item) => item.id === hospital.id);
  const next = alreadySaved
    ? existing.filter((item) => item.id !== hospital.id)
    : [hospital, ...existing].slice(0, 8);
  window.localStorage.setItem(SAVED_HOSPITALS_KEY, JSON.stringify(next));
  return next;
}


export function getSession() {
  try {
    return JSON.parse(window.localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}


export function persistSession(session) {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}


export function clearSession() {
  window.localStorage.removeItem(SESSION_KEY);
}


export function hasRole(role) {
  const session = getSession();
  return session?.role === role;
}


export function persistRecommendations(hospitals) {
  window.sessionStorage.setItem(RECOMMENDATIONS_KEY, JSON.stringify(hospitals));
}


export function getPersistedRecommendations() {
  try {
    return JSON.parse(window.sessionStorage.getItem(RECOMMENDATIONS_KEY) || "[]");
  } catch {
    return [];
  }
}


export function getAdminRecordUploads() {
  return readObject(ADMIN_RECORD_UPLOADS_KEY);
}


export function persistAdminRecordUploads(recordId, files) {
  const existing = getAdminRecordUploads();
  const next = {
    ...existing,
    [recordId]: [...serializeFiles(files), ...(existing[recordId] || [])].slice(0, 12),
  };
  window.localStorage.setItem(ADMIN_RECORD_UPLOADS_KEY, JSON.stringify(next));
  return next;
}


export function getPatientUploads() {
  return readJson(PATIENT_UPLOADS_KEY);
}


export function persistPatientUploads(files) {
  const existing = getPatientUploads();
  const next = [...serializeFiles(files), ...existing].slice(0, 12);
  window.localStorage.setItem(PATIENT_UPLOADS_KEY, JSON.stringify(next));
  return next;
}


export function getPatientBookings() {
  return readJson(PATIENT_BOOKINGS_KEY);
}


export function persistPatientBooking(booking) {
  const existing = getPatientBookings();
  const next = [serializeBooking(booking), ...existing].slice(0, 12);
  window.localStorage.setItem(PATIENT_BOOKINGS_KEY, JSON.stringify(next));
  return next;
}


export function getPatientAlerts() {
  return readJson(PATIENT_ALERTS_KEY);
}


export function persistPatientAlert(alert) {
  const existing = getPatientAlerts();
  const next = [serializeAlert(alert), ...existing].slice(0, 12);
  window.localStorage.setItem(PATIENT_ALERTS_KEY, JSON.stringify(next));
  return next;
}


export function getAdminTransfers() {
  return readJson(ADMIN_TRANSFERS_KEY);
}


export function persistAdminTransfer(transfer) {
  const existing = getAdminTransfers();
  const next = [
    {
      id: transfer.id || Date.now(),
      patient_name: transfer.patient_name || "Demo Patient",
      source_hospital_name: transfer.source_hospital_name || "Demo Hospital",
      target_hospital_name: transfer.target_hospital_name || "Receiving Hospital",
      summary: transfer.summary || "Demo transfer report shared successfully.",
      status: transfer.status || "shared",
      created_at: transfer.created_at || new Date().toISOString(),
    },
    ...existing,
  ].slice(0, 12);
  window.localStorage.setItem(ADMIN_TRANSFERS_KEY, JSON.stringify(next));
  return next;
}
