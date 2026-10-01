import React, { useEffect, useMemo, useState } from "react";

import { Link } from "react-router-dom";



import {

    getDashboardTestData,

    getRiskClass,

    getRiskDescription,

} from "../services/dashboardService";



import ClinicalStatistics from "../components/ClinicalStatistics";
import ShapChart from "../components/ShapChart";
import EcgAnalysis from "../components/EcgAnalysis";
import AIReport from "../components/AIReport";



const Dashboard = () => {

    const [patient, setPatient] = useState(null);

    const [lastUpdated, setLastUpdated] = useState(null);

    const [activeSection, setActiveSection] = useState("overview");



    const [testData, setTestData] = useState(null);

    const [testDataLoading, setTestDataLoading] = useState(false);

    const [testDataError, setTestDataError] = useState("");

    const [dataSource, setDataSource] = useState("SESSION");



    /*

     * Load dashboard test/sample data.

     * This keeps the dashboard functional while backend

     * assessment APIs are being integrated.

     */

    const loadTestData = async (currentPatient = null) => {

        setTestDataLoading(true);

        setTestDataError("");



        try {

            const data = await getDashboardTestData(currentPatient);



            setTestData(data);

            setDataSource(data.source || "TEST_DATA");

            setLastUpdated(new Date());

        } catch (error) {

            console.error(

                "Unable to load dashboard test data:",

                error

            );



            setTestDataError(

                "Dashboard test data could not be loaded."

            );

        } finally {

            setTestDataLoading(false);

        }

    };



    /*

     * Load patient information from session storage.

     */

    useEffect(() => {

        const loadPatient = () => {

            const savedPatient =

                sessionStorage.getItem("cvd_xai_patient");



            if (savedPatient) {

                try {

                    const parsedPatient = JSON.parse(savedPatient);



                    setPatient(parsedPatient);

                    setLastUpdated(new Date());



                    loadTestData(parsedPatient);

                } catch (error) {

                    console.error(

                        "Unable to load patient data:",

                        error

                    );



                    setPatient(null);

                    loadTestData(null);

                }

            } else {

                setPatient(null);

                loadTestData(null);

            }

        };



        loadPatient();



        const handleStorageChange = () => {

            loadPatient();

        };



        window.addEventListener(

            "storage",

            handleStorageChange

        );



        return () => {

            window.removeEventListener(

                "storage",

                handleStorageChange

            );

        };

    }, []);



    /*

     * Patient metrics used throughout the dashboard.

     */

    const patientMetrics = useMemo(() => {

        if (!patient) {

            return {

                age: "--",

                heartRate: "--",

                cholesterol: "--",

                bloodPressure: "--",

            };

        }



        return {

            age: patient.age || "--",



            heartRate: patient.heartRate

                ? `${patient.heartRate} BPM`

                : "--",



            cholesterol: patient.cholesterol

                ? `${patient.cholesterol} mg/dL`

                : "--",



            bloodPressure:

                patient.bloodPressure || "--",

        };

    }, [patient]);



    /*

     * Risk status.

     *

     * Patient riskLevel takes priority if it already exists.

     * Otherwise test-data assessment is used.

     */

    const riskStatus = useMemo(() => {

        if (patient?.riskLevel) {

            return {

                label: patient.riskLevel,

                className: String(

                    patient.riskLevel

                ).toLowerCase(),

                description:

                    "Risk information is available for this patient.",

            };

        }



        if (testData?.assessment?.riskScore !== undefined) {

            const score =

                testData.assessment.riskScore;



            return {

                label:

                    testData.assessment.prediction ||

                    "Test Assessment",



                className: getRiskClass(score),



                description:

                    getRiskDescription(score),

            };

        }



        if (!patient) {

            return {

                label: "Awaiting Assessment",

                className: "pending",

                description:

                    "Register a patient to generate an AI-based assessment.",

            };

        }



        return {

            label: "Not Generated",

            className: "pending",

            description:

                "AI prediction has not been generated yet.",

        };

    }, [patient, testData]);



    /*

     * Format date/time for dashboard status.

     */

    const formatDate = (date) => {

        if (!date) {

            return "Not available";

        }



        return date.toLocaleString("en-IN", {

            day: "2-digit",

            month: "short",

            year: "numeric",

            hour: "2-digit",

            minute: "2-digit",

        });

    };



    /*

     * Refresh both patient and test dashboard data.

     */

    const refreshDashboard = () => {

        const savedPatient =

            sessionStorage.getItem("cvd_xai_patient");



        if (savedPatient) {

            try {

                const refreshedPatient =

                    JSON.parse(savedPatient);



                setPatient(refreshedPatient);

                setLastUpdated(new Date());



                loadTestData(refreshedPatient);

            } catch (error) {

                console.error(

                    "Dashboard refresh failed:",

                    error

                );



                setTestDataError(

                    "Unable to refresh dashboard data."

                );

            }

        } else {

            setPatient(null);

            loadTestData(null);

        }

    };



    /*

     * Remove current patient from the dashboard.

     */

    const clearPatient = () => {

        sessionStorage.removeItem("cvd_xai_patient");



        setPatient(null);

        setLastUpdated(new Date());



        loadTestData(null);

    };



    return (

        <div className="page">



            {/* -------------------------------------------------

                PAGE HEADER

            ------------------------------------------------- */}



            <div className="page-header">



                <div>



                    <span className="welcome-label">

                        CVD-XAI CLINICAL SYSTEM

                    </span>



                    <h1>

                        Clinician Dashboard

                    </h1>



                    <p>

                        Cardiovascular disease risk

                        assessment and clinical insights.

                    </p>



                </div>



                <div className="dashboard-header-actions">



                    <button

                        type="button"

                        className="secondary-btn"

                        onClick={refreshDashboard}

                        disabled={testDataLoading}

                    >

                        {testDataLoading

                            ? "↻ Loading..."

                            : "↻ Refresh"}

                    </button>



                    <Link

                        to="/patient-registration"

                        className="primary-btn"

                    >

                        + New Patient

                    </Link>



                </div>



            </div>



            {/* -------------------------------------------------

                TEST DATA LOADING / ERROR

            ------------------------------------------------- */}



            {testDataLoading && (

                <div className="connection-warning">



                    <span>↻</span>



                    <div>



                        <strong>

                            Loading Test Data

                        </strong>



                        <p>

                            Preparing sample clinical

                            assessment data for dashboard

                            workflow testing.

                        </p>



                    </div>



                </div>

            )}



            {testDataError && (

                <div className="form-error">



                    <span>⚠</span>



                    <div>



                        <strong>

                            Test Data Notice

                        </strong>



                        <p>

                            {testDataError}

                        </p>



                    </div>



                </div>

            )}



            {/* -------------------------------------------------

                WELCOME CARD

            ------------------------------------------------- */}



            <div className="welcome-card">



                <div>



                    <span className="welcome-label">

                        CVD-XAI

                    </span>



                    <h2>

                        Explainable Cardiovascular

                        Risk Assessment

                    </h2>



                    <p>

                        Review patient information,

                        cardiovascular risk predictions,

                        ECG analysis and explainable AI

                        insights from one dashboard.

                    </p>



                    <div className="welcome-features">



                        <span>

                            ✓ Patient Data

                        </span>



                        <span>

                            ✓ AI Prediction

                        </span>



                        <span>

                            ✓ SHAP Explainability

                        </span>



                        <span>

                            ✓ ECG Analysis

                        </span>



                    </div>



                </div>



                <div className="heart-illustration">

                    🫀

                </div>



            </div>



            {/* -------------------------------------------------

                DASHBOARD TABS

            ------------------------------------------------- */}



            <div className="dashboard-tabs">



                <button

                    type="button"

                    className={

                        activeSection === "overview"

                            ? "active"

                            : ""

                    }

                    onClick={() =>

                        setActiveSection("overview")

                    }

                >

                    Overview

                </button>



                <button

                    type="button"

                    className={

                        activeSection === "assessment"

                            ? "active"

                            : ""

                    }

                    onClick={() =>

                        setActiveSection("assessment")

                    }

                >

                    Assessment

                </button>



                <button

                    type="button"

                    className={

                        activeSection === "explainability"

                            ? "active"

                            : ""

                    }

                    onClick={() =>

                        setActiveSection(

                            "explainability"

                        )

                    }

                >

                    Explainability

                </button>



            </div>



            {/* -------------------------------------------------

                DASHBOARD STATISTICS

            ------------------------------------------------- */}



            <div className="dashboard-grid">



                {/* Patients */}



                <div className="dashboard-card">



                    <span className="card-icon">

                        👥

                    </span>



                    <div>



                        <span className="card-label">

                            PATIENTS

                        </span>



                        <h2>

                            {testDataLoading

                                ? "..."

                                : testData?.statistics

                                    ?.totalPatients ??

                                (patient ? 1 : 0)}

                        </h2>



                        <p>

                            {testData

                                ? "Patients in test dataset"

                                : patient

                                    ? "Registered patient"

                                    : "No patient registered"}

                        </p>



                    </div>



                </div>



                {/* AI Predictions */}



                <div className="dashboard-card">



                    <span className="card-icon">

                        🧠

                    </span>



                    <div>



                        <span className="card-label">

                            AI PREDICTIONS

                        </span>



                        <h2>

                            {testDataLoading

                                ? "..."

                                : testData?.statistics

                                    ?.assessmentsCompleted ??

                                0}

                        </h2>



                        <p>

                            Assessments completed

                        </p>



                    </div>



                </div>



                {/* Explainability */}



                <div className="dashboard-card">



                    <span className="card-icon">

                        📊

                    </span>



                    <div>



                        <span className="card-label">

                            EXPLAINABILITY

                        </span>



                        <h2>

                            {testData?.explainability

                                ?.method || "SHAP"}

                        </h2>



                        <p>

                            {testData?.explainability

                                ?.status ||

                                "Feature-level insights"}

                        </p>



                    </div>



                </div>



                {/* Risk */}



                <div className="dashboard-card">



                    <span className="card-icon">

                        ❤️

                    </span>



                    <div>



                        <span className="card-label">

                            RISK STATUS

                        </span>



                        <h2>

                            {testDataLoading

                                ? "..."

                                : riskStatus.label}

                        </h2>



                        <p>

                            {riskStatus.description}

                        </p>



                    </div>



                </div>



            </div>



            {/* -------------------------------------------------

                OVERVIEW SECTION

            ------------------------------------------------- */}



            {activeSection === "overview" && (



                <div className="dashboard-section">



                    <div className="section-heading">



                        <div>



                            <span className="welcome-label">

                                SYSTEM OVERVIEW

                            </span>



                            <h2>

                                Clinical Assessment

                                Workflow

                            </h2>



                            <p>

                                Follow the patient

                                assessment workflow from

                                registration to

                                explainable prediction.

                            </p>



                        </div>



                    </div>



                    <div className="workflow-grid">



                        <div className="workflow-card">



                            <span className="workflow-number">

                                01

                            </span>



                            <div>



                                <h3>

                                    Patient Registration

                                </h3>



                                <p>

                                    Capture demographic and

                                    clinical information

                                    required for

                                    cardiovascular

                                    assessment.

                                </p>



                            </div>



                        </div>



                        <div className="workflow-card">



                            <span className="workflow-number">

                                02

                            </span>



                            <div>



                                <h3>

                                    Risk Prediction

                                </h3>



                                <p>

                                    Submit patient features

                                    to the prediction model

                                    for cardiovascular risk

                                    assessment.

                                </p>



                            </div>



                        </div>



                        <div className="workflow-card">



                            <span className="workflow-number">

                                03

                            </span>



                            <div>



                                <h3>

                                    Explainable AI

                                </h3>



                                <p>

                                    Inspect important model

                                    features using

                                    explainability

                                    techniques such as

                                    SHAP.

                                </p>



                            </div>



                        </div>



                        <div className="workflow-card">



                            <span className="workflow-number">

                                04

                            </span>



                            <div>



                                <h3>

                                    Clinical Review

                                </h3>



                                <p>

                                    Review patient

                                    information and

                                    generated insights

                                    before further

                                    clinical action.

                                </p>



                            </div>



                        </div>



                    </div>



                    {/* Test data overview */}



                    {testData && (



                        <div className="dashboard-section">



                            <div className="section-heading">



                                <div>



                                    <span className="welcome-label">

                                        TEST DATA

                                    </span>



                                    <h2>

                                        Dashboard Test

                                        Statistics

                                    </h2>



                                    <p>

                                        Sample data connected

                                        to validate the

                                        clinician dashboard

                                        workflow.

                                    </p>



                                </div>



                            </div>



                            <div className="dashboard-grid">



                                <div className="dashboard-card">



                                    <span className="card-icon">

                                        📋

                                    </span>



                                    <div>



                                        <span className="card-label">

                                            PENDING

                                            ASSESSMENTS

                                        </span>



                                        <h2>

                                            {

                                                testData

                                                    .statistics

                                                    .pendingAssessments

                                            }

                                        </h2>



                                        <p>

                                            Awaiting

                                            assessment

                                        </p>



                                    </div>



                                </div>



                                <div className="dashboard-card">



                                    <span className="card-icon">

                                        🚨

                                    </span>



                                    <div>



                                        <span className="card-label">

                                            HIGH RISK

                                            PATIENTS

                                        </span>



                                        <h2>

                                            {

                                                testData

                                                    .statistics

                                                    .highRiskPatients

                                            }

                                        </h2>



                                        <p>

                                            Requires clinical

                                            review

                                        </p>



                                    </div>



                                </div>



                                <div className="dashboard-card">



                                    <span className="card-icon">

                                        ❤️

                                    </span>



                                    <div>



                                        <span className="card-label">

                                            AVG HEART RATE

                                        </span>



                                        <h2>

                                            {

                                                testData

                                                    .clinicalMetrics

                                                    .averageHeartRate

                                            }

                                        </h2>



                                        <p>

                                            BPM

                                        </p>



                                    </div>



                                </div>



                                <div className="dashboard-card">



                                    <span className="card-icon">

                                        🧪

                                    </span>



                                    <div>



                                        <span className="card-label">

                                            AVG CHOLESTEROL

                                        </span>



                                        <h2>

                                            {

                                                testData

                                                    .clinicalMetrics

                                                    .averageCholesterol

                                            }

                                        </h2>



                                        <p>

                                            mg/dL

                                        </p>



                                    </div>



                                </div>



                            </div>



                        </div>



                    )}



                </div>



            )}



            {/* -------------------------------------------------

                ASSESSMENT SECTION

            ------------------------------------------------- */}



            {activeSection === "assessment" && (



                <div className="dashboard-section">



                    <div className="section-heading">



                        <div>



                            <span className="welcome-label">

                                ASSESSMENT CENTER

                            </span>



                            <h2>

                                Patient Assessment

                            </h2>



                            <p>

                                Current patient information

                                and assessment status.

                            </p>



                        </div>



                    </div>



                    {patient ? (



                        <div className="assessment-panel">



                            <div className="assessment-header">



                                <div>



                                    <span className="card-label">

                                        CURRENT PATIENT

                                    </span>



                                    <h2>

                                        {patient.name}

                                    </h2>



                                    <p>

                                        Patient ID:{" "}

                                        {patient.patientId ||

                                            "Not assigned"}

                                    </p>



                                </div>



                                <div

                                    className={`risk-badge ${riskStatus.className}`}

                                >

                                    {riskStatus.label}

                                </div>



                            </div>



                            <div className="patient-details">



                                <div>

                                    <span>

                                        AGE

                                    </span>



                                    <strong>

                                        {patientMetrics.age}

                                    </strong>

                                </div>



                                <div>

                                    <span>

                                        GENDER

                                    </span>



                                    <strong>

                                        {patient.gender ||

                                            "Not provided"}

                                    </strong>

                                </div>



                                <div>

                                    <span>

                                        BLOOD PRESSURE

                                    </span>



                                    <strong>

                                        {

                                            patientMetrics.bloodPressure

                                        }

                                    </strong>

                                </div>



                                <div>

                                    <span>

                                        HEART RATE

                                    </span>



                                    <strong>

                                        {

                                            patientMetrics.heartRate

                                        }

                                    </strong>

                                </div>



                                <div>

                                    <span>

                                        CHOLESTEROL

                                    </span>



                                    <strong>

                                        {

                                            patientMetrics.cholesterol

                                        }

                                    </strong>

                                </div>



                                <div>

                                    <span>

                                        DIABETES

                                    </span>



                                    <strong>

                                        {patient.diabetes ||

                                            "Not provided"}

                                    </strong>

                                </div>



                            </div>



                            {/* Test assessment */}



                            {testData && (



                                <div className="assessment-test-data">



                                    <div className="assessment-test-header">



                                        <div>



                                            <span className="card-label">

                                                TEST ASSESSMENT

                                            </span>



                                            <h3>

                                                {

                                                    testData

                                                        .assessment

                                                        .prediction

                                                }

                                            </h3>



                                            <p>

                                                {getRiskDescription(

                                                    testData

                                                        .assessment

                                                        .riskScore

                                                )}

                                            </p>



                                        </div>



                                        <div

                                            className={`risk-score ${getRiskClass(

                                                testData

                                                    .assessment

                                                    .riskScore

                                            )}`}

                                        >



                                            <strong>

                                                {

                                                    testData

                                                        .assessment

                                                        .riskScore

                                                }

                                                %

                                            </strong>



                                            <span>

                                                Risk Score

                                            </span>



                                        </div>



                                    </div>



                                    <div className="test-metrics-grid">



                                        <div>



                                            <span>

                                                MODEL

                                                CONFIDENCE

                                            </span>



                                            <strong>

                                                {

                                                    testData

                                                        .assessment

                                                        .confidence

                                                }

                                                %

                                            </strong>



                                        </div>



                                        <div>



                                            <span>

                                                MODEL

                                            </span>



                                            <strong>

                                                {

                                                    testData

                                                        .assessment

                                                        .model

                                                }

                                            </strong>



                                        </div>



                                        <div>



                                            <span>

                                                DATA SOURCE

                                            </span>



                                            <strong>

                                                {dataSource}

                                            </strong>



                                        </div>



                                    </div>



                                </div>



                            )}



                            <div className="assessment-actions">



                                <Link

                                    to="/patient-registration"

                                    className="primary-btn"

                                >

                                    Update Patient

                                </Link>



                                <button

                                    type="button"

                                    className="secondary-btn"

                                    onClick={clearPatient}

                                >

                                    Clear Current Patient

                                </button>



                            </div>



                        </div>



                    ) : (



                        <div className="empty-state">



                            <div className="empty-icon">

                                🩺

                            </div>



                            <h2>

                                No Patient Available

                            </h2>



                            <p>

                                Register a patient before

                                starting the assessment.

                            </p>



                            <Link

                                to="/patient-registration"

                                className="primary-btn empty-btn"

                            >

                                + Register New Patient

                            </Link>



                        </div>



                    )}



                </div>



            )}



            {/* -------------------------------------------------

                AI REPORT SECTION

            ------------------------------------------------- */}

            {activeSection === "assessment" && testData && (
                <AIReport patient={patient} testData={testData} />
            )}

            {/* -------------------------------------------------

                EXPLAINABILITY SECTION

            ------------------------------------------------- */}



            {activeSection === "explainability" && (



                <div className="dashboard-section">



                    <div className="section-heading">



                        <div>



                            <span className="welcome-label">

                                EXPLAINABLE AI

                            </span>



                            <h2>

                                Model Interpretability

                            </h2>



                            <p>

                                Understand which patient

                                features contribute to the

                                cardiovascular risk

                                prediction.

                            </p>



                        </div>



                    </div>



                    <div className="explainability-grid">



                        <div className="explainability-card">



                            <span className="feature-icon">

                                📊

                            </span>



                            <h3>

                                SHAP Analysis

                            </h3>



                            <p>

                                SHAP can provide

                                feature-level contributions

                                for individual model

                                predictions.

                            </p>



                            <span className="feature-status">

                                {

                                    testData?.explainability

                                        ?.status ||

                                    "Integration Ready"

                                }

                            </span>



                        </div>



                        <div className="explainability-card">



                            <span className="feature-icon">

                                🔎

                            </span>



                            <h3>

                                Feature Importance

                            </h3>



                            <p>

                                Identify important clinical

                                variables used by the trained

                                prediction model.

                            </p>



                            <span className="feature-status">

                                Analysis Module

                            </span>



                        </div>



                        <div className="explainability-card">



                            <span className="feature-icon">

                                ❤️

                            </span>



                            <h3>

                                ECG Insights

                            </h3>



                            <p>

                                ECG-related information can

                                be incorporated into the

                                multimodal assessment

                                workflow.

                            </p>



                            <span className="feature-status">

                                Processing Module

                            </span>



                        </div>



                    </div>



                    {/* Test SHAP feature data */}



                    {testData?.explainability?.topFeatures && (



                        <div className="dashboard-section">



                            <div className="section-heading">



                                <div>



                                    <span className="welcome-label">

                                        TEST EXPLANATION

                                    </span>



                                    <h2>

                                        Top Contributing

                                        Features

                                    </h2>



                                    <p>

                                        Sample feature

                                        contributions prepared

                                        for the future SHAP

                                        visualization.

                                    </p>



                                </div>



                            </div>



                            <div className="explainability-grid">



                                {testData.explainability.topFeatures.map(

                                    (feature) => (



                                        <div

                                            className="explainability-card"

                                            key={feature.feature}

                                        >



                                            <span className="feature-icon">

                                                📈

                                            </span>



                                            <h3>

                                                {

                                                    feature.feature

                                                }

                                            </h3>



                                            <p>

                                                Contribution:

                                                {" "}

                                                {(

                                                    feature.contribution *

                                                    100

                                                ).toFixed(0)}

                                                %

                                            </p>



                                            <span className="feature-status">

                                                {

                                                    feature.direction

                                                } impact

                                            </span>



                                        </div>



                                    )

                                )}



                            </div>



                        </div>



                    )}



                </div>



            )}



            {/* SHAP CHART UI */}
            {testData?.explainability?.topFeatures?.length > 0 && (
                <ShapChart
                    features={testData.explainability.topFeatures}
                    method={testData.explainability.method || "SHAP"}
                />
            )}

            {testData?.ecg && <EcgAnalysis ecg={testData.ecg} />}

            {/* -------------------------------------------------

                CURRENT PATIENT SUMMARY

            ------------------------------------------------- */}



            <div className="patient-summary">



                <div className="patient-summary-header">



                    <div>



                        <span className="welcome-label">

                            CURRENT PATIENT

                        </span>



                        <h2>

                            {patient

                                ? patient.name

                                : "No Patient Selected"}

                        </h2>



                        <p>

                            Patient ID:{" "}

                            {patient?.patientId ||

                                "Not available"}

                        </p>



                    </div>



                    <div className="patient-status">



                        <span className="status-dot"></span>



                        {patient

                            ? "Registered"

                            : "Waiting"}



                    </div>



                </div>



                {patient && (



                    <>



                        <div className="patient-details">



                            <div>



                                <span>

                                    AGE

                                </span>



                                <strong>

                                    {patientMetrics.age}

                                </strong>



                            </div>



                            <div>



                                <span>

                                    GENDER

                                </span>



                                <strong>

                                    {patient.gender ||

                                        "Not provided"}

                                </strong>



                            </div>



                            <div>



                                <span>

                                    BLOOD PRESSURE

                                </span>



                                <strong>

                                    {

                                        patientMetrics.bloodPressure

                                    }

                                </strong>



                            </div>



                            <div>



                                <span>

                                    HEART RATE

                                </span>



                                <strong>

                                    {

                                        patientMetrics.heartRate

                                    }

                                </strong>



                            </div>



                            <div>



                                <span>

                                    CHOLESTEROL

                                </span>



                                <strong>

                                    {

                                        patientMetrics.cholesterol

                                    }

                                </strong>



                            </div>



                            <div>



                                <span>

                                    DIABETES

                                </span>



                                <strong>

                                    {patient.diabetes ||

                                        "Not provided"}

                                </strong>



                            </div>



                        </div>



                        <div className="patient-actions">



                            <span>

                                Last dashboard update:{" "}

                                {formatDate(

                                    lastUpdated

                                )}

                            </span>



                            <Link

                                to="/patient-registration"

                                className="secondary-btn"

                            >

                                Add Another Patient

                            </Link>



                        </div>



                    </>



                )}



                {!patient && (



                    <div className="patient-actions">



                        <span>

                            Register a patient to begin

                            the cardiovascular risk

                            assessment workflow.

                        </span>



                        <Link

                            to="/patient-registration"

                            className="primary-btn"

                        >

                            + Register New Patient

                        </Link>



                    </div>



                )}



            </div>



        </div>

    );

};



export default Dashboard;