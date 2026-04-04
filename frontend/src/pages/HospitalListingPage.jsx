import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import FilterSidebar from "../components/FilterSidebar";
import HospitalCard from "../components/HospitalCard";
import LoadingSkeleton from "../components/LoadingSkeleton";
import SearchBar from "../components/SearchBar";
import { analyzeSymptoms, getHospitalRecommendations } from "../services/api";
import { getSavedHospitals, persistRecommendations, toggleSavedHospital } from "../utils/storage";


export default function HospitalListingPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [analysis, setAnalysis] = useState(null);
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savedIds, setSavedIds] = useState(() => getSavedHospitals().map((item) => item.id));

  const formValues = useMemo(
    () => ({
      symptoms: searchParams.get("symptoms") || "",
      location: searchParams.get("location") || "Delhi",
      urgency: searchParams.get("urgency") || "normal",
    }),
    [searchParams],
  );

  const filters = useMemo(
    () => ({
      distance: searchParams.get("distance") || "10",
      icu: searchParams.get("icu") === "true",
      specialization: searchParams.get("specialization") || "",
    }),
    [searchParams],
  );

  const [draftForm, setDraftForm] = useState(formValues);

  useEffect(() => {
    setDraftForm(formValues);
  }, [formValues]);

  useEffect(() => {
    let ignore = false;

    async function loadData() {
      if (!formValues.symptoms.trim()) {
        setHospitals([]);
        setAnalysis(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      const hospitalPromise = getHospitalRecommendations({
        ...formValues,
        distance: filters.distance,
        icu: filters.icu,
        specialization: filters.specialization,
      });

      const analysisPromise = analyzeSymptoms(formValues).catch(() => null);

      try {
        const [analysisData, hospitalData] = await Promise.all([analysisPromise, hospitalPromise]);

        if (!ignore) {
          setAnalysis(analysisData);
          setHospitals(hospitalData);
          persistRecommendations(hospitalData);
        }
      } catch {
        if (!ignore) {
          setError("Unable to fetch AI recommendations right now.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadData();
    return () => {
      ignore = true;
    };
  }, [filters.distance, filters.icu, filters.specialization, formValues]);

  function updateSearch(nextValues) {
    const nextParams = new URLSearchParams({
      symptoms: nextValues.symptoms,
      location: nextValues.location,
      urgency: nextValues.urgency,
      distance: filters.distance,
    });
    if (filters.icu) {
      nextParams.set("icu", "true");
    }
    if (filters.specialization) {
      nextParams.set("specialization", filters.specialization);
    }
    setSearchParams(nextParams);
  }

  function handleFormChange(event) {
    const { name, value } = event.target;
    setDraftForm((current) => ({ ...current, [name]: value }));
  }

  function handleSearchSubmit(event) {
    event.preventDefault();
    updateSearch(draftForm);
  }

  function handleFilterChange(event) {
    const { name, value, type, checked } = event.target;
    const nextParams = new URLSearchParams(searchParams);
    const nextValue = type === "checkbox" ? checked : value;

    if (!nextValue || nextValue === false) {
      nextParams.delete(name);
    } else {
      nextParams.set(name, String(nextValue));
    }

    setSearchParams(nextParams);
  }

  function handleResetFilters() {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("distance");
    nextParams.delete("icu");
    nextParams.delete("specialization");
    setSearchParams(nextParams);
  }

  function handleSave(hospital) {
    const saved = toggleSavedHospital(hospital);
    setSavedIds(saved.map((item) => item.id));
  }

  function handleViewDetails(hospital) {
    navigate(`/patient/hospitals/${hospital.id}`, {
      state: {
        hospital,
        search: Object.fromEntries(searchParams.entries()),
        analysis,
      },
    });
  }

  return (
    <div className="section-shell pb-16 pt-10">
      <div className="flex flex-col gap-6">
        <div>
          <p className="chip">Core flow: symptoms to ranked care options</p>
          <h1 className="mt-4 font-display text-4xl font-bold tracking-tight">Hospital listing</h1>
        </div>

        <SearchBar
          values={draftForm}
          onChange={handleFormChange}
          onSubmit={handleSearchSubmit}
          submitLabel="Refresh recommendations"
          compact
        />

        {analysis ? (
          <div className="glass-panel p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="chip border-blue-200 bg-blue-50 text-blue-700">
                Severity: {analysis.severity}
              </span>
              <span className="chip border-amber-200 bg-amber-50 text-amber-700">
                Urgency: {analysis.urgency}
              </span>
              {analysis.tags.map((tag) => (
                <span key={tag} className="chip">
                  {tag.replaceAll("_", " ")}
                </span>
              ))}
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">{analysis.summary}</p>
            {analysis.next_steps?.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {analysis.next_steps.map((step) => (
                  <span key={step} className="chip">
                    {step}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[300px_1fr]">
          <FilterSidebar filters={filters} onChange={handleFilterChange} onReset={handleResetFilters} />

          <div>
            {loading ? <LoadingSkeleton cards={4} /> : null}

            {!loading && error ? (
              <ErrorState
                title="Recommendation service unavailable"
                description={error}
                action={
                  <button type="button" className="primary-button mt-6" onClick={() => window.location.reload()}>
                    Retry
                  </button>
                }
              />
            ) : null}

            {!loading && !error && !hospitals.length ? (
              <EmptyState
                title="No hospitals matched these filters"
                description="Try widening the distance radius, turning off ICU-only mode, or using a broader specialization."
              />
            ) : null}

            {!loading && !error && hospitals.length ? (
              <div className="grid gap-5 md:grid-cols-2">
                {hospitals.map((hospital) => (
                  <HospitalCard
                    key={hospital.id}
                    hospital={hospital}
                    isSaved={savedIds.includes(hospital.id)}
                    onSave={() => handleSave(hospital)}
                    onViewDetails={() => handleViewDetails(hospital)}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
