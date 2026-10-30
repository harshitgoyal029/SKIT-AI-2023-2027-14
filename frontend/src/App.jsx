import React, { Suspense, lazy } from "react";
import {
    BrowserRouter,
    Navigate,
    Route,
    Routes,
} from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";

const DashboardLayout = lazy(() => import("./layouts/DashboardLayout"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const PatientRegistration = lazy(() => import("./pages/PatientRegistration"));
const DataUpload = lazy(() => import("./pages/DataUpload"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));

const App = () => (
    <BrowserRouter>
        <Suspense fallback={<div className="app-loading" role="status">Loading CVD-XAI…</div>}>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />

                <Route
                    element={
                        <ProtectedRoute>
                            <DashboardLayout />
                        </ProtectedRoute>
                    }
                >
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/prediction-results" element={<Dashboard activeView="predictions" />} />
                    <Route path="/patient-registration" element={<PatientRegistration />} />
                    <Route path="/data-upload" element={<DataUpload />} />
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                </Route>

                <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
        </Suspense>
    </BrowserRouter>
);

export default App;
