import React, { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { getStoredUser } from "../services/authService";

const ROLE_NAV = {
    patient: {
        roleTitle: "PATIENT PORTAL",
        badge: "🫀 Patient",
        links: [
            { to: "/dashboard", icon: "🫀", label: "My Heart Health" },
            { to: "/data-upload", icon: "📁", label: "Upload Vitals & ECG" },
        ],
    },
    doctor: {
        roleTitle: "CARDIOLOGY SUITE",
        badge: "🩺 Doctor",
        links: [
            { to: "/dashboard", icon: "📊", label: "Diagnostic Dashboard" },
            { to: "/patient-registration", icon: "👥", label: "Patient Cases" },
            { to: "/data-upload", icon: "📁", label: "Upload Clinical & ECG" },
        ],
    },
    clinician: {
        roleTitle: "CLINICAL INTAKE",
        badge: "🔬 Clinician",
        links: [
            { to: "/dashboard", icon: "▣", label: "Cohort Overview" },
            { to: "/patient-registration", icon: "＋", label: "New Patient Intake" },
            { to: "/data-upload", icon: "📁", label: "Upload Clinical & ECG" },
        ],
    },
};

const getRole = () => getStoredUser()?.role || localStorage.getItem("cvd_role") || "patient";

const Sidebar = ({ isOpen = true, onClose }) => {
    const [currentRole, setCurrentRole] = useState(getRole);

    useEffect(() => {
        setCurrentRole(getRole());

        const handleStorageChange = () => {
            setCurrentRole(getRole());
        };

        window.addEventListener("storage", handleStorageChange);
        return () => window.removeEventListener("storage", handleStorageChange);
    }, []);

    const roleConfig = ROLE_NAV[currentRole] || ROLE_NAV.clinician;

    const getLinkClass = ({ isActive }) =>
        isActive ? "sidebar-link active" : "sidebar-link";

    return (
        <>
            {isOpen && (
                <div
                    className="sidebar-overlay"
                    onClick={onClose}
                />
            )}

            <aside className={`sidebar ${isOpen ? "sidebar-visible" : "sidebar-hidden"}`}>
                <div className="sidebar-title">
                    <span>{roleConfig.roleTitle}</span>
                </div>

                <nav className="sidebar-nav">
                    {roleConfig.links.map((link, index) => (
                        <NavLink
                            key={`${link.label}-${index}`}
                            to={link.to}
                            className={getLinkClass}
                            onClick={onClose}
                        >
                            <span className="sidebar-icon">{link.icon}</span>
                            <span>{link.label}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="sidebar-info">
                    <div className="sidebar-info-icon">♥</div>
                    <div>
                        <strong>CVD-XAI</strong>
                        <small>{roleConfig.badge} Active</small>
                    </div>
                </div>

                <div className="sidebar-bottom">
                    <div className="system-status">
                        <span className="status-dot"></span>
                        <div>
                            <strong>System Online</strong>
                            <small>AI services ready</small>
                        </div>
                    </div>

                    <div className="sidebar-version">
                        <span>Clinical Platform</span>
                        <span>v1.0</span>
                    </div>
                </div>
            </aside>
        </>
    );
};

export default Sidebar;