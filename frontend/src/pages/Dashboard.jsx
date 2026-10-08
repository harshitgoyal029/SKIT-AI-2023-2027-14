import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
    getDashboardTestData,
    getRiskClass,
    getRiskDescription,
} from "../services/dashboardService";

import PatientDashboardView from "../components/roles/PatientDashboardView";
import DoctorDashboardView from "../components/roles/DoctorDashboardView";
import ClinicianDashboardView from "../components/roles/ClinicianDashboardView";

import ClinicalStatistics from "../components/ClinicalStatistics";
import ShapChart from "../components/ShapChart";
import EcgAnalysis from "../components/EcgAnalysis";
import AIReport from "../components/AIReport";

const Dashboard = () => {
    const [patient, setPatient] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [testData, setTestData] = useState(null);
    const [testDataLoading, setTestDataLoading] = useState(false);
    const [testDataError, setTestDataError] = useState("");
    const [showSystemDiagnosticView, setShowSystemDiagnosticView] = useState(false);

    // Active role management
    const [activeRole, setActiveRole] = useState(() => {
        return localStorage.getItem("cvd_role") || "clinician";
    });

    const [currentUser, setCurrentUser] = useState(() => {
        try {
            const stored = localStorage.getItem("cvd_user");
            return stored ? JSON.parse(stored) : null;
        } catch {
            return null;
        }
    });

    // Sync auth and role changes across windows or actions
    useEffect(() => {
        const syncAuth = () => {
            const role = localStorage.getItem("cvd_role") || "clinician";
            setActiveRole(role);
            try {
                const stored = localStorage.getItem("cvd_user");
                setCurrentUser(stored ? JSON.parse(stored) : null);
            } catch {
                setCurrentUser(null);
            }
        };

        syncAuth();
        window.addEventListener("storage", syncAuth);
        return () => window.removeEventListener("storage", syncAuth);
    }, []);

    // Load sample / test data for diagnostic components
    const loadTestData = async (currentPatient = null) => {
        setTestDataLoading(true);
        setTestDataError("");

        try {
            const data = await getDashboardTestData(currentPatient);
            setTestData(data);
            setLastUpdated(new Date());
        } catch (error) {
            console.error("Unable to load dashboard test data:", error);
            setTestDataError("Dashboard test data could not be loaded.");
        } finally {
            setTestDataLoading(false);
        }
    };

    // Load patient from session storage
    useEffect(() => {
        const loadPatient = () => {
            const savedPatient = sessionStorage.getItem("cvd_xai_patient");
            if (savedPatient) {
                try {
                    const parsedPatient = JSON.parse(savedPatient);
                    setPatient(parsedPatient);
                    setLastUpdated(new Date());
                    loadTestData(parsedPatient);
                } catch (error) {
                    setPatient(null);
                    loadTestData(null);
                }
            } else {
                setPatient(null);
                loadTestData(null);
            }
        };

        loadPatient();
        window.addEventListener("storage", loadPatient);
        return () => window.removeEventListener("storage", loadPatient);
    }, []);

    const handleSwitchRoleView = (newRole) => {
        setActiveRole(newRole);
        localStorage.setItem("cvd_role", newRole);
        window.dispatchEvent(new Event("storage"));
    };

    const userName = currentUser?.name || (
        activeRole === "patient"
            ? "Jane Doe (Patient)"
            : activeRole === "doctor"
            ? "Dr. Sarah Johnson, MD"
            : "Dr. Alex Mercer, Clinician"
    );

    return (
        <div className="page">
            {/* Role Portal Indicator & Switcher Banner */}
            <div className="role-switcher-banner">
                <div className="role-switcher-left">
                    <span className={`role-indicator-badge ${activeRole}`}>
                        {activeRole === "patient" && "🫀 Patient Portal"}
                        {activeRole === "doctor" && "🩺 Cardiology Doctor Suite"}
                        {activeRole === "clinician" && "🔬 Clinical Intake & Lab Operations"}
                    </span>
                    <span style={{ fontSize: "13px", color: "#64748b" }}>
                        Active Profile: <strong>{userName}</strong>
                    </span>
                </div>

                <div className="role-switcher-tabs">
                    <span style={{ fontSize: "11px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase" }}>
                        Switch Role View:
                    </span>
                    <button
                        type="button"
                        className={`role-switcher-btn ${activeRole === "patient" ? "active patient" : ""}`}
                        onClick={() => handleSwitchRoleView("patient")}
                    >
                        🫀 Patient
                    </button>
                    <button
                        type="button"
                        className={`role-switcher-btn ${activeRole === "doctor" ? "active doctor" : ""}`}
                        onClick={() => handleSwitchRoleView("doctor")}
                    >
                        🩺 Doctor
                    </button>
                    <button
                        type="button"
                        className={`role-switcher-btn ${activeRole === "clinician" ? "active clinician" : ""}`}
                        onClick={() => handleSwitchRoleView("clinician")}
                    >
                        🔬 Clinician
                    </button>
                </div>
            </div>

            {/* Dedicated Role Dashboard Views */}
            {activeRole === "patient" && (
                <PatientDashboardView patient={patient} currentUser={currentUser} />
            )}

            {activeRole === "doctor" && (
                <DoctorDashboardView
                    patient={patient}
                    testData={testData}
                    currentUser={currentUser}
                />
            )}

            {activeRole === "clinician" && (
                <ClinicianDashboardView currentUser={currentUser} />
            )}

            {/* Collapsible System Diagnostic Inspector Toggle */}
            <div style={{ marginTop: "36px", paddingTop: "20px", borderTop: "1px dashed #cbd5e1", textAlign: "center" }}>
                <button
                    type="button"
                    className="secondary-btn"
                    style={{ fontSize: "12px", padding: "6px 14px" }}
                    onClick={() => setShowSystemDiagnosticView(!showSystemDiagnosticView)}
                >
                    {showSystemDiagnosticView ? "▲ Hide System Diagnostic Tools" : "▼ Show System Diagnostic Inspection Tools"}
                </button>
            </div>

            {showSystemDiagnosticView && (
                <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "24px" }}>
                    <div className="card">
                        <h3>Full Cohort Statistics</h3>
                        <ClinicalStatistics testData={testData} />
                    </div>
                    <div className="card">
                        <h3>Telemetry & XAI Inspection</h3>
                        <EcgAnalysis patient={patient} testData={testData} />
                        <ShapChart testData={testData} />
                    </div>
                    {testData && (
                        <AIReport patient={patient} testData={testData} />
                    )}
                </div>
            )}
        </div>
    );
};

export default Dashboard;