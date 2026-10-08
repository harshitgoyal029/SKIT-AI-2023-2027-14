import React, { useState } from "react";
import ShapChart from "../ShapChart";
import EcgAnalysis from "../EcgAnalysis";
import AIReport from "../AIReport";

const DoctorDashboardView = ({ patient, testData, currentUser }) => {
    const [doctorTab, setDoctorTab] = useState("diagnostic");

    const doctorName = currentUser?.name || "Dr. Sarah Johnson, MD";
    const patientName = patient?.name || testData?.patient?.patientName || "Jane Doe";
    const patientAge = patient?.age || testData?.patient?.age || 54;
    const patientGender = patient?.gender || testData?.patient?.gender || "Female";
    const patientBp = patient?.bloodPressure || testData?.patient?.bloodPressure || "138/88";
    const patientChol = patient?.cholesterol || testData?.patient?.cholesterol || 215;
    const patientHr = patient?.heartRate || testData?.patient?.heartRate || 78;

    const riskScore = testData?.assessment?.riskScore || 62;
    const confidence = testData?.assessment?.confidence || 87;

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
                                    <span className="risk-level-badge moderate">
                                        ● Moderate-High Risk
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
                                    <span className="bio-flag warn">Elevated</span>
                                </div>
                                <div className="biomarker-item">
                                    <span className="bio-name">Total Cholesterol</span>
                                    <strong>{patientChol} mg/dL</strong>
                                    <span className="bio-flag warn">Borderline High</span>
                                </div>
                                <div className="biomarker-item">
                                    <span className="bio-name">Resting Heart Rate</span>
                                    <strong>{patientHr} BPM</strong>
                                    <span className="bio-flag ok">Normal</span>
                                </div>
                                <div className="biomarker-item">
                                    <span className="bio-name">High-Sensitivity Troponin</span>
                                    <strong>0.012 ng/mL</strong>
                                    <span className="bio-flag ok">Non-Ischemic</span>
                                </div>
                            </div>
                        </div>

                        <div className="doctor-card protocol-card">
                            <span className="card-kicker">ACC / AHA CLINICAL PROTOCOL</span>
                            <h3>Recommended Interventions</h3>
                            <ul className="protocol-checklist">
                                <li>
                                    <strong>Moderate-Intensity Statin Therapy</strong>
                                    <span>Atorvastatin 20mg daily recommended for primary prevention.</span>
                                </li>
                                <li>
                                    <strong>Blood Pressure Optimization</strong>
                                    <span>Target BP &lt; 130/80 mmHg via lifestyle or low-dose ACEi.</span>
                                </li>
                                <li>
                                    <strong>ECG Telemetry Monitoring</strong>
                                    <span>Repeat 12-lead ECG and echocardiogram in 6 months.</span>
                                </li>
                            </ul>
                        </div>
                    </div>

                    {/* ECG Lead Waveform Telemetry */}
                    <div className="doctor-card ecg-wrapper-card">
                        <EcgAnalysis patient={patient} testData={testData} />
                    </div>
                </div>
            )}

            {/* Tab 2: SHAP Explainability */}
            {doctorTab === "explainability" && (
                <div className="doctor-tab-content">
                    <div className="doctor-card xai-wrapper-card">
                        <div className="xai-header-intro">
                            <h3>SHAP (SHapley Additive exPlanations) Diagnostic Attribution</h3>
                            <p>
                                Quantifying each clinical biomarker's exact mathematical impact on increasing or mitigating
                                the patient's cardiovascular risk score.
                            </p>
                        </div>
                        <ShapChart testData={testData} />
                    </div>
                </div>
            )}

            {/* Tab 3: Clinical AI Report */}
            {doctorTab === "report" && (
                <div className="doctor-tab-content">
                    <AIReport patient={patient} testData={testData} />
                </div>
            )}
        </div>
    );
};

export default DoctorDashboardView;

