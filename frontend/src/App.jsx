import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";

import AdminPage from "./pages/AdminPage";
import AdminRegisterPage from "./pages/AdminRegisterPage";
import DashboardPage from "./pages/DashboardPage";
import HomePage from "./pages/HomePage";
import HospitalDetailPage from "./pages/HospitalDetailPage";
import HospitalListingPage from "./pages/HospitalListingPage";
import AdminLoginPage from "./pages/AdminLoginPage";
import NotFoundPage from "./pages/NotFoundPage";
import PatientLoginPage from "./pages/PatientLoginPage";
import { getActiveSession, logoutPortal } from "./services/api";
import { clearSession, getSession, persistSession } from "./utils/storage";


function navigationForSession(session) {
  if (session?.role === "patient") {
    return [
      { to: "/patient/intake", label: "Patient Intake" },
      { to: "/patient/hospitals", label: "Hospitals" },
      { to: "/patient/dashboard", label: "Dashboard" },
    ];
  }

  if (session?.role === "hospital_admin") {
    return [{ to: "/hospital-admin/portal", label: "Hospital Admin Portal" }];
  }

  return [
    { to: "/", label: "Platform" },
    { to: "/login/patient", label: "Patient Login" },
    { to: "/login/admin", label: "Admin Login" },
    { to: "/register/admin", label: "Create Admin" },
  ];
}


function RequireRole({ session, role, loading, children }) {
  if (loading) {
    return (
      <div className="section-shell py-16">
        <div className="glass-panel p-8 text-center text-slate-500">Restoring secure session...</div>
      </div>
    );
  }

  if (session?.role !== role) {
    return <Navigate to={role === "patient" ? "/login/patient" : "/login/admin"} replace />;
  }

  return children;
}


function AppShell({ children, session, onLogout }) {
  const navigation = navigationForSession(session);

  return (
    <div className="min-h-screen bg-brand-cloud bg-mesh-glow text-brand-ink">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-7rem] top-12 h-64 w-64 rounded-full bg-brand-blue/15 blur-3xl" />
        <div className="absolute right-[-5rem] top-0 h-72 w-72 rounded-full bg-brand-green/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-brand-red/10 blur-3xl" />
      </div>
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-6 lg:px-8">
          <NavLink to="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-blue text-sm font-bold text-white shadow-glow">
              MP
            </div>
            <div>
              <p className="font-display text-lg font-bold tracking-tight">MEDPULSE</p>
              <p className="text-xs text-slate-500">Two-role digital healthcare coordination</p>
            </div>
          </NavLink>
          <nav className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white/80 p-1 shadow-soft md:flex">
            {navigation.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  [
                    "rounded-full px-4 py-2 text-sm font-medium transition",
                    isActive ? "bg-brand-ink text-white" : "text-slate-600 hover:bg-slate-100",
                  ].join(" ")
                }
              >
                {item.label}
              </NavLink>
            ))}
            {session ? (
              <button type="button" className="secondary-button" onClick={onLogout}>
                Logout
              </button>
            ) : null}
          </nav>
        </div>
      </header>
      <main className="relative z-10">{children}</main>
    </div>
  );
}


export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [session, setSession] = useState(() => getSession());
  const [authLoading, setAuthLoading] = useState(() => Boolean(getSession()?.token));

  useEffect(() => {
    let cancelled = false;

    async function hydrateSession() {
      const storedSession = getSession();
      if (!storedSession?.token) {
        setAuthLoading(false);
        return;
      }

      try {
        const activeSession = await getActiveSession();
        persistSession(activeSession);
        if (!cancelled) {
          setSession(activeSession);
        }
      } catch {
        clearSession();
        if (!cancelled) {
          setSession(null);
        }
      } finally {
        if (!cancelled) {
          setAuthLoading(false);
        }
      }
    }

    hydrateSession();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLogout() {
    try {
      await logoutPortal();
    } catch {
      // Keep local logout resilient even if the backend token is already invalid.
    }
    clearSession();
    setSession(null);
    navigate("/");
  }

  return (
    <AppShell session={session} onLogout={handleLogout}>
      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname + location.search}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
        >
          <Routes location={location}>
            <Route path="/" element={<HomePage session={session} />} />
            <Route
              path="/login/patient"
              element={<PatientLoginPage session={session} onSessionChange={setSession} />}
            />
            <Route
              path="/login/admin"
              element={<AdminLoginPage session={session} onSessionChange={setSession} />}
            />
            <Route
              path="/register/admin"
              element={<AdminRegisterPage session={session} onSessionChange={setSession} />}
            />
            <Route
              path="/patient/intake"
              element={
                <RequireRole session={session} role="patient" loading={authLoading}>
                  <HomePage session={session} patientMode />
                </RequireRole>
              }
            />
            <Route
              path="/patient/hospitals"
              element={
                <RequireRole session={session} role="patient" loading={authLoading}>
                  <HospitalListingPage session={session} />
                </RequireRole>
              }
            />
            <Route
              path="/patient/hospitals/:hospitalId"
              element={
                <RequireRole session={session} role="patient" loading={authLoading}>
                  <HospitalDetailPage session={session} />
                </RequireRole>
              }
            />
            <Route
              path="/patient/dashboard"
              element={
                <RequireRole session={session} role="patient" loading={authLoading}>
                  <DashboardPage session={session} />
                </RequireRole>
              }
            />
            <Route
              path="/hospital-admin/portal"
              element={
                <RequireRole session={session} role="hospital_admin" loading={authLoading}>
                  <AdminPage session={session} />
                </RequireRole>
              }
            />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </motion.div>
      </AnimatePresence>
    </AppShell>
  );
}
