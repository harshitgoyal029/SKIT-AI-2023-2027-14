import React, { useMemo } from "react";

const MAX_RENDERED_SAMPLES = 1200;

const readSampleValue = (sample) => {
    const rawValue = typeof sample === "object" && sample !== null
        ? (sample.value ?? sample.amplitude ?? sample.y)
        : sample;
    if (rawValue === null || rawValue === undefined || rawValue === "") {
        return Number.NaN;
    }
    return Number(rawValue);
};

const downsample = (values, maxSamples = MAX_RENDERED_SAMPLES) => {
    if (values.length <= maxSamples) return values;
    const result = [];
    const step = (values.length - 1) / (maxSamples - 1);
    for (let index = 0; index < maxSamples; index += 1) {
        result.push(values[Math.round(index * step)]);
    }
    return result;
};

const makeIllustrativeWaveform = () => Array.from({ length: 180 }, (_, index) => {
    const cycle = index % 36;
    let value = Math.sin(index * 0.18) * 0.08;
    if (cycle === 8) value = -0.22;
    if (cycle === 9) value = 0.75;
    if (cycle === 10) value = -0.42;
    if (cycle >= 11 && cycle <= 14) value += 0.12;
    return value;
});

const EcgAnalysis = ({ ecg = {} }) => {
    const waveformData = useMemo(() => {
        const suppliedSignal = ecg?.waveform ?? ecg?.signal ?? ecg?.samples;
        const normalized = Array.isArray(suppliedSignal)
            ? suppliedSignal.map(readSampleValue).filter(Number.isFinite)
            : [];

        if (normalized.length > 1) {
            return {
                waveform: downsample(normalized),
                hasRealSignal: true,
            };
        }

        // Clearly labelled visual placeholder when no usable ECG signal was supplied.
        return {
            waveform: makeIllustrativeWaveform(),
            hasRealSignal: false,
        };
    }, [ecg?.waveform, ecg?.signal, ecg?.samples]);

    const { waveform, hasRealSignal } = waveformData;
    const signalMin = Math.min(...waveform, -0.01);
    const signalMax = Math.max(...waveform, 0.01);
    const signalRange = signalMax - signalMin || 1;
    const points = waveform
        .map((value, index) => {
            const x = (index / Math.max(waveform.length - 1, 1)) * 100;
            const y = 90 - ((value - signalMin) / signalRange) * 80;
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
                        {hasRealSignal
                            ? "Signal supplied by the ECG analysis service. Interpret with the full clinical assessment."
                            : "Illustrative waveform shown because no usable ECG samples were supplied for this assessment."}
                    </p>
                </div>
                <span className="ecg-status-badge">{ecg.status || "Test Data"}</span>
            </div>

            <div className="ecg-analysis-card">
                <div className="ecg-grid">
                    <svg
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                        role="img"
                        aria-label={hasRealSignal
                            ? "Supplied ECG waveform"
                            : "Illustrative ECG waveform, not patient data"}
                    >
                        <defs>
                            <pattern id="ecgGrid" width="5" height="5" patternUnits="userSpaceOnUse">
                                <path d="M 5 0 L 0 0 0 5" fill="none" stroke="currentColor" strokeWidth="0.15" />
                            </pattern>
                        </defs>
                        <rect width="100" height="100" fill="url(#ecgGrid)" />
                        <polyline
                            points={points}
                            fill="none"
                            className="ecg-waveform"
                            vectorEffect="non-scaling-stroke"
                        />
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
                        {hasRealSignal
                            ? "Waveform values are displayed from the supplied signal and are not, by themselves, a diagnosis."
                            : "This is a synthetic UI sample, not a recorded patient ECG and not a diagnostic reading."}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default EcgAnalysis;
