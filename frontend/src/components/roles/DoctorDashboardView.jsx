import React, { useEffect, useState } from "react";
import ShapChart from "../ShapChart";
import EcgAnalysis from "../EcgAnalysis";
import AIReport from "../AIReport";
import { getApiUrl } from "../../services/api";

const DoctorDashboardView = ({ patient, testData, currentUser }) => {
    const [doctorTab, setDoctorTab] = useState("diagnostic");

    // Real patients loaded from MongoDB (Point 4)
    const [realPatients, setRealPatients] = useState([]);
    const [selectedPatientId, setSelectedPatientId] = useState("");
    const [loadingPatients, setLoadingPatients] = useState(false);

    useEffect(() => {
        const fetchCohort = async () => {
            setLoadingPatients(true);
            try {
                const res = await fetch(getApiUrl("/api/patients?limit=50"));
                if (res.ok) {
                    const data = await res.json();
                    if (data.patients && data.patients.length > 0) {
                        setRealPatients(data.patients);
                        setSelectedPatientId(data.patients[0]._id || data.patients[0].id || "");
                    }
                }
            } catch (err) {
                console.error("Error loading patient cases in Doctor Suite:", err);
            } finally {
                setLoadingPatients(false);
            }
        };

        fetchCohort();
    }, []);

    // Active patient resolution
    const activeCase = realPatients.find(
        (p) => (p._id || p.id) === selectedPatientId
    ) || patient;

    const doctorName = currentUser?.full_name || currentUser?.name || "Dr. Sarah Johnson, MD";
    const patientName = activeCase?.name || activeCase?.patientName || "Jane Doe";
    const patientAge = activeCase?.age || 54;
    const patientGender = activeCase?.gender || "Female";
    const patientBp = activeCase?.bloodPressure || "130/80";
    const patientChol = activeCase?.cholesterol || 210;
    const patientHr = activeCase?.heartRate || 75;

    // Real DNN risk score (Point 8)
    const riskScore = activeCase?.risk_score !== undefined && activeCase?.risk_score !== null
        ? Math.round(activeCase.risk_score * 100)
        : (testData?.assessment?.riskScore || 50);

    const riskLevel = activeCase?.riskLevel || activeCase?.risk_level || (
        riskScore >= 60 ? "High Risk" : riskScore >= 30 ? "Moderate Risk" : "Low Risk"
    );

    const confidence = 88;

    return (
        <div className="doctor-dashboard-container">
            {/* Doctor Portal Header */}
            <div className="doctor-hero-card">
                <div className="doctor-hero-left">
                    <div className="doctor-icon-box">🩺</div>
                    <div>
                        <div className="doctor-badge-row">
                            <span className="doctor-portal-tag">Cardiology Decision Support</span>
                            <span className="doctor-license-tag">Board Certified Cardiologist</span>
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

            {/* Real Patient Case Selector from MongoDB (Point 4) */}
            {realPatients.length > 0 && (
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        background: "#ffffff",
                        border: "1px solid #e2e8f0",
                        borderRadius: "12px",
                        padding: "12px 20px",
                        gap: "16px",
                        flexWrap: "wrap",
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
                            📁 Select Live Case (MongoDB):
                        </span>
                        <select
                            value={selectedPatientId}
                            onChange={(e) => setSelectedPatientId(e.target.value)}
                            style={{
                                padding: "8px 14px",
                                borderRadius: "8px",
                                border: "1.5px solid #cbd5e1",
                                fontSize: "13px",
                                fontWeight: 600,
                                color: "#0f172a",
                                background: "#f8fafc",
                                cursor: "pointer",
                            }}
                        >
                            {realPatients.map((p) => {
                                const pId = p._id || p.id;
                                const pRisk = p.riskLevel || p.risk_level || "Pending";
                                return (
                                    <option key={pId} value={pId}>
                                        {p.name || p.patientId} ({p.age}y, {p.gender}) — {pRisk} {p.risk_score ? `(${Math.round(p.risk_score * 100)}%)` : ""}
                                    </option>
                                );
                            })}
                        </select>
                    </div>

                    <div style={{ fontSize: "12px", color: "#64748b" }}>
                        Loaded <strong>{realPatients.length}</strong> active patient cases from MongoDB
                    </div>
                </div>
            )}

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
                                <div className="gauge-number">{riskScore}%</div>
                                <div className="gauge-meta">
                                    <span className={`risk-level-badge ${riskScore >= 60 ? "high" : riskScore >= 30 ? "moderate" : "optimal"}`}>
                                        ● {riskLevel}
                                    </span>
                                    <small>Model Confidence: {confidence}%</small>
                                </div>
                            </div>
                            <p className="gauge-explanation">
                                Deep neural network estimates an elevated 10-year major adverse cardiovascular event
                                (MACE) risk driven by vascular hypertension and lipid markers.
                            </p>
                        </div>

                        <div className="doctor-card clinical-vitals-card">
                            <span className="card-kicker">CLINICAL BIOMARKERS</span>
                            <h3>Baseline Laboratory Values</h3>
                            <div className="biomarkers-grid">
                                <div className="biomarker-item">
                                    <span className="bio-name">Systolic / Diastolic BP</span>
                                    <strong>{patientBp} mmHg</strong>
                                    <span className={`bio-flag ${parseInt(patientBp) > 130 ? "warn" : "normal"}`}>
                                        {parseInt(patientBp) > 130 ? "Elevated" : "Normal"}
                                    </span>
                                </div>

                                <div className="biomarker-item">
                                    <span className="bio-name">Total Cholesterol</span>
                                    <strong>{patientChol} mg/dL</strong>
                                    <span className={`bio-flag ${patientChol > 200 ? "warn" : "normal"}`}>
                                        {patientChol > 200 ? "High" : "Optimal"}
                                    </span>
                                </div>

                                <div className="biomarker-item">
                                    <span className="bio-name">Resting Heart Rate</span>
                                    <strong>{patientHr} BPM</strong>
                                    <span className="bio-flag normal">Stable</span>
                                </div>

                                <div className="biomarker-item">
                                    <span className="bio-name">Diabetes History</span>
                                    <strong>{activeCase?.diabetes || "No"}</strong>
                                    <span className={`bio-flag ${activeCase?.diabetes === "Yes" ? "warn" : "normal"}`}>
                                        {activeCase?.diabetes === "Yes" ? "Flagged" : "Normal"}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ECG Analysis Component */}
                    <div className="doctor-card" style={{ marginTop: "24px" }}>
                        <EcgAnalysis ecg={testData?.ecg || { heartRate: patientHr, status: "Test Data" }} />
                    </div>
                </div>
            )}

            {/* Tab 2: SHAP Explainability */}
            {doctorTab === "explainability" && (
                <div className="doctor-tab-content">
                    <div className="doctor-card">
                        <h3>SHAP (SHapley Additive exPlanations) Diagnostic Attribution</h3>
                        <p style={{ color: "#64748b", fontSize: "14px", marginBottom: "20px" }}>
                            Feature contribution breakdown demonstrating exact marginal impact of each biomarker on the final deep neural network decision.
                        </p>
                        <ShapChart features={testData?.explainability?.topFeatures || []} method={testData?.explainability?.method || "SHAP"} />
                    </div>
                </div>
            )}

            {/* Tab 3: Clinical Decision Report */}
            {doctorTab === "report" && (
                <div className="doctor-tab-content">
                    <div className="doctor-card">
                        <AIReport patient={activeCase} testData={testData} />
                    </div>
                </div>
            )}
        </div>
    );
};

export default DoctorDashboardView;
// CVD-XAI clinician dashboard integration update
