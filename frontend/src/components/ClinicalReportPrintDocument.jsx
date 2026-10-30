import React from "react";

const displayValue = (value, unit = "") => {
    if (value === null || value === undefined || value === "") return "Not recorded";
    return `${value}${unit ? ` ${unit}` : ""}`;
};

const ClinicalReportPrintDocument = ({ patient, currentUser, latestClinical, latestPrediction }) => {
    const generatedAt = new Date();
    const patientName = currentUser?.full_name || currentUser?.name || patient?.name || "Not provided";
    const patientId = patient?.patientId || patient?.patient_id || currentUser?.id || currentUser?._id || "Not provided";
    const scoreValue = Number(latestPrediction?.risk_score);
    const score = Number.isFinite(scoreValue)
        ? `${Math.round(scoreValue <= 1 ? scoreValue * 100 : scoreValue)}%`
        : "Not available";
    const assessment = latestPrediction?.risk_level || latestPrediction?.predicted_label || "No stored assessment";
    const riskText = String(assessment).toLowerCase();
    const assessmentClass = !latestPrediction
        ? "risk-pending"
        : riskText.includes("high") || riskText.includes("abnormal")
            ? "risk-detected"
            : "risk-optimal";
    const contributions = Array.isArray(latestPrediction?.feature_contributions)
        ? latestPrediction.feature_contributions
        : [];
    const topFeatures = Array.isArray(latestPrediction?.top_contributing_features)
        ? latestPrediction.top_contributing_features
        : [];

    return (
        <div id="clinical-report-printable-area" className="clinical-print-document">
            <div className="print-header">
                <div className="print-header-left">
                    <div className="print-institution-logo" aria-hidden="true">♥</div>
                    <div>
                        <h1 className="print-institution-name">CVD-XAI</h1>
                        <p className="print-institution-dept">Clinical decision support summary</p>
                        <p className="print-institution-sub">Generated from the data currently available in this account</p>
                    </div>
                </div>
                <div className="print-header-right">
                    <span className="print-doc-classification">FOR CLINICIAN REVIEW</span>
                    <div className="print-meta-line"><strong>Generated:</strong> {generatedAt.toLocaleString()}</div>
                    <div className="print-meta-line"><strong>Assessment ID:</strong> {latestPrediction?.id || "Not linked"}</div>
                </div>
            </div>

            <div className="print-divider" />
            <div className="print-title-section">
                <h2 className="print-title">Patient assessment summary</h2>
                <p className="print-subtitle">Verify the measurements and model output before clinical use.</p>
            </div>

            <section className="print-section">
                <h3 className="print-section-header">Patient context</h3>
                <table className="print-demographics-table"><tbody>
                    <tr>
                        <td className="print-demog-label">Name</td><td className="print-demog-val">{patientName}</td>
                        <td className="print-demog-label">Patient ID</td><td className="print-demog-val">{patientId}</td>
                    </tr>
                    <tr>
                        <td className="print-demog-label">Age</td><td className="print-demog-val">{displayValue(patient?.age, "years")}</td>
                        <td className="print-demog-label">Sex</td><td className="print-demog-val">{displayValue(latestClinical?.sex || patient?.gender || patient?.sex)}</td>
                    </tr>
                    <tr>
                        <td className="print-demog-label">Measurements recorded</td>
                        <td className="print-demog-val" colSpan="3">{latestClinical?.recorded_at ? new Date(latestClinical.recorded_at).toLocaleString() : "Not available"}</td>
                    </tr>
                </tbody></table>
            </section>

            <section className="print-section">
                <h3 className="print-section-header">Stored model output</h3>
                <div className={`print-assessment-box ${assessmentClass}`}>
                    <div className="print-assessment-header">
                        <div>
                            <span className="print-eval-tag">Model result</span>
                            <h4 className="print-eval-finding">{assessment}</h4>
                        </div>
                        <span className={`print-eval-badge ${assessmentClass === "risk-detected" ? "badge-risk" : "badge-optimal"}`}>
                            {score}
                        </span>
                    </div>
                    <div className="print-eval-body">
                        <p>
                            {latestPrediction
                                ? `Model: ${latestPrediction.model_name || "Not recorded"}. This is a model-generated result, not a diagnosis. Review it with the source measurements and a qualified clinician.`
                                : "No stored model assessment is available for this account."}
                        </p>
                    </div>
                </div>
            </section>

            <section className="print-section">
                <h3 className="print-section-header">Recorded clinical measurements</h3>
                <table className="print-data-table">
                    <thead><tr><th>Measurement</th><th>Recorded value</th><th>Measurement</th><th>Recorded value</th></tr></thead>
                    <tbody>
                        <tr><td>Resting blood pressure</td><td>{displayValue(latestClinical?.resting_bp, "mmHg")}</td><td>Total cholesterol</td><td>{displayValue(latestClinical?.cholesterol, "mg/dL")}</td></tr>
                        <tr><td>Maximum heart rate</td><td>{displayValue(latestClinical?.max_heart_rate, "BPM")}</td><td>Fasting blood sugar above threshold</td><td>{latestClinical?.fasting_blood_sugar == null ? "Not recorded" : latestClinical.fasting_blood_sugar ? "Yes" : "No"}</td></tr>
                        <tr><td>Resting ECG category</td><td>{displayValue(latestClinical?.resting_ecg)}</td><td>ST depression</td><td>{displayValue(latestClinical?.st_depression, "mm")}</td></tr>
                        <tr><td>Chest pain category</td><td>{displayValue(latestClinical?.chest_pain_type)}</td><td>ST slope</td><td>{displayValue(latestClinical?.st_slope)}</td></tr>
                    </tbody>
                </table>
            </section>

            <section className="print-section">
                <h3 className="print-section-header">Available feature contributions</h3>
                {contributions.length > 0 ? (
                    <ul className="print-xai-list">
                        {contributions.slice(0, 8).map((item, index) => (
                            <li key={`${item.feature || "feature"}-${index}`}>
                                {item.feature || "Feature"}: {displayValue(item.importance ?? item.contribution)}
                            </li>
                        ))}
                    </ul>
                ) : topFeatures.length > 0 ? (
                    <p>{topFeatures.slice(0, 8).join(", ")}</p>
                ) : <p>No feature contribution data is available for this assessment.</p>}
            </section>

            <section className="print-section print-doctor-words-section">
                <h3 className="print-section-header">Clinician review notes</h3>
                <div className="print-doctor-box">
                    <div className="print-doctor-ruled-area">
                        <div className="print-doctor-line" /><div className="print-doctor-line" /><div className="print-doctor-line" />
                    </div>
                </div>
            </section>

            <div className="print-disclaimer">
                This summary presents measurements and model output available in CVD-XAI at the time it was generated. It is not a diagnosis or treatment recommendation. A qualified clinician should review the source data and determine any next steps.
            </div>
        </div>
    );
};

export default ClinicalReportPrintDocument;
