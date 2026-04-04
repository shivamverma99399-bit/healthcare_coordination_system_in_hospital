import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import DemoLoginSuggestion from "../components/DemoLoginSuggestion";
import {
  buildDemoAdminSession,
  DEMO_HOSPITALS,
  validateDemoAdminLogin,
} from "../utils/demoAuth";
import { persistSession } from "../utils/storage";


export default function AdminLoginPage({ session, onSessionChange }) {
  const navigate = useNavigate();
  const [focusedField, setFocusedField] = useState("");
  const [form, setForm] = useState({ email: "", password: "", name: "", hospital: "" });
  const [status, setStatus] = useState({ loading: false, error: "", fieldErrors: {} });

  useEffect(() => {
    if (session?.role === "hospital_admin") {
      navigate("/hospital-admin/portal", { replace: true });
    }
  }, [navigate, session]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setStatus((current) => ({
      ...current,
      error: "",
      fieldErrors: {
        ...current.fieldErrors,
        [name]: "",
      },
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    const fieldErrors = validateDemoAdminLogin(form);
    if (Object.keys(fieldErrors).length) {
      setStatus({ loading: false, error: "", fieldErrors });
      return;
    }

    setStatus({ loading: true, error: "", fieldErrors: {} });
    const sessionData = buildDemoAdminSession(form);
    persistSession(sessionData);
    onSessionChange(sessionData);
    navigate("/hospital-admin/portal");
  }

  function useDemo() {
    setForm({
      email: "admin@medpulse.local",
      password: "admin123",
      name: "Admin 1",
      hospital: String(DEMO_HOSPITALS[0].id),
    });
  }

  function handleDemoLogin() {
    const sessionData = buildDemoAdminSession({
      email: "admin@medpulse.local",
      password: "admin123",
      name: "Admin 1",
      hospital: String(DEMO_HOSPITALS[0].id),
    });
    setStatus({ loading: true, error: "", fieldErrors: {} });
    persistSession(sessionData);
    onSessionChange(sessionData);
    navigate("/hospital-admin/portal");
  }

  const suggestedAdminEmail = "admin@medpulse.local";
  const suggestedAdminPassword = "admin123";

  return (
    <div className="section-shell pb-16 pt-10">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_1fr]">
        <section className="glass-panel p-6">
          <p className="chip border-amber-200 bg-amber-50 text-amber-700">Hospital Admin Login</p>
          <h1 className="mt-4 font-display text-4xl font-bold tracking-tight">
            Manage resources and inter-hospital coordination
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Admin access unlocks live resource controls, SOS inbox, patient-record updates,
            analytics, and report sharing with receiving hospitals.
          </p>
          <div className="mt-6 space-y-4">
            <DemoLoginSuggestion
              title="Demo admin login"
              description="Use instant frontend-only demo access with hospital selection."
              email={suggestedAdminEmail}
              password={suggestedAdminPassword}
              actions={[
                { label: "Use demo details", variant: "secondary", onClick: useDemo },
                { label: "Login as admin", onClick: handleDemoLogin },
              ]}
            />
          </div>
        </section>

        <section className="glass-panel p-6">
          <div className="mb-5">
            <DemoLoginSuggestion
              title="Suggested demo admin login"
              description="Fill the fields or use one-click demo login. Backend authentication is bypassed."
              email={suggestedAdminEmail}
              password={suggestedAdminPassword}
              actions={[
                { label: "Fill demo credentials", variant: "secondary", onClick: useDemo },
                { label: "Quick demo login", onClick: handleDemoLogin },
              ]}
            />
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-600">Admin email</label>
              <input
                className="field"
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                onFocus={() => setFocusedField("email")}
                required
              />
              {focusedField === "email" ? (
                <button
                  type="button"
                  className="mt-2 text-sm text-brand-blue"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => setForm((current) => ({ ...current, email: suggestedAdminEmail }))}
                >
                  Suggestion: use demo email `{suggestedAdminEmail}`
                </button>
              ) : null}
              {status.fieldErrors.email ? (
                <p className="mt-2 text-sm text-red-600">{status.fieldErrors.email}</p>
              ) : null}
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-600">Password</label>
              <input
                className="field"
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                onFocus={() => setFocusedField("password")}
                required
              />
              {focusedField === "password" ? (
                <button
                  type="button"
                  className="mt-2 text-sm text-brand-blue"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => setForm((current) => ({ ...current, password: suggestedAdminPassword }))}
                >
                  Suggestion: use demo password `{suggestedAdminPassword}`
                </button>
              ) : null}
              {status.fieldErrors.password ? (
                <p className="mt-2 text-sm text-red-600">{status.fieldErrors.password}</p>
              ) : null}
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-600">Admin name</label>
              <input
                className="field"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Admin name"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-600">Hospital</label>
              <select className="field" name="hospital" value={form.hospital} onChange={handleChange} required>
                <option value="">Select hospital</option>
                {DEMO_HOSPITALS.map((hospital) => (
                  <option key={hospital.id} value={hospital.id}>
                    {hospital.name}
                  </option>
                ))}
              </select>
              {status.fieldErrors.hospital ? (
                <p className="mt-2 text-sm text-red-600">{status.fieldErrors.hospital}</p>
              ) : null}
            </div>
            <button type="submit" className="primary-button w-full">
              {status.loading ? "Signing in..." : "Continue as hospital admin"}
            </button>
          </form>
          {status.error ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {status.error}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
