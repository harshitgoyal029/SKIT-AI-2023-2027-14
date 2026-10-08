import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const ROLES = [
    { id: "patient", label: "Patient", icon: "🫀", color: "#0284c7" },
    { id: "doctor", label: "Doctor", icon: "🩺", color: "#0d9488" },
    { id: "clinician", label: "Clinician", icon: "🔬", color: "#7c3aed" },
];

const Register = () => {
    const navigate = useNavigate();
    const [selectedRole, setSelectedRole] = useState("patient");
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: "",
        confirmPassword: "",
    });

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
        setError("");
        setSuccess("");
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess("");

        if (!formData.name.trim()) {
            setError("Please enter your full name.");
            return;
        }

        if (!formData.email.trim()) {
            setError("Please enter your email.");
            return;
        }

        if (!formData.password) {
            setError("Please enter a password.");
            return;
        }

        if (formData.password.length < 6) {
            setError("Password must contain at least 6 characters.");
            return;
        }

        if (formData.password !== formData.confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        setLoading(true);

        try {
            const response = await fetch("http://localhost:8000/api/auth/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    name: formData.name.trim(),
                    email: formData.email.trim().toLowerCase(),
                    password: formData.password,
                    role: selectedRole,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data?.detail || "Registration failed. Please try again.");
            }

            setSuccess("Account registered successfully! Redirecting to login...");
            setTimeout(() => {
                navigate("/login");
            }, 1500);
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
                    <span className="role-selector-title">Register Account Role</span>
                    <div className="role-tabs">
                        {ROLES.map((r) => (
                            <button
                                key={r.id}
                                type="button"
                                className={`role-tab-btn ${selectedRole === r.id ? "active" : ""}`}
                                onClick={() => setSelectedRole(r.id)}
                            >
                                <span className="role-tab-icon">{r.icon}</span>
                                <span>{r.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="auth-logo">
                    ❤️
                </div>

                <div className="auth-header">
                    <h1>Create {selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)} Account</h1>
                    <p>Register as a certified {selectedRole} on the CVD-XAI Platform</p>
                </div>

                {error && (
                    <div className="form-error">
                        ⚠ {error}
                    </div>
                )}

                {success && (
                    <div className="form-success">
                        ✓ {success}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Full Name</label>
                        <input
                            type="text"
                            name="name"
                            placeholder="Enter your full name"
                            value={formData.name}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="form-group">
                        <label>Email Address</label>
                        <input
                            type="email"
                            name="email"
                            placeholder="Enter your email"
                            value={formData.email}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="form-group">
                        <label>Password</label>
                        <input
                            type="password"
                            name="password"
                            placeholder="Create a password (min. 6 characters)"
                            value={formData.password}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="form-group">
                        <label>Confirm Password</label>
                        <input
                            type="password"
                            name="confirmPassword"
                            placeholder="Confirm your password"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                        />
                    </div>

                    <button
                        type="submit"
                        className="primary-btn auth-btn"
                        disabled={loading}
                    >
                        {loading ? "Registering..." : `Register as ${selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)}`}
                    </button>
                </form>

                <div className="auth-footer">
                    <span>Already have an account?</span>
                    <Link to="/login">Sign In</Link>
                </div>
            </div>
        </div>
    );
};

export default Register;