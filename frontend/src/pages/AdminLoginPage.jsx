import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";

import { loginPortal } from "../services/api";
import { persistSession } from "../utils/storage";


export default function AdminLoginPage({ session, onSessionChange }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
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

  function validateForm() {
    const fieldErrors = {};
    const email = String(form.email || "").trim();
    const password = String(form.password || "");

    if (!email.includes("@") || !email.includes(".")) {
      fieldErrors.email = "Enter a valid email address.";
    }
    if (!password.trim()) {
      fieldErrors.password = "Password is required.";
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
        role: "hospital_admin",
        email: form.email,
        password: form.password,
      });
      persistSession(sessionData);
      onSessionChange(sessionData);
      navigate("/hospital-admin/portal");
    } catch (error) {
      setStatus({
        loading: false,
        error: error?.message || "Hospital admin login failed. Please check your credentials.",
        fieldErrors: {},
      });
    }
  }

  return (
    <div className="section-shell pb-16 pt-10">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_1fr]">
        <section className="glass-panel p-6">
          <p className="chip border-amber-200 bg-amber-50 text-amber-700">Hospital Admin Login</p>
          <h1 className="mt-4 font-display text-4xl font-bold tracking-tight">
            Manage resources and inter-hospital coordination
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Admin access unlocks live resource controls, SOS review, patient-record updates,
            PDF sharing, analytics, and inter-hospital coordination.
          </p>
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            New hospitals can create an admin account from the frontend. Existing admins can sign
            in here and continue with token-backed hospital scope.
          </div>
          <div className="mt-5 rounded-[24px] border border-emerald-100 bg-emerald-50/70 p-5">
            <p className="text-sm font-semibold text-emerald-800">Need a new admin account?</p>
            <p className="mt-2 text-sm leading-6 text-emerald-900/80">
              Create the hospital admin first, then use this same login form anytime afterward.
            </p>
            <Link to="/register/admin" className="primary-button mt-4">
              Create hospital admin
            </Link>
          </div>
        </section>

        <section className="glass-panel p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-600">Admin email</label>
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
            <div>
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
