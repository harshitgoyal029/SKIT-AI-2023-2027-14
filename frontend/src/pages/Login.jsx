import React, { useState } from "react";
import { Link } from "react-router-dom";

const Login = () => {
    const [formData, setFormData] = useState({
        email: "",
        password: "",
    });

    const [error, setError] = useState("");

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    const handleSubmit = (e) => {
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

        // JWT login API will be connected here by Kanishk.
        console.log("Login data:", formData);
    };

    return (
        <div className="auth-page">
            <div className="auth-card">

                <div className="auth-logo">
                    ❤️
                </div>

                <div className="auth-header">
                    <h1>Welcome Back</h1>
                    <p>Sign in to your CVD-XAI account</p>
                </div>

                {error && (
                    <div className="form-error">
                        ⚠ {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>

                    <div className="form-group">
                        <label>Email</label>
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
                            placeholder="Enter your password"
                            value={formData.password}
                            onChange={handleChange}
                        />
                    </div>

                    <button
                        type="submit"
                        className="primary-btn auth-btn"
                    >
                        Login
                    </button>

                </form>

                <div className="auth-footer">
                    <span>Don't have an account?</span>
                    <Link to="/register">Create Account</Link>
                </div>

            </div>
        </div>
    );
};

export default Login;