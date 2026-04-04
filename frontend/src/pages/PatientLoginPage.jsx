import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import DemoLoginSuggestion from "../components/DemoLoginSuggestion";
import { getDemoAccounts, loginPortal } from "../services/api";
import { persistSession } from "../utils/storage";


export default function PatientLoginPage({ session, onSessionChange }) {
  const navigate = useNavigate();
  const [demoAccount, setDemoAccount] = useState(null);
  const [focusedField, setFocusedField] = useState("");
  const [form, setForm] = useState({
    email: "",
    password: "",
    full_name: "",
    city: "Delhi",
    phone: "",
    emergency_contact: "",
  });
  const [status, setStatus] = useState({ loading: false, error: "", fieldErrors: {} });

  useEffect(() => {
    if (session?.role === "patient") {
      navigate("/patient/intake", { replace: true });
      return;
    }

    getDemoAccounts()
      .then((accounts) => setDemoAccount(accounts.find((item) => item.role === "patient") || null))
      .catch(() => setDemoAccount(null));
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
    const fieldErrors = {};
    const normalizedEmail = form.email.trim();
    const phoneDigits = form.phone.replace(/\D/g, "");

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      fieldErrors.email = "Enter a valid email address.";
    }
    if (phoneDigits.length !== 10) {
      fieldErrors.phone = "Mobile number must be exactly 10 digits.";
    }

    return fieldErrors;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const fieldErrors = validateForm();
    if (Object.keys(fieldErrors).length) {
      setStatus({ loading: false, error: "", fieldErrors });
      return;
    }

    setStatus({ loading: true, error: "", fieldErrors: {} });

    try {
      const sessionData = await loginPortal({
        role: "patient",
        ...form,
      });
      persistSession(sessionData);
      onSessionChange(sessionData);
      navigate("/patient/intake");
    } catch (error) {
      const normalizedEmail = form.email.trim().toLowerCase();
      if (demoAccount && normalizedEmail === demoAccount.email) {
        const sessionData = buildLocalDemoSession(form);
        persistSession(sessionData);
        onSessionChange(sessionData);
        navigate("/patient/intake");
        return;
      }

      setStatus({
        loading: false,
        error: error?.response?.data?.detail || "Patient login failed.",
        fieldErrors: error?.response?.data || {},
      });
    }
  }

  function applyDemo() {
    if (!demoAccount) {
      return;
    }

    setForm((current) => ({
      ...current,
      email: demoAccount.email,
      password: demoAccount.password,
      full_name: "Asha Verma",
      city: "Delhi",
      phone: "9999999999",
      emergency_contact: "Rohan Verma",
    }));
  }

  function buildLocalDemoSession(values) {
    const displayName =
      values.full_name?.trim() ||
      values.email.split("@", 1)[0].replace(/[._-]+/g, " ").trim() ||
      "Demo Patient";

    return {
      token: `demo-patient-${Date.now()}`,
      role: "patient",
      email: values.email,
      display_name: displayName,
      profile: {
        full_name: displayName,
        city: values.city || "Delhi",
        phone: values.phone || "9999999999",
        emergency_contact: values.emergency_contact || "Demo Emergency Contact",
      },
    };
  }

  async function handleDemoLogin() {
    if (!demoAccount) {
      return;
    }

    setStatus({ loading: true, error: "", fieldErrors: {} });

    try {
      const sessionData = await loginPortal({
        role: "patient",
        email: demoAccount.email,
        password: demoAccount.password,
        full_name: "Asha Verma",
        city: "Delhi",
        phone: "9999999999",
        emergency_contact: "Rohan Verma",
      });
      persistSession(sessionData);
      onSessionChange(sessionData);
      navigate("/patient/intake");
    } catch {
      const sessionData = buildLocalDemoSession({
        email: demoAccount.email,
        password: demoAccount.password,
        full_name: "Asha Verma",
        city: "Delhi",
        phone: "9999999999",
        emergency_contact: "Rohan Verma",
      });
      persistSession(sessionData);
      onSessionChange(sessionData);
      navigate("/patient/intake");
    }
  }

  const suggestedPatientEmail = demoAccount?.email || "patient@medpulse.local";
  const suggestedPatientPassword = demoAccount?.password || "patient123";

  return (
    <div className="section-shell pb-16 pt-10">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="glass-panel p-6">
          <p className="chip border-blue-200 bg-blue-50 text-blue-700">Patient Login</p>
          <h1 className="mt-4 font-display text-4xl font-bold tracking-tight">
            Secure sign-in and profile setup
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Use an existing patient account or create one by filling your name, city, and contact
            details. After login you will move straight into symptom intake and AI triage.
          </p>
          {demoAccount ? (
            <div className="mt-6">
              <DemoLoginSuggestion
                title="Demo patient login"
                description="Try the patient journey instantly with the preloaded demo account."
                email={demoAccount.email}
                password={demoAccount.password}
                actions={[
                  { label: "Use demo details", variant: "secondary", onClick: applyDemo },
                  { label: "Login as demo patient", onClick: handleDemoLogin },
                ]}
              />
            </div>
          ) : null}
        </section>

        <section className="glass-panel p-6">
          {demoAccount ? (
            <div className="mb-5">
              <DemoLoginSuggestion
                title="Suggested demo login"
                description="If you only want to explore the app, use these credentials or log in with one click."
                email={demoAccount.email}
                password={demoAccount.password}
                actions={[
                  { label: "Fill demo credentials", variant: "secondary", onClick: applyDemo },
                  { label: "Quick demo login", onClick: handleDemoLogin },
                ]}
              />
            </div>
          ) : null}
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
            </div>
            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-600">Full name</label>
              <input className="field" name="full_name" value={form.full_name} onChange={handleChange} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-600">City</label>
              <input className="field" name="city" value={form.city} onChange={handleChange} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-600">Phone</label>
              <input className="field" name="phone" value={form.phone} onChange={handleChange} />
              {status.fieldErrors.phone ? (
                <p className="mt-2 text-sm text-red-600">{status.fieldErrors.phone}</p>
              ) : null}
            </div>
            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-600">Emergency contact</label>
              <input
                className="field"
                name="emergency_contact"
                value={form.emergency_contact}
                onChange={handleChange}
              />
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
