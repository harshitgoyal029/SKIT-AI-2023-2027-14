import React, { useMemo } from "react";

const EcgAnalysis = ({ ecg = {} }) => {
    const waveform = useMemo(() => {
        return Array.from({ length: 180 }, (_, index) => {
            const cycle = index % 36;
            let value = Math.sin(index * 0.18) * 0.08;
            if (cycle === 8) value = -0.22;
            if (cycle === 9) value = 0.75;
            if (cycle === 10) value = -0.42;
            if (cycle >= 11 && cycle <= 14) value += 0.12;
            return value;
        });
    }, []);

    const points = waveform
        .map((value, index) => {
            const x = (index / (waveform.length - 1)) * 100;
            const y = 50 - value * 35;
            return `${x},${y}`;
        })
        .join(" ");

    return (
        <div className="dashboard-section ecg-analysis-section">
            <div className="section-heading">
                <div>
                    <span className="welcome-label">ECG ANALYSIS</span>
                    <h2>Electrocardiogram Waveform</h2>
                    <p>
                        Visual ECG workflow prepared for integration with the
                        multimodal cardiovascular assessment model.
                    </p>
                </div>
                <span className="ecg-status-badge">{ecg.status || "Test Data"}</span>
            </div>

            <div className="ecg-analysis-card">
                <div className="ecg-grid">
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="ECG waveform">
                        <defs>
                            <pattern id="ecgGrid" width="5" height="5" patternUnits="userSpaceOnUse">
                                <path d="M 5 0 L 0 0 0 5" fill="none" stroke="currentColor" strokeWidth="0.15" />
                            </pattern>
                        </defs>
                        <rect width="100" height="100" fill="url(#ecgGrid)" />
                        <polyline points={points} fill="none" className="ecg-waveform" vectorEffect="non-scaling-stroke" />
                    </svg>
                </div>

                <div className="ecg-metrics-grid">
                    <div className="ecg-metric">
                        <span>Heart Rate</span>
                        <strong>{ecg.heartRate ?? "--"} BPM</strong>
                    </div>
                    <div className="ecg-metric">
                        <span>Rhythm</span>
                        <strong>{ecg.rhythm || "--"}</strong>
                    </div>
                    <div className="ecg-metric">
                        <span>Signal Quality</span>
                        <strong>{ecg.signalQuality || "--"}</strong>
                    </div>
                </div>

                <div className="ecg-note">
                    <span>ⓘ</span>
                    <p>
                        The waveform is a deterministic UI sample for the current
                        dashboard test workflow. It is not a diagnostic ECG reading.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default EcgAnalysis;
