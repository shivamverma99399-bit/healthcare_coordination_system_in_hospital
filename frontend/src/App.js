import { useState } from "react";
import { API_BASE_URL } from "./config/api";

function App() {
  const [symptom, setSymptom] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/recommend/?lat=28.6&lng=77.2&symptom=${encodeURIComponent(symptom)}`
      );
      const data = await res.json();

      const formatted = (data.results || []).map((item, i) => ({
        id: i,
        name: item.hospital,
        score: item.score,
        reasons: item.reasons,
      }));

      setResults(formatted);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: 20, fontFamily: "Arial", background: "#0f172a", minHeight: "100vh", color: "white" }}>
      <h1 style={{ marginBottom: 20 }}>🏥 Nearby Healthcare Facilities</h1>

      <div style={{ marginBottom: 20 }}>
        <input
          value={symptom}
          onChange={(e) => setSymptom(e.target.value)}
          placeholder="Condition (e.g. chest pain)"
          style={{
            padding: 10,
            borderRadius: 8,
            border: "1px solid #333",
            marginRight: 10,
            width: 250
          }}
        />

        <button
          onClick={fetchData}
          style={{
            padding: 10,
            borderRadius: 8,
            background: "#2563eb",
            color: "white",
            border: "none",
            cursor: "pointer"
          }}
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      <div>
        {results.map((h) => (
          <div
            key={h.id}
            style={{
              background: "#1e293b",
              padding: 15,
              borderRadius: 10,
              marginBottom: 15,
              boxShadow: "0 2px 10px rgba(0,0,0,0.3)"
            }}
          >
            <h2>{h.name}</h2>
            <p><b>Score:</b> {h.score}</p>

            <p style={{ color: "#22c55e" }}><b>Why this hospital?</b></p>
            <ul>
              {h.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
