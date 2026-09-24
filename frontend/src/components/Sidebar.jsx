import React from "react";
import { NavLink } from "react-router-dom";

const Sidebar = ({ isOpen = true, onClose }) => {
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
                    <span>MAIN MENU</span>
                </div>

                <nav className="sidebar-nav">
                    <NavLink
                        to="/dashboard"
                        className={getLinkClass}
                        onClick={onClose}
                    >
                        <span className="sidebar-icon">▣</span>
                        <span>Dashboard</span>
                    </NavLink>

                    <NavLink
                        to="/patient-registration"
                        className={getLinkClass}
                        onClick={onClose}
                    >
                        <span className="sidebar-icon">＋</span>
                        <span>New Patient</span>
                    </NavLink>
                </nav>

                <div className="sidebar-info">
                    <div className="sidebar-info-icon">🫀</div>

                    <div>
                        <strong>CVD-XAI</strong>
                        <small>Clinical Intelligence</small>
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