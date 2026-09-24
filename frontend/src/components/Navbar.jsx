import React, { useEffect, useState } from "react";

const Navbar = ({ onMenuClick }) => {
    const [notifications, setNotifications] = useState(0);
    const [showProfile, setShowProfile] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 60000);

        return () => clearInterval(timer);
    }, []);

    const toggleNotifications = () => {
        setNotifications(0);
    };

    const toggleProfile = () => {
        setShowProfile(previousState => !previousState);
    };

    const formattedTime = currentTime.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit"
    });

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
                    <span>Clinical System</span>
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
                        <div className="profile-avatar">DR</div>

                        <div>
                            <strong>Clinician</strong>
                            <span>Medical Professional</span>
                        </div>

                        <span className="profile-arrow">
                            {showProfile ? "▲" : "▼"}
                        </span>
                    </button>

                    {showProfile && (
                        <div className="profile-menu">
                            <div className="profile-menu-header">
                                <div className="profile-avatar large">
                                    DR
                                </div>

                                <div>
                                    <strong>Clinician</strong>
                                    <span>Medical Professional</span>
                                </div>
                            </div>

                            <div className="profile-menu-divider"></div>

                            <button type="button">
                                👤 Profile
                            </button>

                            <button type="button">
                                ⚙ Settings
                            </button>

                            <button type="button">
                                🔒 Security
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Navbar;