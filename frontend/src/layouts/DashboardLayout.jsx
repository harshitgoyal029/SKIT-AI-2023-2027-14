import React, { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";

const DashboardLayout = ({ children }) => {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [online, setOnline] = useState(navigator.onLine);

    useEffect(() => {
        const handleOnline = () => setOnline(true);
        const handleOffline = () => setOnline(false);

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, []);

    const toggleSidebar = () => {
        setSidebarOpen(previousState => !previousState);
    };

    return (
        <div className={`app-container ${sidebarOpen ? "sidebar-open" : "sidebar-closed"}`}>
            <Navbar onMenuClick={toggleSidebar} />

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
                                    Network connection is unavailable.
                                    Backend requests may not work.
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="content-wrapper">
                        {children}
                    </div>
                </main>
            </div>

            <div className="system-status">
                <span className={`status-indicator ${online ? "online" : "offline"}`}></span>
                <span>
                    {online ? "System Online" : "Offline"}
                </span>
            </div>
        </div>
    );
};

export default DashboardLayout;