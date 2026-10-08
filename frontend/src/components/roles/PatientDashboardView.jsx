import React, { useState } from "react";
import { Link } from "react-router-dom";

const PatientDashboardView = ({ patient, currentUser }) => {
    const [vitalLogged, setVitalLogged] = useState(false);
    const [showContactModal, setShowContactModal] = useState(false);

    // Extract patient details
    const patientName = currentUser?.name || patient?.name || "Jane Doe";
    const patientEmail = currentUser?.email || patient?.email || "patient@cardioxai.org";
    const bpValue = patient?.bloodPressure || "120/80";
    const hrValue = patient?.heartRate || 72;
    const cholValue = patient?.cholesterol || 185;
    const glucoseValue = patient?.fastingBloodSugar || 94;
    const bmiValue = patient?.bmi || 23.4;

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
                            <span className="patient-portal-tag">Patient Health Portal</span>
                            <span className="patient-status-pill green">● Status: Stable</span>
                        </div>
                        <h2>Welcome back, {patientName}</h2>
                        <p className="patient-hero-sub">
                            Here is your personalized cardiovascular wellness summary and daily care plan.
                        </p>
                    </div>
                </div>

                <div className="patient-hero-actions">
                    <Link
                        to="/data-upload"
                        className="patient-btn primary"
                        style={{ textDecoration: "none" }}
                    >
                        📁 Upload Vitals & ECG
                    </Link>
                    <button
                        type="button"
                        className="patient-btn outline"
                        onClick={handlePrintSummary}
                    >
                        📄 Download Summary
                    </button>
                    <button
                        type="button"
                        className="patient-btn primary"
                        onClick={() => setShowContactModal(true)}
                    >
                        🩺 Message Doctor
                    </button>
                </div>
            </div>

            {/* Health Status Banner */}
            <div className="patient-status-banner">
                <div className="status-banner-left">
                    <span className="status-icon">✓</span>
                    <div>
                        <strong>Overall Cardiovascular Score: Low Risk (Optimal)</strong>
                        <p>
                            Your clinical vitals and ECG records indicate healthy heart function with no acute risk factors.
                        </p>
                    </div>
                </div>
                <div className="status-banner-careteam">
                    <small>Attending Cardiologist</small>
                    <strong>Dr. Sarah Johnson, MD</strong>
                </div>
            </div>

            {/* Vitals Grid with Visual Status */}
            <div className="patient-section-header">
                <h3>My Latest Vital Signs</h3>
                <span className="last-sync-badge">Last measured: 2 days ago at clinic</span>
            </div>

            <div className="patient-vitals-grid">
                <div className="patient-vital-card">
                    <div className="vital-card-top">
                        <span className="vital-label">Blood Pressure</span>
                        <span className="vital-tag optimal">Normal</span>
                    </div>
                    <div className="vital-value-row">
                        <span className="vital-num">{bpValue}</span>
                        <span className="vital-unit">mmHg</span>
                    </div>
                    <div className="vital-range-bar">
                        <div className="range-fill optimal" style={{ width: "65%" }}></div>
                    </div>
                    <small className="vital-target">Target range: &lt; 120/80 mmHg</small>
                </div>

                <div className="patient-vital-card">
                    <div className="vital-card-top">
                        <span className="vital-label">Resting Heart Rate</span>
                        <span className="vital-tag optimal">Normal</span>
                    </div>
                    <div className="vital-value-row">
                        <span className="vital-num">{hrValue}</span>
                        <span className="vital-unit">BPM</span>
                    </div>
                    <div className="vital-range-bar">
                        <div className="range-fill optimal" style={{ width: "60%" }}></div>
                    </div>
                    <small className="vital-target">Target range: 60 - 100 BPM</small>
                </div>

                <div className="patient-vital-card">
                    <div className="vital-card-top">
                        <span className="vital-label">Total Cholesterol</span>
                        <span className="vital-tag optimal">Desirable</span>
                    </div>
                    <div className="vital-value-row">
                        <span className="vital-num">{cholValue}</span>
                        <span className="vital-unit">mg/dL</span>
                    </div>
                    <div className="vital-range-bar">
                        <div className="range-fill optimal" style={{ width: "55%" }}></div>
                    </div>
                    <small className="vital-target">Target range: &lt; 200 mg/dL</small>
                </div>

                <div className="patient-vital-card">
                    <div className="vital-card-top">
                        <span className="vital-label">Fasting Glucose</span>
                        <span className="vital-tag optimal">Healthy</span>
                    </div>
                    <div className="vital-value-row">
                        <span className="vital-num">{glucoseValue}</span>
                        <span className="vital-unit">mg/dL</span>
                    </div>
                    <div className="vital-range-bar">
                        <div className="range-fill optimal" style={{ width: "50%" }}></div>
                    </div>
                    <small className="vital-target">Target range: 70 - 99 mg/dL</small>
                </div>

                <div className="patient-vital-card">
                    <div className="vital-card-top">
                        <span className="vital-label">Body Mass Index (BMI)</span>
                        <span className="vital-tag optimal">Healthy Weight</span>
                    </div>
                    <div className="vital-value-row">
                        <span className="vital-num">{bmiValue}</span>
                        <span className="vital-unit">kg/m²</span>
                    </div>
                    <div className="vital-range-bar">
                        <div className="range-fill optimal" style={{ width: "58%" }}></div>
                    </div>
                    <small className="vital-target">Target range: 18.5 - 24.9</small>
                </div>
            </div>

            {/* ECG & Rhythm Summary */}
            <div className="patient-ecg-card">
                <div className="patient-ecg-icon">📈</div>
                <div className="patient-ecg-content">
                    <h4>Latest 12-Lead ECG Summary</h4>
                    <p>
                        <strong>Result: Normal Sinus Rhythm</strong> — Your cardiac telemetry confirms a steady rate
                        without irregular beats, conduction delays, or ST-segment abnormalities.
                    </p>
                    <div className="patient-ecg-tags">
                        <span>PR Interval: 142 ms (Normal)</span>
                        <span>QRS Duration: 88 ms (Narrow)</span>
                        <span>QTc: 410 ms (Normal)</span>
                    </div>
                </div>
            </div>

            {/* Daily Care Plan & Lifestyle Tips */}
            <div className="patient-section-header">
                <h3>Your Heart Health Care Plan</h3>
                <span className="last-sync-badge">Recommended by Cardiology Clinic</span>
            </div>

            <div className="patient-lifestyle-grid">
                <div className="patient-plan-card">
                    <div className="plan-card-icon">🥗</div>
                    <h4>Heart-Healthy Diet</h4>
                    <p>
                        Focus on rich dietary fiber, olive oil, walnuts, and green vegetables.
                        Limit dietary sodium to under 2,000 mg daily to preserve optimal blood pressure.
                    </p>
                    <span className="plan-pill">Target: &lt; 2g Sodium / Day</span>
                </div>

                <div className="patient-plan-card">
                    <div className="plan-card-icon">🚶‍♀️</div>
                    <h4>Aerobic Activity</h4>
                    <p>
                        Engage in 30 minutes of brisk walking, swimming, or cycling at least 5 days a week.
                        Regular exercise strengthens cardiac muscle and helps maintain HDL cholesterol.
                    </p>
                    <span className="plan-pill">Goal: 150 Mins / Week</span>
                </div>

                <div className="patient-plan-card">
                    <div className="plan-card-icon">💊</div>
                    <h4>Medication & Reminders</h4>
                    <p>
                        Take your preventative cardiovascular support every morning with water.
                        Set an alarm to never miss a dose, and report any palpitations immediately.
                    </p>
                    <span className="plan-pill">Daily adherence: 100%</span>
                </div>

                <div className="patient-plan-card">
                    <div className="plan-card-icon">📅</div>
                    <h4>Next Clinical Appointment</h4>
                    <p>
                        Your next scheduled assessment with Dr. Sarah Johnson is booked for comprehensive follow-up.
                        Bring your home blood pressure logs to the consultation.
                    </p>
                    <span className="plan-pill highlight">Scheduled: In 8 Weeks</span>
                </div>
            </div>

            {/* Message Doctor Modal */}
            {showContactModal && (
                <div className="patient-modal-overlay" onClick={() => setShowContactModal(false)}>
                    <div className="patient-modal-box" onClick={(e) => e.stopPropagation()}>
                        <h3>🩺 Contact Cardiology Care Team</h3>
                        <p>
                            Send a secure question to <strong>Dr. Sarah Johnson, MD</strong> or request a prescription refill.
                        </p>
                        <textarea
                            className="patient-message-input"
                            rows={4}
                            placeholder="Type your message, questions regarding symptoms, or prescription queries..."
                        />
                        <div className="modal-actions-row">
                            <button
                                type="button"
                                className="patient-btn outline"
                                onClick={() => setShowContactModal(false)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="patient-btn primary"
                                onClick={() => {
                                    alert("Message transmitted to Dr. Sarah Johnson's cardiology inbox.");
                                    setShowContactModal(false);
                                }}
                            >
                                Send Message
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PatientDashboardView;

