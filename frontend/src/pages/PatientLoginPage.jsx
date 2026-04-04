import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import DemoLoginSuggestion from "../components/DemoLoginSuggestion";
import {
  buildDemoPatientSession,
  validateDemoPatientLogin,
} from "../utils/demoAuth";
import { persistSession } from "../utils/storage";


export default function PatientLoginPage({ session, onSessionChange }) {
  const navigate = useNavigate();
  const [focusedField, setFocusedField] = useState("");
  const [form, setForm] = useState({
    email: "",
    password: "",
    full_name: "",
    phone: "",
  });
  const [status, setStatus] = useState({ loading: false, error: "", fieldErrors: {} });

  useEffect(() => {
    if (session?.role === "patient") {
      navigate("/patient/dashboard", { replace: true });
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

  function validateForm() {
    return validateDemoPatientLogin(form);
  }

  function handleSubmit(event) {
    event.preventDefault();
    const fieldErrors = validateForm();
    if (Object.keys(fieldErrors).length) {
      setStatus({ loading: false, error: "", fieldErrors });
      return;
    }

    setStatus({ loading: true, error: "", fieldErrors: {} });
    const sessionData = buildDemoPatientSession(form);
    persistSession(sessionData);
    onSessionChange(sessionData);
    navigate("/patient/dashboard");
  }

  function applyDemo() {
    setForm((current) => ({
      ...current,
      email: "patient@medpulse.local",
      password: "patient123",
      full_name: "Asha Verma",
      phone: "9999999999",
    }));
  }

  function handleDemoLogin() {
    const demoValues = {
      email: "patient@medpulse.local",
      password: "patient123",
      full_name: "Asha Verma",
      phone: "9999999999",
    };
    setStatus({ loading: true, error: "", fieldErrors: {} });
    const sessionData = buildDemoPatientSession(demoValues);
    persistSession(sessionData);
    onSessionChange(sessionData);
    navigate("/patient/dashboard");
  }

  const suggestedPatientEmail = "patient@medpulse.local";
  const suggestedPatientPassword = "patient123";

  return (
    <div className="section-shell pb-16 pt-10">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="glass-panel p-6">
          <p className="chip border-blue-200 bg-blue-50 text-blue-700">Patient Login</p>
          <h1 className="mt-4 font-display text-4xl font-bold tracking-tight">
            Secure sign-in and profile setup
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Use an existing patient account or create one by filling your basic details. After
            login you will move straight into symptom intake and AI triage.
          </p>
          <div className="mt-6">
            <DemoLoginSuggestion
              title="Demo patient login"
              description="Use instant frontend-only demo access with no backend dependency."
              email={suggestedPatientEmail}
              password={suggestedPatientPassword}
              actions={[
                { label: "Use demo details", variant: "secondary", onClick: applyDemo },
                { label: "Login as demo patient", onClick: handleDemoLogin },
              ]}
            />
          </div>
        </section>

        <section className="glass-panel p-6">
          <div className="mb-5">
            <DemoLoginSuggestion
              title="Suggested demo login"
              description="If you only want to explore the app, use these demo values or log in with one click."
              email={suggestedPatientEmail}
              password={suggestedPatientPassword}
              actions={[
                { label: "Fill demo credentials", variant: "secondary", onClick: applyDemo },
                { label: "Quick demo login", onClick: handleDemoLogin },
              ]}
            />
          </div>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-600">Email</label>
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
                  onClick={() => setForm((current) => ({ ...current, email: suggestedPatientEmail }))}
                >
                  Suggestion: use demo email `{suggestedPatientEmail}`
                </button>
              ) : null}
              {status.fieldErrors.email ? (
                <p className="mt-2 text-sm text-red-600">{status.fieldErrors.email}</p>
              ) : null}
            </div>
            <div className="sm:col-span-2">
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
                  onClick={() => setForm((current) => ({ ...current, password: suggestedPatientPassword }))}
                >
                  Suggestion: use demo password `{suggestedPatientPassword}`
                </button>
              ) : null}
              {status.fieldErrors.password ? (
                <p className="mt-2 text-sm text-red-600">{status.fieldErrors.password}</p>
              ) : null}
            </div>
            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-600">Full name</label>
              <input className="field" name="full_name" value={form.full_name} onChange={handleChange} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-600">Phone</label>
              <input className="field" name="phone" value={form.phone} onChange={handleChange} />
              {status.fieldErrors.phone ? (
                <p className="mt-2 text-sm text-red-600">{status.fieldErrors.phone}</p>
              ) : null}
            </div>
            <div className="sm:col-span-2">
              <button type="submit" className="primary-button w-full">
                {status.loading ? "Signing in..." : "Continue as patient"}
              </button>
            </div>
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
