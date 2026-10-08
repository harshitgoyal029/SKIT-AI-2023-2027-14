import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const ROLE_BADGES = {
    doctor: { label: "Doctor (Cardiologist)", initials: "DR", color: "#0d9488", icon: "🩺" },
    clinician: { label: "Clinician / Lab", initials: "CL", color: "#7c3aed", icon: "🔬" },
    patient: { label: "Patient", initials: "PT", color: "#0284c7", icon: "🫀" },
    admin: { label: "Administrator", initials: "AD", color: "#e11d48", icon: "🛡" },
};

const Navbar = ({ onMenuClick }) => {
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState(0);
    const [showProfile, setShowProfile] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [currentUser, setCurrentUser] = useState(null);

    useEffect(() => {
        // Load logged in user info
        const stored = localStorage.getItem("cvd_user");
        if (stored) {
            try {
                setCurrentUser(JSON.parse(stored));
            } catch (e) {
                setCurrentUser(null);
            }
        }

        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 60000);

        return () => clearInterval(timer);
    }, []);

    const toggleNotifications = () => {
        setNotifications(0);
    };

    const toggleProfile = () => {
        setShowProfile((previousState) => !previousState);
    };

    const handleSignOut = () => {
        localStorage.removeItem("cvd_token");
        localStorage.removeItem("cvd_user");
        localStorage.removeItem("cvd_role");
        setShowProfile(false);
        navigate("/login");
    };

    const formattedTime = currentTime.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
    });

    const userRole = currentUser?.role || "clinician";
    const roleMeta = ROLE_BADGES[userRole] || ROLE_BADGES.clinician;
    const userName = currentUser?.name || "Dr. Alex Mercer";

    return (
        <header className="navbar">
            <div className="navbar-left">
                <button
                    type="button"
                    className="menu-button"
                    onClick={onMenuClick}
                    aria-label="Toggle navigation"
                >
                    ☰
                </button>

                <div className="logo-icon">♥</div>

                <div>
                    <h2>CVD-XAI</h2>
                    <span>Clinical Intelligence</span>
                </div>
            </div>

            <div className="navbar-right">
                <div className="navbar-time">
                    <span>{roleMeta.icon} {roleMeta.label}</span>
                    <strong>{formattedTime}</strong>
                </div>

                <button
                    type="button"
                    className="notification"
                    onClick={toggleNotifications}
                    aria-label="Notifications"
                >
                    🔔
                    {notifications > 0 && (
                        <span className="notification-badge">
                            {notifications}
                        </span>
                    )}
                </button>

                <div className="profile-container">
                    <button
                        type="button"
                        className="profile"
                        onClick={toggleProfile}
                    >
                        <div
                            className="profile-avatar"
                            style={{ background: roleMeta.color }}
                        >
                            {roleMeta.initials}
                        </div>

                        <div>
                            <strong>{userName}</strong>
                            <span>{roleMeta.label}</span>
                        </div>

                        <span className="profile-arrow">
                            {showProfile ? "▲" : "▼"}
                        </span>
                    </button>

                    {showProfile && (
                        <div className="profile-menu">
                            <div className="profile-menu-header">
                                <div
                                    className="profile-avatar large"
                                    style={{ background: roleMeta.color }}
                                >
                                    {roleMeta.initials}
                                </div>

                                <div>
                                    <strong>{userName}</strong>
                                    <span style={{ color: roleMeta.color }}>
                                        {roleMeta.label}
                                    </span>
                                    {currentUser?.email && (
                                        <small className="profile-menu-email">
                                            {currentUser.email}
                                        </small>
                                    )}
                                </div>
                            </div>

                            <div className="profile-menu-divider"></div>

                            <Link
                                to="/dashboard"
                                className="profile-menu-item"
                                onClick={() => setShowProfile(false)}
                            >
                                📊 Dashboard
                            </Link>

                            <Link
                                to="/patient-registration"
                                className="profile-menu-item"
                                onClick={() => setShowProfile(false)}
                            >
                                ＋ New Patient Intake
                            </Link>

                            <div className="profile-menu-divider"></div>

                            {currentUser ? (
                                <button
                                    type="button"
                                    className="profile-menu-item sign-out-btn"
                                    onClick={handleSignOut}
                                >
                                    🚪 Sign Out ({roleMeta.label})
                                </button>
                            ) : (
                                <Link
                                    to="/login"
                                    className="profile-menu-item sign-in-btn"
                                    onClick={() => setShowProfile(false)}
                                >
                                    🔑 Switch Portal / Login
                                </Link>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Navbar;