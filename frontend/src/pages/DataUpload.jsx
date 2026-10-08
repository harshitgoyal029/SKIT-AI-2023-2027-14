import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getApiUrl } from "../services/api";

const DataUpload = () => {
    const [activeTab, setActiveTab] = useState("clinical");

    // Clinical form state
    const [clinicalForm, setClinicalForm] = useState({
        age: "",
        sex: "Male",
        chest_pain_type: "ASY",
        resting_bp: "",
        cholesterol: "",
        fasting_blood_sugar: false,
        resting_ecg: "Normal",
        max_heart_rate: "",
        exercise_angina: false,
        st_depression: "0.0",
        st_slope: "Flat",
    });

    // ECG file form state
    const [selectedFile, setSelectedFile] = useState(null);
    const [ecgSamplingRate, setEcgSamplingRate] = useState(500);
    const [ecgLeadCount, setEcgLeadCount] = useState(12);
    const [ecgDuration, setEcgDuration] = useState(10.0);

    // Submission states
    const [loading, setLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    const [errorMessage, setErrorMessage] = useState("");

    // Database record history
    const [clinicalRecords, setClinicalRecords] = useState([]);
    const [ecgRecords, setEcgRecords] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    const token = localStorage.getItem("cvd_xai_access_token") || localStorage.getItem("cvd_token");

    // Fetch history from MongoDB
    const fetchHistory = async () => {
        if (!token) return;
        setHistoryLoading(true);
        try {
            const [clinRes, ecgRes] = await Promise.all([
                fetch(getApiUrl("/api/data/clinical"), {
                    headers: { Authorization: `Bearer ${token}` },
                }),
                fetch(getApiUrl("/api/data/ecg"), {
                    headers: { Authorization: `Bearer ${token}` },
                }),
            ]);

            if (clinRes.ok) {
                const clinData = await clinRes.json();
                setClinicalRecords(clinData);
            }
            if (ecgRes.ok) {
                const ecgData = await ecgRes.json();
                setEcgRecords(ecgData);
            }
        } catch (err) {
            console.error("Error fetching upload history:", err);
        } finally {
            setHistoryLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, [token]);

    const handleClinicalChange = (e) => {
        const { name, value, type, checked } = e.target;
        setClinicalForm((prev) => ({
            ...prev,
            [name]: type === "checkbox" ? checked : value,
        }));
        setSuccessMessage("");
        setErrorMessage("");
    };

    const handleClinicalSubmit = async (e) => {
        e.preventDefault();
        setErrorMessage("");
        setSuccessMessage("");

        if (!token) {
            setErrorMessage("Please sign in first to upload clinical data to your account.");
            return;
        }

        if (!clinicalForm.age || !clinicalForm.resting_bp || !clinicalForm.cholesterol) {
            setErrorMessage("Please fill in Age, Blood Pressure, and Cholesterol.");
            return;
        }

        setLoading(true);

        try {
            const payload = {
                age: Number(clinicalForm.age),
                sex: clinicalForm.sex,
                chest_pain_type: clinicalForm.chest_pain_type,
                resting_bp: Number(clinicalForm.resting_bp),
                cholesterol: Number(clinicalForm.cholesterol),
                fasting_blood_sugar: Boolean(clinicalForm.fasting_blood_sugar),
                resting_ecg: clinicalForm.resting_ecg,
                max_heart_rate: clinicalForm.max_heart_rate ? Number(clinicalForm.max_heart_rate) : null,
                exercise_angina: Boolean(clinicalForm.exercise_angina),
                st_depression: Number(clinicalForm.st_depression) || 0.0,
                st_slope: clinicalForm.st_slope,
            };

            const response = await fetch(getApiUrl("/api/data/clinical"), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data?.detail || "Failed to submit clinical data.");
            }

            setSuccessMessage(`✓ Clinical data successfully saved to MongoDB (Record ID: ${data.id})!`);
            fetchHistory();
        } catch (err) {
            const isFetchErr = err?.name === "TypeError" && String(err?.message).toLowerCase().includes("fetch");
            setErrorMessage(
                isFetchErr
                    ? "Backend server is not reachable on port 8000. Please ensure the backend is running."
                    : (err.message || "Network error submitting clinical data.")
            );
        } finally {
            setLoading(false);
        }
    };

    const handleEcgFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
            setSuccessMessage("");
            setErrorMessage("");
        }
    };

    const handleEcgSubmit = async (e) => {
        e.preventDefault();
        setErrorMessage("");
        setSuccessMessage("");

        if (!token) {
            setErrorMessage("Please sign in first to upload ECG recordings.");
            return;
        }

        if (!selectedFile) {
            setErrorMessage("Please select an ECG file (.csv, .dat, .hea, .txt, .pdf, or image).");
            return;
        }

        setLoading(true);

        try {
            const formData = new FormData();
            formData.append("file", selectedFile);
            formData.append("sampling_rate_hz", ecgSamplingRate);
            formData.append("lead_count", ecgLeadCount);
            if (ecgDuration) {
                formData.append("duration_seconds", ecgDuration);
            }

            const response = await fetch(getApiUrl("/api/data/ecg"), {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data?.detail || "Failed to upload ECG file.");
            }

            setSuccessMessage(`✓ ECG file '${data.original_name}' successfully uploaded and registered in MongoDB (ID: ${data.id})!`);
            setSelectedFile(null);
            fetchHistory();
        } catch (err) {
            const isFetchErr = err?.name === "TypeError" && String(err?.message).toLowerCase().includes("fetch");
            setErrorMessage(
                isFetchErr
                    ? "Backend server is not reachable on port 8000. Please ensure the backend is running."
                    : (err.message || "Network error uploading ECG recording.")
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="page data-upload-page">
            <div className="page-header">
                <div>
                    <span className="welcome-label">DATA INGESTION PIPELINE</span>
                    <h1>Clinical & ECG Upload Portal</h1>
                    <p>Upload patient vitals and 12-lead ECG signals directly to MongoDB for AI processing.</p>
                </div>
                <div className="dashboard-header-actions">
                    <Link to="/dashboard" className="secondary-btn">
                        ← Back to Dashboard
                    </Link>
                </div>
            </div>

            {/* Unauthenticated User Alert */}
            {!token && (
                <div className="form-error" style={{ margin: "16px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>⚠ You are not currently signed in. Uploaded records require an active user account.</span>
                    <Link to="/login" className="primary-btn" style={{ padding: "6px 14px", fontSize: "12px", textDecoration: "none" }}>
                        Sign In Now
                    </Link>
                </div>
            )}

            {/* Upload Category Tabs */}
            <div className="upload-nav-tabs">
                <button
                    type="button"
                    className={`upload-tab-btn ${activeTab === "clinical" ? "active" : ""}`}
                    onClick={() => {
                        setActiveTab("clinical");
                        setSuccessMessage("");
                        setErrorMessage("");
                    }}
                >
                    🩺 1. Clinical Data Upload
                </button>
                <button
                    type="button"
                    className={`upload-tab-btn ${activeTab === "ecg" ? "active" : ""}`}
                    onClick={() => {
                        setActiveTab("ecg");
                        setSuccessMessage("");
                        setErrorMessage("");
                    }}
                >
                    📈 2. ECG Recording File Upload
                </button>
                <button
                    type="button"
                    className={`upload-tab-btn ${activeTab === "history" ? "active" : ""}`}
                    onClick={() => {
                        setActiveTab("history");
                        fetchHistory();
                    }}
                >
                    🗄 3. Stored MongoDB Records ({clinicalRecords.length + ecgRecords.length})
                </button>
            </div>

            {/* Notification Messages */}
            {successMessage && (
                <div className="form-success" style={{ margin: "16px 0" }}>
                    {successMessage}
                </div>
            )}
            {errorMessage && (
                <div className="form-error" style={{ margin: "16px 0" }}>
                    ⚠ {errorMessage}
                </div>
            )}

            {/* Tab 1: Clinical Data Upload */}
            {activeTab === "clinical" && (
                <div className="card upload-card">
                    <div className="card-header-styled">
                        <h3>Clinical Biomarkers & Vitals Form</h3>
                        <p>Submit patient measurements directly to the <code>clinical_records</code> MongoDB collection.</p>
                    </div>

                    <form onSubmit={handleClinicalSubmit} className="upload-form-grid">
                        <div className="form-group">
                            <label>Patient Age (Years) *</label>
                            <input
                                type="number"
                                name="age"
                                min="1"
                                max="120"
                                placeholder="e.g. 54"
                                value={clinicalForm.age}
                                onChange={handleClinicalChange}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>Gender *</label>
                            <select name="sex" value={clinicalForm.sex} onChange={handleClinicalChange}>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Resting Blood Pressure (mmHg) *</label>
                            <input
                                type="number"
                                name="resting_bp"
                                placeholder="e.g. 138"
                                value={clinicalForm.resting_bp}
                                onChange={handleClinicalChange}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>Serum Cholesterol (mg/dL) *</label>
                            <input
                                type="number"
                                name="cholesterol"
                                placeholder="e.g. 215"
                                value={clinicalForm.cholesterol}
                                onChange={handleClinicalChange}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>Maximum Heart Rate (BPM)</label>
                            <input
                                type="number"
                                name="max_heart_rate"
                                placeholder="e.g. 150"
                                value={clinicalForm.max_heart_rate}
                                onChange={handleClinicalChange}
                            />
                        </div>

                        <div className="form-group">
                            <label>Chest Pain Classification</label>
                            <select name="chest_pain_type" value={clinicalForm.chest_pain_type} onChange={handleClinicalChange}>
                                <option value="ASY">Asymptomatic (ASY)</option>
                                <option value="NAP">Non-Anginal Pain (NAP)</option>
                                <option value="ATA">Atypical Angina (ATA)</option>
                                <option value="TA">Typical Angina (TA)</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Resting ECG Waveform</label>
                            <select name="resting_ecg" value={clinicalForm.resting_ecg} onChange={handleClinicalChange}>
                                <option value="Normal">Normal</option>
                                <option value="ST">ST-T Wave Abnormality</option>
                                <option value="LVH">Left Ventricular Hypertrophy</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label>ST Depression (mm)</label>
                            <input
                                type="number"
                                step="0.1"
                                name="st_depression"
                                placeholder="e.g. 1.2"
                                value={clinicalForm.st_depression}
                                onChange={handleClinicalChange}
                            />
                        </div>

                        <div className="form-group">
                            <label>ST Segment Slope</label>
                            <select name="st_slope" value={clinicalForm.st_slope} onChange={handleClinicalChange}>
                                <option value="Up">Upsloping (Up)</option>
                                <option value="Flat">Flat</option>
                                <option value="Down">Downsloping (Down)</option>
                            </select>
                        </div>

                        <div className="form-group checkbox-group" style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "24px" }}>
                            <input
                                type="checkbox"
                                id="fasting_blood_sugar"
                                name="fasting_blood_sugar"
                                checked={clinicalForm.fasting_blood_sugar}
                                onChange={handleClinicalChange}
                            />
                            <label htmlFor="fasting_blood_sugar">Fasting Blood Sugar &gt; 120 mg/dL</label>
                        </div>

                        <div className="form-group checkbox-group" style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "24px" }}>
                            <input
                                type="checkbox"
                                id="exercise_angina"
                                name="exercise_angina"
                                checked={clinicalForm.exercise_angina}
                                onChange={handleClinicalChange}
                            />
                            <label htmlFor="exercise_angina">Exercise-Induced Angina</label>
                        </div>

                        <div style={{ gridColumn: "1 / -1", marginTop: "16px" }}>
                            <button type="submit" className="primary-btn" disabled={loading} style={{ width: "100%" }}>
                                {loading ? "Saving to MongoDB..." : "💾 Save Clinical Record to MongoDB"}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Tab 2: ECG File Upload */}
            {activeTab === "ecg" && (
                <div className="card upload-card">
                    <div className="card-header-styled">
                        <h3>12-Lead ECG Signal Upload</h3>
                        <p>Upload raw telemetry recordings. Files are saved to disk and metadata is registered in MongoDB.</p>
                    </div>

                    <form onSubmit={handleEcgSubmit}>
                        <div className="file-dropzone" onClick={() => document.getElementById("ecgFileInput").click()}>
                            <div className="dropzone-icon">📁</div>
                            <h4>{selectedFile ? selectedFile.name : "Click or Drag & Drop ECG file here"}</h4>
                            <p>Supported file types: .csv, .dat, .hea, .txt, .pdf, .png, .jpg (Max 10 MB)</p>
                            <input
                                id="ecgFileInput"
                                type="file"
                                style={{ display: "none" }}
                                accept=".csv,.dat,.hea,.txt,.pdf,.png,.jpg,.jpeg"
                                onChange={handleEcgFileChange}
                            />
                        </div>

                        <div className="upload-form-grid" style={{ marginTop: "20px" }}>
                            <div className="form-group">
                                <label>Sampling Rate (Hz)</label>
                                <input
                                    type="number"
                                    value={ecgSamplingRate}
                                    onChange={(e) => setEcgSamplingRate(Number(e.target.value))}
                                />
                            </div>

                            <div className="form-group">
                                <label>Lead Count</label>
                                <select value={ecgLeadCount} onChange={(e) => setEcgLeadCount(Number(e.target.value))}>
                                    <option value={12}>12-Lead ECG (Standard)</option>
                                    <option value={6}>6-Lead ECG</option>
                                    <option value={3}>3-Lead Holter</option>
                                    <option value={1}>1-Lead Rhythm Strip</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Duration (Seconds)</label>
                                <input
                                    type="number"
                                    step="0.5"
                                    value={ecgDuration}
                                    onChange={(e) => setEcgDuration(Number(e.target.value))}
                                />
                            </div>
                        </div>

                        <div style={{ marginTop: "20px" }}>
                            <button type="submit" className="primary-btn" disabled={loading || !selectedFile} style={{ width: "100%" }}>
                                {loading ? "Uploading to Server..." : "⬆ Upload ECG Recording to Server & MongoDB"}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Tab 3: MongoDB Stored Records Viewer */}
            {activeTab === "history" && (
                <div className="card upload-card">
                    <div className="card-header-styled" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                            <h3>Active MongoDB Records for Your Account</h3>
                            <p>Real-time query of clinical vitals and ECG files saved in database collections.</p>
                        </div>
                        <button type="button" className="secondary-btn" onClick={fetchHistory} disabled={historyLoading}>
                            {historyLoading ? "Querying..." : "↻ Refresh from MongoDB"}
                        </button>
                    </div>

                    <div style={{ marginTop: "24px" }}>
                        <h4 style={{ marginBottom: "12px" }}>🩺 Clinical Records in MongoDB (<code>clinical_records</code>)</h4>
                        {clinicalRecords.length === 0 ? (
                            <p style={{ color: "#64748b", fontStyle: "italic" }}>No clinical records saved in MongoDB yet.</p>
                        ) : (
                            <div className="registry-table-wrapper">
                                <table className="registry-table">
                                    <thead>
                                        <tr>
                                            <th>Record ID</th>
                                            <th>Age / Sex</th>
                                            <th>Blood Pressure</th>
                                            <th>Cholesterol</th>
                                            <th>Max Heart Rate</th>
                                            <th>Chest Pain</th>
                                            <th>Recorded At</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {clinicalRecords.map((r) => (
                                            <tr key={r.id}>
                                                <td><code>{r.id}</code></td>
                                                <td>{r.age} yrs • {r.sex}</td>
                                                <td><strong>{r.resting_bp} mmHg</strong></td>
                                                <td>{r.cholesterol} mg/dL</td>
                                                <td>{r.max_heart_rate ? `${r.max_heart_rate} BPM` : "--"}</td>
                                                <td>{r.chest_pain_type || "--"}</td>
                                                <td><small>{r.recorded_at ? new Date(r.recorded_at).toLocaleString() : "Just now"}</small></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    <div style={{ marginTop: "32px" }}>
                        <h4 style={{ marginBottom: "12px" }}>📈 ECG Recordings in MongoDB (<code>ecg_recordings</code>)</h4>
                        {ecgRecords.length === 0 ? (
                            <p style={{ color: "#64748b", fontStyle: "italic" }}>No ECG recordings uploaded to MongoDB yet.</p>
                        ) : (
                            <div className="registry-table-wrapper">
                                <table className="registry-table">
                                    <thead>
                                        <tr>
                                            <th>Recording ID</th>
                                            <th>File Name</th>
                                            <th>Leads</th>
                                            <th>Sampling Rate</th>
                                            <th>Size</th>
                                            <th>Status</th>
                                            <th>Uploaded At</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {ecgRecords.map((r) => (
                                            <tr key={r.id}>
                                                <td><code>{r.id}</code></td>
                                                <td><strong>{r.original_name}</strong></td>
                                                <td>{r.lead_count} Leads</td>
                                                <td>{r.sampling_rate_hz} Hz</td>
                                                <td>{(r.size_bytes / 1024).toFixed(1)} KB</td>
                                                <td><span className="risk-pill low">{r.processing_status}</span></td>
                                                <td><small>{r.uploaded_at ? new Date(r.uploaded_at).toLocaleString() : "Just now"}</small></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default DataUpload;

