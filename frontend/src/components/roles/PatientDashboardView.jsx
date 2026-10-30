import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest, getApiUrl } from "../../services/api";
import CvdXaiIntroSlider from "../CvdXaiIntroSlider";
import EcgAnalysis from "../EcgAnalysis";
import ClinicalReportPrintDocument from "../ClinicalReportPrintDocument";
import { printClinicalReport } from "../../utils/printReport";

const PatientDashboardView = ({ patient, currentUser, activeView = "dashboard" }) => {
    // Real data from MongoDB
    const [clinicalRecords, setClinicalRecords] = useState([]);
    const [ecgRecords, setEcgRecords] = useState([]);
    const [ecgPrediction, setEcgPrediction] = useState(null);
    const [ecgPredictionError, setEcgPredictionError] = useState("");
    const [predictions, setPredictions] = useState([]);
    const [loadingData, setLoadingData] = useState(true);
    const [modelHealth, setModelHealth] = useState(null);

    // Form and submission states
    const [submittingStep, setSubmittingStep] = useState(false);
    const [stepSuccessMsg, setStepSuccessMsg] = useState("");
    const [stepErrorMsg, setStepErrorMsg] = useState("");
    const [modelInputs, setModelInputs] = useState({
        diastolicBp: "",
        height: "",
        weight: "",
        smoking: "",
        alcohol: "",
        active: "",
    });

    // Message triage and Print preview modals
    const [showContactModal, setShowContactModal] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);

    const token = localStorage.getItem("cvd_xai_access_token") || localStorage.getItem("cvd_token");

    // Fetch real patient data from MongoDB
    const fetchPatientData = useCallback(async () => {
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
    }, [token]);

    useEffect(() => {
        fetchPatientData();
    }, [fetchPatientData]);

    useEffect(() => {
        let active = true;
        apiRequest("/api/predict/health")
            .then((data) => { if (active) setModelHealth(data); })
            .catch(() => { if (active) setModelHealth(null); });
        return () => { active = false; };
    }, []);

    // Latest real records from MongoDB
    const latestClinical = clinicalRecords.length > 0 ? clinicalRecords[0] : null;
    const latestEcgRecord = ecgRecords[0] || null;
    const latestPrediction = predictions.length > 0 ? predictions[0] : null;

    useEffect(() => {
        let active = true;
        setEcgPrediction(null);
        setEcgPredictionError("");
        const recordId = latestEcgRecord?._id || latestEcgRecord?.id;
        if (!recordId) return () => { active = false; };

        apiRequest(`/api/predict/ecg/${encodeURIComponent(recordId)}`)
            .then((data) => { if (active) setEcgPrediction(data); })
            .catch((error) => {
                if (active) setEcgPredictionError(error.message || "ECG assessment is unavailable.");
            });
        return () => { active = false; };
    }, [latestEcgRecord?._id, latestEcgRecord?.id]);

    // Patient display details
    const patientDisplayName = currentUser?.full_name || currentUser?.name || patient?.name || "Patient";

    // Disease risk determination (Points 5: state whether at risk of disease or not, no %)
    const riskStatusLabel = latestPrediction?.risk_level || latestPrediction?.predicted_label ||
        (latestClinical ? "Clinical vitals recorded" : "Awaiting data upload");
    const normalizedRiskLabel = String(riskStatusLabel).toLowerCase();
    const hasDiseaseRisk = normalizedRiskLabel.includes("high") || normalizedRiskLabel.includes("abnormal");
    const riskStatusTone = latestPrediction
        ? (hasDiseaseRisk ? "warn" : normalizedRiskLabel.includes("low") || normalizedRiskLabel.includes("normal") ? "green" : "neutral")
        : "neutral";
    const featureContributions = Array.isArray(latestPrediction?.feature_contributions)
        ? latestPrediction.feature_contributions.filter((item) =>
            Number.isFinite(Number(item?.importance ?? item?.contribution))
        )
        : [];

    // Recalculate AI prediction on demand from latest vitals
    const handleRunPrediction = async () => {
        if (!token) return;
        if (!latestClinical) return;

        setSubmittingStep(true);
        setStepErrorMsg("");
        setStepSuccessMsg("");

        try {
            if (modelHealth && !modelHealth.model_loaded) {
                throw new Error("The clinical prediction model is not available right now.");
            }

            const requiredInputs = [
                [modelInputs.diastolicBp, "diastolic blood pressure"],
                [modelInputs.height, "height"],
                [modelInputs.weight, "weight"],
                [modelInputs.smoking, "smoking status"],
                [modelInputs.alcohol, "alcohol use"],
                [modelInputs.active, "physical activity"],
            ];
            const missingInput = requiredInputs.find(([value]) => value === "");
            if (missingInput) {
                throw new Error(`Enter ${missingInput[1]} to run this model. These values are not part of the saved clinical record.`);
            }

            const ageVal = Number(latestClinical.age);
            const bpHi = Number(latestClinical.resting_bp);
            const bpLo = Number(modelInputs.diastolicBp);
            const cholVal = Number(latestClinical.cholesterol);
            const rawGender = String(latestClinical.sex ?? latestClinical.gender ?? "").trim().toLowerCase();
            const genderVal = ["m", "male", "1"].includes(rawGender) ? 1
                : ["f", "female", "0"].includes(rawGender) ? 0 : Number.NaN;
            if (![ageVal, bpHi, bpLo, cholVal, genderVal].every(Number.isFinite) || latestClinical.fasting_blood_sugar == null) {
                throw new Error("The saved clinical record is missing age, sex, blood pressure, cholesterol, or fasting blood sugar.");
            }
            if (bpHi <= bpLo) {
                throw new Error("Systolic blood pressure must be greater than diastolic blood pressure.");
            }
            const cholCategory = cholVal >= 240 ? 3 : cholVal >= 200 ? 2 : 1;
            const glucCategory = latestClinical.fasting_blood_sugar ? 2 : 1;

            const payload = {
                gender: genderVal,
                height: Number(modelInputs.height),
                weight: Number(modelInputs.weight),
                ap_hi: bpHi,
                ap_lo: bpLo,
                cholesterol: cholCategory,
                gluc: glucCategory,
                smoke: Number(modelInputs.smoking),
                alco: Number(modelInputs.alcohol),
                active: Number(modelInputs.active),
                age_years: ageVal,
                clinical_record_id: latestClinical._id || latestClinical.id || null,
            };

            await apiRequest("/api/predict/clinical", {
                method: "POST",
                body: payload,
            });

            await fetchPatientData();
            setStepSuccessMsg("Assessment completed. Review the model output with your clinician.");
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
        printClinicalReport("clinical-report-printable-area");
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
                                    <span className={`patient-status-pill ${riskStatusTone}`}>
                                        ● {latestPrediction ? riskStatusLabel : (latestClinical ? "Vitals Stored" : "Active Profile")}
                                    </span>
                                </div>
                                <h2>Welcome back, {patientDisplayName}</h2>
                                <p className="patient-hero-sub">
                                    Review your saved measurements and model results. This dashboard does not provide a diagnosis.
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
                                    background: riskStatusTone === "warn" ? "#ef4444" : riskStatusTone === "green" ? "#22c55e" : "#0284c7",
                                }}
                            >
                                {latestPrediction ? (hasDiseaseRisk ? "!" : "i") : "i"}
                            </span>
                            <div>
                                <strong>
                                    {latestPrediction
                                        ? `Stored model result: ${riskStatusLabel}`
                                        : latestClinical
                                        ? "Clinical Vitals Recorded — Assessment Ready"
                                        : "Welcome to CardioXAI — Please Record Your Clinical Vitals"}
                                </strong>
                                <p>
                                    {latestPrediction
                                        ? `Model: ${latestPrediction.model_name || "not recorded"}. Review the source measurements and discuss this result with your clinician; it is not a diagnosis.`
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

                        <div className="status-banner-careteam">
                            <small>Care team</small>
                            <strong style={{ color: "#475569" }}>Contact your care provider</strong>
                            <div style={{ fontSize: "11px", color: "#64748b" }}>Care team assignment and messaging are not available in this app.</div>
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
                                    {latestClinical.recorded_at ? `Recorded ${new Date(latestClinical.recorded_at).toLocaleDateString()}` : "Record date unavailable"}
                                </span>
                            </div>

                            <div className="patient-vitals-grid">
                                {[
                                    ["Resting Blood Pressure", latestClinical.resting_bp, "mmHg"],
                                    ["Total Cholesterol", latestClinical.cholesterol, "mg/dL"],
                                    ["Max Heart Rate", latestClinical.max_heart_rate, "BPM"],
                                    ["Fasting Blood Sugar", latestClinical.fasting_blood_sugar == null ? null : (latestClinical.fasting_blood_sugar ? "> 120" : "≤ 120"), "mg/dL · category recorded"],
                                    ["ST Depression", latestClinical.st_depression, "mm"],
                                ].map(([label, value, unit]) => (
                                    <div className="patient-vital-card" key={label}>
                                        <div className="vital-card-top"><span className="vital-label">{label}</span><span className="vital-tag">{value == null ? "Not recorded" : "Recorded"}</span></div>
                                        <div className="vital-value-row"><span className="vital-num">{value == null ? "—" : value}</span><span className="vital-unit">{value == null ? "" : unit}</span></div>
                                    </div>
                                ))}
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

                    {latestEcgRecord && (
                        <div>
                            <EcgAnalysis ecg={{
                                status: ecgPrediction?.risk_level || "ECG assessment pending",
                                heartRate: ecgPrediction?.heart_rate_bpm,
                                rhythm: ecgPrediction?.rhythm_classification,
                                signalQuality: ecgPrediction?.metrics?.signal_quality || "Not reported",
                            }} />
                            {ecgPredictionError && <p className="form-error" role="status">{ecgPredictionError}</p>}
                            <p className="patient-ecg-data-note">Latest uploaded file: {latestEcgRecord.original_name || "ECG recording"}. The displayed waveform is illustrative because this API returns ECG measurements, not raw waveform samples.</p>
                        </div>
                    )}

                    {/* ----------------------------------------------------------------- */}
                    {/* POSITION 4 (LAST): PERSONALIZED HEART HEALTH GUIDANCE             */}
                    {/* ----------------------------------------------------------------- */}
                    <div>
                        <div className="patient-section-header">
                            <h3>Care information</h3>
                            <span className="last-sync-badge">General guidance</span>
                        </div>

                        <div className="patient-lifestyle-grid">
                            <div className="patient-plan-card">
                                <div className="plan-card-icon">ℹ️</div>
                                <h4>Discuss your results with your care provider</h4>
                                <p>This app displays recorded measurements and model outputs. A qualified clinician can interpret them in your health context and advise on next steps.</p>
                            </div>
                            <div className="patient-plan-card">
                                <div className="plan-card-icon">📞</div>
                                <h4>Need help?</h4>
                                <p>Contact your clinic using its usual phone number or patient portal. This app does not send messages or schedule appointments.</p>
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
                    {latestClinical && (
                        <section className="prediction-input-card" aria-labelledby="prediction-input-title">
                            <div>
                                <h3 id="prediction-input-title">Complete the model inputs</h3>
                                <p>The clinical model requires these additional values. They are used for this calculation and are not added to your saved clinical record.</p>
                            </div>
                            <div className="prediction-input-grid">
                                <label>Diastolic blood pressure (mmHg)
                                    <input type="number" min="1" max="200" value={modelInputs.diastolicBp} onChange={(e) => setModelInputs((current) => ({ ...current, diastolicBp: e.target.value }))} />
                                </label>
                                <label>Height (cm)
                                    <input type="number" min="1" max="300" step="0.1" value={modelInputs.height} onChange={(e) => setModelInputs((current) => ({ ...current, height: e.target.value }))} />
                                </label>
                                <label>Weight (kg)
                                    <input type="number" min="1" max="500" step="0.1" value={modelInputs.weight} onChange={(e) => setModelInputs((current) => ({ ...current, weight: e.target.value }))} />
                                </label>
                                {[["smoking", "Smoking status"], ["alcohol", "Alcohol use"], ["active", "Physically active"]].map(([name, label]) => (
                                    <label key={name}>{label}
                                        <select value={modelInputs[name]} onChange={(e) => setModelInputs((current) => ({ ...current, [name]: e.target.value }))}>
                                            <option value="">Select</option>
                                            <option value="1">Yes</option>
                                            <option value="0">No</option>
                                        </select>
                                    </label>
                                ))}
                            </div>
                        </section>
                    )}
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
                                {modelHealth
                                    ? `${modelHealth.model_name} · ${modelHealth.model_loaded ? "Model ready" : "Model unavailable"}${modelHealth.feature_count ? ` · ${modelHealth.feature_count} features` : ""}`
                                    : "Checking prediction service…"}
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
                                className="patient-btn outline"
                                style={{ fontSize: "13px", padding: "8px 14px" }}
                                onClick={() => setShowReportModal(true)}
                            >
                                👁️ Preview Report
                            </button>
                            <button
                                type="button"
                                className="patient-btn primary"
                                style={{ fontSize: "13px", padding: "8px 16px" }}
                                onClick={handleDirectPrint}
                            >
                                🖨️ Print Report (PDF)
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
                                    background: riskStatusTone === "warn" ? "#fef2f2" : riskStatusTone === "green" ? "#f0fdf4" : "#f8fafc",
                                    border: `1.5px solid ${riskStatusTone === "warn" ? "#fecaca" : riskStatusTone === "green" ? "#bbf7d0" : "#cbd5e1"}`,
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
                                                color: riskStatusTone === "warn" ? "#b91c1c" : riskStatusTone === "green" ? "#15803d" : "#475569",
                                            }}
                                        >
                                            STORED MODEL RESULT
                                        </span>
                                        <h2 style={{ margin: "4px 0 0", color: "#0f172a", fontSize: "26px", fontWeight: 800 }}>
                                            {riskStatusLabel}
                                        </h2>
                                    </div>
                                    <div
                                        style={{
                                            padding: "10px 22px",
                                            borderRadius: "24px",
                                            fontWeight: 800,
                                            fontSize: "14px",
                                            background: riskStatusTone === "warn" ? "#dc2626" : riskStatusTone === "green" ? "#16a34a" : "#64748b",
                                            color: "#ffffff",
                                            boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                                        }}
                                    >
                                        ● Model output
                                    </div>
                                </div>

                                <div style={{ background: "#ffffff", borderRadius: "10px", padding: "16px 20px", border: "1px solid rgba(0,0,0,0.06)" }}>
                                    <strong style={{ display: "block", color: "#0f172a", marginBottom: "4px", fontSize: "14px" }}>
                                        Review context:
                                    </strong>
                                    <p style={{ margin: 0, fontSize: "14px", color: "#334155", lineHeight: "1.6" }}>
                                        This stored model result is not a diagnosis. Confirm the source measurements and discuss the result with a qualified clinician.
                                    </p>
                                </div>
                            </div>

                            <section className="patient-model-features" aria-labelledby="patient-model-features-title">
                                <h3 id="patient-model-features-title">Model feature contributions</h3>
                                <p>Values below are model output. They are not clinical findings or treatment guidance.</p>
                                {featureContributions.length > 0 ? (
                                    <ul>
                                        {featureContributions.slice(0, 8).map((item, index) => (
                                            <li key={`${item.feature || "feature"}-${index}`}>
                                                <span>{item.feature || "Feature"}</span>
                                                <strong>{Number(item.importance ?? item.contribution).toFixed(3)}</strong>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p>No feature contribution data is available for this assessment.</p>
                                )}
                            </section>

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
                                                    const resultLabel = p.risk_level || p.predicted_label || "Assessment available";
                                                    const resultText = String(resultLabel).toLowerCase();
                                                    const resultTone = resultText.includes("high") || resultText.includes("abnormal")
                                                        ? "high"
                                                        : resultText.includes("low") || resultText.includes("normal") ? "low" : "pending";
                                                    return (
                                                        <tr key={p.id || idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                                            <td style={{ padding: "12px 14px", color: "#0f172a" }}>
                                                                {p.created_at ? new Date(p.created_at).toLocaleString() : "Time unavailable"}
                                                            </td>
                                                            <td style={{ padding: "12px 14px", color: "#64748b" }}>
                                                                {p.model_name || "Not recorded"}
                                                            </td>
                                                            <td style={{ padding: "12px 14px" }}>
                                                                <span
                                                                    style={{
                                                                        padding: "3px 10px",
                                                                        borderRadius: "12px",
                                                                        fontSize: "11px",
                                                                        fontWeight: 700,
                                                                        background: resultTone === "high" ? "#fee2e2" : resultTone === "low" ? "#dcfce7" : "#f1f5f9",
                                                                        color: resultTone === "high" ? "#991b1b" : resultTone === "low" ? "#166534" : "#475569",
                                                                    }}
                                                                >
                                                                    {resultLabel}
                                                                </span>
                                                            </td>
                                                            <td style={{ padding: "12px 14px", color: "#64748b" }}>
                                                                {Array.isArray(p.top_contributing_features) && p.top_contributing_features.length > 0
                                                                    ? p.top_contributing_features.slice(0, 3).join(", ")
                                                                    : "Not provided"}
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
                                    Generate a printable summary of the stored assessment and source data.
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
                                        className="patient-btn outline"
                                        onClick={() => setShowReportModal(true)}
                                    >
                                        👁️ Preview Report
                                    </button>
                                    <button
                                        type="button"
                                        className="patient-btn primary"
                                        onClick={handleDirectPrint}
                                    >
                                        🖨️ Print / Save as PDF
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {showContactModal && (
                <div className="patient-modal-overlay" onClick={() => setShowContactModal(false)}>
                    <div className="patient-modal-box" role="dialog" aria-modal="true" aria-labelledby="contact-care-title" onClick={(e) => e.stopPropagation()}>
                        <h3 id="contact-care-title">Contact your care team</h3>
                        <p style={{ fontSize: "13px", color: "#64748b" }}>Messaging and appointment scheduling are not available in this app. Please use your clinic’s usual contact method.</p>
                        <div className="modal-actions-row"><button type="button" className="patient-btn primary" onClick={() => setShowContactModal(false)}>Close</button></div>
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
                                    📄 Clinical Assessment Summary Preview
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
