import React, { useMemo } from "react";

const ShapChart = ({ features = [], method = "SHAP" }) => {
    const chartData = useMemo(() => {
        return features
            .filter((feature) => feature?.feature)
            .map((feature) => {
                const rawValue = Number(feature.contribution) || 0;
                const direction = String(feature.direction || "positive").toLowerCase();
                const isNegative = direction.includes("negative") || direction.includes("decrease") || direction.includes("down");
                const value = Math.abs(rawValue);

                return {
                    ...feature,
                    signedValue: isNegative ? -value : value,
                    directionLabel: isNegative ? "Negative impact" : "Positive impact",
                };
            })
            .sort((a, b) => Math.abs(b.signedValue) - Math.abs(a.signedValue));
    }, [features]);

    const maxContribution = Math.max(
        ...chartData.map((feature) => Math.abs(feature.signedValue)),
        0.01
    );

    if (!chartData.length) return null;

    return (
        <div className="dashboard-section shap-chart-section">
            <div className="section-heading">
                <div>
                    <span className="welcome-label">MODEL EXPLAINABILITY</span>
                    <h2>{method} Feature Contribution</h2>
                    <p>
                        Visual representation of how each feature contributes to
                        the current cardiovascular risk assessment.
                    </p>
                </div>
                <div className="shap-chart-badge">{method}</div>
            </div>

            <div className="shap-chart-card">
                <div className="shap-chart-legend">
                    <span><i className="shap-dot positive" /> Increases risk</span>
                    <span><i className="shap-dot negative" /> Decreases risk</span>
                </div>

                <div className="shap-axis">
                    <span>Lower contribution</span>
                    <span>Higher contribution</span>
                </div>

                <div className="shap-bars">
                    {chartData.map((feature) => {
                        const width = Math.max(8, (Math.abs(feature.signedValue) / maxContribution) * 100);
                        const isNegative = feature.signedValue < 0;

                        return (
                            <div className="shap-row" key={feature.feature}>
                                <div className="shap-feature-name">
                                    <strong>{feature.feature}</strong>
                                    <span>{feature.directionLabel}</span>
                                </div>

                                <div className="shap-bar-area">
                                    <div className="shap-center-line" />
                                    <div
                                        className={`shap-bar ${isNegative ? "negative" : "positive"}`}
                                        style={{ width: `${width}%` }}
                                    />
                                </div>

                                <div className={`shap-value ${isNegative ? "negative" : "positive"}`}>
                                    {isNegative ? "-" : "+"}
                                    {(Math.abs(feature.signedValue) * 100).toFixed(0)}%
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="shap-chart-note">
                    <span>ⓘ</span>
                    <p>
                        Larger bars indicate a stronger contribution to the model
                        explanation. This view uses the dashboard test data until
                        the live SHAP backend is connected.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ShapChart;
