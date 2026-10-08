import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const SAMPLE_COHORT = [
    {
        patientId: "CVD-101",
        name: "Eleanor Vance",
        age: 62,
        gender: "Female",
        bloodPressure: "145/92",
        cholesterol: 238,
        heartRate: 82,
        riskLevel: "High Risk",
        registeredAt: "Today, 10:30 AM",
    },
    {
        patientId: "CVD-102",
        name: "Marcus Brody",
        age: 48,
        gender: "Male",
        bloodPressure: "124/80",
        cholesterol: 188,
        heartRate: 71,
        riskLevel: "Low Risk",
        registeredAt: "Today, 09:15 AM",
    },
    {
        patientId: "CVD-103",
        name: "Sophia Martinez",
        age: 55,
        gender: "Female",
        bloodPressure: "136/86",
        cholesterol: 210,
        heartRate: 76,
        riskLevel: "Moderate Risk",
        registeredAt: "Yesterday",
    },
    {
        patientId: "CVD-104",
        name: "Arthur Pendelton",
        age: 69,
        gender: "Male",
        bloodPressure: "152/96",
        cholesterol: 245,
        heartRate: 88,
        riskLevel: "High Risk",
        registeredAt: "Yesterday",
    },
    {
        patientId: "CVD-105",
        name: "Claire Dunphy",
        age: 42,
        gender: "Female",
        bloodPressure: "118/78",
        cholesterol: 172,
        heartRate: 68,
        riskLevel: "Low Risk",
        registeredAt: "2 days ago",
    },
];

const ClinicianDashboardView = ({ currentUser }) => {
    const navigate = useNavigate();
    const [patients, setPatients] = useState(SAMPLE_COHORT);
    const [loading, setLoading] = useState(false);
    const [filterRisk, setFilterRisk] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");

    const clinicianName = currentUser?.name || "Dr. Alex Mercer, Clinician";

    // Attempt to fetch live patients from backend
    useEffect(() => {
        const fetchPatients = async () => {
            setLoading(true);
            try {
                const res = await fetch("http://localhost:8000/api/patients?limit=20");
                if (res.ok) {
                    const data = await res.json();
                    if (data.patients && data.patients.length > 0) {
                        setPatients(data.patients);
                    }
                }
            } catch (e) {
                // Keep sample cohort on network error or offline backend
            } finally {
                setLoading(false);
            }
        };

        fetchPatients();
    }, []);

    const handleSelectPatient = (p) => {
        sessionStorage.setItem("cvd_xai_patient", JSON.stringify(p));
        alert(`Loaded patient ${p.name || p.patientId} into current session.`);
        window.dispatchEvent(new Event("storage"));
    };

    const filteredPatients = patients.filter((p) => {
        const matchesSearch =
            (p.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (p.patientId || "").toLowerCase().includes(searchQuery.toLowerCase());

        const risk = p.riskLevel || p.risk_level || "";
        const matchesRisk =
            filterRisk === "all" ||
            risk.toLowerCase().includes(filterRisk.toLowerCase());

        return matchesSearch && matchesRisk;
    });

    const highRiskCount = patients.filter((p) =>
        (p.riskLevel || p.risk_level || "").toLowerCase().includes("high")
    ).length;

    return (
        <div className="clinician-dashboard-container">
            {/* Clinician Hero Card */}
            <div className="clinician-hero-card">
                <div className="clinician-hero-left">
                    <div className="clinician-icon-box">🔬</div>
                    <div>
                        <div className="clinician-badge-row">
                            <span className="clinician-portal-tag">Clinical Intake & Lab Management</span>
                            <span className="clinician-status-tag">● Lab Services Active</span>
                        </div>
                        <h2>{clinicianName}</h2>
                        <p className="clinician-hero-sub">
                            Patient intake workflow, biomarker validation, and cohort risk monitoring.
                        </p>
                    </div>
                </div>

                <div className="clinician-hero-actions" style={{ display: "flex", gap: "10px" }}>
                    <Link
                        to="/data-upload"
                        className="clinician-action-btn"
                        style={{
                            background: "#ffffff",
                            border: "1.5px solid #ddd6fe",
                            color: "#7c3aed",
                            textDecoration: "none",
                            padding: "10px 18px",
                            borderRadius: "9px",
                            fontSize: "13px",
                            fontWeight: 600,
                        }}
                    >
                        📁 Upload Clinical / ECG
                    </Link>
                    <Link to="/patient-registration" className="clinician-action-btn primary">
                        ＋ New Patient Intake
                    </Link>
                </div>
            </div>

            {/* Cohort Key Operational Metrics */}
            <div className="cohort-metrics-grid">
                <div className="cohort-metric-card">
                    <span className="metric-title">TOTAL REGISTERED INTAKES</span>
                    <div className="metric-val-row">
                        <span className="metric-big">{patients.length}</span>
                        <span className="metric-delta pos">Active</span>
                    </div>
                    <small>Monitored cohort in clinic</small>
                </div>

                <div className="cohort-metric-card">
                    <span className="metric-title">HIGH-RISK CASES FLAGGED</span>
                    <div className="metric-val-row">
                        <span className="metric-big text-warn">{highRiskCount}</span>
                        <span className="metric-delta warn">Priority</span>
                    </div>
                    <small>Urgent cardiology review needed</small>
                </div>

                <div className="cohort-metric-card">
                    <span className="metric-title">DATA COMPLETENESS SCORE</span>
                    <div className="metric-val-row">
                        <span className="metric-big">99.4%</span>
                        <span className="metric-delta pos">High Quality</span>
                    </div>
                    <small>All required vitals & ECG logged</small>
                </div>

                <div className="cohort-metric-card">
                    <span className="metric-title">AVG. DNN PREDICTION TIME</span>
                    <div className="metric-val-row">
                        <span className="metric-big">1.2s</span>
                        <span className="metric-delta pos">Realtime</span>
                    </div>
                    <small>Instant AI inference turnaround</small>
                </div>
            </div>

            {/* Patient Registry Table & Controls */}
            <div className="clinician-registry-card">
                <div className="registry-card-header">
                    <div>
                        <h3>Clinical Cohort Registry</h3>
                        <p>Search, review, and load patient case records for immediate evaluation.</p>
                    </div>

                    <div className="registry-filters">
                        <input
                            type="text"
                            placeholder="Search by name or ID..."
                            className="registry-search-input"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />

                        <select
                            className="registry-filter-select"
                            value={filterRisk}
                            onChange={(e) => setFilterRisk(e.target.value)}
                        >
                            <option value="all">All Risk Levels</option>
                            <option value="high">High Risk</option>
                            <option value="moderate">Moderate Risk</option>
                            <option value="low">Low Risk</option>
                        </select>
                    </div>
                </div>

                <div className="registry-table-wrapper">
                    <table className="registry-table">
                        <thead>
                            <tr>
                                <th>Patient ID</th>
                                <th>Name</th>
                                <th>Age / Gender</th>
                                <th>Blood Pressure</th>
                                <th>Cholesterol</th>
                                <th>Risk Assessment</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredPatients.map((p, idx) => {
                                const riskStr = p.riskLevel || p.risk_level || "Pending";
                                const isHigh = riskStr.toLowerCase().includes("high");
                                const isMod = riskStr.toLowerCase().includes("mod");

                                return (
                                    <tr key={p.patientId || p._id || idx}>
                                        <td>
                                            <span className="patient-id-badge">
                                                {p.patientId || "CVD-XXX"}
                                            </span>
                                        </td>
                                        <td>
                                            <strong>{p.name || "Unnamed"}</strong>
                                        </td>
                                        <td>
                                            {p.age || "--"} yrs • {p.gender || "--"}
                                        </td>
                                        <td>{p.bloodPressure || "--"} mmHg</td>
                                        <td>{p.cholesterol ? `${p.cholesterol} mg/dL` : "--"}</td>
                                        <td>
                                            <span
                                                className={`risk-pill ${
                                                    isHigh ? "high" : isMod ? "moderate" : "low"
                                                }`}
                                            >
                                                {riskStr}
                                            </span>
                                        </td>
                                        <td>
                                            <button
                                                type="button"
                                                className="load-case-btn"
                                                onClick={() => handleSelectPatient(p)}
                                            >
                                                Load Case
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Clinical Intake Quick Checklist */}
            <div className="clinician-guidance-grid">
                <div className="guidance-card">
                    <h4>🧪 Biomarker Entry Standard</h4>
                    <p>
                        Verify serum cholesterol and fasting glucose within 12 hours of collection.
                        Ensure blood pressure is measured after 5 minutes of seated rest.
                    </p>
                </div>
                <div className="guidance-card">
                    <h4>📈 12-Lead ECG Quality Assurance</h4>
                    <p>
                        Check electrode contact impedance before recording. Reject waveforms with baseline
                        wander exceeding 0.5 mV.
                    </p>
                </div>
                <div className="guidance-card">
                    <h4>🛡 Cohort Privacy Compliance</h4>
                    <p>
                        All uploaded clinical records are hashed and stored with institutional patient identifiers
                        in compliance with HIPAA guidelines.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ClinicianDashboardView;

