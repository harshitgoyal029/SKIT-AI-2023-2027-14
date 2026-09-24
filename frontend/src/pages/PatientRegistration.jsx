import React, { useMemo, useState } from "react";
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

    const [errors, setErrors] = useState({});
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const fieldLabels = {
        patientId: "Patient ID",
        name: "Full Name",
        age: "Age",
        gender: "Gender",
        phone: "Phone Number",
        email: "Email",
        bloodPressure: "Blood Pressure",
        cholesterol: "Cholesterol",
        heartRate: "Heart Rate",
        diabetes: "Diabetes",
        smoking: "Smoking",
        familyHistory: "Family History"
    };

    const requiredFields = useMemo(() => [
        "patientId",
        "name",
        "age",
        "gender"
    ], []);

    const handleChange = (e) => {
        const { name, value } = e.target;

        setFormData(previousData => ({
            ...previousData,
            [name]: value
        }));

        setErrors(previousErrors => ({
            ...previousErrors,
            [name]: ""
        }));

        setError("");
    };

    const validatePatientId = (value) => {
        if (!value.trim()) {
            return "Please enter the patient ID.";
        }

        if (value.trim().length < 2) {
            return "Patient ID must contain at least 2 characters.";
        }

        if (value.trim().length > 30) {
            return "Patient ID cannot exceed 30 characters.";
        }

        return "";
    };

    const validateName = (value) => {
        if (!value.trim()) {
            return "Please enter the patient's full name.";
        }

        if (value.trim().length < 3) {
            return "Patient name must contain at least 3 characters.";
        }

        if (value.trim().length > 100) {
            return "Patient name cannot exceed 100 characters.";
        }

        if (!/^[a-zA-Z .'-]+$/.test(value.trim())) {
            return "Patient name contains invalid characters.";
        }

        return "";
    };

    const validateAge = (value) => {
        if (!value) {
            return "Please enter the patient's age.";
        }

        const age = Number(value);

        if (!Number.isInteger(age)) {
            return "Age must be a whole number.";
        }

        if (age < 1 || age > 120) {
            return "Please enter a valid age between 1 and 120.";
        }

        return "";
    };

    const validateGender = (value) => {
        if (!value) {
            return "Please select the patient's gender.";
        }

        return "";
    };

    const validatePhone = (value) => {
        if (!value) {
            return "";
        }

        const cleaned = value.replace(/\s|-/g, "");

        if (!/^[0-9]{10}$/.test(cleaned)) {
            return "Phone number must contain 10 digits.";
        }

        return "";
    };

    const validateEmail = (value) => {
        if (!value) {
            return "";
        }

        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailPattern.test(value.trim())) {
            return "Please enter a valid email address.";
        }

        return "";
    };

    const validateBloodPressure = (value) => {
        if (!value) {
            return "";
        }

        const parts = value.trim().split("/");

        if (parts.length !== 2) {
            return "Blood pressure must use the format 120/80.";
        }

        const systolic = Number(parts[0]);
        const diastolic = Number(parts[1]);

        if (!Number.isFinite(systolic) || !Number.isFinite(diastolic)) {
            return "Blood pressure must contain valid numbers.";
        }

        if (systolic < 50 || systolic > 250) {
            return "Systolic pressure must be between 50 and 250.";
        }

        if (diastolic < 30 || diastolic > 180) {
            return "Diastolic pressure must be between 30 and 180.";
        }

        return "";
    };

    const validateCholesterol = (value) => {
        if (!value) {
            return "";
        }

        const cholesterol = Number(value);

        if (!Number.isFinite(cholesterol)) {
            return "Cholesterol must be a valid number.";
        }

        if (cholesterol < 50 || cholesterol > 1000) {
            return "Please enter a valid cholesterol value.";
        }

        return "";
    };

    const validateHeartRate = (value) => {
        if (!value) {
            return "";
        }

        const heartRate = Number(value);

        if (!Number.isFinite(heartRate)) {
            return "Heart rate must be a valid number.";
        }

        if (heartRate < 30 || heartRate > 250) {
            return "Please enter a valid heart rate between 30 and 250.";
        }

        return "";
    };

    const validateForm = () => {
        const validationErrors = {};

        const patientIdError = validatePatientId(formData.patientId);
        const nameError = validateName(formData.name);
        const ageError = validateAge(formData.age);
        const genderError = validateGender(formData.gender);
        const phoneError = validatePhone(formData.phone);
        const emailError = validateEmail(formData.email);
        const bloodPressureError = validateBloodPressure(
            formData.bloodPressure
        );
        const cholesterolError = validateCholesterol(
            formData.cholesterol
        );
        const heartRateError = validateHeartRate(
            formData.heartRate
        );

        if (patientIdError) {
            validationErrors.patientId = patientIdError;
        }

        if (nameError) {
            validationErrors.name = nameError;
        }

        if (ageError) {
            validationErrors.age = ageError;
        }

        if (genderError) {
            validationErrors.gender = genderError;
        }

        if (phoneError) {
            validationErrors.phone = phoneError;
        }

        if (emailError) {
            validationErrors.email = emailError;
        }

        if (bloodPressureError) {
            validationErrors.bloodPressure = bloodPressureError;
        }

        if (cholesterolError) {
            validationErrors.cholesterol = cholesterolError;
        }

        if (heartRateError) {
            validationErrors.heartRate = heartRateError;
        }

        setErrors(validationErrors);

        return Object.keys(validationErrors).length === 0;
    };

    const getFieldClass = (field) => {
        if (errors[field]) {
            return "input-error";
        }

        if (formData[field]) {
            return "input-valid";
        }

        return "";
    };

    const preparePayload = () => {
        return {
            patientId: formData.patientId.trim(),
            name: formData.name.trim(),
            age: Number(formData.age),
            gender: formData.gender,
            phone: formData.phone.trim(),
            email: formData.email.trim().toLowerCase(),
            bloodPressure: formData.bloodPressure.trim(),
            cholesterol: formData.cholesterol
                ? Number(formData.cholesterol)
                : null,
            heartRate: formData.heartRate
                ? Number(formData.heartRate)
                : null,
            diabetes: formData.diabetes,
            smoking: formData.smoking,
            familyHistory: formData.familyHistory
        };
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        setError("");

        if (!validateForm()) {
            setError("Please correct the highlighted fields before submitting.");
            return;
        }

        setLoading(true);

        try {
            const payload = preparePayload();

            const response = await fetch(
                "http://localhost:8000/api/patients",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(payload)
                }
            );

            let data = null;

            try {
                data = await response.json();
            } catch (parseError) {
                data = null;
            }

            if (!response.ok) {
                throw new Error(
                    data?.detail ||
                    data?.message ||
                    "Failed to register patient."
                );
            }

            sessionStorage.setItem(
                "cvd_xai_patient",
                JSON.stringify(data)
            );

            navigate("/dashboard");
        } catch (requestError) {
            console.error("Patient registration failed:", requestError);

            setError(
                requestError.message ||
                "Unable to connect to the patient registration service."
            );
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setFormData({
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

        setErrors({});
        setError("");
    };

    const renderError = (field) => {
        if (!errors[field]) {
            return null;
        }

        return (
            <small className="field-error">
                {errors[field]}
            </small>
        );
    };

    const renderLabel = (field, required = false) => {
        return (
            <label>
                {fieldLabels[field]}
                {required && <span className="required">*</span>}
            </label>
        );
    };

    return (
        <div className="page">
            <div className="page-header">
                <div>
                    <span className="welcome-label">
                        CVD-XAI CLINICAL SYSTEM
                    </span>

                    <h1>Patient Registration</h1>

                    <p>
                        Enter patient information for cardiovascular risk
                        assessment.
                    </p>
                </div>
            </div>

            {error && (
                <div className="form-error">
                    <span>⚠</span>
                    <div>
                        <strong>Registration Notice</strong>
                        <p>{error}</p>
                    </div>
                </div>
            )}

            <form
                className="registration-card"
                onSubmit={handleSubmit}
                noValidate
            >
                <div className="section-title">
                    <div className="section-icon">👤</div>

                    <div>
                        <h2>Patient Information</h2>
                        <p>Basic patient details</p>
                    </div>
                </div>

                <div className="form-grid">
                    <div className="form-group">
                        {renderLabel("patientId", true)}

                        <input
                            className={getFieldClass("patientId")}
                            type="text"
                            name="patientId"
                            placeholder="Enter patient ID"
                            value={formData.patientId}
                            onChange={handleChange}
                            maxLength="30"
                        />

                        {renderError("patientId")}
                    </div>

                    <div className="form-group">
                        {renderLabel("name", true)}

                        <input
                            className={getFieldClass("name")}
                            type="text"
                            name="name"
                            placeholder="Enter full name"
                            value={formData.name}
                            onChange={handleChange}
                            maxLength="100"
                        />

                        {renderError("name")}
                    </div>

                    <div className="form-group">
                        {renderLabel("age", true)}

                        <input
                            className={getFieldClass("age")}
                            type="number"
                            name="age"
                            min="1"
                            max="120"
                            placeholder="Enter age"
                            value={formData.age}
                            onChange={handleChange}
                        />

                        {renderError("age")}
                    </div>

                    <div className="form-group">
                        {renderLabel("gender", true)}

                        <select
                            className={getFieldClass("gender")}
                            name="gender"
                            value={formData.gender}
                            onChange={handleChange}
                        >
                            <option value="">Select gender</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                        </select>

                        {renderError("gender")}
                    </div>

                    <div className="form-group">
                        {renderLabel("phone")}

                        <input
                            className={getFieldClass("phone")}
                            type="tel"
                            name="phone"
                            placeholder="Enter phone number"
                            value={formData.phone}
                            onChange={handleChange}
                            maxLength="10"
                        />

                        {renderError("phone")}
                    </div>

                    <div className="form-group">
                        {renderLabel("email")}

                        <input
                            className={getFieldClass("email")}
                            type="email"
                            name="email"
                            placeholder="Enter email"
                            value={formData.email}
                            onChange={handleChange}
                        />

                        {renderError("email")}
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
                        {renderLabel("bloodPressure")}

                        <input
                            className={getFieldClass("bloodPressure")}
                            type="text"
                            name="bloodPressure"
                            placeholder="e.g. 120/80"
                            value={formData.bloodPressure}
                            onChange={handleChange}
                        />

                        {renderError("bloodPressure")}
                    </div>

                    <div className="form-group">
                        {renderLabel("cholesterol")}

                        <input
                            className={getFieldClass("cholesterol")}
                            type="number"
                            name="cholesterol"
                            min="50"
                            max="1000"
                            placeholder="mg/dL"
                            value={formData.cholesterol}
                            onChange={handleChange}
                        />

                        {renderError("cholesterol")}
                    </div>

                    <div className="form-group">
                        {renderLabel("heartRate")}

                        <input
                            className={getFieldClass("heartRate")}
                            type="number"
                            name="heartRate"
                            min="30"
                            max="250"
                            placeholder="BPM"
                            value={formData.heartRate}
                            onChange={handleChange}
                        />

                        {renderError("heartRate")}
                    </div>

                    <div className="form-group">
                        {renderLabel("diabetes")}

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
                        {renderLabel("smoking")}

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
                        {renderLabel("familyHistory")}

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

                <div className="registration-info">
                    <div className="info-icon">ℹ</div>

                    <div>
                        <strong>Assessment Information</strong>

                        <p>
                            Patient information will be submitted to the
                            cardiovascular assessment backend. Required fields
                            must be completed before registration.
                        </p>
                    </div>
                </div>

                <div className="form-summary">
                    <div>
                        <span>Required fields</span>
                        <strong>{requiredFields.length}</strong>
                    </div>

                    <div>
                        <span>Clinical parameters</span>
                        <strong>6</strong>
                    </div>

                    <div>
                        <span>Assessment ready</span>
                        <strong>
                            {Object.keys(errors).length === 0 &&
                                formData.patientId &&
                                formData.name &&
                                formData.age &&
                                formData.gender
                                ? "Yes"
                                : "Pending"}
                        </strong>
                    </div>
                </div>

                <div className="form-actions">
                    <button
                        type="button"
                        className="secondary-btn"
                        onClick={handleReset}
                        disabled={loading}
                    >
                        Reset
                    </button>

                    <button
                        type="button"
                        className="secondary-btn"
                        onClick={() => navigate("/dashboard")}
                        disabled={loading}
                    >
                        Cancel
                    </button>

                    <button
                        type="submit"
                        className="primary-btn"
                        disabled={loading}
                    >
                        {loading
                            ? "Registering..."
                            : "Register Patient →"}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default PatientRegistration;