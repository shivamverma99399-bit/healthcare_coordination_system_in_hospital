import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { loginPortal, registerHospitalAdmin } from "../services/api";
import { persistSession } from "../utils/storage";


function extractFieldErrors(error) {
  const payload = error?.payload;
  if (!payload || typeof payload !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(payload)
      .filter(([, value]) => Array.isArray(value) && value[0])
      .map(([key, value]) => [key, String(value[0])]),
  );
}


export default function AdminRegisterPage({ session, onSessionChange }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: "",
    password: "",
    phone: "",
    hospital_name: "",
    city: "Delhi",
  });
  const [status, setStatus] = useState({
    loading: false,
    error: "",
    success: "",
    fieldErrors: {},
  });

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
      success: "",
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
    const phone = String(form.phone || "").replace(/\D/g, "");
    const hospitalName = String(form.hospital_name || "").trim();
    const city = String(form.city || "").trim();

    if (!email.includes("@") || !email.includes(".")) {
      fieldErrors.email = "Enter a valid email address.";
    }
    if (password.trim().length < 8) {
      fieldErrors.password = "Password must be at least 8 characters.";
    }
    if (!phone) {
      fieldErrors.phone = "Phone is required.";
    }
    if (!hospitalName) {
      fieldErrors.hospital_name = "Hospital name is required.";
    }
    if (!city) {
      fieldErrors.city = "City is required.";
    }

    return fieldErrors;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const fieldErrors = validateForm();
    if (Object.keys(fieldErrors).length) {
      setStatus({ loading: false, error: "", success: "", fieldErrors });
      return;
    }

    setStatus({ loading: true, error: "", success: "", fieldErrors: {} });

    try {
      await registerHospitalAdmin({
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim(),
        hospital_name: form.hospital_name.trim(),
        city: form.city.trim(),
      });

      const sessionData = await loginPortal({
        role: "hospital_admin",
        email: form.email.trim(),
        password: form.password,
      });

      persistSession(sessionData);
      onSessionChange(sessionData);
      setStatus({
        loading: false,
        error: "",
        success: "Admin account created. Redirecting to your hospital portal...",
        fieldErrors: {},
      });
      navigate("/hospital-admin/portal");
    } catch (error) {
      setStatus({
        loading: false,
        error: error?.message || "Hospital admin signup failed. Please try again.",
        success: "",
        fieldErrors: extractFieldErrors(error),
      });
    }
  }

  return (
    <div className="section-shell pb-16 pt-10">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="glass-panel p-6">
          <p className="chip border-emerald-200 bg-emerald-50 text-emerald-700">Create Hospital Admin</p>
          <h1 className="mt-4 font-display text-4xl font-bold tracking-tight">
            Launch a hospital admin account from the frontend
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Create the admin user, attach a hospital, issue the backend token, and continue into
            the existing admin portal without changing the login API.
          </p>
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            First signup creates the hospital admin account and links the hospital to that admin.
            After that, the same credentials work through the existing admin login endpoint.
          </div>
          <div className="mt-6 rounded-[24px] border border-emerald-100 bg-emerald-50/70 p-5">
            <p className="text-sm font-semibold text-emerald-800">What happens on submit</p>
            <div className="mt-3 space-y-3 text-sm text-emerald-900/80">
              <div className="rounded-2xl bg-white/80 px-4 py-3">1. Create admin user and secure password hash</div>
              <div className="rounded-2xl bg-white/80 px-4 py-3">2. Create hospital profile and link it to that admin</div>
              <div className="rounded-2xl bg-white/80 px-4 py-3">3. Sign in through the existing `/api/auth/login` flow</div>
            </div>
          </div>
        </section>

        <section className="glass-panel p-6">
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
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
            <div className="md:col-span-2">
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
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-600">Phone</label>
              <input
                className="field"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                required
              />
              {status.fieldErrors.phone ? (
                <p className="mt-2 text-sm text-red-600">{status.fieldErrors.phone}</p>
              ) : null}
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-600">City</label>
              <input
                className="field"
                name="city"
                value={form.city}
                onChange={handleChange}
                required
              />
              {status.fieldErrors.city ? (
                <p className="mt-2 text-sm text-red-600">{status.fieldErrors.city}</p>
              ) : null}
            </div>
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-600">Hospital name</label>
              <input
                className="field"
                name="hospital_name"
                value={form.hospital_name}
                onChange={handleChange}
                required
              />
              {status.fieldErrors.hospital_name ? (
                <p className="mt-2 text-sm text-red-600">{status.fieldErrors.hospital_name}</p>
              ) : null}
            </div>
            <div className="md:col-span-2">
              <button type="submit" className="primary-button w-full" disabled={status.loading}>
                {status.loading ? "Creating admin account..." : "Create hospital admin"}
              </button>
            </div>
          </form>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <span>Already created an admin account?</span>
            <Link className="font-semibold text-brand-blue hover:underline" to="/login/admin">
              Sign in here
            </Link>
          </div>

          {status.success ? (
            <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
              {status.success}
            </div>
          ) : null}
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
