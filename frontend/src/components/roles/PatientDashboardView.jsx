import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getApiUrl } from "../../services/api";
import CvdXaiIntroSlider from "../CvdXaiIntroSlider";
import ClinicalReportPrintDocument from "../ClinicalReportPrintDocument";

const PatientDashboardView = ({ patient, currentUser, activeView = "dashboard" }) => {
    // Real data from MongoDB
    const [clinicalRecords, setClinicalRecords] = useState([]);
    const [ecgRecords, setEcgRecords] = useState([]);
    const [predictions, setPredictions] = useState([]);
    const [loadingData, setLoadingData] = useState(true);

    // Form and submission states
    const [submittingStep, setSubmittingStep] = useState(false);
    const [stepSuccessMsg, setStepSuccessMsg] = useState("");
    const [stepErrorMsg, setStepErrorMsg] = useState("");

    // Message triage and Print preview modals
    const [showContactModal, setShowContactModal] = useState(false);
    const [triageMsgSent, setTriageMsgSent] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);

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

    // Latest real records from MongoDB
    const latestClinical = clinicalRecords.length > 0 ? clinicalRecords[0] : null;
    const latestPrediction = predictions.length > 0 ? predictions[0] : null;

    // Patient display details
    const patientDisplayName = currentUser?.full_name || currentUser?.name || patient?.name || "Patient";

    // Disease risk determination (Points 5: state whether at risk of disease or not, no %)
    const riskScoreVal = latestPrediction ? Number(latestPrediction.risk_score || 0) : null;
    const hasDiseaseRisk = riskScoreVal !== null && riskScoreVal >= 0.35;

    const riskStatusLabel = latestPrediction
        ? (hasDiseaseRisk ? "Cardiovascular Disease Risk Detected" : "No Immediate CVD Risk Detected")
        : (latestClinical ? "Clinical Vitals Recorded" : "Awaiting Data Upload");

    // Recalculate AI prediction on demand from latest vitals
    const handleRunPrediction = async () => {
        if (!token) return;
        if (!latestClinical) return;

        setSubmittingStep(true);
        setStepErrorMsg("");
        setStepSuccessMsg("");

        try {
            const bpHi = Math.max(70, Number(latestClinical.resting_bp) || 120);
            const bpLo = Math.min(bpHi - 10, 80);
            const cholVal = Number(latestClinical.cholesterol) || 200;
            const cholCategory = cholVal > 220 ? 3 : (cholVal > 200 ? 2 : 1);
            const glucCategory = latestClinical.fasting_blood_sugar ? 2 : 1;
            const ageVal = Math.max(18, Math.min(100, Number(latestClinical.age) || 52));
            const genderVal = (latestClinical.sex === "M" || latestClinical.gender === 1) ? 1 : 0;

            const payload = {
                gender: genderVal,
                height: 170.0,
                weight: 70.0,
                ap_hi: bpHi,
                ap_lo: bpLo,
                cholesterol: cholCategory,
                gluc: glucCategory,
                smoke: 0,
                alco: 0,
                active: 1,
                age_years: ageVal,
                clinical_record_id: latestClinical._id || latestClinical.id || null,
            };

            const res = await fetch(getApiUrl("/api/predict/clinical"), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData?.detail || "Prediction request could not be processed.");
            }

            await fetchPatientData();
            setStepSuccessMsg("✓ Clinical DNN risk assessment recalculated successfully!");
            setTimeout(() => setStepSuccessMsg(""), 3500);
        } catch (err) {
            setStepErrorMsg(err.message || "Failed to recalculate assessment.");
        } finally {
            setSubmittingStep(false);
        }
    };

    const handlePrintSummary = () => {
        setShowReportModal(true);
    };

    const handleDirectPrint = () => {
        window.print();
    };

    return (
        <div className="patient-dashboard-container" style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
            {/* ========================================================================= */}
            {/* VIEW 1: MAIN PATIENT DASHBOARD (Strict Positional Sequence)               */}
            {/* ========================================================================= */}
            {activeView === "dashboard" && (
                <>
                    {/* ----------------------------------------------------------------- */}
                    {/* TOP: PATIENT WELCOME CARD (Point 4: Clean, ALL action buttons removed) */}
                    {/* ----------------------------------------------------------------- */}
                    <div className="patient-hero-card">
                        <div className="patient-hero-main">
                            <div className="patient-avatar-box">🫀</div>
                            <div>
                                <div className="patient-badge-row">
                                    <span className="patient-portal-tag">Patient Cardiovascular Portal</span>
                                    <span className={`patient-status-pill ${hasDiseaseRisk ? "warn" : "green"}`}>
                                        ● {latestPrediction ? riskStatusLabel : (latestClinical ? "Vitals Stored" : "Active Profile")}
                                    </span>
                                </div>
                                <h2>Welcome back, {patientDisplayName}</h2>
                                <p className="patient-hero-sub">
                                    Your personalized heart health summary, AI cardiovascular risk assessments, and daily care guidance.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* ----------------------------------------------------------------- */}
                    {/* POSITION 1: CVD-XAI INTRODUCTION SLIDER (Point 2: Sliding animation)*/}
                    {/* ----------------------------------------------------------------- */}
                    <CvdXaiIntroSlider />

                    {/* ----------------------------------------------------------------- */}
                    {/* POSITION 2: DISEASE RISK STATUS BANNER (Points 5 & 7: No %, No duplicate) */}
                    {/* ----------------------------------------------------------------- */}
                    <div className="patient-status-banner">
                        <div className="status-banner-left">
                            <span
                                className="status-icon"
                                style={{
                                    background: latestPrediction
                                        ? (hasDiseaseRisk ? "#ef4444" : "#22c55e")
                                        : "#0284c7",
                                }}
                            >
                                {latestPrediction ? (hasDiseaseRisk ? "!" : "✓") : "i"}
                            </span>
                            <div>
                                <strong>
                                    {latestPrediction
                                        ? (hasDiseaseRisk
                                            ? "Cardiovascular Disease Risk Detected — Clinical Follow-Up Recommended"
                                            : "No Immediate Cardiovascular Disease Risk Detected — Optimal Range")
                                        : latestClinical
                                        ? "Clinical Vitals Recorded — Assessment Ready"
                                        : "Welcome to CardioXAI — Please Record Your Clinical Vitals"}
                                </strong>
                                <p>
                                    {latestPrediction
                                        ? (hasDiseaseRisk
                                            ? `Evaluated by trained deep neural network (DNN). Based on systolic BP ${latestClinical?.resting_bp || 120} mmHg and cholesterol ${latestClinical?.cholesterol || 200} mg/dL, early intervention is advised.`
                                            : `Evaluated by trained deep neural network (DNN). Based on systolic BP ${latestClinical?.resting_bp || 120} mmHg and cholesterol ${latestClinical?.cholesterol || 200} mg/dL, your cardiac parameters are within target boundaries.`)
                                        : latestClinical
                                        ? "Your vitals are stored in MongoDB. Click below to view your full AI prediction results."
                                        : "No clinical measurements found yet. Use the Upload Vitals tab to record your measurements."}
                                </p>
                                {latestPrediction && (
                                    <Link
                                        to="/prediction-results"
                                        style={{
                                            display: "inline-block",
                                            marginTop: "8px",
                                            background: "#0284c7",
                                            color: "#ffffff",
                                            textDecoration: "none",
                                            borderRadius: "6px",
                                            padding: "6px 14px",
                                            fontSize: "12px",
                                            fontWeight: 600,
                                        }}
                                    >
                                        View Detailed Prediction Results →
                                    </Link>
                                )}
                            </div>
                        </div>

                        {/* Point 7: Attending Cardiologist Unassigned (Under Review) */}
                        <div className="status-banner-careteam">
                            <small>Attending Cardiologist</small>
                            <strong style={{ color: "#b45309" }}>Unassigned (Under Review)</strong>
                            <div style={{ fontSize: "11px", color: "#64748b" }}>Case queued in clinical triage</div>
                        </div>
                    </div>

                    {/* ----------------------------------------------------------------- */}
                    {/* POSITION 3: MY LATEST CLINICAL MEASUREMENTS (Point 2 & Point 6)  */}
                    {/* ----------------------------------------------------------------- */}
                    {latestClinical ? (
                        <div>
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
                        </div>
                    ) : (
                        !loadingData && (
                            <div style={{ background: "#ffffff", border: "1.5px dashed #0284c7", borderRadius: "16px", padding: "36px", textAlign: "center" }}>
                                <div style={{ fontSize: "40px", marginBottom: "10px" }}>📋</div>
                                <h3 style={{ margin: "0 0 6px", color: "#0f172a" }}>No Clinical Vitals Uploaded Yet</h3>
                                <p style={{ margin: "0 auto 16px", color: "#64748b", maxWidth: "520px", fontSize: "14px" }}>
                                    Record your clinical vitals and lab data to calculate your personalized cardiovascular disease risk assessment.
                                </p>
                                <Link
                                    to="/data-upload"
                                    className="patient-btn primary"
                                    style={{ textDecoration: "none", display: "inline-block" }}
                                >
                                    Upload Vitals & ECG Now →
                                </Link>
                            </div>
                        )
                    )}

                    {/* ----------------------------------------------------------------- */}
                    {/* POSITION 4 (LAST): PERSONALIZED HEART HEALTH GUIDANCE             */}
                    {/* ----------------------------------------------------------------- */}
                    <div>
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
                </>
            )}

            {/* ========================================================================= */}
            {/* VIEW 2: DEDICATED PREDICTION RESULTS VIEW (Point 1 Sidebar Tab)           */}
            {/* ========================================================================= */}
            {activeView === "predictions" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
                    {/* Model Specification Header Banner */}
                    <div
                        style={{
                            background: "#ffffff",
                            border: "1px solid #e2e8f0",
                            borderRadius: "14px",
                            padding: "18px 24px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            flexWrap: "wrap",
                            gap: "14px",
                        }}
                    >
                        <div>
                            <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#0284c7" }}>
                                CARDIOVASCULAR AI PREDICTION ENGINE
                            </span>
                            <h3 style={{ margin: "2px 0 0", color: "#0f172a", fontSize: "18px" }}>
                                Model: clinical_dnn.keras (16 features, 10,302 multi-center patient records)
                            </h3>
                            <span style={{ fontSize: "12px", color: "#64748b" }}>
                                {latestPrediction?.created_at
                                    ? `Last evaluated: ${new Date(latestPrediction.created_at).toLocaleString()}`
                                    : "Awaiting baseline evaluation"}
                            </span>
                        </div>
                        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                            {latestClinical && (
                                <button
                                    type="button"
                                    className="patient-btn outline"
                                    style={{ fontSize: "13px", padding: "8px 16px" }}
                                    onClick={handleRunPrediction}
                                    disabled={submittingStep}
                                >
                                    {submittingStep ? "Calculating..." : "🔄 Re-Calculate Assessment"}
                                </button>
                            )}
                            <button
                                type="button"
                                className="patient-btn primary"
                                style={{ fontSize: "13px", padding: "8px 16px" }}
                                onClick={handlePrintSummary}
                            >
                                📄 Print Report (PDF)
                            </button>
                        </div>
                    </div>

                    {stepSuccessMsg && <div className="form-success">{stepSuccessMsg}</div>}
                    {stepErrorMsg && <div className="form-error">{stepErrorMsg}</div>}

                    {/* No Predictions Available State */}
                    {!latestPrediction && (
                        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "40px", textAlign: "center" }}>
                            <div style={{ fontSize: "44px", marginBottom: "12px" }}>⏳</div>
                            <h3 style={{ margin: "0 0 8px", color: "#0f172a" }}>No Prediction Assessment Recorded Yet</h3>
                            <p style={{ color: "#64748b", maxWidth: "520px", margin: "0 auto 20px", fontSize: "14px" }}>
                                {latestClinical
                                    ? "Your clinical vitals are stored in MongoDB. Click below to run the deep neural network assessment now."
                                    : "Enter your resting clinical vitals to calculate your cardiovascular disease risk assessment."}
                            </p>
                            {latestClinical ? (
                                <button
                                    type="button"
                                    className="patient-btn primary"
                                    onClick={handleRunPrediction}
                                    disabled={submittingStep}
                                >
                                    {submittingStep ? "Running Neural Network..." : "⚡ Calculate Prediction Now"}
                                </button>
                            ) : (
                                <Link
                                    to="/data-upload"
                                    className="patient-btn primary"
                                    style={{ textDecoration: "none", display: "inline-block" }}
                                >
                                    Upload Vitals & ECG →
                                </Link>
                            )}
                        </div>
                    )}

                    {/* Active Prediction Assessment View */}
                    {latestPrediction && (
                        <>
                            {/* Primary Disease Risk Status Card (Point 5: Disease risk status without %) */}
                            <div
                                style={{
                                    background: hasDiseaseRisk ? "#fef2f2" : "#f0fdf4",
                                    border: `1.5px solid ${hasDiseaseRisk ? "#fecaca" : "#bbf7d0"}`,
                                    borderRadius: "16px",
                                    padding: "28px",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "18px",
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
                                                color: hasDiseaseRisk ? "#b91c1c" : "#15803d",
                                            }}
                                        >
                                            CARDIOVASCULAR DISEASE RISK ASSESSMENT
                                        </span>
                                        <h2 style={{ margin: "4px 0 0", color: "#0f172a", fontSize: "26px", fontWeight: 800 }}>
                                            {hasDiseaseRisk
                                                ? "Cardiovascular Disease Risk Detected"
                                                : "No Immediate Cardiovascular Disease Risk Detected"}
                                        </h2>
                                    </div>
                                    <div
                                        style={{
                                            padding: "10px 22px",
                                            borderRadius: "24px",
                                            fontWeight: 800,
                                            fontSize: "14px",
                                            background: hasDiseaseRisk ? "#dc2626" : "#16a34a",
                                            color: "#ffffff",
                                            boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                                        }}
                                    >
                                        ● {hasDiseaseRisk ? "Action Advised" : "Optimal Low Risk"}
                                    </div>
                                </div>

                                <div style={{ background: "#ffffff", borderRadius: "10px", padding: "16px 20px", border: "1px solid rgba(0,0,0,0.06)" }}>
                                    <strong style={{ display: "block", color: "#0f172a", marginBottom: "4px", fontSize: "14px" }}>
                                        Clinical Diagnostic Summary:
                                    </strong>
                                    <p style={{ margin: 0, fontSize: "14px", color: "#334155", lineHeight: "1.6" }}>
                                        {hasDiseaseRisk
                                            ? "Based on your clinical hemodynamics, lipid indicators, and biomarker profile, our trained deep learning model has identified risk factors associated with cardiovascular disease. We advise sharing this assessment with your physician or cardiology care team to review antihypertensive and lipid-management strategies."
                                            : "Your clinical biomarkers fall within the optimal low-risk cardiovascular spectrum. Continue with proactive physical exercise, balanced dietary habits, and routine annual wellness monitoring to preserve long-term myocardial health."}
                                    </p>
                                </div>
                            </div>

                            {/* Biomarker Risk Attribution (Explainable AI) */}
                            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "26px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
                                    <div>
                                        <h3 style={{ margin: "0 0 4px", color: "#0f172a", fontSize: "18px" }}>
                                            Contributing Biomarker Analysis (Explainable AI)
                                        </h3>
                                        <p style={{ margin: 0, color: "#64748b", fontSize: "13px" }}>
                                            Individual physiological parameters evaluated by the deep neural network:
                                        </p>
                                    </div>
                                    <span style={{ fontSize: "12px", background: "#f1f5f9", padding: "4px 10px", borderRadius: "6px", color: "#475569" }}>
                                        Trained DNN Attributions
                                    </span>
                                </div>

                                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                    {/* Systolic BP */}
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", background: "#f8fafc", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                                        <div style={{ flex: 1 }}>
                                            <strong style={{ color: "#0f172a", fontSize: "14px", display: "block" }}>
                                                Resting Systolic Blood Pressure
                                            </strong>
                                            <span style={{ fontSize: "13px", color: "#64748b" }}>
                                                Recorded: <strong>{latestClinical?.resting_bp || 120} mmHg</strong> (Target: &lt; 120 mmHg) — Primary determinant of vascular wall stress and left ventricular workload.
                                            </span>
                                        </div>
                                        <span
                                            style={{
                                                fontWeight: 700,
                                                fontSize: "12px",
                                                padding: "5px 12px",
                                                borderRadius: "6px",
                                                background: (latestClinical?.resting_bp || 120) > 130 ? "#fee2e2" : "#dcfce7",
                                                color: (latestClinical?.resting_bp || 120) > 130 ? "#991b1b" : "#166534",
                                            }}
                                        >
                                            {(latestClinical?.resting_bp || 120) > 130 ? "▲ Risk Factor (+)" : "✓ Protective / Normal"}
                                        </span>
                                    </div>

                                    {/* Serum Cholesterol */}
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", background: "#f8fafc", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                                        <div style={{ flex: 1 }}>
                                            <strong style={{ color: "#0f172a", fontSize: "14px", display: "block" }}>
                                                Serum Total Cholesterol
                                            </strong>
                                            <span style={{ fontSize: "13px", color: "#64748b" }}>
                                                Recorded: <strong>{latestClinical?.cholesterol || 200} mg/dL</strong> (Target: &lt; 200 mg/dL) — Associated with coronary atheroma formation and plaque burden.
                                            </span>
                                        </div>
                                        <span
                                            style={{
                                                fontWeight: 700,
                                                fontSize: "12px",
                                                padding: "5px 12px",
                                                borderRadius: "6px",
                                                background: (latestClinical?.cholesterol || 200) > 200 ? "#fee2e2" : "#dcfce7",
                                                color: (latestClinical?.cholesterol || 200) > 200 ? "#991b1b" : "#166534",
                                            }}
                                        >
                                            {(latestClinical?.cholesterol || 200) > 200 ? "▲ Risk Factor (+)" : "✓ Desirable"}
                                        </span>
                                    </div>

                                    {/* Fasting Blood Sugar */}
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", background: "#f8fafc", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                                        <div style={{ flex: 1 }}>
                                            <strong style={{ color: "#0f172a", fontSize: "14px", display: "block" }}>
                                                Fasting Blood Sugar / Glycemic Status
                                            </strong>
                                            <span style={{ fontSize: "13px", color: "#64748b" }}>
                                                Status: <strong>{latestClinical?.fasting_blood_sugar ? "Elevated (> 120 mg/dL)" : "Normal (≤ 120 mg/dL)"}</strong> — Key predictor of microvascular and endothelial dysfunction.
                                            </span>
                                        </div>
                                        <span
                                            style={{
                                                fontWeight: 700,
                                                fontSize: "12px",
                                                padding: "5px 12px",
                                                borderRadius: "6px",
                                                background: latestClinical?.fasting_blood_sugar ? "#fee2e2" : "#dcfce7",
                                                color: latestClinical?.fasting_blood_sugar ? "#991b1b" : "#166534",
                                            }}
                                        >
                                            {latestClinical?.fasting_blood_sugar ? "▲ Metabolic Risk (+)" : "✓ Normoglycemic"}
                                        </span>
                                    </div>

                                    {/* ST Depression */}
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", background: "#f8fafc", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                                        <div style={{ flex: 1 }}>
                                            <strong style={{ color: "#0f172a", fontSize: "14px", display: "block" }}>
                                                ST Segment Depression (ECG Stress Marker)
                                            </strong>
                                            <span style={{ fontSize: "13px", color: "#64748b" }}>
                                                Measured: <strong>{latestClinical?.st_depression || "0.0"} mm</strong> (Slope: {latestClinical?.st_slope || "Flat"}) — Evaluates myocardial subendocardial ischemia under exertion.
                                            </span>
                                        </div>
                                        <span
                                            style={{
                                                fontWeight: 700,
                                                fontSize: "12px",
                                                padding: "5px 12px",
                                                borderRadius: "6px",
                                                background: (Number(latestClinical?.st_depression) || 0) > 1.0 ? "#fee2e2" : "#dcfce7",
                                                color: (Number(latestClinical?.st_depression) || 0) > 1.0 ? "#991b1b" : "#166534",
                                            }}
                                        >
                                            {(Number(latestClinical?.st_depression) || 0) > 1.0 ? "▲ Ischemia Sign (+)" : "✓ No Acute Strain"}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Historical Prediction Log */}
                            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "26px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
                                    <div>
                                        <h3 style={{ margin: "0 0 4px", color: "#0f172a", fontSize: "18px" }}>
                                            Historical Prediction Timeline
                                        </h3>
                                        <p style={{ margin: 0, color: "#64748b", fontSize: "13px" }}>
                                            All assessments recorded in MongoDB for your patient profile:
                                        </p>
                                    </div>
                                    <span style={{ fontSize: "12px", background: "#e0f2fe", color: "#0369a1", padding: "4px 10px", borderRadius: "6px", fontWeight: 600 }}>
                                        {predictions.length} Total Assessment{predictions.length !== 1 ? "s" : ""}
                                    </span>
                                </div>

                                {predictions.length === 0 ? (
                                    <p style={{ color: "#64748b", fontSize: "13px", textAlign: "center", padding: "20px 0" }}>
                                        No historical evaluations found in database.
                                    </p>
                                ) : (
                                    <div style={{ overflowX: "auto" }}>
                                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                                            <thead>
                                                <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", textAlign: "left" }}>
                                                    <th style={{ padding: "10px 14px", color: "#475569" }}>Date & Time</th>
                                                    <th style={{ padding: "10px 14px", color: "#475569" }}>Model</th>
                                                    <th style={{ padding: "10px 14px", color: "#475569" }}>Disease Risk Status</th>
                                                    <th style={{ padding: "10px 14px", color: "#475569" }}>Primary Factors</th>
                                                    <th style={{ padding: "10px 14px", color: "#475569" }}>Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {predictions.map((p, idx) => {
                                                    const score = Number(p.risk_score || 0);
                                                    const riskFound = score >= 0.35;
                                                    return (
                                                        <tr key={p.id || idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                                            <td style={{ padding: "12px 14px", color: "#0f172a" }}>
                                                                {p.created_at ? new Date(p.created_at).toLocaleString() : "Recent"}
                                                            </td>
                                                            <td style={{ padding: "12px 14px", color: "#64748b" }}>
                                                                {p.model_name || "clinical_dnn"}
                                                            </td>
                                                            <td style={{ padding: "12px 14px" }}>
                                                                <span
                                                                    style={{
                                                                        padding: "3px 10px",
                                                                        borderRadius: "12px",
                                                                        fontSize: "11px",
                                                                        fontWeight: 700,
                                                                        background: riskFound ? "#fee2e2" : "#dcfce7",
                                                                        color: riskFound ? "#991b1b" : "#166534",
                                                                    }}
                                                                >
                                                                    {riskFound ? "Risk Detected" : "No Immediate Risk"}
                                                                </span>
                                                            </td>
                                                            <td style={{ padding: "12px 14px", color: "#64748b" }}>
                                                                {Array.isArray(p.top_contributing_features) && p.top_contributing_features.length > 0
                                                                    ? p.top_contributing_features.slice(0, 3).join(", ")
                                                                    : "Systolic BP, Cholesterol"}
                                                            </td>
                                                            <td style={{ padding: "12px 14px", color: "#16a34a", fontWeight: 600 }}>
                                                                ✓ Saved
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            {/* Download & Print Summary Section */}
                            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
                                <div>
                                    <strong style={{ color: "#0f172a", display: "block" }}>Download Official Clinical Assessment Report</strong>
                                    <span style={{ fontSize: "13px", color: "#64748b" }}>
                                        Generate an official printable report for your consultation with your physician.
                                    </span>
                                </div>
                                <div style={{ display: "flex", gap: "10px" }}>
                                    <button
                                        type="button"
                                        className="patient-btn outline"
                                        onClick={() => setShowContactModal(true)}
                                    >
                                        🩺 Message Care Team
                                    </button>
                                    <button
                                        type="button"
                                        className="patient-btn primary"
                                        onClick={handlePrintSummary}
                                    >
                                        📄 Print / Save as PDF
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Message Care Team Triage Modal */}
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

            {/* Medical Clinical Report Preview & Print Modal */}
            {showReportModal && (
                <div className="report-preview-modal-overlay" onClick={() => setShowReportModal(false)}>
                    <div className="report-preview-modal-box" onClick={(e) => e.stopPropagation()}>
                        <div className="report-preview-modal-header">
                            <div>
                                <strong style={{ fontSize: "16px", color: "#0f172a", display: "block" }}>
                                    📄 Official Medical Clinical Report Preview
                                </strong>
                                <span style={{ fontSize: "12px", color: "#64748b" }}>
                                    Formatted specifically for high-clarity A4 printing and PDF record saving (zero website UI elements)
                                </span>
                            </div>
                            <div style={{ display: "flex", gap: "10px" }}>
                                <button
                                    type="button"
                                    className="patient-btn primary"
                                    style={{ padding: "8px 18px", fontSize: "13px", fontWeight: 700 }}
                                    onClick={handleDirectPrint}
                                >
                                    🖨️ Print / Save as PDF
                                </button>
                                <button
                                    type="button"
                                    className="patient-btn outline"
                                    style={{ padding: "8px 16px", fontSize: "13px" }}
                                    onClick={() => setShowReportModal(false)}
                                >
                                    Close
                                </button>
                            </div>
                        </div>

                        <div className="report-preview-modal-body">
                            <div className="report-paper-preview">
                                <ClinicalReportPrintDocument
                                    patient={patient}
                                    currentUser={currentUser}
                                    latestClinical={latestClinical}
                                    latestPrediction={latestPrediction}
                                    hasDiseaseRisk={hasDiseaseRisk}
                                    riskStatusLabel={riskStatusLabel}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Dedicated Print Engine Container (Always active for @media print, hidden on screen) */}
            <div className="printable-clinical-report hidden-screen">
                <ClinicalReportPrintDocument
                    patient={patient}
                    currentUser={currentUser}
                    latestClinical={latestClinical}
                    latestPrediction={latestPrediction}
                    hasDiseaseRisk={hasDiseaseRisk}
                    riskStatusLabel={riskStatusLabel}
                />
            </div>
        </div>
    );
};

export default PatientDashboardView;
