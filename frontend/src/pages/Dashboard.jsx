import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getDashboardTestData } from "../services/dashboardService";
import { getStoredUser } from "../services/authService";

import PatientDashboardView from "../components/roles/PatientDashboardView";
import DoctorDashboardView from "../components/roles/DoctorDashboardView";
import ClinicianDashboardView from "../components/roles/ClinicianDashboardView";

const Dashboard = () => {
    const [patient, setPatient] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [testData, setTestData] = useState(null);
    const [testDataLoading, setTestDataLoading] = useState(false);
    const [testDataError, setTestDataError] = useState("");

    // Strictly enforce role from authenticated session (Point 3)
    const getAuthenticatedUser = () => {
        try {
            const user = getStoredUser();
            if (user) return user;
            const stored = localStorage.getItem("cvd_user");
            return stored ? JSON.parse(stored) : null;
        } catch {
            return null;
        }
    };

    const [currentUser, setCurrentUser] = useState(getAuthenticatedUser);

    const getActiveRole = () => {
        const user = getAuthenticatedUser();
        return user?.role || localStorage.getItem("cvd_role") || "patient";
    };

    const [activeRole, setActiveRole] = useState(getActiveRole);

    // Sync auth and role changes across windows or actions
    useEffect(() => {
        const syncAuth = () => {
            const user = getAuthenticatedUser();
            setCurrentUser(user);
            setActiveRole(user?.role || localStorage.getItem("cvd_role") || "patient");
        };

        syncAuth();
        window.addEventListener("storage", syncAuth);
        return () => window.removeEventListener("storage", syncAuth);
    }, []);

    // Load sample / test data for doctor/clinician diagnostic components
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

    const userDisplayName = currentUser?.full_name || currentUser?.name || (
        activeRole === "patient"
            ? "Jane Doe (Patient)"
            : activeRole === "doctor"
            ? "Dr. Sarah Johnson, MD"
            : "Dr. Alex Mercer, Clinician"
    );

    return (
        <div className="page">
            {/* Authenticated Role Portal Banner (Role switcher tabs permanently removed — Point 3) */}
            <div className="role-switcher-banner">
                <div className="role-switcher-left">
                    <span className={`role-indicator-badge ${activeRole}`}>
                        {activeRole === "patient" && "🫀 Patient Portal"}
                        {activeRole === "doctor" && "🩺 Cardiology Doctor Suite"}
                        {activeRole === "clinician" && "🔬 Clinical Intake & Registry"}
                        {activeRole === "admin" && "⚙️ System Administrator"}
                    </span>
                    <span style={{ fontSize: "13px", color: "#64748b" }}>
                        Signed in as: <strong style={{ color: "#0f172a" }}>{userDisplayName}</strong> ({currentUser?.email || "Authenticated User"})
                    </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <Link
                        to="/data-upload"
                        className="secondary-btn"
                        style={{ fontSize: "12px", padding: "6px 14px", textDecoration: "none" }}
                    >
                        📁 Upload Vitals & ECG
                    </Link>
                </div>
            </div>

            {/* Strictly Role-Enforced Dashboard View */}
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

            {(activeRole === "clinician" || activeRole === "admin") && (
                <ClinicianDashboardView currentUser={currentUser} />
            )}

            {/* Note: System Diagnostic Inspection Tool permanently deleted — Point 2 */}
        </div>
    );
};

export default Dashboard;