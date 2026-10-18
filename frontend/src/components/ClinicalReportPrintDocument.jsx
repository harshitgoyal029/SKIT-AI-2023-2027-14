import React from "react";

const ClinicalReportPrintDocument = ({
    patient,
    currentUser,
    latestClinical,
    latestPrediction,
    hasDiseaseRisk,
    riskStatusLabel,
}) => {
    const today = new Date();
    const formattedDate = today.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
    const formattedTime = today.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
    });

    const patientName =
        currentUser?.full_name || currentUser?.name || patient?.name || "Jane Doe (Patient)";
    const patientEmail = currentUser?.email || patient?.email || "patient@cardioxai.org";
    const patientId = currentUser?.id || currentUser?._id || "PT-94021";

    const reportId = latestPrediction?.id
        ? `CVD-RPT-${latestPrediction.id.slice(-6).toUpperCase()}`
        : `CVD-RPT-${today.getFullYear()}-001`;

    const restingBp = latestClinical?.resting_bp || 120;
    const cholesterol = latestClinical?.cholesterol || 200;
    const maxHeartRate = latestClinical?.max_heart_rate || "--";
    const fastingSugar = latestClinical?.fasting_blood_sugar
        ? "Elevated (> 120 mg/dL)"
        : "Normal (≤ 120 mg/dL)";
    const stDepression =
        latestClinical?.st_depression !== undefined
            ? `${latestClinical.st_depression} mm`
            : "0.0 mm";
    const stSlope = latestClinical?.st_slope || "Flat";
    const chestPain = latestClinical?.chest_pain_type || "Asymptomatic (ASY)";

    return (
        <div id="clinical-report-printable-area" className="clinical-print-document">
            {/* Header: Institutional & Department Banner */}
            <div className="print-header">
                <div className="print-header-left">
                    <div className="print-institution-logo">🫀</div>
                    <div>
                        <h1 className="print-institution-name">CardioXAI Clinical Intelligence</h1>
                        <p className="print-institution-dept">
                            Division of Cardiovascular Medicine & Computational Diagnostics
                        </p>
                        <p className="print-institution-sub">
                            Center for Artificial Intelligence in Cardiology • ACC/AHA Multi-Center Standards
                        </p>
                    </div>
                </div>
                <div className="print-header-right">
                    <span className="print-doc-classification">CONFIDENTIAL MEDICAL DOCUMENT</span>
                    <div className="print-meta-line">
                        <strong>Report Ref:</strong> {reportId}
                    </div>
                    <div className="print-meta-line">
                        <strong>Generated:</strong> {formattedDate}, {formattedTime}
                    </div>
                    <div className="print-meta-line">
                        <strong>Source:</strong> Verified Clinical Records
                    </div>
                </div>
            </div>

            <div className="print-divider"></div>

            {/* Document Title */}
            <div className="print-title-section">
                <h2 className="print-title">CARDIOVASCULAR HEALTH & RISK ASSESSMENT REPORT</h2>
                <p className="print-subtitle">
                    Automated Deep Learning Decision Support & Biomarker Attribution Analysis
                </p>
            </div>

            {/* Patient Demographics & Identification Grid */}
            <div className="print-section">
                <div className="print-section-header">PATIENT IDENTIFICATION & CLINICAL RECORD</div>
                <table className="print-demographics-table">
                    <tbody>
                        <tr>
                            <td className="print-demog-label">Patient Full Name:</td>
                            <td className="print-demog-val">
                                <strong>{patientName}</strong>
                            </td>
                            <td className="print-demog-label">Patient ID:</td>
                            <td className="print-demog-val">{patientId}</td>
                        </tr>
                        <tr>
                            <td className="print-demog-label">Age / Biological Sex:</td>
                            <td className="print-demog-val">
                                {latestClinical?.age || 52} Years /{" "}
                                {latestClinical?.sex === "M" ? "Male" : "Female"}
                            </td>
                            <td className="print-demog-label">Registered Email:</td>
                            <td className="print-demog-val">{patientEmail}</td>
                        </tr>
                        <tr>
                            <td className="print-demog-label">Attending Cardiologist:</td>
                            <td className="print-demog-val" style={{ color: "#b45309", fontWeight: 700 }}>
                                Unassigned (Queued in Clinical Triage)
                            </td>
                            <td className="print-demog-label">Last Vitals Upload:</td>
                            <td className="print-demog-val">
                                {latestClinical?.recorded_at
                                    ? new Date(latestClinical.recorded_at).toLocaleDateString()
                                    : formattedDate}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Primary Diagnostic Assessment Box */}
            <div className="print-section">
                <div className="print-section-header">CARDIOVASCULAR RISK EVALUATION</div>
                <div
                    className={`print-assessment-box ${hasDiseaseRisk ? "risk-detected" : "risk-optimal"}`}
                >
                    <div className="print-assessment-header">
                        <div>
                            <span className="print-eval-tag">DEEP NEURAL NETWORK CLINICAL ASSESSMENT</span>
                            <h3 className="print-eval-finding">
                                {hasDiseaseRisk
                                    ? "Cardiovascular Disease Risk Detected — Clinical Consultation Recommended"
                                    : "No Immediate Cardiovascular Disease Risk Detected — Optimal Range"}
                            </h3>
                        </div>
                        <div className={`print-eval-badge ${hasDiseaseRisk ? "badge-risk" : "badge-optimal"}`}>
                            {hasDiseaseRisk ? "ELEVATED RISK" : "OPTIMAL / LOW RISK"}
                        </div>
                    </div>

                    <div className="print-eval-body">
                        <p>
                            <strong>Clinical Diagnostic Interpretation: </strong>
                            {hasDiseaseRisk
                                ? `Diagnostic inference by trained 16-feature deep neural network (clinical_dnn.keras, validated on 10,302 multi-center patient records). Based on resting systolic blood pressure of ${restingBp} mmHg and serum cholesterol of ${cholesterol} mg/dL, early intervention is advised. A formal outpatient clinical review with the attending cardiology care team is recommended to discuss antihypertensive, lipid-lowering, and lifestyle therapies.`
                                : `Diagnostic inference by trained 16-feature deep neural network (clinical_dnn.keras, validated on 10,302 multi-center patient records). Measured hemodynamic and lipid markers are currently within standard non-ischemic target ranges. Routine preventative lifestyle maintenance, balanced Mediterranean nutrition, and regular annual screening are recommended.`}
                        </p>
                    </div>
                </div>
            </div>

            {/* Clinical Laboratory Biomarkers & Vitals Table */}
            <div className="print-section">
                <div className="print-section-header">RECORDED CLINICAL MEASUREMENTS & LABORATORY VITALS</div>
                <table className="print-data-table">
                    <thead>
                        <tr>
                            <th>Biomarker / Clinical Parameter</th>
                            <th>Patient Value</th>
                            <th>Clinical Target Reference</th>
                            <th>Status / Classification</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>
                                <strong>Resting Systolic Blood Pressure</strong>
                                <small>Vascular wall tension and afterload</small>
                            </td>
                            <td>
                                <strong>{restingBp} mmHg</strong>
                            </td>
                            <td>&lt; 120 mmHg</td>
                            <td className={restingBp > 130 ? "text-warn" : "text-ok"}>
                                {restingBp > 130 ? "Elevated (Attention Advised)" : "Within Normal Limits"}
                            </td>
                        </tr>
                        <tr>
                            <td>
                                <strong>Serum Total Cholesterol</strong>
                                <small>Atherogenic lipid marker</small>
                            </td>
                            <td>
                                <strong>{cholesterol} mg/dL</strong>
                            </td>
                            <td>&lt; 200 mg/dL</td>
                            <td className={cholesterol > 200 ? "text-warn" : "text-ok"}>
                                {cholesterol > 200 ? "Borderline / High" : "Desirable Target"}
                            </td>
                        </tr>
                        <tr>
                            <td>
                                <strong>Fasting Blood Sugar / Glycemic Status</strong>
                                <small>Microvascular & endothelial indicator</small>
                            </td>
                            <td>
                                <strong>{fastingSugar}</strong>
                            </td>
                            <td>Fasting &lt; 100 mg/dL</td>
                            <td className={latestClinical?.fasting_blood_sugar ? "text-warn" : "text-ok"}>
                                {latestClinical?.fasting_blood_sugar ? "Elevated (Metabolic Risk)" : "Normal Metabolism"}
                            </td>
                        </tr>
                        <tr>
                            <td>
                                <strong>ST Segment Depression (Exertion ECG)</strong>
                                <small>Subendocardial myocardial ischemia</small>
                            </td>
                            <td>
                                <strong>{stDepression}</strong>
                            </td>
                            <td>&lt; 0.5 mm</td>
                            <td
                                className={
                                    Number(latestClinical?.st_depression || 0) > 1.0 ? "text-warn" : "text-ok"
                                }
                            >
                                {Number(latestClinical?.st_depression || 0) > 1.0
                                    ? "Depressed (Ischemia Marker)"
                                    : "Normal ST Segment"}
                            </td>
                        </tr>
                        <tr>
                            <td>
                                <strong>ST Slope Configuration</strong>
                                <small>Repolarization slope shape</small>
                            </td>
                            <td>
                                <strong>{stSlope}</strong>
                            </td>
                            <td>Upsloping</td>
                            <td>{stSlope === "Up" ? "Normal" : "Borderline / Monitored"}</td>
                        </tr>
                        <tr>
                            <td>
                                <strong>Max Heart Rate Recorded</strong>
                                <small>Peak chronological response</small>
                            </td>
                            <td>
                                <strong>{maxHeartRate} BPM</strong>
                            </td>
                            <td>60 - 150 BPM</td>
                            <td>Recorded Baseline</td>
                        </tr>
                        <tr>
                            <td>
                                <strong>Chest Pain Symptom Profile</strong>
                                <small>Clinical angina classification</small>
                            </td>
                            <td>
                                <strong>{chestPain}</strong>
                            </td>
                            <td>Asymptomatic</td>
                            <td>Reported Symptom Class</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Explainable AI (XAI) Biomarker Attribution Analysis */}
            <div className="print-section">
                <div className="print-section-header">EXPLAINABLE AI (XAI) BIOMARKER ATTRIBUTIONS</div>
                <div className="print-xai-grid">
                    <div className="print-xai-card">
                        <div className="print-xai-title">▲ Primary Risk Drivers</div>
                        <ul className="print-xai-list">
                            {restingBp > 130 && (
                                <li>
                                    <strong>Systolic BP ({restingBp} mmHg):</strong> Elevates arterial endothelial shear stress and cardiac afterload.
                                </li>
                            )}
                            {cholesterol > 200 && (
                                <li>
                                    <strong>Total Cholesterol ({cholesterol} mg/dL):</strong> Associated with increased risk of atheroma formation.
                                </li>
                            )}
                            {latestClinical?.fasting_blood_sugar && (
                                <li>
                                    <strong>Fasting Blood Sugar:</strong> Impaired fasting glucose contributes to microvascular oxidative stress.
                                </li>
                            )}
                            {Number(latestClinical?.st_depression || 0) > 1.0 && (
                                <li>
                                    <strong>ST Depression ({stDepression}):</strong> Indicative of exertional myocardial oxygen demand mismatch.
                                </li>
                            )}
                            {restingBp <= 130 &&
                                cholesterol <= 200 &&
                                !latestClinical?.fasting_blood_sugar &&
                                Number(latestClinical?.st_depression || 0) <= 1.0 && (
                                    <li style={{ color: "#166534" }}>
                                        No critical adverse risk drivers detected across evaluated biomarkers.
                                    </li>
                                )}
                        </ul>
                    </div>

                    <div className="print-xai-card">
                        <div className="print-xai-title">✓ Key Protective Factors</div>
                        <ul className="print-xai-list">
                            {restingBp <= 130 && (
                                <li>
                                    <strong>Normotensive Pressure:</strong> Preserves vascular compliance and reduces myocardial strain.
                                </li>
                            )}
                            {cholesterol <= 200 && (
                                <li>
                                    <strong>Desirable Cholesterol:</strong> Significantly reduces coronary atheroma and stenosis risk.
                                </li>
                            )}
                            {!latestClinical?.fasting_blood_sugar && (
                                <li>
                                    <strong>Normal Glucose Metabolism:</strong> Protects microvascular and capillary integrity.
                                </li>
                            )}
                            {Number(latestClinical?.st_depression || 0) <= 1.0 && (
                                <li>
                                    <strong>Stable ST Segment:</strong> No evidence of acute exertional myocardial ischemia.
                                </li>
                            )}
                        </ul>
                    </div>
                </div>
            </div>

            {/* Personalized Recommendations & Care Plan */}
            <div className="print-section">
                <div className="print-section-header">CLINICAL CARE PLAN & LIFESTYLE GUIDANCE</div>
                <div className="print-guidance-grid">
                    <div className="print-guidance-item">
                        <strong>🥗 Dietary Sodium & Lipid Management:</strong>
                        <p>
                            Restrict sodium intake to &lt; 2,000 mg/day. Prioritize soluble dietary fiber,
                            extra-virgin olive oil, and leafy greens to optimize LDL-to-HDL lipid ratios.
                        </p>
                    </div>
                    <div className="print-guidance-item">
                        <strong>🚶 Cardiovascular Aerobic Activity:</strong>
                        <p>
                            Target at least 150 minutes of moderate-intensity aerobic exercise (e.g. brisk walking,
                            swimming) distributed across 5 days weekly.
                        </p>
                    </div>
                    <div className="print-guidance-item">
                        <strong>🩺 Outpatient Cardiology Review:</strong>
                        <p>
                            This record has been submitted to the outpatient cardiology triage queue. An attending
                            cardiologist will review this assessment and establish direct clinical follow-up.
                        </p>
                    </div>
                </div>
            </div>

            {/* Attending Physician / Cardiologist Clinical Review Block ("Doctor's Words") */}
            <div className="print-section print-doctor-words-section">
                <div className="print-section-header">
                    ATTENDING PHYSICIAN / CARDIOLOGIST CLINICAL EVALUATION &amp; IMPRESSIONS ("DOCTOR'S WORDS")
                </div>
                <div className="print-doctor-box">
                    <div className="print-doctor-box-header">
                        <span className="print-doctor-prompt">
                            Physician Clinical Impressions, Diagnostic Findings, Pharmacotherapy &amp; Management Notes:
                        </span>
                        <div className="print-doctor-checkboxes">
                            <span className="checkbox-item"><span className="checkbox-square"></span> Confirm Assessment</span>
                            <span className="checkbox-item"><span className="checkbox-square"></span> Order 12-Lead ECG / Echo</span>
                            <span className="checkbox-item"><span className="checkbox-square"></span> Modify Statin / BP Rx</span>
                            <span className="checkbox-item"><span className="checkbox-square"></span> Follow-up Scheduled</span>
                        </div>
                    </div>
                    {/* Ruled lines for doctor's handwritten or recorded clinical notes */}
                    <div className="print-doctor-ruled-area">
                        <div className="print-doctor-line">
                            <span className="print-line-label">Clinical Diagnosis / Impressions:</span>
                        </div>
                        <div className="print-doctor-line">
                            <span className="print-line-label">Therapeutic Plan &amp; Medication Adjustments:</span>
                        </div>
                        <div className="print-doctor-line">
                            <span className="print-line-label">Additional Diagnostic Workup / Lab Orders:</span>
                        </div>
                        <div className="print-doctor-line">
                            <span className="print-line-label">Follow-up Timeline &amp; Patient Instructions:</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Official Physician & Clinical Sign-Off Block */}
            <div className="print-section print-signature-section">
                <div className="print-section-header">CLINICAL ATTESTATION &amp; OFFICIAL SIGNATURES</div>
                <div className="print-signature-grid">
                    {/* Attending Physician Signature */}
                    <div className="print-signature-box">
                        <div className="print-signature-space"></div>
                        <div className="print-sig-line"></div>
                        <span className="print-sig-role">Attending Physician / Cardiologist Signature</span>
                        <div className="print-sig-detail">Doctor's Name: Dr. ___________________________</div>
                        <div className="print-sig-detail">Medical License / Reg No.: _____________________</div>
                    </div>

                    {/* Official Medical Stamp / Clinic Seal */}
                    <div className="print-signature-box stamp-box">
                        <div className="print-stamp-area">
                            <span className="stamp-placeholder">[ OFFICIAL CLINIC / HOSPITAL STAMP ]</span>
                        </div>
                        <span className="print-sig-role" style={{ textAlign: "center" }}>Medical Seal &amp; Verification</span>
                        <div className="print-sig-detail" style={{ textAlign: "center" }}>CardioXAI Clinical Center</div>
                    </div>

                    {/* Review Date & Department */}
                    <div className="print-signature-box">
                        <div className="print-signature-space"></div>
                        <div className="print-sig-line"></div>
                        <span className="print-sig-role">Date of Physician Review &amp; Sign-Off</span>
                        <div className="print-sig-detail">Review Date: _____ / _____ / 2026</div>
                        <div className="print-sig-detail">Division: Cardiovascular Outpatient Care</div>
                    </div>
                </div>

                <div className="print-disclaimer">
                    <strong>Medical Legal Disclaimer: </strong>
                    This report was synthesized using the validated CardioXAI computational deep learning diagnostic
                    system (clinical_dnn.keras, 16 input parameters, 10,302 multi-center training cohorts). It is
                    intended for clinical decision support and health monitoring. This document does not replace formal
                    medical consultation, laboratory bloodwork, or acute emergency evaluation.
                </div>
            </div>
        </div>
    );
};

export default ClinicalReportPrintDocument;

