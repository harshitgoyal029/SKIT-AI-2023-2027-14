import React, { useState, useEffect } from "react";

const SLIDES = [
    {
        badge: "CARDIOVASCULAR INTELLIGENCE",
        title: "Welcome to CVD-XAI Clinical Platform",
        subtitle: "Next-Generation Multimodal AI for Early Cardiovascular Risk Detection",
        description:
            "CardioXAI combines 12-lead electrocardiograms with deep clinical biomarker modeling to detect cardiovascular disease risk earlier, safer, and with clinically proven precision.",
        highlights: [
            { icon: "⚡", label: "10,302 Training Cohorts" },
            { icon: "🩺", label: "ACC / AHA Compliant" },
            { icon: "🔒", label: "Secure MongoDB Cloud" },
        ],
        gradient: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
        icon: "🫀",
        accentColor: "#0284c7",
    },
    {
        badge: "DEEP NEURAL NETWORK",
        title: "Trained 16-Feature Clinical Model",
        subtitle: "High-Sensitivity Predictive Modeling Driven by clinical_dnn.keras",
        description:
            "Our neural network analyzes resting hemodynamics, lipid profiles, and exercise ST vectors to deliver individualized, non-invasive cardiovascular risk evaluations.",
        highlights: [
            { icon: "🧠", label: "Multi-Layer DNN Architecture" },
            { icon: "📐", label: "MAP & Pulse Pressure Normalization" },
            { icon: "📊", label: "Calibrated Decision Sensitivity" },
        ],
        gradient: "linear-gradient(135deg, #0f766e 0%, #115e59 100%)",
        icon: "⚡",
        accentColor: "#0f766e",
    },
    {
        badge: "EXPLAINABLE AI (XAI)",
        title: "Transparent & Clinically Interpretable",
        subtitle: "Eliminating Black-Box AI with Explainable Biomarker Drivers",
        description:
            "CardioXAI pinpoints precisely which biomarkers (blood pressure, cholesterol, blood glucose) are accelerating strain or keeping your cardiovascular system protected.",
        highlights: [
            { icon: "🔍", label: "Biomarker Risk Attributions" },
            { icon: "🎯", label: "Directional Impact (Risk vs Protective)" },
            { icon: "🥗", label: "Actionable Lifestyle Targets" },
        ],
        gradient: "linear-gradient(135deg, #6366f1 0%, #4338ca 100%)",
        icon: "🔬",
        accentColor: "#6366f1",
    },
    {
        badge: "INTEGRATED CLINICAL TRIAGE",
        title: "Coordinated Outpatient Cardiology Care",
        subtitle: "Bridging Patients and Clinical Specialists for Timely Care",
        description:
            "Your vital submissions and ECG recordings are automatically queued in cardiology clinical triage for comprehensive specialist review, lifestyle guidance, and consultation.",
        highlights: [
            { icon: "🩺", label: "On-Call Cardiology Triage" },
            { icon: "📄", label: "Official Printable PDF Summaries" },
            { icon: "💬", label: "Direct Care Team Communication" },
        ],
        gradient: "linear-gradient(135deg, #0369a1 0%, #1e40af 100%)",
        icon: "🏥",
        accentColor: "#0369a1",
    },
];

const CvdXaiIntroSlider = () => {
    const [currentSlide, setCurrentSlide] = useState(0);
    const [isPaused, setIsPaused] = useState(false);

    // Auto-advance slide every 5.5 seconds unless paused
    useEffect(() => {
        if (isPaused) return;
        const interval = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % SLIDES.length);
        }, 5500);
        return () => clearInterval(interval);
    }, [isPaused]);

    const handlePrev = () => {
        setCurrentSlide((prev) => (prev - 1 + SLIDES.length) % SLIDES.length);
    };

    const handleNext = () => {
        setCurrentSlide((prev) => (prev + 1) % SLIDES.length);
    };

    const slide = SLIDES[currentSlide];

    return (
        <div
            style={{
                position: "relative",
                borderRadius: "18px",
                overflow: "hidden",
                boxShadow: "0 4px 20px rgba(0, 0, 0, 0.08)",
                background: slide.gradient,
                color: "#ffffff",
                transition: "background 0.8s ease-in-out",
                minHeight: "220px",
            }}
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
        >
            {/* Background glowing ambient shape */}
            <div
                style={{
                    position: "absolute",
                    top: "-40px",
                    right: "-40px",
                    width: "240px",
                    height: "240px",
                    borderRadius: "50%",
                    background: "rgba(255, 255, 255, 0.1)",
                    filter: "blur(30px)",
                    pointerEvents: "none",
                }}
            />

            <div
                style={{
                    padding: "30px 36px 36px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "28px",
                    position: "relative",
                    zIndex: 2,
                }}
            >
                {/* Left content */}
                <div style={{ flex: 1, maxWidth: "780px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                        <span
                            style={{
                                background: "rgba(255, 255, 255, 0.2)",
                                backdropFilter: "blur(4px)",
                                padding: "4px 12px",
                                borderRadius: "20px",
                                fontSize: "11px",
                                fontWeight: 700,
                                letterSpacing: "0.6px",
                                textTransform: "uppercase",
                            }}
                        >
                            {slide.badge}
                        </span>
                        <span style={{ fontSize: "12px", opacity: 0.85 }}>
                            Step {currentSlide + 1} of {SLIDES.length}
                        </span>
                    </div>

                    <h3
                        style={{
                            margin: "0 0 6px",
                            fontSize: "24px",
                            fontWeight: 800,
                            letterSpacing: "-0.3px",
                            lineHeight: "1.25",
                        }}
                    >
                        {slide.title}
                    </h3>

                    <p
                        style={{
                            margin: "0 0 14px",
                            fontSize: "14px",
                            fontWeight: 600,
                            opacity: 0.95,
                            lineHeight: "1.4",
                        }}
                    >
                        {slide.subtitle}
                    </p>

                    <p
                        style={{
                            margin: "0 0 18px",
                            fontSize: "13.5px",
                            opacity: 0.88,
                            lineHeight: "1.6",
                            maxWidth: "680px",
                        }}
                    >
                        {slide.description}
                    </p>

                    {/* Feature Highlight Pills */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                        {slide.highlights.map((h, idx) => (
                            <span
                                key={idx}
                                style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    background: "rgba(255, 255, 255, 0.16)",
                                    backdropFilter: "blur(4px)",
                                    padding: "5px 12px",
                                    borderRadius: "8px",
                                    fontSize: "12px",
                                    fontWeight: 600,
                                }}
                            >
                                <span>{h.icon}</span>
                                <span>{h.label}</span>
                            </span>
                        ))}
                    </div>
                </div>

                {/* Right Visual Graphic */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "120px",
                        height: "120px",
                        borderRadius: "24px",
                        background: "rgba(255, 255, 255, 0.15)",
                        backdropFilter: "blur(8px)",
                        border: "1.5px solid rgba(255, 255, 255, 0.25)",
                        fontSize: "56px",
                        flexShrink: 0,
                        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12)",
                    }}
                >
                    {slide.icon}
                </div>
            </div>

            {/* Bottom Slider Controls & Dots */}
            <div
                style={{
                    position: "absolute",
                    bottom: "12px",
                    left: "36px",
                    right: "36px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    zIndex: 3,
                }}
            >
                {/* Dots indicator */}
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    {SLIDES.map((_, index) => (
                        <button
                            key={index}
                            type="button"
                            onClick={() => setCurrentSlide(index)}
                            aria-label={`Go to slide ${index + 1}`}
                            style={{
                                width: currentSlide === index ? "24px" : "8px",
                                height: "8px",
                                borderRadius: "4px",
                                border: "none",
                                background: currentSlide === index ? "#ffffff" : "rgba(255, 255, 255, 0.4)",
                                cursor: "pointer",
                                transition: "all 0.3s ease",
                                padding: 0,
                            }}
                        />
                    ))}
                </div>

                {/* Left / Right arrow navigation */}
                <div style={{ display: "flex", gap: "6px" }}>
                    <button
                        type="button"
                        onClick={handlePrev}
                        aria-label="Previous Slide"
                        style={{
                            width: "28px",
                            height: "28px",
                            borderRadius: "50%",
                            border: "none",
                            background: "rgba(255, 255, 255, 0.2)",
                            color: "#ffffff",
                            cursor: "pointer",
                            fontSize: "14px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "background 0.2s",
                        }}
                    >
                        ‹
                    </button>
                    <button
                        type="button"
                        onClick={handleNext}
                        aria-label="Next Slide"
                        style={{
                            width: "28px",
                            height: "28px",
                            borderRadius: "50%",
                            border: "none",
                            background: "rgba(255, 255, 255, 0.2)",
                            color: "#ffffff",
                            cursor: "pointer",
                            fontSize: "14px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "background 0.2s",
                        }}
                    >
                        ›
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CvdXaiIntroSlider;

