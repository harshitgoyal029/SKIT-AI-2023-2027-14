import React, { useMemo } from "react";
import { printClinicalReport } from "../utils/printReport";

const AiReport = ({ patient, testData }) => {
    const report = useMemo(() => {
        const assessment = testData?.assessment || {};
        const metrics = testData?.clinicalMetrics || {};
        const features = testData?.explainability?.topFeatures || [];
        const ecg = testData?.ecg || {};
        const risk = patient?.riskLevel || patient?.risk_level || assessment.prediction || "Pending assessment";
        const rawScore = assessment.riskScore !== undefined && assessment.riskScore !== null
            ? Number(assessment.riskScore)
            : Number(patient?.risk_score) * 100;
        const score = Number.isFinite(rawScore)
            ? `${Math.round(rawScore)}%`
            : "—";
        const topFeature = [...features].sort(
            (a, b) => Math.abs(Number(b.contribution) || 0) - Math.abs(Number(a.contribution) || 0)
        )[0];

        return {
            risk,
            score,
            model: assessment.model || patient?.model_name || "Model name unavailable",
            topFeature: topFeature?.feature || "No stored feature attribution available",
            topFeatureDirection: topFeature?.direction || "",
            heartRate: metrics.averageHeartRate ?? patient?.heartRate ?? patient?.heart_rate ?? "—",
            cholesterol: metrics.averageCholesterol ?? patient?.cholesterol ?? "—",
            bloodPressure:
                metrics.averageSystolicBP && metrics.averageDiastolicBP
                    ? `${metrics.averageSystolicBP}/${metrics.averageDiastolicBP}`
                    : patient?.bloodPressure || patient?.blood_pressure || "—",
            rhythm: ecg.rhythm || "—",
        };
    }, [patient, testData]);

    return (
        <div className="dashboard-section ai-report-section">
            <div className="section-heading">
                <div>
                    <span className="welcome-label">AI REPORT</span>
                    <h2>Clinical Assessment Summary</h2>
                    <p>
                        Structured summary based on the assessment and clinical explanation data currently available in the dashboard.
                    </p>
                </div>
                <span className="ai-report-badge">CLINICAL SUMMARY</span>
            </div>

            <div className="ai-report-card">
                <div className="ai-report-header">
                    <div>
                        <span>Patient</span>
                        <strong>{patient?.name || testData?.patient?.patientName || "No patient selected"}</strong>
                    </div>
                    <div>
                        <span>Patient ID</span>
                        <strong>{patient?.patientId || patient?.patient_id || testData?.patient?.patientId || "—"}</strong>
                    </div>
                    <div>
                        <span>Assessment</span>
                        <strong>{report.risk}</strong>
                    </div>
                    <div>
                        <span>Risk Score</span>
                        <strong>{report.score}</strong>
                    </div>
                </div>

                <div className="ai-report-grid">
                    <section className="ai-report-block">
                        <h3>Clinical Summary</h3>
                        <p>
                            {report.score !== "—"
                                ? <>The stored model result is <strong>{report.risk}</strong> ({report.score}) from the {report.model}. Review it alongside the source measurements: heart rate <strong>{report.heartRate} BPM</strong>, cholesterol <strong>{report.cholesterol} mg/dL</strong>, and blood pressure <strong>{report.bloodPressure} mmHg</strong>.</>
                                : "No model assessment is stored for this patient. Complete an assessment and verify the source data before generating a clinical summary."}
                        </p>
                    </section>

                    <section className="ai-report-block">
                        <h3>Model Explanation</h3>
                        <p>
                            {report.topFeatureDirection
                                ? <>The strongest available stored attribution is <strong>{report.topFeature}</strong>, with a {report.topFeatureDirection} impact.</>
                                : report.topFeature}
                        </p>
                    </section>

                    <section className="ai-report-block">
                        <h3>ECG Summary</h3>
                        <p>
                            {report.rhythm !== "—"
                                ? <>The attached ECG result reports a rhythm of <strong>{report.rhythm}</strong>.</>
                                : "No ECG result is attached to this assessment."}
                        </p>
                    </section>

                    <section className="ai-report-block">
                        <h3>Clinical Review</h3>
                        <p>
                            This summary supports clinician review only. Confirm the source data and model output before making clinical decisions; it is not a standalone diagnosis or treatment recommendation.
                        </p>
                    </section>
                </div>

                <div className="ai-report-footer">
                    <span>Review source data and confirm the model result before clinical use.</span>
                    <button type="button" className="secondary-btn" onClick={() => printClinicalReport()}>
                        Print Report
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AiReport;
