import React, { useMemo } from "react";

const ShapChart = ({ features = [], method = "SHAP" }) => {
    const chartData = useMemo(() => {
        return features
            .map((feature) => {
                const featureName = feature?.feature ?? feature?.feature_name ?? feature?.name;
                const rawContribution = feature?.contribution ?? feature?.shap_value ?? feature?.value;
                const parsedContribution = Number(rawContribution);
                if (!featureName || !Number.isFinite(parsedContribution)) return null;

                const direction = String(feature.direction || "").toLowerCase();
                const directionIsNegative = direction.includes("negative") || direction.includes("decrease") || direction.includes("down");
                const directionIsPositive = direction.includes("positive") || direction.includes("increase") || direction.includes("up");
                const signedValue = directionIsNegative
                    ? -Math.abs(parsedContribution)
                    : directionIsPositive
                        ? Math.abs(parsedContribution)
                        : parsedContribution;
                const isNegative = signedValue < 0;

                return {
                    ...feature,
                    feature: String(featureName),
                    signedValue,
                    directionLabel: isNegative ? "Decreases model output" : signedValue > 0 ? "Increases model output" : "No directional impact",
                };
            })
            .filter(Boolean)
            .sort((a, b) => Math.abs(b.signedValue) - Math.abs(a.signedValue));
    }, [features]);

    const maxContribution = Math.max(
        ...chartData.map((feature) => Math.abs(feature.signedValue)),
        0.01
    );

    if (!chartData.length) {
        return (
            <div className="dashboard-section shap-chart-section">
                <div className="section-heading">
                    <div>
                        <span className="welcome-label">MODEL EXPLAINABILITY</span>
                        <h2>{method} Feature Contribution</h2>
                    </div>
                </div>
                <div className="shap-chart-card" role="status">
                    No feature-attribution data is available for this assessment yet.
                </div>
            </div>
        );
    }

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
                    <span><i className="shap-dot positive" /> Positive contribution</span>
                    <span><i className="shap-dot negative" /> Negative contribution</span>
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
                                        role="img"
                                        aria-label={`${feature.feature}: ${feature.signedValue.toFixed(3)} contribution`}
                                    />
                                </div>

                                <div className={`shap-value ${isNegative ? "negative" : "positive"}`}>
                                    {feature.signedValue > 0 ? "+" : feature.signedValue < 0 ? "−" : ""}
                                    {Math.abs(feature.signedValue).toFixed(3)}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="shap-chart-note">
                    <span>ⓘ</span>
                    <p>
                        Larger bars indicate a stronger contribution magnitude. Values are shown in
                        the units supplied by the explanation service; direction labels indicate
                        whether the feature raises or lowers the model output. Review these values
                        alongside the full clinical assessment.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ShapChart;
