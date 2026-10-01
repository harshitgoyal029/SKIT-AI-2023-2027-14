import React, { useMemo } from "react";

const AiReport = ({ patient, testData }) => {
    const report = useMemo(() => {
        const assessment = testData?.assessment || {};
        const metrics = testData?.clinicalMetrics || {};
        const features = testData?.explainability?.topFeatures || [];
        const ecg = testData?.ecg || {};
        const risk = patient?.riskLevel || assessment.prediction || "Pending";
        const score = assessment.riskScore ?? "--";
        const topFeature = [...features].sort(
            (a, b) => Math.abs(Number(b.contribution) || 0) - Math.abs(Number(a.contribution) || 0)
        )[0];

        return {
            risk,
            score,
            model: assessment.model || "Cardiovascular Risk Model",
            topFeature: topFeature?.feature || "No feature available",
            topFeatureDirection: topFeature?.direction || "Pending",
            heartRate: metrics.averageHeartRate ?? ecg.heartRate ?? "--",
            cholesterol: metrics.averageCholesterol ?? "--",
            bloodPressure:
                metrics.averageSystolicBP && metrics.averageDiastolicBP
                    ? `${metrics.averageSystolicBP}/${metrics.averageDiastolicBP}`
                    : "--",
            rhythm: ecg.rhythm || "--",
        };
    }, [patient, testData]);

    return (
        <div className="dashboard-section ai-report-section">
            <div className="section-heading">
                <div>
                    <span className="welcome-label">AI REPORT</span>
                    <h2>Clinical Assessment Summary</h2>
                    <p>
                        Structured report generated from the current dashboard test
                        assessment and available clinical explanation data.
                    </p>
                </div>
                <span className="ai-report-badge">AI GENERATED</span>
            </div>

            <div className="ai-report-card">
                <div className="ai-report-header">
                    <div>
                        <span>Patient</span>
                        <strong>{patient?.name || testData?.patient?.patientName || "Sample Patient"}</strong>
                    </div>
                    <div>
                        <span>Patient ID</span>
                        <strong>{patient?.patientId || testData?.patient?.patientId || "TEST-001"}</strong>
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
                            The current test assessment reports a <strong>{report.risk}</strong> result
                            using the {report.model}. Available dashboard metrics include a heart rate
                            of <strong>{report.heartRate} BPM</strong>, cholesterol of
                            <strong> {report.cholesterol} mg/dL</strong>, and blood pressure of
                            <strong> {report.bloodPressure} mmHg</strong>.
                        </p>
                    </section>

                    <section className="ai-report-block">
                        <h3>Model Explanation</h3>
                        <p>
                            The strongest available contributing feature is
                            <strong> {report.topFeature}</strong>, with a {report.topFeatureDirection}
                            impact in the current test explanation.
                        </p>
                    </section>

                    <section className="ai-report-block">
                        <h3>ECG Summary</h3>
                        <p>
                            ECG workflow data reports a rhythm of <strong>{report.rhythm}</strong>.
                            The ECG module is currently using test data until live ECG input is connected.
                        </p>
                    </section>

                    <section className="ai-report-block">
                        <h3>Clinical Review</h3>
                        <p>
                            This report is intended to support clinician review. It should not be used
                            as a standalone medical diagnosis or treatment recommendation.
                        </p>
                    </section>
                </div>

                <div className="ai-report-footer">
                    <span>Report status: Test Workflow</span>
                    <button type="button" className="secondary-btn" onClick={() => window.print()}>
                        Print Report
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AiReport;
