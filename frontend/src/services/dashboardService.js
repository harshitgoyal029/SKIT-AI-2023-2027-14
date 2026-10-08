const TEST_DASHBOARD_DATA = {
    source: "TEST_DATA",
    datasetVersion: "Sprint-2-Sample-01",
    assessment: {
        prediction: "Moderate Risk",
        riskScore: 62,
        confidence: 87,
        model: "Cardiovascular Risk Model",
    },
    statistics: {
        totalPatients: 12,
        assessmentsCompleted: 8,
        pendingAssessments: 4,
        highRiskPatients: 3,
    },
    clinicalMetrics: {
        averageHeartRate: 78,
        averageCholesterol: 196,
        averageSystolicBP: 128,
        averageDiastolicBP: 82,
    },
    explainability: {
        method: "SHAP",
        status: "Ready",
        topFeatures: [
            { feature: "Age", contribution: 0.31, direction: "positive" },
            { feature: "Cholesterol", contribution: 0.24, direction: "positive" },
            { feature: "Blood Pressure", contribution: 0.19, direction: "positive" },
            { feature: "Heart Rate", contribution: 0.12, direction: "positive" },
        ],
    },
    ecg: {
        status: "Test Data",
        heartRate: 78,
        rhythm: "Regular",
        signalQuality: "Good",
    },
};

const DEFAULT_PATIENT = {
    patientId: "TEST-001",
    patientName: "Sample Patient",
    age: 54,
    gender: "Male",
    heartRate: 78,
    cholesterol: 196,
    bloodPressure: "128/82",
};

const delay = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds));

const normalizePatient = (patient) => ({
    patientId: patient?.patientId || DEFAULT_PATIENT.patientId,
    patientName: patient?.name || DEFAULT_PATIENT.patientName,
    age: patient?.age || DEFAULT_PATIENT.age,
    gender: patient?.gender || DEFAULT_PATIENT.gender,
    heartRate: patient?.heartRate || DEFAULT_PATIENT.heartRate,
    cholesterol: patient?.cholesterol || DEFAULT_PATIENT.cholesterol,
    bloodPressure: patient?.bloodPressure || DEFAULT_PATIENT.bloodPressure,
});

/**
 * Returns the deterministic Sprint-2 sample dataset used to verify the
 * clinician dashboard before live dashboard aggregation APIs are connected.
 */
export const getDashboardTestData = async (patient = null) => {
    await delay(400);

    return {
        ...TEST_DASHBOARD_DATA,
        assessment: {
            ...TEST_DASHBOARD_DATA.assessment,
            generatedAt: new Date().toISOString(),
        },
        patient: normalizePatient(patient),
        loadedAt: new Date().toISOString(),
    };
};

export const getRiskClass = (riskScore) => {
    const score = Number(riskScore);

    if (!Number.isFinite(score)) {
        return "pending";
    }

    if (score >= 70) {
        return "high";
    }

    if (score >= 40) {
        return "moderate";
    }

    return "low";
};

export const getRiskDescription = (riskScore) => {
    const score = Number(riskScore);

    if (!Number.isFinite(score)) {
        return "No risk score is available for this assessment.";
    }

    if (score >= 70) {
        return "The test assessment indicates a high cardiovascular risk level.";
    }

    if (score >= 40) {
        return "The test assessment indicates a moderate cardiovascular risk level.";
    }

    return "The test assessment indicates a low cardiovascular risk level.";
};

export const formatMetric = (value, unit = "") => {
    if (value === null || value === undefined || value === "") {
        return "--";
    }

    return `${value}${unit ? ` ${unit}` : ""}`;
};
