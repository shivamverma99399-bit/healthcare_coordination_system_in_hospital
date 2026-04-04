import axios from "axios";

import { API_BASE_URL } from "../config/api";
import { fallbackDoctors, fallbackHospitals } from "../data/fallbackData";
import {
  getAdminTransfers as getLocalAdminTransfers,
  getPatientAlerts,
  getPatientBookings,
  getSavedHospitals,
  getSession,
  persistAdminTransfer,
  persistPatientAlert,
  persistPatientBooking,
} from "../utils/storage";


const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 8000,
});

function authConfig(config = {}) {
  const token = getSession()?.token;
  return token
    ? {
        ...config,
        headers: {
          ...(config.headers || {}),
          Authorization: `Token ${token}`,
        },
      }
    : config;
}


function fallbackRecommendationList(params = {}) {
  const maxDistance = Number(params.distance || 0);
  const specialization = String(params.specialization || "").trim().toLowerCase();
  const requireIcu = String(params.icu || "").toLowerCase() === "true" || params.icu === true;

  return fallbackHospitals
    .map((hospital) => ({
      ...hospital,
      score_breakdown: {
        distance: 24,
        capacity: 22,
        specialist_match: 18,
        urgency: 16,
        emergency: hospital.emergency_available ? 8 : 0,
      },
      care_pathway: hospital.emergency_available ? "Immediate emergency route" : "Routine coordinated care route",
      next_steps: [
        "Review doctor availability.",
        "Confirm appointment or use SOS escalation.",
      ],
    }))
    .filter((hospital) => {
      if (maxDistance && hospital.distance > maxDistance) {
        return false;
      }

      if (requireIcu && hospital.icu_available <= 0) {
        return false;
      }

      if (specialization) {
        const normalizedSpecializations = hospital.specialization.map((item) => String(item).toLowerCase());
        const normalizedRequested = specialization
          .replace("cardio", "cardiologist")
          .replace("general", "general_physician")
          .replace("neuro", "neurologist")
          .replace("pulmo", "pulmonologist")
          .replace("ortho", "orthopedic")
          .replace("derma", "dermatologist");

        if (!normalizedSpecializations.includes(normalizedRequested)) {
          return false;
        }
      }

      return true;
    })
    .sort((left, right) => right.ai_score - left.ai_score || left.distance - right.distance);
}


function shouldUsePatientDemoFallback(error) {
  const status = error?.response?.status;
  const token = getSession()?.token || "";
  return token.startsWith("demo-patient-") || status === 401 || status === 403 || !status;
}


function buildFallbackPatientDashboard() {
  const session = getSession();
  const savedHospitals = getSavedHospitals();
  const history = getPatientBookings();
  const alerts = getPatientAlerts();

  return {
    profile: {
      full_name: session?.profile?.full_name || session?.display_name || "Demo Patient",
      city: session?.profile?.city || "Delhi",
      phone: session?.profile?.phone || "9999999999",
      emergency_contact: session?.profile?.emergency_contact || "Demo Emergency Contact",
    },
    stats: {
      appointments: history.length,
      active_alerts: alerts.filter((item) => item.status === "active").length,
      network_hospitals: fallbackHospitals.length,
      emergency_ready: fallbackHospitals.filter((item) => item.emergency_available).length,
    },
    history,
    alerts,
    saved_hospitals: savedHospitals,
  };
}


function shouldUseAdminDemoFallback(error) {
  const status = error?.response?.status;
  const token = getSession()?.token || "";
  return token.startsWith("demo-admin-") || status === 401 || status === 403 || !status;
}


function buildFallbackAdminOverview() {
  const session = getSession();
  const localTransfers = getLocalAdminTransfers();
  const managedHospital = {
    id: session?.profile?.hospital?.id || 1,
    name: session?.profile?.hospital?.name || "Demo Hospital",
    location: session?.profile?.hospital?.location || "Delhi",
    available_beds: 18,
    available_icu: 4,
    total_beds: 100,
    total_icu: 20,
    emergency_available: true,
    avg_wait_time: 15,
    opd_load: 3,
  };

  return {
    profile: {
      title: session?.profile?.title || "Hospital Operations Admin",
      hospital: session?.profile?.hospital || {
        id: managedHospital.id,
        name: managedHospital.name,
        location: managedHospital.location,
      },
    },
    managed_hospital: managedHospital,
    network_hospitals: fallbackHospitals.slice(0, 4).map((hospital) => ({
      id: hospital.id,
      name: hospital.hospital_name,
      location: hospital.location,
      available_beds: hospital.beds_available,
      available_icu: hospital.icu_available,
      total_beds: hospital.beds_available + 20,
      total_icu: hospital.icu_available + 4,
      emergency_available: hospital.emergency_available,
      avg_wait_time: 18,
      opd_load: 4,
    })),
    analytics: {
      active_records: 0,
      active_sos_alerts: 0,
      outbound_transfers: localTransfers.length,
      inbound_transfers: 0,
    },
    patient_records: [],
    alerts: [],
    transfers: {
      outbound: localTransfers,
      inbound: [],
    },
  };
}


export async function getDemoAccounts() {
  const { data } = await api.get("auth/demo-accounts");
  return data.accounts || [];
}


export async function loginPortal(payload) {
  const { data } = await api.post("auth/login", payload);
  return data;
}


export async function getActiveSession() {
  const { data } = await api.get("auth/session", authConfig());
  return data;
}


export async function logoutPortal() {
  const { data } = await api.post("auth/logout", {}, authConfig());
  return data;
}


export async function analyzeSymptoms(payload) {
  const { data } = await api.post("analyze-symptoms", payload, authConfig());
  return data;
}


export async function getHospitalRecommendations(params) {
  try {
    const { data } = await api.get("hospitals/recommendations", authConfig({ params }));
    return data;
  } catch {
    return fallbackRecommendationList(params);
  }
}


export async function getDoctorsByHospital(hospitalId, specialization) {
  try {
    const { data } = await api.get("doctors/by-hospital", authConfig({
      params: { id: hospitalId, specialization },
    }));
    return data;
  } catch {
    return fallbackDoctors[hospitalId] || [];
  }
}


export async function bookAppointment(payload) {
  try {
    const { data } = await api.post("book-appointment", payload, authConfig());
    persistPatientBooking({
      id: data.booking_id,
      patient_name: payload.patient_name,
      hospital_name: data.hospital_name,
      doctor_name: data.doctor_name,
      urgency: payload.urgency,
      status: "scheduled",
      ai_summary: payload.ai_summary,
      next_steps: payload.next_steps,
    });
    return data;
  } catch (error) {
    if (!shouldUsePatientDemoFallback(error)) {
      throw error;
    }

    const bookingId = Date.now();
    persistPatientBooking({
      id: bookingId,
      patient_name: payload.patient_name,
      hospital_name: payload.hospital_name || "Demo hospital",
      doctor_name: payload.doctor_name || "Demo doctor",
      urgency: payload.urgency,
      status: "scheduled",
      ai_summary: payload.ai_summary,
      next_steps: payload.next_steps,
    });

    return {
      status: "confirmed",
      booking_id: bookingId,
      doctor_name: payload.doctor_name || "Demo doctor",
      hospital_name: payload.hospital_name || "Demo hospital",
      time: payload.time,
      token_number: Math.floor((bookingId / 1000) % 1000),
    };
  }
}


export async function getPatientDashboard() {
  try {
    const { data } = await api.get("patient/dashboard", authConfig());
    return data;
  } catch (error) {
    if (!shouldUsePatientDemoFallback(error)) {
      throw error;
    }
    return buildFallbackPatientDashboard();
  }
}


export async function createPatientSosAlert(payload) {
  try {
    const { data } = await api.post("patient/sos-alerts", payload, authConfig());
    persistPatientAlert(data);
    return data;
  } catch (error) {
    if (!shouldUsePatientDemoFallback(error)) {
      throw error;
    }

    const alert = {
      id: Date.now(),
      hospital_name: "",
      location_context: payload.location_context,
      message: payload.message,
      status: "active",
      urgency: payload.urgency,
    };
    persistPatientAlert(alert);
    return alert;
  }
}


export async function getAdminOverview() {
  try {
    const { data } = await api.get("admin/overview", authConfig());
    return data;
  } catch (error) {
    if (!shouldUseAdminDemoFallback(error)) {
      throw error;
    }
    return buildFallbackAdminOverview();
  }
}


export async function updateHospitalResources(hospitalId, payload) {
  try {
    const { data } = await api.patch(`admin/hospitals/${hospitalId}`, payload, authConfig());
    return data;
  } catch (error) {
    if (!shouldUseAdminDemoFallback(error)) {
      throw error;
    }
    return { id: hospitalId, ...payload };
  }
}


export async function updatePatientRecord(recordId, payload) {
  try {
    const { data } = await api.patch(`admin/patient-records/${recordId}`, payload, authConfig());
    return data;
  } catch (error) {
    if (!shouldUseAdminDemoFallback(error)) {
      throw error;
    }
    return { id: recordId, ...payload };
  }
}


export async function getAdminTransfers() {
  const { data } = await api.get("admin/transfers", authConfig());
  return data;
}


export async function createTransfer(payload) {
  try {
    const { data } = await api.post("admin/transfers", payload, authConfig());
    persistAdminTransfer(data);
    return data;
  } catch (error) {
    if (!shouldUseAdminDemoFallback(error)) {
      throw error;
    }

    const session = getSession();
    const transfer = {
      id: Date.now(),
      patient_name: "Demo Patient",
      source_hospital_name: session?.profile?.hospital?.name || "Demo Hospital",
      target_hospital_name: `Hospital ${payload.target_hospital_id}`,
      summary: "Demo transfer report shared successfully.",
      status: "shared",
    };
    persistAdminTransfer(transfer);
    return transfer;
  }
}
