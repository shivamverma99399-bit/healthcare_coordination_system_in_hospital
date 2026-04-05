import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { loginPortal } from "../services/api";
import { persistSession } from "../utils/storage";


export default function PatientLoginPage({ session, onSessionChange }) {
  const navigate = useNavigate();
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
    const fieldErrors = {};
    const email = String(form.email || "").trim();
    const password = String(form.password || "");
    const phoneDigits = String(form.phone || "").replace(/\D/g, "");

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
        email: form.email,
        password: form.password,
        full_name: form.full_name,
        city: form.city,
        phone: form.phone,
        emergency_contact: form.emergency_contact,
      });
      persistSession(sessionData);
      onSessionChange(sessionData);
      navigate("/patient/dashboard");
    } catch (error) {
      setStatus({
        loading: false,
        error: error?.message || "Patient login failed. Please check your credentials.",
        fieldErrors: {},
      });
    }
  }

  return (
    <div className="section-shell pb-16 pt-10">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="glass-panel p-6">
          <p className="chip border-blue-200 bg-blue-50 text-blue-700">Patient Login</p>
          <h1 className="mt-4 font-display text-4xl font-bold tracking-tight">
            Secure sign-in and profile setup
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Use an existing patient account or create one by signing in with your details. The
            backend will store the patient profile, issue a token, and restore the same session on
            refresh.
          </p>
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            First sign-in creates a patient profile if this email does not exist yet. Existing
            patient accounts must use the original password.
          </div>
        </section>

        <section className="glass-panel p-6">
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-600">Email</label>
              <input
                className="field"
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
              />
              {status.fieldErrors.email ? (
                <p className="mt-2 text-sm text-red-600">{status.fieldErrors.email}</p>
              ) : null}
            </div>
            <div className="sm:col-span-2 md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-600">Password</label>
              <input
                className="field"
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                required
              />
              {status.fieldErrors.password ? (
                <p className="mt-2 text-sm text-red-600">{status.fieldErrors.password}</p>
              ) : null}
            </div>
            <div className="sm:col-span-2 md:col-span-2">
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
            <div className="sm:col-span-2 md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-600">Emergency contact</label>
              <input
                className="field"
                name="emergency_contact"
                value={form.emergency_contact}
                onChange={handleChange}
              />
            </div>
            <div className="sm:col-span-2 md:col-span-2">
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
