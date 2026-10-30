import React, { lazy, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

import { getStoredUser } from "../services/authService";

const PatientDashboardView = lazy(() => import("../components/roles/PatientDashboardView"));
const DoctorDashboardView = lazy(() => import("../components/roles/DoctorDashboardView"));
const ClinicianDashboardView = lazy(() => import("../components/roles/ClinicianDashboardView"));

const Dashboard = ({ activeView }) => {
    const location = useLocation();
    const currentView = activeView || (location.pathname === "/prediction-results" ? "predictions" : "dashboard");
    const [patient, setPatient] = useState(null);

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

    // Load the selected patient from this browser session.
    useEffect(() => {
        const loadPatient = () => {
            const savedPatient = sessionStorage.getItem("cvd_xai_patient");
            if (savedPatient) {
                try {
                    const parsedPatient = JSON.parse(savedPatient);
                    setPatient(parsedPatient);
                } catch (error) {
                    setPatient(null);
                }
            } else {
                setPatient(null);
            }
        };

        loadPatient();
        window.addEventListener("cvd-xai:patient-selected", loadPatient);
        window.addEventListener("storage", loadPatient);
        return () => {
            window.removeEventListener("cvd-xai:patient-selected", loadPatient);
            window.removeEventListener("storage", loadPatient);
        };
    }, []);

    return (
        <div className="page">
            {/* Strictly Role-Enforced Dashboard View */}
            {activeRole === "patient" && (
                <PatientDashboardView
                    patient={patient}
                    currentUser={currentUser}
                    activeView={currentView}
                />
            )}

            {activeRole === "doctor" && (
                <DoctorDashboardView
                    patient={patient}
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
