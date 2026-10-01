import React, { useMemo } from "react";

const ClinicalStatistics = ({ testData }) => {
    const statistics = useMemo(() => {
        if (!testData) {
            return {
                totalPatients: 0,
                completed: 0,
                pending: 0,
                highRisk: 0,
                completionRate: 0,
                averageHeartRate: "--",
                averageCholesterol: "--",
                averageSystolicBP: "--",
                averageDiastolicBP: "--",
            };
        }

        const totalPatients =
            Number(testData.statistics?.totalPatients) || 0;

        const completed =
            Number(testData.statistics?.assessmentsCompleted) || 0;

        const pending =
            Number(testData.statistics?.pendingAssessments) || 0;

        const highRisk =
            Number(testData.statistics?.highRiskPatients) || 0;

        const completionRate =
            totalPatients > 0
                ? Math.round((completed / totalPatients) * 100)
                : 0;

        return {
            totalPatients,
            completed,
            pending,
            highRisk,
            completionRate,
            averageHeartRate:
                testData.clinicalMetrics?.averageHeartRate ?? "--",

            averageCholesterol:
                testData.clinicalMetrics?.averageCholesterol ?? "--",

            averageSystolicBP:
                testData.clinicalMetrics?.averageSystolicBP ?? "--",

            averageDiastolicBP:
                testData.clinicalMetrics?.averageDiastolicBP ?? "--",
        };
    }, [testData]);

    const getCompletionStatus = () => {
        if (statistics.completionRate >= 80) {
            return "Good";
        }

        if (statistics.completionRate >= 50) {
            return "Moderate";
        }

        return "Pending";
    };

    const getHeartRateStatus = () => {
        const value = Number(statistics.averageHeartRate);

        if (!value) {
            return "Unavailable";
        }

        if (value >= 60 && value <= 100) {
            return "Within range";
        }

        return "Needs review";
    };

    const getCholesterolStatus = () => {
        const value = Number(
            statistics.averageCholesterol
        );

        if (!value) {
            return "Unavailable";
        }

        if (value < 200) {
            return "Desirable";
        }

        if (value < 240) {
            return "Borderline";
        }

        return "High";
    };

    const getBloodPressureStatus = () => {
        const systolic =
            Number(statistics.averageSystolicBP);

        const diastolic =
            Number(statistics.averageDiastolicBP);

        if (!systolic || !diastolic) {
            return "Unavailable";
        }

        if (systolic < 120 && diastolic < 80) {
            return "Normal range";
        }

        if (systolic < 130 && diastolic < 80) {
            return "Elevated";
        }

        return "Needs review";
    };

    return (
        <div className="clinical-statistics">

            <div className="section-heading">

                <div>
                    <span className="welcome-label">
                        CLINICAL STATISTICS
                    </span>

                    <h2>
                        Assessment Overview
                    </h2>

                    <p>
                        Summary of clinical test data
                        available in the dashboard.
                    </p>
                </div>

            </div>

            <div className="clinical-stats-grid">

                <div className="clinical-stat-card">

                    <div className="clinical-stat-icon">
                        👥
                    </div>

                    <div className="clinical-stat-content">

                        <span className="card-label">
                            TOTAL PATIENTS
                        </span>

                        <h3>
                            {statistics.totalPatients}
                        </h3>

                        <p>
                            Patients in current dataset
                        </p>

                    </div>

                </div>

                <div className="clinical-stat-card">

                    <div className="clinical-stat-icon">
                        🧠
                    </div>

                    <div className="clinical-stat-content">

                        <span className="card-label">
                            COMPLETED
                        </span>

                        <h3>
                            {statistics.completed}
                        </h3>

                        <p>
                            Assessments completed
                        </p>

                    </div>

                </div>

                <div className="clinical-stat-card">

                    <div className="clinical-stat-icon">
                        📋
                    </div>

                    <div className="clinical-stat-content">

                        <span className="card-label">
                            PENDING
                        </span>

                        <h3>
                            {statistics.pending}
                        </h3>

                        <p>
                            Assessments awaiting review
                        </p>

                    </div>

                </div>

                <div className="clinical-stat-card">

                    <div className="clinical-stat-icon">
                        ⚠️
                    </div>

                    <div className="clinical-stat-content">

                        <span className="card-label">
                            HIGH RISK
                        </span>

                        <h3>
                            {statistics.highRisk}
                        </h3>

                        <p>
                            Patients requiring review
                        </p>

                    </div>

                </div>

            </div>

            <div className="clinical-analysis-grid">

                <div className="clinical-analysis-card">

                    <div className="analysis-header">

                        <div>
                            <span className="card-label">
                                ASSESSMENT COMPLETION
                            </span>

                            <h3>
                                {statistics.completionRate}%
                            </h3>
                        </div>

                        <span className="analysis-icon">
                            ✓
                        </span>

                    </div>

                    <div className="progress-track">

                        <div
                            className="progress-fill"
                            style={{
                                width: `${statistics.completionRate}%`,
                            }}
                        />

                    </div>

                    <div className="analysis-footer">

                        <span>
                            {statistics.completed} of{" "}
                            {statistics.totalPatients} completed
                        </span>

                        <strong>
                            {getCompletionStatus()}
                        </strong>

                    </div>

                </div>

                <div className="clinical-analysis-card">

                    <div className="analysis-header">

                        <div>
                            <span className="card-label">
                                HEART RATE
                            </span>

                            <h3>
                                {statistics.averageHeartRate}
                                {" "}
                                <small>BPM</small>
                            </h3>
                        </div>

                        <span className="analysis-icon">
                            ❤️
                        </span>

                    </div>

                    <div className="analysis-footer">

                        <span>
                            Average value
                        </span>

                        <strong>
                            {getHeartRateStatus()}
                        </strong>

                    </div>

                </div>

                <div className="clinical-analysis-card">

                    <div className="analysis-header">

                        <div>
                            <span className="card-label">
                                CHOLESTEROL
                            </span>

                            <h3>
                                {statistics.averageCholesterol}
                                {" "}
                                <small>mg/dL</small>
                            </h3>
                        </div>

                        <span className="analysis-icon">
                            🧪
                        </span>

                    </div>

                    <div className="analysis-footer">

                        <span>
                            Average value
                        </span>

                        <strong>
                            {getCholesterolStatus()}
                        </strong>

                    </div>

                </div>

                <div className="clinical-analysis-card">

                    <div className="analysis-header">

                        <div>
                            <span className="card-label">
                                BLOOD PRESSURE
                            </span>

                            <h3>
                                {statistics.averageSystolicBP}
                                /
                                {statistics.averageDiastolicBP}
                            </h3>
                        </div>

                        <span className="analysis-icon">
                            🩺
                        </span>

                    </div>

                    <div className="analysis-footer">

                        <span>
                            Average BP
                        </span>

                        <strong>
                            {getBloodPressureStatus()}
                        </strong>

                    </div>

                </div>

            </div>

        </div>
    );
};

export default ClinicalStatistics;