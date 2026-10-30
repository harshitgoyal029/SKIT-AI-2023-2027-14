import React, { useEffect, useMemo, useState } from "react";
import ShapChart from "../ShapChart";
import EcgAnalysis from "../EcgAnalysis";
import AIReport from "../AIReport";
import { apiRequest } from "../../services/api";

const DoctorDashboardView = ({ patient, currentUser }) => {
    const [doctorTab, setDoctorTab] = useState("diagnostic");

    // Real patients loaded from MongoDB (Point 4)
    const [realPatients, setRealPatients] = useState([]);
    const [selectedPatientId, setSelectedPatientId] = useState("");
    const [loadingPatients, setLoadingPatients] = useState(false);
    const [patientError, setPatientError] = useState("");
    const [explainability, setExplainability] = useState(null);
    const [assessmentLoading, setAssessmentLoading] = useState(false);
    const [assessmentError, setAssessmentError] = useState("");
    const [explanationRefresh, setExplanationRefresh] = useState(0);
    const [assessedCase, setAssessedCase] = useState(null);

    useEffect(() => {
        let active = true;
        const fetchCohort = async () => {
            setLoadingPatients(true);
            try {
                const data = await apiRequest("/api/patients?limit=50");
                if (!active) return;
                const patients = Array.isArray(data?.patients) ? data.patients : [];
                setRealPatients(patients);
                setSelectedPatientId((current) => current || patients[0]?.patientId || patients[0]?._id || patients[0]?.id || "");
            } catch (requestError) {
                if (active) setPatientError(requestError.message || "Patient cases could not be loaded.");
            } finally {
                if (active) setLoadingPatients(false);
            }
        };

        fetchCohort();
        return () => { active = false; };
    }, []);

    useEffect(() => {
        const patientId = patient?.patientId || patient?.patient_id || patient?._id || patient?.id;
        if (patientId) setSelectedPatientId((current) => current || patientId);
    }, [patient]);

    // Active patient resolution
    const activeCase = realPatients.find(
        (p) => (p.patientId || p.patient_id || p._id || p.id) === selectedPatientId
    ) || (assessedCase && (assessedCase.patientId || assessedCase.patient_id || assessedCase._id || assessedCase.id) === selectedPatientId
        ? assessedCase
        : patient);

    const activePatientId = activeCase?.patientId || activeCase?.patient_id || activeCase?._id || activeCase?.id;

    useEffect(() => {
        let active = true;
        setExplainability(null);
        if (!activePatientId) return () => { active = false; };
        apiRequest(`/api/patients/${encodeURIComponent(activePatientId)}/explainability`)
            .then((data) => { if (active) setExplainability(data); })
            .catch(() => { if (active) setExplainability(null); });
        return () => { active = false; };
    }, [activePatientId, explanationRefresh]);

    const handleAssessment = async () => {
        if (!activePatientId) return;
        setAssessmentLoading(true);
        setAssessmentError("");
        try {
            const result = await apiRequest(`/api/patients/${encodeURIComponent(activePatientId)}/assess`, { method: "POST" });
            setAssessedCase({ ...activeCase, ...result, riskLevel: result.risk_level });
            setRealPatients((current) => current.map((record) =>
                (record.patientId || record.patient_id || record._id || record.id) === activePatientId
                    ? { ...record, ...result, riskLevel: result.risk_level }
                    : record
            ));
            setExplanationRefresh((version) => version + 1);
        } catch (requestError) {
            setAssessmentError(requestError.message || "The model assessment could not be completed.");
        } finally {
            setAssessmentLoading(false);
        }
    };

    const doctorName = currentUser?.full_name || currentUser?.name || "Clinical team";
    const patientName = activeCase?.name || activeCase?.patientName || "No patient selected";
    const patientAge = activeCase?.age ?? "—";
    const patientGender = activeCase?.gender || activeCase?.sex || "—";
    const patientBp = activeCase?.bloodPressure || activeCase?.blood_pressure || "—";
    const patientChol = activeCase?.cholesterol ?? "—";
    const patientHr = activeCase?.heartRate ?? activeCase?.heart_rate ?? "—";

    // Real DNN risk score (Point 8)
    const riskScore = activeCase?.risk_score !== undefined && activeCase?.risk_score !== null
        ? Math.round(activeCase.risk_score * 100)
        : null;
    const hasRiskScore = riskScore !== null;

    const riskLevel = activeCase?.riskLevel || activeCase?.risk_level || "Pending assessment";
    const riskClass = riskLevel.toLowerCase().includes("high") ? "high"
        : riskLevel.toLowerCase().includes("moderate") ? "moderate"
            : riskLevel.toLowerCase().includes("low") ? "optimal" : "pending";
    const dashboardData = useMemo(() => ({
        assessment: {
            prediction: riskLevel,
            riskScore: riskScore ?? "--",
            model: activeCase?.model_name || "Cardiovascular Risk Model",
        },
        explainability: explainability ? {
            method: explainability.method || "SHAP",
            status: "Live",
            topFeatures: explainability.features || [],
        } : { method: "SHAP", status: "Unavailable", topFeatures: [] },
        ecg: null,
    }), [activeCase?.model_name, explainability, riskLevel, riskScore]);

    return (
        <div className="doctor-dashboard-container">
            {/* Doctor Portal Header */}
            <div className="doctor-hero-card">
                <div className="doctor-hero-left">
                    <div className="doctor-icon-box">🩺</div>
                    <div>
                        <div className="doctor-badge-row">
                            <span className="doctor-portal-tag">Cardiology Decision Support</span>
            <span className="doctor-license-tag">Clinical decision support</span>
                        </div>
                        <h2>{doctorName}</h2>
                        <p className="doctor-hero-sub">
                            Active Case Evaluation • AI-assisted risk prediction and explainability engine
                        </p>
                    </div>
                </div>

                <div className="doctor-case-badge">
                    <span className="case-title">ACTIVE PATIENT CASE</span>
                    <strong>{patientName}</strong>
                    <small>{patientAge} yrs • {patientGender} • BP {patientBp}</small>
                </div>
            </div>

            <div className="doctor-case-selector">
                {loadingPatients ? <span role="status">Loading patient cases…</span> : null}
                {patientError ? <span role="alert">{patientError}</span> : null}
                {!loadingPatients && !patientError && realPatients.length === 0 ? <span>No patient records are available yet.</span> : null}
                {realPatients.length > 0 && (
                    <>
                    <label className="doctor-case-selector-label" htmlFor="doctor-patient-case">Select patient case</label>
                        <select
                            id="doctor-patient-case"
                            value={selectedPatientId}
                            onChange={(e) => setSelectedPatientId(e.target.value)}
                        >
                            {realPatients.map((p) => {
                                const pId = p.patientId || p.patient_id || p._id || p.id;
                                const pRisk = p.riskLevel || p.risk_level || "Pending";
                                return (
                                    <option key={pId} value={pId}>
                                        {p.name || p.patientId || pId} ({p.age ?? "—"}y, {p.gender || p.sex || "—"}) — {pRisk} {p.risk_score != null ? `(${Math.round(p.risk_score * 100)}%)` : ""}
                                    </option>
                                );
                            })}
                        </select>
                        <span>{realPatients.length} patient case{realPatients.length === 1 ? "" : "s"}</span>
                    </>
                )}
            </div>

            {/* Doctor Navigation Subtabs */}
            <div className="doctor-subtabs-bar">
                <button
                    type="button"
                    className={`doctor-tab-btn ${doctorTab === "diagnostic" ? "active" : ""}`}
                    onClick={() => setDoctorTab("diagnostic")}
                >
                    📊 Diagnostic Risk & ECG
                </button>
                <button
                    type="button"
                    className={`doctor-tab-btn ${doctorTab === "explainability" ? "active" : ""}`}
                    onClick={() => setDoctorTab("explainability")}
                >
                    🔬 SHAP Explainability (XAI)
                </button>
                <button
                    type="button"
                    className={`doctor-tab-btn ${doctorTab === "report" ? "active" : ""}`}
                    onClick={() => setDoctorTab("report")}
                >
                    📄 Clinical Decision Report
                </button>
            </div>

            {/* Tab 1: Diagnostic Risk & ECG */}
            {doctorTab === "diagnostic" && (
                <div className="doctor-tab-content">
                    {/* Top Diagnostic Summary Grid */}
                    <div className="doctor-risk-grid">
                        <div className="doctor-card risk-gauge-card">
                            <span className="card-kicker">DNN PREDICTION ENGINE</span>
                            <h3>CVD Risk Stratification</h3>
                            <div className="gauge-display">
                                <div className="gauge-number">{hasRiskScore ? `${riskScore}%` : "—"}</div>
                                <div className="gauge-meta">
                                    <span className={`risk-level-badge ${riskClass}`}>
                                        ● {riskLevel}
                                    </span>
                                    <small>Model: {activeCase?.model_name || "not recorded"}</small>
                                </div>
                            </div>
                            {activeCase && (
                                <button type="button" className="secondary-btn doctor-assess-btn" onClick={handleAssessment} disabled={assessmentLoading}>
                                    {assessmentLoading ? "Running assessment…" : "Run model assessment"}
                                </button>
                            )}
                            {assessmentError && <p className="form-error" role="alert">{assessmentError}</p>}
                            <p className="gauge-explanation">
                                {hasRiskScore
                                    ? "Risk score from the stored patient assessment. Review source data and model details before clinical use."
                                    : "No model assessment is available for this patient yet."}
                            </p>
                        </div>

                        <div className="doctor-card clinical-vitals-card">
                            <span className="card-kicker">CLINICAL BIOMARKERS</span>
                            <h3>Baseline Laboratory Values</h3>
                            <div className="biomarkers-grid">
                                <div className="biomarker-item">
                                    <span className="bio-name">Systolic / Diastolic BP</span>
                                    <strong>{patientBp} mmHg</strong>
                                </div>

                                <div className="biomarker-item">
                                    <span className="bio-name">Total Cholesterol</span>
                                    <strong>{patientChol} mg/dL</strong>
                                </div>

                                <div className="biomarker-item">
                                    <span className="bio-name">Resting Heart Rate</span>
                                    <strong>{patientHr} BPM</strong>
                                </div>

                                <div className="biomarker-item">
                                    <span className="bio-name">Diabetes History</span>
                                    <strong>{activeCase?.diabetes ?? "—"}</strong>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ECG Analysis Component */}
                    <div className="doctor-card" style={{ marginTop: "24px" }}>
                        <EcgAnalysis ecg={dashboardData.ecg || { status: "No ECG data" }} />
                    </div>
                </div>
            )}

            {/* Tab 2: SHAP Explainability */}
            {doctorTab === "explainability" && (
                <div className="doctor-tab-content">
                    <div className="doctor-card">
                        <h3>SHAP (SHapley Additive exPlanations) Diagnostic Attribution</h3>
                        <p className="doctor-explainability-intro">
                            Stored feature attributions for the selected patient assessment, when available.
                        </p>
                        <ShapChart features={dashboardData.explainability.topFeatures} method={dashboardData.explainability.method} />
                    </div>
                </div>
            )}

            {/* Tab 3: Clinical Decision Report */}
            {doctorTab === "report" && (
                <div className="doctor-tab-content">
                    <div className="doctor-card">
                        <AIReport patient={activeCase} testData={dashboardData} />
                    </div>
                </div>
            )}
        </div>
    );
};

export default DoctorDashboardView;
// CVD-XAI clinician dashboard integration update
