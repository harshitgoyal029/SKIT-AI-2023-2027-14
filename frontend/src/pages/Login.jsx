import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const ROLE_CONFIG = {
    patient: {
        id: "patient",
        label: "Patient",
        icon: "🫀",
        badge: "Personal Health Portal",
        color: "#0284c7",
        bgColor: "#f0f9ff",
        borderColor: "#bae6fd",
        subtitle: "Sign in to track your cardiovascular assessments and ECG records.",
        demoEmail: "patient@cardioxai.org",
        demoPass: "Patient@123",
        demoName: "Jane Doe (Patient)",
    },
    doctor: {
        id: "doctor",
        label: "Doctor",
        icon: "🩺",
        badge: "Medical Decision Support",
        color: "#0d9488",
        bgColor: "#f0fdfa",
        borderColor: "#99f6e4",
        subtitle: "Sign in to review clinical risk predictions and SHAP explainability insights.",
        demoEmail: "doctor@cardioxai.org",
        demoPass: "Doctor@123",
        demoName: "Dr. Sarah Johnson, MD",
    },
    clinician: {
        id: "clinician",
        label: "Clinician",
        icon: "🔬",
        badge: "Clinical Intake & Research",
        color: "#7c3aed",
        bgColor: "#faf5ff",
        borderColor: "#ddd6fe",
        subtitle: "Sign in to register patients, enter clinical vitals, and evaluate cohorts.",
        demoEmail: "clinician@cardioxai.org",
        demoPass: "Clinician@123",
        demoName: "Dr. Alex Mercer, Clinician",
    },
};

const Login = () => {
    const navigate = useNavigate();
    const [selectedRole, setSelectedRole] = useState("doctor");
    const [formData, setFormData] = useState({
        email: "",
        password: "",
    });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const activeConfig = ROLE_CONFIG[selectedRole];

    const handleRoleChange = (role) => {
        setSelectedRole(role);
        setError("");
    };

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
        setError("");
    };

    const fillDemoCredentials = () => {
        setFormData({
            email: activeConfig.demoEmail,
            password: activeConfig.demoPass,
        });
        setError("");
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (!formData.email.trim()) {
            setError("Please enter your email.");
            return;
        }

        if (!formData.password) {
            setError("Please enter your password.");
            return;
        }

        setLoading(true);

        try {
            const response = await fetch("http://localhost:8000/api/auth/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    email: formData.email.trim().toLowerCase(),
                    password: formData.password,
                    role: selectedRole,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data?.detail || "Invalid email or password.");
            }

            // Store authentication in localStorage
            localStorage.setItem("cvd_token", data.access_token);
            localStorage.setItem("cvd_user", JSON.stringify(data.user));
            localStorage.setItem("cvd_role", data.user.role);

            // Navigate to dashboard
            navigate("/dashboard");
        } catch (err) {
            setError(err.message || "Failed to connect to authentication server.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-card role-auth-card">
                {/* Role Switcher Tabs */}
                <div className="role-selector-header">
                    <span className="role-selector-title">Select Portal Role</span>
                    <div className="role-tabs">
                        {Object.values(ROLE_CONFIG).map((r) => (
                            <button
                                key={r.id}
                                type="button"
                                className={`role-tab-btn ${selectedRole === r.id ? "active" : ""}`}
                                style={
                                    selectedRole === r.id
                                        ? {
                                              borderColor: r.color,
                                              background: r.bgColor,
                                              color: r.color,
                                          }
                                        : {}
                                }
                                onClick={() => handleRoleChange(r.id)}
                            >
                                <span className="role-tab-icon">{r.icon}</span>
                                <span>{r.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div
                    className="auth-logo"
                    style={{
                        background: activeConfig.bgColor,
                        border: `1px solid ${activeConfig.borderColor}`,
                        color: activeConfig.color,
                    }}
                >
                    {activeConfig.icon}
                </div>

                <div className="auth-header">
                    <div
                        className="role-badge"
                        style={{
                            color: activeConfig.color,
                            background: activeConfig.bgColor,
                            border: `1px solid ${activeConfig.borderColor}`,
                        }}
                    >
                        {activeConfig.badge}
                    </div>
                    <h1>{activeConfig.label} Sign In</h1>
                    <p>{activeConfig.subtitle}</p>
                </div>

                {error && (
                    <div className="form-error">
                        ⚠ {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Email Address</label>
                        <input
                            type="email"
                            name="email"
                            placeholder={`e.g. ${activeConfig.demoEmail}`}
                            value={formData.email}
                            onChange={handleChange}
                            autoComplete="username"
                        />
                    </div>

                    <div className="form-group">
                        <label>Password</label>
                        <input
                            type="password"
                            name="password"
                            placeholder="Enter your password"
                            value={formData.password}
                            onChange={handleChange}
                            autoComplete="current-password"
                        />
                    </div>

                    <button
                        type="submit"
                        className="primary-btn auth-btn"
                        disabled={loading}
                        style={{ background: activeConfig.color }}
                    >
                        {loading ? "Authenticating..." : `Sign In as ${activeConfig.label}`}
                    </button>
                </form>

                {/* Quick Demo Credentials Assistant */}
                <div
                    className="demo-credentials-box"
                    style={{
                        background: activeConfig.bgColor,
                        borderColor: activeConfig.borderColor,
                    }}
                >
                    <div className="demo-credentials-info">
                        <strong>Test {activeConfig.label} Account:</strong>
                        <span>{activeConfig.demoEmail}</span>
                    </div>
                    <button
                        type="button"
                        className="demo-fill-btn"
                        style={{ color: activeConfig.color }}
                        onClick={fillDemoCredentials}
                    >
                        Use Demo Info
                    </button>
                </div>

                <div className="auth-footer">
                    <span>Don't have an account?</span>
                    <Link to="/register">Create Account</Link>
                </div>
            </div>
        </div>
    );
};

export default Login;