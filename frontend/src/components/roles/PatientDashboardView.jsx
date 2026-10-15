import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getApiUrl } from "../../services/api";

const PatientDashboardView = ({ patient, currentUser }) => {
    // Sub-tab navigation: "overview", "results", or "entry" (Point 6 & Point 5)
    const [patientTab, setPatientTab] = useState("overview");

    // Real data from MongoDB (Point 4)
    const [clinicalRecords, setClinicalRecords] = useState([]);
    const [ecgRecords, setEcgRecords] = useState([]);
    const [predictions, setPredictions] = useState([]);
    const [loadingData, setLoadingData] = useState(true);

    // 2-Step data entry workflow state (Point 5)
    const [entryStep, setEntryStep] = useState(1);
    const [clinicalForm, setClinicalForm] = useState({
        age: "52",
        sex: "M",
        chest_pain_type: "ASY",
        resting_bp: "135",
        cholesterol: "230",
        fasting_blood_sugar: false,
        resting_ecg: "Normal",
        max_heart_rate: "148",
        exercise_angina: false,
        st_depression: "0.5",
        st_slope: "Flat",
    });
    const [selectedEcgFile, setSelectedEcgFile] = useState(null);
    const [submittingStep, setSubmittingStep] = useState(false);
    const [stepSuccessMsg, setStepSuccessMsg] = useState("");
    const [stepErrorMsg, setStepErrorMsg] = useState("");

    // Message triage modal (Point 7)
    const [showContactModal, setShowContactModal] = useState(false);
    const [triageMsgSent, setTriageMsgSent] = useState(false);

    const token = localStorage.getItem("cvd_xai_access_token") || localStorage.getItem("cvd_token");

    // Fetch real patient data from MongoDB
    const fetchPatientData = async () => {
        if (!token) {
            setLoadingData(false);
            return;
        }

        try {
            setLoadingData(true);
            const headers = { Authorization: `Bearer ${token}` };

            const [clinRes, ecgRes, predRes] = await Promise.all([
                fetch(getApiUrl("/api/data/clinical"), { headers }).catch(() => null),
                fetch(getApiUrl("/api/data/ecg"), { headers }).catch(() => null),
                fetch(getApiUrl("/api/predict/history"), { headers }).catch(() => null),
            ]);

            if (clinRes && clinRes.ok) {
                const data = await clinRes.json();
                setClinicalRecords(Array.isArray(data) ? data : []);
            }
            if (ecgRes && ecgRes.ok) {
                const data = await ecgRes.json();
                setEcgRecords(Array.isArray(data) ? data : []);
            }
            if (predRes && predRes.ok) {
                const data = await predRes.json();
                setPredictions(Array.isArray(data) ? data : []);
            }
        } catch (err) {
            console.error("Error fetching patient records:", err);
        } finally {
            setLoadingData(false);
        }
    };

    useEffect(() => {
        fetchPatientData();
    }, [token]);

    // Latest real record from MongoDB
    const latestClinical = clinicalRecords.length > 0 ? clinicalRecords[0] : null;
    const latestEcg = ecgRecords.length > 0 ? ecgRecords[0] : null;
    const latestPrediction = predictions.length > 0 ? predictions[0] : null;

    // Patient display details
    const patientDisplayName = currentUser?.full_name || currentUser?.name || patient?.name || "Jane Doe (Patient)";
    const patientDisplayEmail = currentUser?.email || patient?.email || "patient@cardioxai.org";

    // Computed risk score from real DNN model (Point 8)
    const riskScorePercent = latestPrediction
        ? Math.round(latestPrediction.risk_score * 100)
        : null;

    const riskLevelLabel = latestPrediction
        ? latestPrediction.risk_level || (riskScorePercent >= 60 ? "High Risk" : riskScorePercent >= 30 ? "Moderate Risk" : "Low Risk")
        : (latestClinical ? "Assessment Ready" : "Awaiting Data Upload");

    // Handle 2-Step Form submission
    const handleClinicalStepSubmit = async (e) => {
        e.preventDefault();
        setStepErrorMsg("");
        setStepSuccessMsg("");

        if (!token) {
            setStepErrorMsg("Please sign in to save clinical records.");
            return;
        }

        setSubmittingStep(true);
        try {
            const payload = {
                age: Number(clinicalForm.age),
                sex: clinicalForm.sex,
                chest_pain_type: clinicalForm.chest_pain_type,
                resting_bp: Number(clinicalForm.resting_bp),
                cholesterol: Number(clinicalForm.cholesterol),
                fasting_blood_sugar: Boolean(clinicalForm.fasting_blood_sugar),
                resting_ecg: clinicalForm.resting_ecg,
                max_heart_rate: clinicalForm.max_heart_rate ? Number(clinicalForm.max_heart_rate) : null,
                exercise_angina: Boolean(clinicalForm.exercise_angina),
                st_depression: Number(clinicalForm.st_depression) || 0.0,
                st_slope: clinicalForm.st_slope,
            };

            const res = await fetch(getApiUrl("/api/data/clinical"), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData?.detail || "Failed to save clinical vitals.");
            }

            setStepSuccessMsg("✓ Step 1 Complete: Clinical vitals saved to MongoDB! Proceeding to Step 2...");
            await fetchPatientData();
            setTimeout(() => {
                setEntryStep(2);
                setStepSuccessMsg("");
            }, 1000);
        } catch (err) {
            setStepErrorMsg(err.message || "Failed to submit clinical vitals.");
        } finally {
            setSubmittingStep(false);
        }
    };

    const handleEcgStepSubmit = async (e) => {
        e.preventDefault();
        setStepErrorMsg("");
        setStepSuccessMsg("");

        if (!token) {
            setStepErrorMsg("Please sign in to upload ECG files.");
            return;
        }

        if (!selectedEcgFile) {
            setStepErrorMsg("Please choose an ECG file (.csv, .dat, .hea, .txt, or .pdf).");
            return;
        }

        setSubmittingStep(true);
        try {
            const formData = new FormData();
            formData.append("file", selectedEcgFile);
            formData.append("sampling_rate_hz", 500);
            formData.append("lead_count", 12);

            const res = await fetch(getApiUrl("/api/data/ecg"), {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData?.detail || "Failed to upload ECG file.");
            }

            setStepSuccessMsg("✓ Step 2 Complete: ECG recording registered & AI DNN inference complete!");
            setSelectedEcgFile(null);
            await fetchPatientData();
            setTimeout(() => {
                setPatientTab("results");
                setEntryStep(1);
                setStepSuccessMsg("");
            }, 1200);
        } catch (err) {
            setStepErrorMsg(err.message || "Failed to upload ECG file.");
        } finally {
            setSubmittingStep(false);
        }
    };

    const handlePrintSummary = () => {
        window.print();
    };

    return (
        <div className="patient-dashboard-container">
            {/* Patient Hero Welcome Card */}
            <div className="patient-hero-card">
                <div className="patient-hero-main">
                    <div className="patient-avatar-box">🫀</div>
                    <div>
                        <div className="patient-badge-row">
                            <span className="patient-portal-tag">Patient Cardiovascular Portal</span>
                            <span className={`patient-status-pill ${riskScorePercent !== null && riskScorePercent < 40 ? "green" : "warn"}`}>
                                ● {latestPrediction ? `AI Risk: ${riskLevelLabel}` : (latestClinical ? "Vitals Stored" : "New Patient")}
                            </span>
                        </div>
                        <h2>Welcome back, {patientDisplayName}</h2>
                        <p className="patient-hero-sub">
                            Your personalized heart health summary, AI cardiovascular risk assessments, and daily care guidance.
                        </p>
                    </div>
                </div>

                <div className="patient-hero-actions">
                    <button
                        type="button"
                        className="patient-btn primary"
                        onClick={() => {
                            setPatientTab("entry");
                            setEntryStep(1);
                        }}
                    >
                        ＋ 2-Step Data Entry
                    </button>
                    <button
                        type="button"
                        className="patient-btn outline"
                        onClick={handlePrintSummary}
                    >
                        📄 Download / Print Summary
                    </button>
                    <button
                        type="button"
                        className="patient-btn outline"
                        onClick={() => setShowContactModal(true)}
                    >
                        🩺 Message Care Team
                    </button>
                </div>
            </div>

            {/* Health Status Banner with Strictly Unassigned Cardiologist (Point 7) */}
            <div className="patient-status-banner">
                <div className="status-banner-left">
                    <span
                        className="status-icon"
                        style={{
                            background: latestPrediction
                                ? (riskScorePercent >= 60 ? "#ef4444" : riskScorePercent >= 30 ? "#f59e0b" : "#22c55e")
                                : "#0284c7",
                        }}
                    >
                        {latestPrediction ? (riskScorePercent >= 60 ? "!" : "✓") : "i"}
                    </span>
                    <div>
                        <strong>
                            {latestPrediction
                                ? `Cardiovascular Risk Score: ${riskScorePercent}% — ${riskLevelLabel}`
                                : latestClinical
                                ? "Clinical Vitals Recorded — Assessment Ready"
                                : "Welcome to CardioXAI — Please Record Your Vitals"}
                        </strong>
                        <p>
                            {latestPrediction
                                ? `Evaluated by trained deep neural network (DNN). Based on systolic BP ${latestClinical?.resting_bp || 120} mmHg and cholesterol ${latestClinical?.cholesterol || 200} mg/dL.`
                                : latestClinical
                                ? "Your vitals are stored in MongoDB. Complete Step 2 or click 'My Results' to view your AI assessment."
                                : "No clinical measurements found yet. Use the 2-Step Data Entry below to record your blood pressure, cholesterol, and ECG."}
                        </p>
                    </div>
                </div>

                {/* Point 7: Attending Cardiologist Unassigned (Under Review) */}
                <div className="status-banner-careteam">
                    <small>Attending Cardiologist</small>
                    <strong style={{ color: "#b45309" }}>Unassigned (Under Review)</strong>
                    <div style={{ fontSize: "11px", color: "#64748b" }}>Case queued in clinical triage</div>
                </div>
            </div>

            {/* Sub-Tab Navigation (Point 6: Dedicated Results Tab) */}
            <div style={{ display: "flex", gap: "10px", borderBottom: "2px solid #e2e8f0", paddingBottom: "10px", marginTop: "10px" }}>
                <button
                    type="button"
                    style={{
                        padding: "9px 20px",
                        borderRadius: "8px",
                        fontWeight: 600,
                        fontSize: "14px",
                        cursor: "pointer",
                        border: "none",
                        background: patientTab === "overview" ? "#0284c7" : "#f1f5f9",
                        color: patientTab === "overview" ? "#ffffff" : "#475569",
                        transition: "all 0.2s ease",
                    }}
                    onClick={() => setPatientTab("overview")}
                >
                    🫀 My Heart Overview
                </button>
                <button
                    type="button"
                    style={{
                        padding: "9px 20px",
                        borderRadius: "8px",
                        fontWeight: 600,
                        fontSize: "14px",
                        cursor: "pointer",
                        border: "none",
                        background: patientTab === "results" ? "#0284c7" : "#f1f5f9",
                        color: patientTab === "results" ? "#ffffff" : "#475569",
                        transition: "all 0.2s ease",
                    }}
                    onClick={() => setPatientTab("results")}
                >
                    🎯 My Results & Risk Assessment {latestPrediction && "●"}
                </button>
                <button
                    type="button"
                    style={{
                        padding: "9px 20px",
                        borderRadius: "8px",
                        fontWeight: 600,
                        fontSize: "14px",
                        cursor: "pointer",
                        border: "none",
                        background: patientTab === "entry" ? "#0284c7" : "#f1f5f9",
                        color: patientTab === "entry" ? "#ffffff" : "#475569",
                        transition: "all 0.2s ease",
                    }}
                    onClick={() => setPatientTab("entry")}
                >
                    📝 2-Step Data Entry & Upload
                </button>
            </div>

            {/* ========================================================================= */}
            {/* TAB 1: MY HEART OVERVIEW                                                  */}
            {/* ========================================================================= */}
            {patientTab === "overview" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
                    {/* Onboarding State if no real records yet in MongoDB (Point 4) */}
                    {!latestClinical && !loadingData && (
                        <div style={{ background: "#ffffff", border: "1.5px dashed #0284c7", borderRadius: "16px", padding: "36px", textAlign: "center" }}>
                            <div style={{ fontSize: "44px", marginBottom: "12px" }}>📋</div>
                            <h3 style={{ margin: "0 0 8px", color: "#0f172a" }}>No Clinical Vitals or ECG Uploaded Yet</h3>
                            <p style={{ margin: "0 auto 20px", color: "#64748b", maxWidth: "560px", fontSize: "14px" }}>
                                To calculate your personalized cardiovascular risk score using our trained deep neural network (DNN), please complete the quick 2-step onboarding below.
                            </p>
                            <button
                                type="button"
                                className="patient-btn primary"
                                style={{ fontSize: "14px", padding: "12px 24px" }}
                                onClick={() => {
                                    setPatientTab("entry");
                                    setEntryStep(1);
                                }}
                            >
                                Start 2-Step Data Entry Now →
                            </button>
                        </div>
                    )}

                    {/* Real Vitals Grid from MongoDB (Point 4) */}
                    {latestClinical && (
                        <>
                            <div className="patient-section-header">
                                <h3>My Latest Clinical Measurements</h3>
                                <span className="last-sync-badge">
                                    Saved in MongoDB: {new Date(latestClinical.recorded_at).toLocaleDateString()}
                                </span>
                            </div>

                            <div className="patient-vitals-grid">
                                <div className="patient-vital-card">
                                    <div className="vital-card-top">
                                        <span className="vital-label">Resting Blood Pressure</span>
                                        <span className={`vital-tag ${latestClinical.resting_bp > 130 ? "warn" : "optimal"}`}>
                                            {latestClinical.resting_bp > 130 ? "Elevated" : "Normal"}
                                        </span>
                                    </div>
                                    <div className="vital-value-row">
                                        <span className="vital-num">{latestClinical.resting_bp}</span>
                                        <span className="vital-unit">mmHg</span>
                                    </div>
                                    <div className="vital-range-bar">
                                        <div
                                            className={`range-fill ${latestClinical.resting_bp > 130 ? "warn" : "optimal"}`}
                                            style={{ width: `${Math.min(100, (latestClinical.resting_bp / 180) * 100)}%` }}
                                        ></div>
                                    </div>
                                    <small className="vital-target">Target: &lt; 120 mmHg</small>
                                </div>

                                <div className="patient-vital-card">
                                    <div className="vital-card-top">
                                        <span className="vital-label">Total Cholesterol</span>
                                        <span className={`vital-tag ${latestClinical.cholesterol > 200 ? "warn" : "optimal"}`}>
                                            {latestClinical.cholesterol > 200 ? "Borderline / High" : "Desirable"}
                                        </span>
                                    </div>
                                    <div className="vital-value-row">
                                        <span className="vital-num">{latestClinical.cholesterol}</span>
                                        <span className="vital-unit">mg/dL</span>
                                    </div>
                                    <div className="vital-range-bar">
                                        <div
                                            className={`range-fill ${latestClinical.cholesterol > 200 ? "warn" : "optimal"}`}
                                            style={{ width: `${Math.min(100, (latestClinical.cholesterol / 300) * 100)}%` }}
                                        ></div>
                                    </div>
                                    <small className="vital-target">Target: &lt; 200 mg/dL</small>
                                </div>

                                <div className="patient-vital-card">
                                    <div className="vital-card-top">
                                        <span className="vital-label">Max Heart Rate</span>
                                        <span className="vital-tag optimal">Recorded</span>
                                    </div>
                                    <div className="vital-value-row">
                                        <span className="vital-num">{latestClinical.max_heart_rate || "--"}</span>
                                        <span className="vital-unit">BPM</span>
                                    </div>
                                    <div className="vital-range-bar">
                                        <div className="range-fill optimal" style={{ width: "65%" }}></div>
                                    </div>
                                    <small className="vital-target">Target: 60 - 150 BPM</small>
                                </div>

                                <div className="patient-vital-card">
                                    <div className="vital-card-top">
                                        <span className="vital-label">Fasting Blood Sugar</span>
                                        <span className={`vital-tag ${latestClinical.fasting_blood_sugar ? "warn" : "optimal"}`}>
                                            {latestClinical.fasting_blood_sugar ? "&gt; 120 mg/dL" : "&le; 120 mg/dL"}
                                        </span>
                                    </div>
                                    <div className="vital-value-row">
                                        <span className="vital-num">{latestClinical.fasting_blood_sugar ? "High" : "Normal"}</span>
                                        <span className="vital-unit">Blood Sugar</span>
                                    </div>
                                    <div className="vital-range-bar">
                                        <div
                                            className={`range-fill ${latestClinical.fasting_blood_sugar ? "warn" : "optimal"}`}
                                            style={{ width: latestClinical.fasting_blood_sugar ? "85%" : "40%" }}
                                        ></div>
                                    </div>
                                    <small className="vital-target">Target: Fasting &lt; 100 mg/dL</small>
                                </div>

                                <div className="patient-vital-card">
                                    <div className="vital-card-top">
                                        <span className="vital-label">ST Depression</span>
                                        <span className={`vital-tag ${latestClinical.st_depression > 1.0 ? "warn" : "optimal"}`}>
                                            {latestClinical.st_depression > 1.0 ? "Depressed" : "Normal"}
                                        </span>
                                    </div>
                                    <div className="vital-value-row">
                                        <span className="vital-num">{latestClinical.st_depression}</span>
                                        <span className="vital-unit">mm</span>
                                    </div>
                                    <div className="vital-range-bar">
                                        <div
                                            className={`range-fill ${latestClinical.st_depression > 1.0 ? "warn" : "optimal"}`}
                                            style={{ width: `${Math.min(100, (latestClinical.st_depression / 3.0) * 100)}%` }}
                                        ></div>
                                    </div>
                                    <small className="vital-target">Target: &lt; 0.5 mm</small>
                                </div>
                            </div>
                        </>
                    )}

                    {/* ECG Recording Status from MongoDB */}
                    <div className="patient-ecg-card">
                        <div className="patient-ecg-icon">📈</div>
                        <div className="patient-ecg-content">
                            <h4>12-Lead Electrocardiogram (ECG) Status</h4>
                            {latestEcg ? (
                                <>
                                    <p>
                                        <strong>Registered File: {latestEcg.original_name}</strong> (Size: {(latestEcg.size_bytes / 1024).toFixed(1)} KB) —
                                        Sampling rate {latestEcg.sampling_rate_hz} Hz with {latestEcg.lead_count} standard limb and precordial leads.
                                    </p>
                                    <div className="patient-ecg-tags">
                                        <span>Status: {latestEcg.processing_status}</span>
                                        <span>Uploaded: {new Date(latestEcg.uploaded_at).toLocaleDateString()}</span>
                                        <span>Resting ECG: {latestClinical?.resting_ecg || "Normal"}</span>
                                    </div>
                                </>
                            ) : (
                                <p style={{ color: "#64748b" }}>
                                    No ECG waveform recording uploaded yet. Click <strong>2-Step Data Entry</strong> to upload your 12-lead ECG (.csv, .dat, .hea, .pdf).
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Daily Care Plan */}
                    <div className="patient-section-header">
                        <h3>Personalized Heart Health Guidance</h3>
                        <span className="last-sync-badge">Cardiovascular Wellness Plan</span>
                    </div>

                    <div className="patient-lifestyle-grid">
                        <div className="patient-plan-card">
                            <div className="plan-card-icon">🥗</div>
                            <h4>Heart-Healthy Nutrition</h4>
                            <p>
                                Prioritize soluble fiber, extra virgin olive oil, walnuts, and green leafy vegetables.
                                Restrict dietary sodium to under 2,000 mg/day to alleviate vascular pressure.
                            </p>
                            <span className="plan-pill">Target: &lt; 2g Sodium / Day</span>
                        </div>

                        <div className="patient-plan-card">
                            <div className="plan-card-icon">🚶‍♀️</div>
                            <h4>Aerobic Cardiovascular Activity</h4>
                            <p>
                                Maintain 30 minutes of moderate aerobic activity (brisk walking, cycling) at least 5 days weekly
                                to enhance myocardial endurance and regulate HDL cholesterol.
                            </p>
                            <span className="plan-pill">Goal: 150 Mins / Week</span>
                        </div>

                        <div className="patient-plan-card">
                            <div className="plan-card-icon">💊</div>
                            <h4>Blood Pressure & Biomarker Logs</h4>
                            <p>
                                Record morning resting blood pressure twice weekly using a calibrated cuff.
                                Keep a symptom diary of any palpitations or shortness of breath.
                            </p>
                            <span className="plan-pill">Log Frequency: 2x Weekly</span>
                        </div>

                        <div className="patient-plan-card">
                            <div className="plan-card-icon">📅</div>
                            <h4>Clinical Appointment & Triage</h4>
                            <p>
                                Your case is queued in cardiology triage. Once an attending cardiologist is assigned,
                                your formal outpatient consultation time will be scheduled.
                            </p>
                            <span className="plan-pill highlight">Status: Under Triage Review</span>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 2: MY RESULTS & RISK ASSESSMENT (Point 6: Dedicated Results Tab)       */}
            {/* ========================================================================= */}
            {patientTab === "results" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                    {!latestPrediction && (
                        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "36px", textAlign: "center" }}>
                            <div style={{ fontSize: "40px", marginBottom: "10px" }}>⏳</div>
                            <h3>No AI Risk Prediction Generated Yet</h3>
                            <p style={{ color: "#64748b", maxWidth: "500px", margin: "0 auto 18px" }}>
                                Enter your clinical vitals using the 2-step flow to calculate your AI cardiovascular risk score.
                            </p>
                            <button
                                type="button"
                                className="patient-btn primary"
                                onClick={() => {
                                    setPatientTab("entry");
                                    setEntryStep(1);
                                }}
                            >
                                Go to 2-Step Entry Form →
                            </button>
                        </div>
                    )}

                    {latestPrediction && (
                        <>
                            {/* Prominent Risk Score Card */}
                            <div
                                style={{
                                    background: riskScorePercent >= 60 ? "#fef2f2" : riskScorePercent >= 30 ? "#fffbeb" : "#f0fdf4",
                                    border: `1.5px solid ${riskScorePercent >= 60 ? "#fecaca" : riskScorePercent >= 30 ? "#fde68a" : "#bbf7d0"}`,
                                    borderRadius: "16px",
                                    padding: "28px",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "16px",
                                }}
                            >
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
                                    <div>
                                        <span
                                            style={{
                                                fontSize: "12px",
                                                fontWeight: 700,
                                                textTransform: "uppercase",
                                                letterSpacing: "0.5px",
                                                color: riskScorePercent >= 60 ? "#b91c1c" : riskScorePercent >= 30 ? "#b45309" : "#15803d",
                                            }}
                                        >
                                            TRAINED CLINICAL DNN ASSESSMENT
                                        </span>
                                        <h2 style={{ margin: "4px 0 0", color: "#0f172a", fontSize: "26px" }}>
                                            Overall CVD Risk: {riskScorePercent}% ({riskLevelLabel})
                                        </h2>
                                    </div>
                                    <div
                                        style={{
                                            padding: "8px 18px",
                                            borderRadius: "20px",
                                            fontWeight: 700,
                                            fontSize: "14px",
                                            background: riskScorePercent >= 60 ? "#dc2626" : riskScorePercent >= 30 ? "#d97706" : "#16a34a",
                                            color: "#ffffff",
                                        }}
                                    >
                                        {riskLevelLabel}
                                    </div>
                                </div>

                                {/* Visual Risk Meter */}
                                <div>
                                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#64748b", marginBottom: "6px" }}>
                                        <span>0% (Low Risk)</span>
                                        <span>30% (Moderate Threshold)</span>
                                        <span>60% (High Risk)</span>
                                        <span>100%</span>
                                    </div>
                                    <div style={{ height: "14px", background: "#e2e8f0", borderRadius: "10px", overflow: "hidden", position: "relative" }}>
                                        <div
                                            style={{
                                                height: "100%",
                                                width: `${riskScorePercent}%`,
                                                background: riskScorePercent >= 60
                                                    ? "linear-gradient(90deg, #f59e0b, #ef4444)"
                                                    : riskScorePercent >= 30
                                                    ? "linear-gradient(90deg, #10b981, #f59e0b)"
                                                    : "#10b981",
                                                borderRadius: "10px",
                                                transition: "width 0.6s ease",
                                            }}
                                        ></div>
                                    </div>
                                </div>

                                <p style={{ margin: 0, fontSize: "14px", color: "#334155", lineHeight: "1.6" }}>
                                    {riskScorePercent >= 60
                                        ? "Your cardiovascular risk is evaluated as elevated. We recommend scheduling an expedited consultation with a cardiologist to review antihypertensive and lipid-lowering therapies."
                                        : riskScorePercent >= 30
                                        ? "Your cardiovascular risk is in the moderate range. Consistent lifestyle adjustments (exercise, salt reduction, and cholesterol management) can substantially lower your long-term cardiac risk."
                                        : "Your cardiovascular risk is within the optimal low-risk bracket. Continue with routine physical activity, balanced nutrition, and regular annual health screenings."}
                                </p>
                            </div>

                            {/* Specific Contributing Risk Factors (Point 6 requirement) */}
                            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "24px" }}>
                                <h3 style={{ margin: "0 0 6px", color: "#0f172a" }}>Contributing Risk Factors Analysis</h3>
                                <p style={{ margin: "0 0 18px", color: "#64748b", fontSize: "13px" }}>
                                    Here is how your specific biomarkers influence your cardiovascular risk profile according to the deep learning model:
                                </p>

                                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                    {/* Blood Pressure Factor */}
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "#f8fafc", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                                        <div>
                                            <strong style={{ display: "block", color: "#0f172a" }}>Systolic Blood Pressure</strong>
                                            <span style={{ fontSize: "13px", color: "#64748b" }}>
                                                Recorded value: {latestClinical?.resting_bp || 120} mmHg (Standard target: &lt; 120 mmHg)
                                            </span>
                                        </div>
                                        <span
                                            style={{
                                                fontWeight: 600,
                                                fontSize: "12px",
                                                padding: "4px 10px",
                                                borderRadius: "6px",
                                                background: (latestClinical?.resting_bp || 120) > 130 ? "#fee2e2" : "#dcfce7",
                                                color: (latestClinical?.resting_bp || 120) > 130 ? "#991b1b" : "#166534",
                                            }}
                                        >
                                            {(latestClinical?.resting_bp || 120) > 130 ? "Increases Risk" : "Protective / Normal"}
                                        </span>
                                    </div>

                                    {/* Cholesterol Factor */}
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "#f8fafc", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                                        <div>
                                            <strong style={{ display: "block", color: "#0f172a" }}>Serum Total Cholesterol</strong>
                                            <span style={{ fontSize: "13px", color: "#64748b" }}>
                                                Recorded value: {latestClinical?.cholesterol || 200} mg/dL (Standard target: &lt; 200 mg/dL)
                                            </span>
                                        </div>
                                        <span
                                            style={{
                                                fontWeight: 600,
                                                fontSize: "12px",
                                                padding: "4px 10px",
                                                borderRadius: "6px",
                                                background: (latestClinical?.cholesterol || 200) > 220 ? "#fee2e2" : (latestClinical?.cholesterol || 200) > 200 ? "#fef3c7" : "#dcfce7",
                                                color: (latestClinical?.cholesterol || 200) > 220 ? "#991b1b" : (latestClinical?.cholesterol || 200) > 200 ? "#92400e" : "#166534",
                                            }}
                                        >
                                            {(latestClinical?.cholesterol || 200) > 200 ? "Increases Risk" : "Optimal"}
                                        </span>
                                    </div>

                                    {/* Fasting Blood Sugar Factor */}
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "#f8fafc", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                                        <div>
                                            <strong style={{ display: "block", color: "#0f172a" }}>Fasting Blood Sugar / Glucose</strong>
                                            <span style={{ fontSize: "13px", color: "#64748b" }}>
                                                {latestClinical?.fasting_blood_sugar ? "Elevated (> 120 mg/dL)" : "Normal (≤ 120 mg/dL)"}
                                            </span>
                                        </div>
                                        <span
                                            style={{
                                                fontWeight: 600,
                                                fontSize: "12px",
                                                padding: "4px 10px",
                                                borderRadius: "6px",
                                                background: latestClinical?.fasting_blood_sugar ? "#fee2e2" : "#dcfce7",
                                                color: latestClinical?.fasting_blood_sugar ? "#991b1b" : "#166534",
                                            }}
                                        >
                                            {latestClinical?.fasting_blood_sugar ? "Metabolic Factor" : "Normal Metabolism"}
                                        </span>
                                    </div>

                                    {/* ST Depression Factor */}
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "#f8fafc", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                                        <div>
                                            <strong style={{ display: "block", color: "#0f172a" }}>ST Depression (Exercise ECG)</strong>
                                            <span style={{ fontSize: "13px", color: "#64748b" }}>
                                                Measured ST segment: {latestClinical?.st_depression || "0.0"} mm (Slope: {latestClinical?.st_slope || "Flat"})
                                            </span>
                                        </div>
                                        <span
                                            style={{
                                                fontWeight: 600,
                                                fontSize: "12px",
                                                padding: "4px 10px",
                                                borderRadius: "6px",
                                                background: (Number(latestClinical?.st_depression) || 0) > 1.0 ? "#fee2e2" : "#dcfce7",
                                                color: (Number(latestClinical?.st_depression) || 0) > 1.0 ? "#991b1b" : "#166534",
                                            }}
                                        >
                                            {(Number(latestClinical?.st_depression) || 0) > 1.0 ? "Ischemic Sign" : "No Acute Strain"}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Download & Print Summary Section */}
                            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
                                <div>
                                    <strong style={{ color: "#0f172a", display: "block" }}>Cardiovascular Health Report (Official PDF Summary)</strong>
                                    <span style={{ fontSize: "13px", color: "#64748b" }}>
                                        Generate an official printable report for your consultation with your physician.
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    className="patient-btn primary"
                                    onClick={handlePrintSummary}
                                >
                                    📄 Print / Save as PDF
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 3: 2-STEP PATIENT DATA ENTRY FLOW (Point 5)                           */}
            {/* ========================================================================= */}
            {patientTab === "entry" && (
                <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "28px" }}>
                    {/* Stepper Header */}
                    <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px" }}>
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                padding: "8px 16px",
                                borderRadius: "10px",
                                background: entryStep === 1 ? "#0284c7" : "#e0f2fe",
                                color: entryStep === 1 ? "#ffffff" : "#0369a1",
                                fontWeight: 700,
                                fontSize: "13px",
                            }}
                        >
                            <span>①</span> Step 1: Vitals & Clinical Data
                        </div>
                        <span style={{ color: "#94a3b8" }}>→</span>
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                padding: "8px 16px",
                                borderRadius: "10px",
                                background: entryStep === 2 ? "#0284c7" : "#f1f5f9",
                                color: entryStep === 2 ? "#ffffff" : "#64748b",
                                fontWeight: 700,
                                fontSize: "13px",
                            }}
                        >
                            <span>②</span> Step 2: 12-Lead ECG File Upload
                        </div>
                    </div>

                    {stepSuccessMsg && <div className="form-success" style={{ marginBottom: "16px" }}>{stepSuccessMsg}</div>}
                    {stepErrorMsg && <div className="form-error" style={{ marginBottom: "16px" }}>{stepErrorMsg}</div>}

                    {/* Step 1 Form: Clinical Vitals */}
                    {entryStep === 1 && (
                        <form onSubmit={handleClinicalStepSubmit}>
                            <h3 style={{ margin: "0 0 6px", color: "#0f172a" }}>Step 1: Patient Demographics & Clinical Vitals</h3>
                            <p style={{ margin: "0 0 20px", color: "#64748b", fontSize: "13px" }}>
                                Enter your resting clinical measurements. These values feed directly into the deep learning neural network.
                            </p>

                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
                                <div className="form-group">
                                    <label>Age (years)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="120"
                                        value={clinicalForm.age}
                                        onChange={(e) => setClinicalForm({ ...clinicalForm, age: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Biological Sex</label>
                                    <select
                                        value={clinicalForm.sex}
                                        onChange={(e) => setClinicalForm({ ...clinicalForm, sex: e.target.value })}
                                    >
                                        <option value="M">Male</option>
                                        <option value="F">Female</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Resting Systolic BP (mmHg)</label>
                                    <input
                                        type="number"
                                        placeholder="e.g. 130"
                                        value={clinicalForm.resting_bp}
                                        onChange={(e) => setClinicalForm({ ...clinicalForm, resting_bp: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Serum Cholesterol (mg/dL)</label>
                                    <input
                                        type="number"
                                        placeholder="e.g. 220"
                                        value={clinicalForm.cholesterol}
                                        onChange={(e) => setClinicalForm({ ...clinicalForm, cholesterol: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Chest Pain Symptom Type</label>
                                    <select
                                        value={clinicalForm.chest_pain_type}
                                        onChange={(e) => setClinicalForm({ ...clinicalForm, chest_pain_type: e.target.value })}
                                    >
                                        <option value="ASY">Asymptomatic (ASY)</option>
                                        <option value="ATA">Atypical Angina (ATA)</option>
                                        <option value="NAP">Non-Anginal Pain (NAP)</option>
                                        <option value="TA">Typical Angina (TA)</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Max Heart Rate Achieved (BPM)</label>
                                    <input
                                        type="number"
                                        placeholder="e.g. 150"
                                        value={clinicalForm.max_heart_rate}
                                        onChange={(e) => setClinicalForm({ ...clinicalForm, max_heart_rate: e.target.value })}
                                    />
                                </div>

                                <div className="form-group">
                                    <label>ST Depression (mm)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        placeholder="e.g. 0.8"
                                        value={clinicalForm.st_depression}
                                        onChange={(e) => setClinicalForm({ ...clinicalForm, st_depression: e.target.value })}
                                    />
                                </div>

                                <div className="form-group">
                                    <label>ST Slope Shape</label>
                                    <select
                                        value={clinicalForm.st_slope}
                                        onChange={(e) => setClinicalForm({ ...clinicalForm, st_slope: e.target.value })}
                                    >
                                        <option value="Up">Upsloping (Normal)</option>
                                        <option value="Flat">Flat (Borderline)</option>
                                        <option value="Down">Downsloping (Abnormal)</option>
                                    </select>
                                </div>
                            </div>

                            <div style={{ marginTop: "16px", display: "flex", gap: "24px" }}>
                                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer" }}>
                                    <input
                                        type="checkbox"
                                        checked={clinicalForm.fasting_blood_sugar}
                                        onChange={(e) => setClinicalForm({ ...clinicalForm, fasting_blood_sugar: e.target.checked })}
                                    />
                                    Fasting Blood Sugar &gt; 120 mg/dL (Diabetes indicator)
                                </label>
                                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer" }}>
                                    <input
                                        type="checkbox"
                                        checked={clinicalForm.exercise_angina}
                                        onChange={(e) => setClinicalForm({ ...clinicalForm, exercise_angina: e.target.checked })}
                                    />
                                    Exercise-Induced Angina / Chest Tightness
                                </label>
                            </div>

                            <div style={{ marginTop: "24px", display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                                <button
                                    type="submit"
                                    className="patient-btn primary"
                                    disabled={submittingStep}
                                >
                                    {submittingStep ? "Saving to MongoDB..." : "Save Vitals & Proceed to Step 2 →"}
                                </button>
                            </div>
                        </form>
                    )}

                    {/* Step 2 Form: ECG File Upload */}
                    {entryStep === 2 && (
                        <form onSubmit={handleEcgStepSubmit}>
                            <h3 style={{ margin: "0 0 6px", color: "#0f172a" }}>Step 2: 12-Lead ECG Signal Upload</h3>
                            <p style={{ margin: "0 0 20px", color: "#64748b", fontSize: "13px" }}>
                                Attach your raw ECG waveform recording or test file (.csv, .dat, .hea, .txt, or .pdf).
                            </p>

                            <div className="file-dropzone" style={{ border: "2px dashed #0284c7", borderRadius: "12px", padding: "30px", textAlign: "center", background: "#f0f9ff" }}>
                                <div style={{ fontSize: "36px", marginBottom: "8px" }}>📈</div>
                                <h4>Select or Drop Your ECG Recording</h4>
                                <p style={{ fontSize: "13px", color: "#64748b", marginBottom: "12px" }}>
                                    Supported formats: CSV waveform data, PhysioNet .dat/.hea, text matrices, or diagnostic PDF.
                                </p>
                                <input
                                    type="file"
                                    accept=".csv,.dat,.hea,.txt,.pdf,.png,.jpg"
                                    onChange={(e) => setSelectedEcgFile(e.target.files?.[0] || null)}
                                    style={{ margin: "0 auto", display: "block" }}
                                />
                                {selectedEcgFile && (
                                    <div style={{ marginTop: "12px", color: "#0369a1", fontWeight: 600, fontSize: "13px" }}>
                                        ✓ Selected file: {selectedEcgFile.name} ({(selectedEcgFile.size / 1024).toFixed(1)} KB)
                                    </div>
                                )}
                            </div>

                            <div style={{ marginTop: "24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <button
                                    type="button"
                                    className="patient-btn outline"
                                    onClick={() => setEntryStep(1)}
                                >
                                    ← Back to Step 1
                                </button>
                                <button
                                    type="submit"
                                    className="patient-btn primary"
                                    disabled={submittingStep}
                                >
                                    {submittingStep ? "Uploading & Running AI Model..." : "⚡ Complete Upload & Calculate AI Risk"}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            )}

            {/* Point 7: Message Care Team Triage Modal */}
            {showContactModal && (
                <div className="patient-modal-overlay" onClick={() => setShowContactModal(false)}>
                    <div className="patient-modal-box" onClick={(e) => e.stopPropagation()}>
                        <h3>🩺 Contact Cardiology Care Team (Triage)</h3>
                        <p style={{ fontSize: "13px", color: "#64748b" }}>
                            Your attending cardiologist is currently <strong>Unassigned (Under Review)</strong>.
                            Your inquiry will be routed directly to the on-call cardiology clinical triage team.
                        </p>
                        {triageMsgSent ? (
                            <div className="form-success" style={{ margin: "16px 0" }}>
                                ✓ Your message has been routed to Cardiology On-Call Triage. A nurse practitioner or cardiologist will respond within 24 hours.
                            </div>
                        ) : (
                            <textarea
                                className="patient-message-input"
                                rows={4}
                                placeholder="Describe any symptoms, medication questions, or request an appointment..."
                            />
                        )}
                        <div className="modal-actions-row">
                            <button
                                type="button"
                                className="patient-btn outline"
                                onClick={() => {
                                    setShowContactModal(false);
                                    setTriageMsgSent(false);
                                }}
                            >
                                Close
                            </button>
                            {!triageMsgSent && (
                                <button
                                    type="button"
                                    className="patient-btn primary"
                                    onClick={() => setTriageMsgSent(true)}
                                >
                                    Send to Triage
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PatientDashboardView;
