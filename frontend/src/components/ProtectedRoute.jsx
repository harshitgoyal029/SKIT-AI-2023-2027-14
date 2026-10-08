import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getCurrentUser, getStoredUser, isAuthenticated } from "../services/authService";

const ProtectedRoute = ({ children }) => {
    const location = useLocation();
    const [checking, setChecking] = useState(true);
    const [authenticated, setAuthenticated] = useState(false);

    useEffect(() => {
        let active = true;

        const verifySession = async () => {
            if (!isAuthenticated()) {
                if (active) {
                    setAuthenticated(false);
                    setChecking(false);
                }
                return;
            }

            try {
                const user = await getCurrentUser();
                if (active) {
                    setAuthenticated(Boolean(user || getStoredUser()));
                }
            } catch (error) {
                console.error("Unable to verify authentication session:", error);
                if (active) {
                    setAuthenticated(false);
                }
            } finally {
                if (active) {
                    setChecking(false);
                }
            }
        };

        verifySession();

        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        const handleUnauthorized = () => setAuthenticated(false);
        window.addEventListener("cvd-xai:unauthorized", handleUnauthorized);
        return () => window.removeEventListener("cvd-xai:unauthorized", handleUnauthorized);
    }, []);

    if (checking) {
        return (
            <div className="auth-page">
                <div className="auth-card auth-loading-card">
                    <div className="auth-logo">♥</div>
                    <h2>Checking secure session</h2>
                    <p>Please wait while your CVD-XAI session is verified.</p>
                </div>
            </div>
        );
    }

    if (!authenticated) {
        return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    }

    return children;
};

export default ProtectedRoute;
