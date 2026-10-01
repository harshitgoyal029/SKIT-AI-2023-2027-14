const TEST_DASHBOARD_DATA = {
    assessment: {
        prediction: "Moderate Risk",
        riskScore: 62,
        confidence: 87,
        model: "Cardiovascular Risk Model",
        generatedAt: new Date().toISOString(),
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
            {
                feature: "Age",
                contribution: 0.31,
                direction: "positive",
            },
            {
                feature: "Cholesterol",
                contribution: 0.24,
                direction: "positive",
            },
            {
                feature: "Blood Pressure",
                contribution: 0.19,
                direction: "positive",
            },
            {
                feature: "Heart Rate",
                contribution: 0.12,
                direction: "positive",
            },
        ],
    },

    ecg: {
        status: "Test Data",
        heartRate: 78,
        rhythm: "Regular",
        signalQuality: "Good",
    },
};

const delay = (milliseconds) =>
    new Promise((resolve) => {
        setTimeout(resolve, milliseconds);
    });

export const getDashboardTestData = async (patient = null) => {
    await delay(400);

    const patientData = patient
        ? {
            patientId: patient.patientId || "TEST-001",
            patientName: patient.name || "Test Patient",
            age: patient.age || 54,
            gender: patient.gender || "Not provided",
            heartRate: patient.heartRate || 78,
            cholesterol: patient.cholesterol || 196,
            bloodPressure: patient.bloodPressure || "128/82",
        }
        : {
            patientId: "TEST-001",
            patientName: "Sample Patient",
            age: 54,
            gender: "Male",
            heartRate: 78,
            cholesterol: 196,
            bloodPressure: "128/82",
        };

    return {
        ...TEST_DASHBOARD_DATA,
        patient: patientData,
        source: "TEST_DATA",
        loadedAt: new Date().toISOString(),
    };
};

export const getRiskClass = (riskScore) => {
    if (riskScore >= 70) {
        return "high";
    }

    if (riskScore >= 40) {
        return "moderate";
    }

    return "low";
};

export const getRiskDescription = (riskScore) => {
    if (riskScore >= 70) {
        return "The test assessment indicates a high cardiovascular risk level.";
    }

    if (riskScore >= 40) {
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