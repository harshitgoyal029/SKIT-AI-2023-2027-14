import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../../services/api";

const ClinicianDashboardView = ({ currentUser }) => {
    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState("");
    const [notice, setNotice] = useState("");
    const [filterRisk, setFilterRisk] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");

    const clinicianName = currentUser?.full_name || currentUser?.name || "Clinical team";

    // Attempt to fetch live patients from backend
    useEffect(() => {
        const fetchPatients = async () => {
            setLoading(true);
            setLoadError("");
            try {
                const data = await apiRequest("/api/patients?limit=50");
                setPatients(Array.isArray(data?.patients) ? data.patients : []);
            } catch (requestError) {
                setLoadError(requestError.message || "Patient records could not be loaded.");
            } finally {
                setLoading(false);
            }
        };

        fetchPatients();
    }, []);

    const handleSelectPatient = (p) => {
        sessionStorage.setItem("cvd_xai_patient", JSON.stringify(p));
        setNotice(`${p.name || p.patientId || "Patient record"} is loaded for this session.`);
        window.dispatchEvent(new Event("cvd-xai:patient-selected"));
    };

    const filteredPatients = patients.filter((p) => {
        const matchesSearch =
            (p.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (p.patientId || p.patient_id || "").toLowerCase().includes(searchQuery.toLowerCase());

        const risk = p.riskLevel || p.risk_level || "";
        const matchesRisk =
            filterRisk === "all" ||
            risk.toLowerCase().includes(filterRisk.toLowerCase());

        return matchesSearch && matchesRisk;
    });

    const highRiskCount = patients.filter((p) =>
        (p.riskLevel || p.risk_level || "").toLowerCase().includes("high")
    ).length;
    const assessedCount = patients.filter((p) => p.risk_score !== null && p.risk_score !== undefined).length;
    const completeCount = patients.filter((p) => p.age && (p.gender || p.sex) && (p.bloodPressure || p.blood_pressure) && p.cholesterol != null).length;
    const completeness = patients.length ? Math.round((completeCount / patients.length) * 100) : null;

    return (
        <div className="clinician-dashboard-container">
            {/* Clinician Hero Card */}
            <div className="clinician-hero-card">
                <div className="clinician-hero-left">
                    <div className="clinician-icon-box">🔬</div>
                    <div>
                        <div className="clinician-badge-row">
                            <span className="clinician-portal-tag">Clinical Intake & Lab Management</span>
                            <span className="clinician-status-tag">● Clinical intake</span>
                        </div>
                        <h2>{clinicianName}</h2>
                        <p className="clinician-hero-sub">
                            Patient intake workflow, biomarker validation, and cohort risk monitoring.
                        </p>
                    </div>
                </div>

                <div className="clinician-hero-actions">
                    <Link
                        to="/data-upload"
                        className="clinician-action-btn"
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
                        <small>Records returned by the patient service</small>
                </div>

                <div className="cohort-metric-card">
                    <span className="metric-title">HIGH-RISK CASES FLAGGED</span>
                    <div className="metric-val-row">
                        <span className="metric-big text-warn">{highRiskCount}</span>
                        <span className="metric-delta warn">Priority</span>
                    </div>
                        <small>Based on available risk labels</small>
                </div>

                <div className="cohort-metric-card">
                    <span className="metric-title">DATA COMPLETENESS SCORE</span>
                    <div className="metric-val-row">
                        <span className="metric-big">{completeness === null ? "--" : `${completeness}%`}</span>
                        <span className="metric-delta">Vitals on file</span>
                    </div>
                    <small>Records with age, gender, blood pressure and cholesterol</small>
                </div>

                <div className="cohort-metric-card">
                    <span className="metric-title">ASSESSED RECORDS</span>
                    <div className="metric-val-row">
                        <span className="metric-big">{assessedCount}</span>
                        <span className="metric-delta">of {patients.length}</span>
                    </div>
                    <small>Records with a stored model risk score</small>
                </div>
            </div>

            {notice && <div className="form-success" role="status">{notice}</div>}

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
                            {loading && <tr><td colSpan="7">Loading patient records…</td></tr>}
                            {!loading && loadError && <tr><td colSpan="7" role="alert">{loadError}</td></tr>}
                            {!loading && !loadError && filteredPatients.length === 0 && (
                                <tr><td colSpan="7">{patients.length ? "No patients match these filters." : "No patient records are available yet. Register a patient to get started."}</td></tr>
                            )}
                            {filteredPatients.map((p, idx) => {
                                const riskStr = p.riskLevel || p.risk_level || "Pending assessment";
                                const isHigh = riskStr.toLowerCase().includes("high");
                                const isMod = riskStr.toLowerCase().includes("mod");
                                const isPending = riskStr.toLowerCase().includes("pending");
                                const patientId = p.patientId || p.patient_id || p.id || p._id;
                                const bloodPressure = p.bloodPressure || p.blood_pressure;

                                return (
                                    <tr key={patientId || idx}>
                                        <td>
                                            <span className="patient-id-badge">
                                                {patientId || "—"}
                                            </span>
                                        </td>
                                        <td>
                                            <strong>{p.name || "Unnamed"}</strong>
                                        </td>
                                        <td>
                                            {p.age || "—"} yrs • {p.gender || p.sex || "—"}
                                        </td>
                                        <td>{bloodPressure ? `${bloodPressure} mmHg` : "—"}</td>
                                        <td>{p.cholesterol != null ? `${p.cholesterol} mg/dL` : "—"}</td>
                                        <td>
                                            <span
                                                className={`risk-pill ${
                                                    isHigh ? "high" : isMod ? "moderate" : isPending ? "pending" : "low"
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
                    <h4>🧪 Clinical data review</h4>
                    <p>Confirm source, units and collection context for every value before using it in an assessment.</p>
                </div>
                <div className="guidance-card">
                    <h4>📈 12-Lead ECG Quality Assurance</h4>
                    <p>Review recording quality and confirm the lead configuration and sampling details before interpretation.</p>
                </div>
                <div className="guidance-card">
                    <h4>🛡 Cohort Privacy Compliance</h4>
                    <p>Follow your organization’s consent, access-control and data-retention procedures when handling records.</p>
                </div>
            </div>
        </div>
    );
};

export default ClinicianDashboardView;

