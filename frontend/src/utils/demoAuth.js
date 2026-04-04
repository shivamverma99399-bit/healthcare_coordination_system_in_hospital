export const DEMO_HOSPITALS = [
  { id: 1, name: "City Hospital", location: "Delhi" },
  { id: 2, name: "Metro General Hospital", location: "Noida" },
  { id: 3, name: "Care Plus Hospital", location: "Gurugram" },
];

function resolveHospital(hospitalId) {
  return DEMO_HOSPITALS.find((hospital) => String(hospital.id) === String(hospitalId)) || null;
}

export function validateDemoPatientLogin(values) {
  const fieldErrors = {};
  const email = String(values.email || "").trim();
  const password = String(values.password || "");
  const phoneDigits = String(values.phone || "").replace(/\D/g, "");

  if (!email.includes("@") || !email.includes(".")) {
    fieldErrors.email = "Enter a valid email address.";
  }
  if (!password.trim()) {
    fieldErrors.password = "Password is required.";
  }
  if (phoneDigits.length !== 10) {
    fieldErrors.phone = "Mobile number must be exactly 10 digits.";
  }

  return fieldErrors;
}

export function validateDemoAdminLogin(values) {
  const fieldErrors = {};
  const email = String(values.email || "").trim();
  const password = String(values.password || "");

  if (!email.includes("@") || !email.includes(".")) {
    fieldErrors.email = "Enter a valid email address.";
  }
  if (!password.trim()) {
    fieldErrors.password = "Password is required.";
  }
  if (!String(values.hospital || "").trim()) {
    fieldErrors.hospital = "Please select a hospital.";
  }

  return fieldErrors;
}

export function buildDemoPatientSession(values) {
  const displayName =
    String(values.full_name || "").trim()
    || String(values.email || "").split("@", 1)[0].replace(/[._-]+/g, " ").trim()
    || "Demo Patient";

  return {
    token: `demo-patient-${Date.now()}`,
    role: "patient",
    email: values.email,
    name: displayName,
    display_name: displayName,
    profile: {
      full_name: displayName,
      city: "Delhi",
      phone: String(values.phone || "").replace(/\D/g, ""),
      emergency_contact: "Demo Emergency Contact",
    },
  };
}

export function buildDemoAdminSession(values) {
  const hospital = resolveHospital(values.hospital) || DEMO_HOSPITALS[0];
  const displayName =
    String(values.name || "").trim()
    || String(values.email || "").split("@", 1)[0].replace(/[._-]+/g, " ").trim()
    || "Demo Admin";

  return {
    token: `demo-admin-${Date.now()}`,
    role: "hospital_admin",
    email: values.email,
    name: displayName,
    hospital: hospital.name,
    display_name: displayName,
    profile: {
      name: displayName,
      admin_id: `ADM-${hospital.id}${Date.now().toString().slice(-4)}`,
      title: "Hospital Operations Admin",
      hospital,
    },
  };
}
