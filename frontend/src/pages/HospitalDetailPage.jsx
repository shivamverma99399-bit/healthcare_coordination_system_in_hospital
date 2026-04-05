import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";

import AIInsightBox from "../components/AIInsightBox";
import AvailabilityPanel from "../components/AvailabilityPanel";
import DoctorList from "../components/DoctorList";
import EmptyState from "../components/EmptyState";
import LoadingSkeleton from "../components/LoadingSkeleton";
import { bookAppointment, getDoctorsByHospital } from "../services/api";
import { getPersistedRecommendations } from "../utils/storage";
import { formatTag } from "../utils/hospital";


export default function HospitalDetailPage({ session }) {
  const { hospitalId } = useParams();
  const location = useLocation();
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [bookingForm, setBookingForm] = useState({
    patient_name: session?.profile?.full_name || "",
    phone: session?.profile?.phone || "",
    time: "",
  });
  const [bookingState, setBookingState] = useState({ loading: false, message: "", error: "" });

  const hospital = useMemo(() => {
    if (location.state?.hospital) {
      return location.state.hospital;
    }

    return getPersistedRecommendations().find((item) => String(item.id) === String(hospitalId));
  }, [hospitalId, location.state]);

  useEffect(() => {
    let ignore = false;

    async function loadDoctors() {
      if (!hospital) {
        setLoading(false);
        return;
      }

      setLoading(true);
      const specialization = hospital.specialization?.[0] || "";
      const data = await getDoctorsByHospital(hospital.id, specialization);

      if (!ignore) {
        setDoctors(data);
        setSelectedDoctor(data[0] || null);
        setBookingForm((current) => ({
          ...current,
          time: data[0]?.time_slots?.[0] || "",
        }));
        setLoading(false);
      }
    }

    loadDoctors();
    return () => {
      ignore = true;
    };
  }, [hospital]);

  function handleSelectDoctor(doctor) {
    setSelectedDoctor(doctor);
    setBookingForm((current) => ({
      ...current,
      time: doctor.time_slots?.[0] || "",
    }));
  }

  function handleBookingChange(event) {
    const { name, value } = event.target;
    setBookingForm((current) => ({ ...current, [name]: value }));
  }

  async function handleBookingSubmit(event) {
    event.preventDefault();
    if (!selectedDoctor) {
      return;
    }

    setBookingState({ loading: true, message: "", error: "" });

    try {
      const response = await bookAppointment({
        doctor_id: selectedDoctor.id,
        patient_name: bookingForm.patient_name,
        phone: bookingForm.phone,
        time: bookingForm.time,
        doctor_name: selectedDoctor.name,
        hospital_name: hospital.hospital_name,
        symptoms: location.state?.search?.symptoms || "",
        ai_summary: location.state?.analysis?.summary || "",
        recommended_specializations: location.state?.analysis?.tags || [],
        next_steps: (hospital.next_steps || []).join(" "),
        urgency: location.state?.search?.urgency || "normal",
      });

      setBookingState({
        loading: false,
        message: `Appointment ${response.status}. Token ${response.token_number} with ${selectedDoctor.name} at ${response.time}.`,
        error: "",
      });
      const refreshedDoctors = await getDoctorsByHospital(
        hospital.id,
        hospital.specialization?.[0] || "",
      );
      setDoctors(refreshedDoctors);
      const refreshedDoctor = refreshedDoctors.find((doctor) => doctor.id === selectedDoctor.id) || refreshedDoctors[0] || null;
      setSelectedDoctor(refreshedDoctor);
      setBookingForm((current) => ({
        ...current,
        time: refreshedDoctor?.time_slots?.[0] || "",
      }));
    } catch {
      setBookingState({
        loading: false,
        message: "",
        error: "Booking could not be completed. Please choose another slot.",
      });
    }
  }

  if (!hospital) {
    return (
      <div className="section-shell py-16">
        <EmptyState
          title="Hospital detail is unavailable"
          description="Return to the listing page and open a hospital from the latest recommendation results."
        />
      </div>
    );
  }

  return (
    <div className="section-shell pb-16 pt-10">
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <div className="glass-panel p-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="chip border-blue-200 bg-blue-50 text-blue-700">Hospital detail</span>
              <span className="chip">{hospital.distance} km away</span>
              <span className="chip">{hospital.beds_available} beds open</span>
            </div>
            <h1 className="mt-4 font-display text-4xl font-bold tracking-tight">
              {hospital.hospital_name}
            </h1>
            <p className="mt-3 text-base leading-7 text-slate-600">{hospital.location}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {hospital.specialization.map((tag) => (
                <span key={tag} className="chip">
                  {formatTag(tag)}
                </span>
              ))}
            </div>
          </div>

          <AIInsightBox hospital={hospital} />

          <div>
            <h2 className="mb-4 font-display text-3xl font-bold tracking-tight">Doctor list</h2>
            {loading ? <LoadingSkeleton cards={2} /> : null}
            {!loading && doctors.length ? (
              <DoctorList
                doctors={doctors}
                selectedDoctorId={selectedDoctor?.id}
                onSelectDoctor={handleSelectDoctor}
              />
            ) : null}
          </div>
        </div>

        <div className="space-y-6">
          <AvailabilityPanel
            doctor={selectedDoctor}
            bookingForm={bookingForm}
            onChange={handleBookingChange}
            onSubmit={handleBookingSubmit}
            bookingState={bookingState}
          />
        </div>
      </div>
    </div>
  );
}
