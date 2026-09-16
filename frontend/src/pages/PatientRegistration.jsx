import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const PatientRegistration = () => {
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        patientId: "",
        name: "",
        age: "",
        gender: "",
        phone: "",
        email: "",
        bloodPressure: "",
        cholesterol: "",
        heartRate: "",
        diabetes: "No",
        smoking: "No",
        familyHistory: "No",
    });

    const [error, setError] = useState("");

    const handleChange = (e) => {
        const { name, value } = e.target;

        setFormData((previousData) => ({
            ...previousData,
            [name]: value,
        }));

        setError("");
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.patientId.trim()) {
            setError("Please enter the patient ID.");
            return;
        }

        if (!formData.name.trim()) {
            setError("Please enter the patient's full name.");
            return;
        }

        if (!formData.age || formData.age < 1 || formData.age > 120) {
            setError("Please enter a valid age between 1 and 120.");
            return;
        }

        if (!formData.gender) {
            setError("Please select the patient's gender.");
            return;
        }

        if (
            formData.heartRate &&
            (formData.heartRate < 30 || formData.heartRate > 250)
        ) {
            setError("Please enter a valid heart rate.");
            return;
        }

        try {
            const response = await fetch("http://localhost:8000/api/patients", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(formData),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || "Failed to register patient.");
            }

            sessionStorage.setItem(
                "cvd_xai_patient",
                JSON.stringify(data)
            );

            navigate("/dashboard");
        } catch (error) {
            setError(error.message);
        }
    };

    return (
        <div className="page">
            <div className="page-header">
                <div>
                    <h1>Patient Registration</h1>
                    <p>
                        Enter patient information for cardiovascular risk assessment.
                    </p>
                </div>
            </div>

            {error && (
                <div className="form-error">
                    <span>⚠</span>
                    {error}
                </div>
            )}

            <form className="registration-card" onSubmit={handleSubmit}>
                <div className="section-title">
                    <div className="section-icon">👤</div>

                    <div>
                        <h2>Patient Information</h2>
                        <p>Basic patient details</p>
                    </div>
                </div>

                <div className="form-grid">
                    <div className="form-group">
                        <label>
                            Patient ID <span className="required">*</span>
                        </label>

                        <input
                            type="text"
                            name="patientId"
                            placeholder="Enter patient ID"
                            value={formData.patientId}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="form-group">
                        <label>
                            Full Name <span className="required">*</span>
                        </label>

                        <input
                            type="text"
                            name="name"
                            placeholder="Enter full name"
                            value={formData.name}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="form-group">
                        <label>
                            Age <span className="required">*</span>
                        </label>

                        <input
                            type="number"
                            name="age"
                            min="1"
                            max="120"
                            placeholder="Enter age"
                            value={formData.age}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="form-group">
                        <label>
                            Gender <span className="required">*</span>
                        </label>

                        <select
                            name="gender"
                            value={formData.gender}
                            onChange={handleChange}
                        >
                            <option value="">Select gender</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Phone Number</label>

                        <input
                            type="tel"
                            name="phone"
                            placeholder="Enter phone number"
                            value={formData.phone}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="form-group">
                        <label>Email</label>

                        <input
                            type="email"
                            name="email"
                            placeholder="Enter email"
                            value={formData.email}
                            onChange={handleChange}
                        />
                    </div>
                </div>

                <div className="section-title medical-section">
                    <div className="section-icon">🫀</div>

                    <div>
                        <h2>Clinical Parameters</h2>
                        <p>Relevant cardiovascular information</p>
                    </div>
                </div>

                <div className="form-grid">
                    <div className="form-group">
                        <label>Blood Pressure</label>

                        <input
                            type="text"
                            name="bloodPressure"
                            placeholder="e.g. 120/80"
                            value={formData.bloodPressure}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="form-group">
                        <label>Cholesterol</label>

                        <input
                            type="number"
                            name="cholesterol"
                            placeholder="mg/dL"
                            value={formData.cholesterol}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="form-group">
                        <label>Heart Rate</label>

                        <input
                            type="number"
                            name="heartRate"
                            min="30"
                            max="250"
                            placeholder="BPM"
                            value={formData.heartRate}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="form-group">
                        <label>Diabetes</label>

                        <select
                            name="diabetes"
                            value={formData.diabetes}
                            onChange={handleChange}
                        >
                            <option value="No">No</option>
                            <option value="Yes">Yes</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Smoking</label>

                        <select
                            name="smoking"
                            value={formData.smoking}
                            onChange={handleChange}
                        >
                            <option value="No">No</option>
                            <option value="Yes">Yes</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Family History of CVD</label>

                        <select
                            name="familyHistory"
                            value={formData.familyHistory}
                            onChange={handleChange}
                        >
                            <option value="No">No</option>
                            <option value="Yes">Yes</option>
                        </select>
                    </div>
                </div>

                <div className="form-actions">
                    <button
                        type="button"
                        className="secondary-btn"
                        onClick={() => navigate("/dashboard")}
                    >
                        Cancel
                    </button>

                    <button type="submit" className="primary-btn">
                        Register Patient →
                    </button>
                </div>
            </form>
        </div>
    );
};

export default PatientRegistration;