import React, { useState, useEffect, useRef } from "react";

const SLIDES = [
    {
        badge: "CARDIOVASCULAR WORKSPACE",
        title: "Welcome to the CVD-XAI platform",
        subtitle: "Clinical measurements and ECG review in one workspace",
        description:
            "Review patient records, submit clinical measurements, and manage ECG uploads. Available results depend on the data and services connected to this deployment.",
        highlights: [
            { icon: "🩺", label: "Patient records" },
            { icon: "📈", label: "Clinical measurements" },
            { icon: "♡", label: "ECG uploads" },
        ],
        gradient: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
        icon: "🫀",
        accentColor: "#0284c7",
    },
    {
        badge: "CLINICAL ASSESSMENT",
        title: "Review cardiovascular risk assessments",
        subtitle: "See stored model results alongside patient measurements",
        description:
            "Run an assessment for a registered patient when the model service is available. Results should be reviewed with their source data and are not a diagnosis.",
        highlights: [
            { icon: "📊", label: "Stored risk score" },
            { icon: "🧾", label: "Source measurements" },
            { icon: "🩺", label: "Clinician review" },
        ],
        gradient: "linear-gradient(135deg, #0f766e 0%, #115e59 100%)",
        icon: "⚡",
        accentColor: "#0f766e",
    },
    {
        badge: "MODEL EXPLANATIONS",
        title: "Explore available feature attributions",
        subtitle: "Review which inputs influenced a stored model result",
        description:
            "When an explanation is available for a patient assessment, the dashboard displays its feature contributions and direction. The chart reflects model output, not a clinical finding.",
        highlights: [
            { icon: "🔍", label: "SHAP attributions" },
            { icon: "↕", label: "Contribution direction" },
            { icon: "ⓘ", label: "Model output context" },
        ],
        gradient: "linear-gradient(135deg, #6366f1 0%, #4338ca 100%)",
        icon: "🔬",
        accentColor: "#6366f1",
    },
    {
        badge: "REPORTING & REVIEW",
        title: "Keep assessment details together",
        subtitle: "Review available results and print a structured summary",
        description:
            "The report brings together the selected patient, stored assessment, available feature attributions, and measurements. Confirm the source data before using it in clinical review.",
        highlights: [
            { icon: "🩺", label: "Patient context" },
            { icon: "📄", label: "Printable summary" },
            { icon: "✓", label: "Source data review" },
        ],
        gradient: "linear-gradient(135deg, #0369a1 0%, #1e40af 100%)",
        icon: "🏥",
        accentColor: "#0369a1",
    },
];

// Infinite loop array: [Clone of Last, ...SLIDES, Clone of First]
const EXTENDED_SLIDES = [
    SLIDES[SLIDES.length - 1],
    ...SLIDES,
    SLIDES[0],
];

const CvdXaiIntroSlider = () => {
    // Start at index 1 (the first real slide)
    const [currentIndex, setCurrentIndex] = useState(1);
    const [isTransitioning, setIsTransitioning] = useState(true);
    const [isPaused, setIsPaused] = useState(false);
    const trackRef = useRef(null);

    // Compute zero-based dot indicator index (0 to 3)
    const activeDotIndex =
        currentIndex === 0
            ? SLIDES.length - 1
            : currentIndex === EXTENDED_SLIDES.length - 1
            ? 0
            : currentIndex - 1;

    // Auto-advance slides every 4.8 seconds in automatic sliding motion
    useEffect(() => {
        if (isPaused) return;

        const interval = setInterval(() => {
            setIsTransitioning(true);
            setCurrentIndex((prev) => prev + 1);
        }, 4800);

        return () => clearInterval(interval);
    }, [isPaused]);

    // Handle seamless infinite sliding loop when transition ends
    const handleTransitionEnd = () => {
        // If we slid into the clone of the first slide (at the end), instantly snap to real first slide
        if (currentIndex === EXTENDED_SLIDES.length - 1) {
            setIsTransitioning(false);
            setCurrentIndex(1);
        }
        // If we slid backwards into the clone of the last slide (at the beginning), instantly snap to real last slide
        else if (currentIndex === 0) {
            setIsTransitioning(false);
            setCurrentIndex(SLIDES.length);
        }
    };

    const handleNext = () => {
        setIsTransitioning(true);
        setCurrentIndex((prev) => prev + 1);
    };

    const handlePrev = () => {
        setIsTransitioning(true);
        setCurrentIndex((prev) => prev - 1);
    };

    const handleDotClick = (targetIndex) => {
        setIsTransitioning(true);
        setCurrentIndex(targetIndex + 1);
    };

    return (
        <div
            className="cvd-intro-slider-container"
            style={{
                position: "relative",
                width: "100%",
                borderRadius: "18px",
                overflow: "hidden",
                boxShadow: "0 4px 20px rgba(0, 0, 0, 0.08)",
                background: "#0f172a",
                minHeight: "220px",
                userSelect: "none",
            }}
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
        >
            {/* Sliding Track */}
            <div
                ref={trackRef}
                onTransitionEnd={handleTransitionEnd}
                style={{
                    display: "flex",
                    width: "100%",
                    transform: `translateX(-${currentIndex * 100}%)`,
                    transition: isTransitioning
                        ? "transform 0.75s cubic-bezier(0.25, 1, 0.5, 1)"
                        : "none",
                    willChange: "transform",
                }}
            >
                {EXTENDED_SLIDES.map((slide, idx) => {
                    // Determine slide number for step indicator
                    const stepNum =
                        idx === 0
                            ? SLIDES.length
                            : idx === EXTENDED_SLIDES.length - 1
                            ? 1
                            : idx;

                    return (
                        <div
                            key={idx}
                            style={{
                                flex: "0 0 100%",
                                width: "100%",
                                minWidth: "100%",
                                boxSizing: "border-box",
                                background: slide.gradient,
                                color: "#ffffff",
                                padding: "30px 36px 42px",
                                position: "relative",
                                overflow: "hidden",
                            }}
                        >
                            {/* Glowing ambient background circle */}
                            <div
                                style={{
                                    position: "absolute",
                                    top: "-50px",
                                    right: "-50px",
                                    width: "260px",
                                    height: "260px",
                                    borderRadius: "50%",
                                    background: "rgba(255, 255, 255, 0.12)",
                                    filter: "blur(32px)",
                                    pointerEvents: "none",
                                }}
                            />

                            {/* Main slide content row */}
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: "28px",
                                    position: "relative",
                                    zIndex: 2,
                                }}
                            >
                                {/* Left Content */}
                                <div style={{ flex: 1, maxWidth: "780px" }}>
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "10px",
                                            marginBottom: "8px",
                                        }}
                                    >
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
                                            Step {stepNum} of {SLIDES.length}
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
                                        {slide.highlights.map((h, hIdx) => (
                                            <span
                                                key={hIdx}
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

                                {/* Right Visual Icon Graphic */}
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        width: "120px",
                                        height: "120px",
                                        borderRadius: "24px",
                                        background: "rgba(255, 255, 255, 0.16)",
                                        backdropFilter: "blur(8px)",
                                        border: "1.5px solid rgba(255, 255, 255, 0.28)",
                                        fontSize: "56px",
                                        flexShrink: 0,
                                        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12)",
                                    }}
                                >
                                    {slide.icon}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Bottom Controls: Navigation Dots & Arrow Buttons */}
            <div
                style={{
                    position: "absolute",
                    bottom: "12px",
                    left: "36px",
                    right: "36px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    zIndex: 10,
                    pointerEvents: "auto",
                }}
            >
                {/* Dots indicator */}
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    {SLIDES.map((_, index) => (
                        <button
                            key={index}
                            type="button"
                            onClick={() => handleDotClick(index)}
                            aria-label={`Go to slide ${index + 1}`}
                            style={{
                                width: activeDotIndex === index ? "26px" : "8px",
                                height: "8px",
                                borderRadius: "4px",
                                border: "none",
                                background:
                                    activeDotIndex === index
                                        ? "#ffffff"
                                        : "rgba(255, 255, 255, 0.4)",
                                cursor: "pointer",
                                transition: "all 0.35s ease",
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
                            background: "rgba(255, 255, 255, 0.22)",
                            color: "#ffffff",
                            cursor: "pointer",
                            fontSize: "14px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "background 0.2s, transform 0.15s",
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = "rgba(255, 255, 255, 0.35)";
                            e.currentTarget.style.transform = "scale(1.08)";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = "rgba(255, 255, 255, 0.22)";
                            e.currentTarget.style.transform = "scale(1)";
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
                            background: "rgba(255, 255, 255, 0.22)",
                            color: "#ffffff",
                            cursor: "pointer",
                            fontSize: "14px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "background 0.2s, transform 0.15s",
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = "rgba(255, 255, 255, 0.35)";
                            e.currentTarget.style.transform = "scale(1.08)";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = "rgba(255, 255, 255, 0.22)";
                            e.currentTarget.style.transform = "scale(1)";
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
