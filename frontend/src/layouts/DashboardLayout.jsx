import React, { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import { getStoredUser, logout } from "../services/authService";

const DashboardLayout = () => {
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [online, setOnline] = useState(navigator.onLine);
    const [user, setUser] = useState(getStoredUser);

    useEffect(() => {
        const handleOnline = () => setOnline(true);
        const handleOffline = () => setOnline(false);
        const handleUnauthorized = () => {
            setUser(null);
            navigate("/login", { replace: true });
        };

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);
        window.addEventListener("cvd-xai:unauthorized", handleUnauthorized);

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
            window.removeEventListener("cvd-xai:unauthorized", handleUnauthorized);
        };
    }, [navigate]);

    const handleLogout = () => {
        logout();
        setUser(null);
        navigate("/login", { replace: true });
    };

    return (
        <div className={`app-container ${sidebarOpen ? "sidebar-open" : "sidebar-closed"}`}>
            <Navbar user={user} onMenuClick={() => setSidebarOpen((open) => !open)} onLogout={handleLogout} />

            <div className="main-container">
                <Sidebar
                    isOpen={sidebarOpen}
                    onClose={() => setSidebarOpen(false)}
                />

                <main className="content">
                    {!online && (
                        <div className="connection-warning">
                            <span>⚠</span>
                            <div>
                                <strong>Offline Mode</strong>
                                <p>
                                    Network connection is unavailable. Backend requests may not work.
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="content-wrapper">
                        <Outlet />
                    </div>
                </main>
            </div>

            <div className="system-status">
                <span className={`status-indicator ${online ? "online" : "offline"}`}></span>
                <span>{online ? "System Online" : "Offline"}</span>
            </div>
        </div>
    );
};

export default DashboardLayout;
