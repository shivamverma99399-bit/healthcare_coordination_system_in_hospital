import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import DemoLoginSuggestion from "../components/DemoLoginSuggestion";
import { getDemoAccounts, loginPortal } from "../services/api";
import { persistSession } from "../utils/storage";

const fallbackAdminAccounts = [
  {
    email: "admin1@medpulse.local",
    password: "admin123",
    hospital_name: "Demo Hospital Admin",
    role: "hospital_admin",
  },
];


export default function AdminLoginPage({ session, onSessionChange }) {
  const navigate = useNavigate();
  const [demoAccounts, setDemoAccounts] = useState([]);
  const [focusedField, setFocusedField] = useState("");
  const [form, setForm] = useState({ email: "", password: "" });
  const [status, setStatus] = useState({ loading: false, error: "" });

  useEffect(() => {
    if (session?.role === "hospital_admin") {
      navigate("/hospital-admin/portal", { replace: true });
      return;
    }

    getDemoAccounts()
      .then((accounts) => {
        const adminAccounts = accounts.filter((item) => item.role === "hospital_admin");
        setDemoAccounts(adminAccounts.length ? adminAccounts : fallbackAdminAccounts);
      })
      .catch(() => setDemoAccounts(fallbackAdminAccounts));
  }, [navigate, session]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus({ loading: true, error: "" });

    try {
      const sessionData = await loginPortal({
        role: "hospital_admin",
        ...form,
      });
      persistSession(sessionData);
      onSessionChange(sessionData);
      navigate("/hospital-admin/portal");
    } catch (error) {
      const normalizedEmail = form.email.trim().toLowerCase();
      const matchedDemo =
        demoAccounts.find((account) => account.email === normalizedEmail) ||
        fallbackAdminAccounts.find((account) => account.email === normalizedEmail);

      if (matchedDemo && form.password === matchedDemo.password) {
        const sessionData = buildLocalAdminSession(matchedDemo, form);
        persistSession(sessionData);
        onSessionChange(sessionData);
        navigate("/hospital-admin/portal");
        return;
      }

      setStatus({
        loading: false,
        error: error?.response?.data?.detail || "Hospital admin login failed.",
      });
    }
  }

  function useDemo(account) {
    setForm({ email: account.email, password: account.password });
  }

  function buildLocalAdminSession(account, values) {
    const resolvedAccount = account || suggestedAdminAccount || fallbackAdminAccounts[0];
    const email = values?.email || resolvedAccount.email;

    return {
      token: `demo-admin-${Date.now()}`,
      role: "hospital_admin",
      email,
      display_name: "Admin 1",
      profile: {
        name: "Admin 1",
        admin_id: "ADM-DEMO",
        title: "Hospital Operations Admin",
        hospital: {
          id: 1,
          name: resolvedAccount.hospital_name || "Demo Hospital",
          location: "Delhi",
        },
      },
    };
  }

  async function handleDemoLogin(account) {
    if (!account) {
      return;
    }

    setStatus({ loading: true, error: "" });

    try {
      const sessionData = await loginPortal({
        role: "hospital_admin",
        email: account.email,
        password: account.password,
      });
      persistSession(sessionData);
      onSessionChange(sessionData);
      navigate("/hospital-admin/portal");
    } catch {
      const sessionData = buildLocalAdminSession(account, {
        email: account.email,
        password: account.password,
      });
      persistSession(sessionData);
      onSessionChange(sessionData);
      navigate("/hospital-admin/portal");
    }
  }

  const suggestedAdminAccount =
    demoAccounts.find((account) => account.email === form.email) || demoAccounts[0] || fallbackAdminAccounts[0];

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
            {demoAccounts.map((account) => (
              <DemoLoginSuggestion
                key={account.email}
                title={account.hospital_name}
                description="Use this demo admin account to open the hospital coordination portal."
                email={account.email}
                password={account.password}
                actions={[
                  { label: "Use demo details", variant: "secondary", onClick: () => useDemo(account) },
                  { label: "Login as admin", onClick: () => handleDemoLogin(account) },
                ]}
              />
            ))}
          </div>
        </section>

        <section className="glass-panel p-6">
          {demoAccounts[0] ? (
            <div className="mb-5">
              <DemoLoginSuggestion
                title="Suggested demo admin login"
                description={`Quickest way to explore the admin workflow for ${demoAccounts[0].hospital_name}.`}
                email={demoAccounts[0].email}
                password={demoAccounts[0].password}
                actions={[
                  { label: "Fill demo credentials", variant: "secondary", onClick: () => useDemo(demoAccounts[0]) },
                  { label: "Quick demo login", onClick: () => handleDemoLogin(demoAccounts[0]) },
                ]}
              />
            </div>
          ) : null}
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
              {focusedField === "email" && suggestedAdminAccount ? (
                <button
                  type="button"
                  className="mt-2 text-sm text-brand-blue"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => setForm((current) => ({ ...current, email: suggestedAdminAccount.email }))}
                >
                  Suggestion: use demo email `{suggestedAdminAccount.email}`
                </button>
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
              {focusedField === "password" && suggestedAdminAccount ? (
                <button
                  type="button"
                  className="mt-2 text-sm text-brand-blue"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => setForm((current) => ({ ...current, password: suggestedAdminAccount.password }))}
                >
                  Suggestion: use demo password `{suggestedAdminAccount.password}`
                </button>
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
