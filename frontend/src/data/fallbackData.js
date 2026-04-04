export const fallbackHospitals = [
  {
    id: 1,
    hospital_name: "City Hospital",
    distance: 2.5,
    beds_available: 12,
    icu_available: 3,
    ai_score: 92,
    ai_reason: "Closest hospital with ICU availability and solid general medicine coverage.",
    specialization: ["general_physician"],
    location: "Central Delhi",
    emergency_available: true,
  },
  {
    id: 2,
    hospital_name: "Pulse Specialty Center",
    distance: 4.8,
    beds_available: 7,
    icu_available: 1,
    ai_score: 87,
    ai_reason: "Balanced travel distance with specialist coverage for cardiology and urgent intake.",
    specialization: ["cardiologist"],
    location: "South Delhi",
    emergency_available: true,
  },
  {
    id: 3,
    hospital_name: "Care Axis Clinic",
    distance: 6.1,
    beds_available: 3,
    icu_available: 0,
    ai_score: 76,
    ai_reason: "Near-term appointment availability with moderate bed capacity for stable cases.",
    specialization: ["general_physician", "pulmonologist"],
    location: "Noida",
    emergency_available: false,
  },
];

export const fallbackDoctors = {
  1: [
    {
      id: 101,
      name: "Dr. Meera Rao",
      specialization: "General Physician",
      timing: "10:00 AM - 2:30 PM",
      available: true,
      time_slots: ["10:00 AM", "11:00 AM", "12:00 PM"],
    },
    {
      id: 102,
      name: "Dr. Arjun Sharma",
      specialization: "Cardiologist",
      timing: "11:00 AM - 4:30 PM",
      available: true,
      time_slots: ["11:00 AM", "1:00 PM", "3:00 PM"],
    },
  ],
  2: [
    {
      id: 201,
      name: "Dr. Kavya Nair",
      specialization: "Cardiologist",
      timing: "9:30 AM - 1:30 PM",
      available: true,
      time_slots: ["9:30 AM", "10:30 AM", "12:30 PM"],
    },
  ],
  3: [
    {
      id: 301,
      name: "Dr. Sana Khan",
      specialization: "Pulmonologist",
      timing: "10:00 AM - 1:00 PM",
      available: true,
      time_slots: ["10:00 AM", "11:30 AM"],
    },
  ],
};

export const fallbackDashboard = {
  stats: {
    hospital_count: 18,
    active_bookings: 24,
    emergency_ready: 9,
    active_sos_alerts: 2,
  },
  history: [
    {
      id: 1,
      patient_name: "Asha",
      hospital_name: "City Hospital",
      doctor_name: "Dr. Meera Rao",
      urgency: "normal",
      created_at: "2026-04-03T09:30:00Z",
    },
  ],
  alerts: [
    {
      id: 1,
      hospital_name: "Pulse Specialty Center",
      message: "ICU load rising rapidly in the next 30 minutes.",
      contact_name: "Ops Desk",
      status: "active",
      created_at: "2026-04-03T10:15:00Z",
    },
  ],
};
