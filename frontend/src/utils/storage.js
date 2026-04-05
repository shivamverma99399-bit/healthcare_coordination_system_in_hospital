const SAVED_HOSPITALS_KEY = "medpulse:saved-hospitals";
const SESSION_KEY = "medpulse:session";
const RECOMMENDATIONS_KEY = "medpulse:last-recommendations";


function readJson(key) {
  try {
    return JSON.parse(window.localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
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
