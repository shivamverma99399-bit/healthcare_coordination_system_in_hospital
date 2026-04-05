import { buildApiUrl } from "../config/api";
import { clearSession, getSession, persistSession } from "../utils/storage";


class ApiError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "ApiError";
    this.status = options.status;
    this.payload = options.payload;
    this.url = options.url;
  }
}


function buildUrl(path, params) {
  const url = new URL(buildApiUrl(path));
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") {
        return;
      }
      url.searchParams.set(key, String(value));
    });
  }
  return url.toString();
}


function getErrorMessage(payload, fallbackMessage) {
  if (!payload) {
    return fallbackMessage;
  }

  if (typeof payload === "string" && payload.trim()) {
    return payload;
  }

  if (typeof payload.detail === "string" && payload.detail.trim()) {
    return payload.detail;
  }

  if (typeof payload.message === "string" && payload.message.trim()) {
    return payload.message;
  }

  const firstFieldError = Object.values(payload).find((value) => Array.isArray(value) && value[0]);
  if (firstFieldError) {
    return String(firstFieldError[0]);
  }

  return fallbackMessage;
}


async function parsePayload(response, responseType) {
  if (responseType === "blob") {
    return response.blob();
  }

  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response.text();
}


async function request(path, options = {}, fallbackMessage = "Request failed.") {
  const {
    method = "GET",
    body,
    params,
    headers = {},
    auth = true,
    responseType = "json",
  } = options;

  const requestHeaders = new Headers({
    Accept: responseType === "blob" ? "application/pdf" : "application/json",
    ...headers,
  });

  const token = auth ? getSession()?.token : null;
  if (token) {
    requestHeaders.set("Authorization", `Token ${token}`);
  }

  const init = {
    method,
    headers: requestHeaders,
  };

  if (body !== undefined && body !== null) {
    if (body instanceof FormData) {
      init.body = body;
      requestHeaders.delete("Content-Type");
    } else {
      requestHeaders.set("Content-Type", "application/json");
      init.body = JSON.stringify(body);
    }
  }

  const url = buildUrl(path, params);
  const response = await fetch(url, init);
  const payload = await parsePayload(response, responseType);

  if (!response.ok) {
    if (auth && response.status === 401) {
      clearSession();
    }

    throw new ApiError(getErrorMessage(payload, fallbackMessage), {
      status: response.status,
      payload,
      url,
    });
  }

  return payload;
}


function buildPdfFormData(files) {
  const formData = new FormData();
  Array.from(files || []).forEach((file) => {
    formData.append("files", file);
  });
  return formData;
}


function persistUpdatedAdminSession(profile) {
  const session = getSession();
  if (!session) {
    return;
  }

  persistSession({
    ...session,
    display_name: profile.name || session.display_name,
    profile: {
      ...session.profile,
      name: profile.name || session.profile?.name,
      admin_id: profile.admin_id || session.profile?.admin_id,
      title: profile.title || session.profile?.title,
      hospital: profile.hospital || session.profile?.hospital,
    },
  });
}


export async function loginPortal(payload) {
  return request("auth/login", { method: "POST", auth: false, body: payload }, "Unable to log in.");
}


export async function registerHospitalAdmin(payload) {
  return request(
    "auth/admin-register",
    { method: "POST", auth: false, body: payload },
    "Unable to create the hospital admin account.",
  );
}


export async function getActiveSession() {
  return request("auth/session", {}, "Unable to load the active session.");
}


export async function logoutPortal() {
  return request("auth/logout", { method: "POST", body: {} }, "Unable to log out.");
}


export async function analyzeSymptoms(payload) {
  return request("analyze-symptoms", { method: "POST", body: payload }, "Unable to analyze symptoms.");
}


export async function getHospitalRecommendations(params) {
  return request(
    "hospitals/recommendations",
    { params },
    "Unable to load hospital recommendations.",
  );
}


export async function getDoctorsByHospital(hospitalId, specialization) {
  return request(
    "doctors/by-hospital",
    {
      params: {
        id: hospitalId,
        specialization,
      },
    },
    "Unable to load doctors.",
  );
}


export async function bookAppointment(payload) {
  return request("book-appointment", { method: "POST", body: payload }, "Unable to book the appointment.");
}


export async function getPatientDashboard() {
  return request("patient/dashboard", {}, "Unable to load the patient dashboard.");
}


export async function createPatientSosAlert(payload) {
  return request("patient/sos-alerts", { method: "POST", body: payload }, "Unable to create the SOS alert.");
}


export async function deletePatientSosAlert(alertId) {
  return request(
    `patient/sos-alerts/${alertId}`,
    { method: "DELETE" },
    "Unable to delete the SOS alert.",
  );
}


export async function cancelPatientAppointment(bookingId) {
  return request(
    `patient/appointments/${bookingId}/status`,
    {
      method: "PATCH",
      body: { status: "cancelled" },
    },
    "Unable to cancel the appointment.",
  );
}


export async function deletePatientRecord(bookingId) {
  return request(
    `patient/records/${bookingId}`,
    { method: "DELETE" },
    "Unable to delete the patient record.",
  );
}


export async function uploadPatientDocuments(files) {
  return request(
    "patient/documents",
    {
      method: "POST",
      body: buildPdfFormData(files),
    },
    "Unable to upload the PDF document.",
  );
}


export async function deletePatientDocument(documentId) {
  return request(
    `patient/documents/${documentId}`,
    { method: "DELETE" },
    "Unable to delete the document.",
  );
}


export async function downloadDocument(documentId) {
  return request(
    `documents/${documentId}/download`,
    { responseType: "blob" },
    "Unable to load the document.",
  );
}


export async function getAdminOverview() {
  return request("admin/overview", {}, "Unable to load the admin overview.");
}


export async function getAdminProfile() {
  return request("admin/profile", {}, "Unable to load the admin profile.");
}


export async function updateAdminProfile(payload) {
  const data = await request(
    "admin/profile",
    {
      method: "PUT",
      body: payload,
    },
    "Unable to update the admin profile.",
  );
  persistUpdatedAdminSession(data);
  return data;
}


export async function updateHospitalResources(hospitalId, payload) {
  return request(
    `admin/hospitals/${hospitalId}`,
    {
      method: "PATCH",
      body: payload,
    },
    "Unable to update hospital resources.",
  );
}


export async function updatePatientRecord(recordId, payload) {
  return request(
    `admin/patient-records/${recordId}`,
    {
      method: "PATCH",
      body: payload,
    },
    "Unable to update the patient record.",
  );
}


export async function createPatientRecord(payload) {
  return request(
    "admin/patient-records",
    {
      method: "POST",
      body: payload,
    },
    "Unable to create the patient record.",
  );
}


export async function uploadAdminRecordDocuments(recordId, files) {
  return request(
    `admin/patient-records/${recordId}/documents`,
    {
      method: "POST",
      body: buildPdfFormData(files),
    },
    "Unable to upload the patient document.",
  );
}


export async function deleteAdminDocument(documentId) {
  return request(
    `admin/documents/${documentId}`,
    { method: "DELETE" },
    "Unable to delete the document.",
  );
}


export async function updateAppointmentStatus(bookingId, statusValue) {
  return request(
    `admin/appointments/${bookingId}/status`,
    {
      method: "PATCH",
      body: { status: statusValue },
    },
    "Unable to update the appointment status.",
  );
}


export async function getAdminTransfers() {
  return request("admin/transfers", {}, "Unable to load transfer data.");
}


export async function createTransfer(payload) {
  return request(
    "admin/transfers",
    {
      method: "POST",
      body: payload,
    },
    "Unable to create the transfer.",
  );
}
