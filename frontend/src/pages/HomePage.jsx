import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import EmergencyButton from "../components/EmergencyButton";
import SearchBar from "../components/SearchBar";
import { getDemoAccounts } from "../services/api";


function FlowCard({ title, items, tone = "bg-white/80" }) {
  return (
    <div className={`rounded-[24px] border border-slate-200 ${tone} p-5`}>
      <p className="text-sm font-semibold text-slate-500">{title}</p>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div key={item} className="rounded-2xl bg-white p-3 text-sm text-slate-600">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function AssistantBubble({ role, children }) {
  const assistant = role === "assistant";

  return (
    <div className={["flex", assistant ? "justify-start" : "justify-end"].join(" ")}>
      <div
        className={[
          "max-w-[88%] rounded-[24px] px-4 py-3 text-sm leading-6 shadow-sm",
          assistant
            ? "border border-blue-100 bg-blue-50 text-slate-700"
            : "bg-brand-ink text-white",
        ].join(" ")}
      >
        {children}
      </div>
    </div>
  );
}


export default function HomePage({ session, patientMode = false }) {
  const navigate = useNavigate();
  const [demoAccounts, setDemoAccounts] = useState([]);
  const [form, setForm] = useState({
    symptoms: "",
    location: "Delhi",
    urgency: "normal",
  });

  useEffect(() => {
    if (!patientMode) {
      getDemoAccounts().then(setDemoAccounts).catch(() => setDemoAccounts([]));
    }
  }, [patientMode]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function handlePrompt(symptoms) {
    setForm((current) => ({ ...current, symptoms }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    const params = new URLSearchParams(form);
    navigate(`/patient/hospitals?${params.toString()}`);
  }

  function handleEmergency() {
    const params = new URLSearchParams({
      symptoms: form.symptoms || "severe pain and emergency support needed",
      location: form.location || "Delhi",
      urgency: "critical",
    });
    navigate(`/patient/hospitals?${params.toString()}`);
  }

  if (!patientMode) {
    const patientDemo = demoAccounts.find((item) => item.role === "patient");
    const adminDemos = demoAccounts.filter((item) => item.role === "hospital_admin");

    return (
      <div className="section-shell pb-16 pt-10 sm:pb-20 sm:pt-14">
        <section className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            
            <h1 className="mt-6 max-w-3xl font-display text-5xl font-bold tracking-tight text-slate-900 sm:text-6xl">
              Patient care routing and hospital coordination in one platform.
            </h1>
            
            <div className="mt-8 flex flex-wrap gap-4">
              <button type="button" className="primary-button" onClick={() => navigate("/login/patient")}>
                Patient Login
              </button>
              <button type="button" className="secondary-button" onClick={() => navigate("/login/admin")}>
                Hospital Admin Login
              </button>
            </div>
            {patientDemo ? (
              <div className="mt-6 rounded-[24px] border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
                Demo patient: {patientDemo.email} / {patientDemo.password}
              </div>
            ) : null}
          </div>

          <div className="glass-panel p-6">
            <h2 className="font-display text-3xl font-bold tracking-tight">Workflow Split</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <FlowCard
                title="Patient User"
                tone="bg-brand-cloud"
                items={[
                  "Login and profile setup",
                  "Symptoms + city + urgency entry",
                  "AI recommendation and ranking",
                  "Doctor / bed / ICU review",
                  "Book appointment, SOS, and dashboard",
                ]}
              />
              <FlowCard
                title="Hospital Admin"
                tone="bg-amber-50"
                items={[
                  "Secure admin login",
                  "Update doctors, beds, ICU, and emergency state",
                  "Manage SOS and patient records",
                  "Generate reports and analytics",
                  "Share with other hospitals for continuity of care",
                ]}
              />
            </div>
          </div>
        </section>

        
      </div>
    );
  }

  return (
    <div className="section-shell pb-16 pt-10 sm:pb-20 sm:pt-14">
      <section className="grid items-start gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="chip border-blue-200 bg-blue-50 text-blue-700">Patient workflow</p>
          <h1 className="mt-6 max-w-3xl font-display text-5xl font-bold tracking-tight text-slate-900 sm:text-6xl">
            Enter symptoms and let the AI route you to the best-fit hospital.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600">
            Logged in as {session?.display_name || "patient"}. The recommendation engine uses
            urgency, distance, beds, ICU, and doctor availability to rank care options.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <EmergencyButton onClick={handleEmergency} />
            <p className="text-sm text-slate-500">Use SOS for immediate escalation if the condition worsens.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="glass-panel overflow-hidden p-0">
            <div className="border-b border-slate-200 bg-white/80 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-blue text-sm font-bold text-white shadow-glow">
                  AI
                </div>
                <div>
                  <p className="font-display text-2xl font-bold tracking-tight text-slate-900">
                    MedPulse Assistant
                  </p>
                  <p className="text-sm text-slate-500">Live triage guide for symptom-based routing</p>
                </div>
              </div>
            </div>

            <div className="space-y-4 bg-gradient-to-b from-slate-50/80 to-white px-6 py-6">
              <AssistantBubble role="assistant">
                Tell me what you are feeling, where you are, and how urgent it seems. I will route
                you to the best-fit hospitals.
              </AssistantBubble>

              <AssistantBubble role="user">
                {form.symptoms?.trim()
                  ? form.symptoms
                  : "I need help finding the right hospital for my condition."}
              </AssistantBubble>

              <div className="flex flex-wrap gap-2">
                {[
                  "Chest pain and palpitations",
                  "High fever and weakness",
                  "Difficulty breathing since morning",
                ].map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    className="chip transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                    onClick={() => handlePrompt(prompt)}
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Start the conversation
                </p>
                <div className="space-y-3">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
                    Step 1: describe symptoms in plain language
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
                    Step 2: choose city and urgency
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
                    Step 3: get ranked hospitals, beds, ICU, and doctors
                  </div>
                </div>
              </div>

              <SearchBar
                values={form}
                onChange={handleChange}
                onSubmit={handleSubmit}
                submitLabel="Ask MedPulse AI"
                compact
                chatbot
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
