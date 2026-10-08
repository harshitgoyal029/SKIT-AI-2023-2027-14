import React from "react";
import {
    BrowserRouter,
    Navigate,
    Route,
    Routes,
} from "react-router-dom";

import DashboardLayout from "./layouts/DashboardLayout";
import Dashboard from "./pages/Dashboard";
<<<<<<< HEAD
import PatientRegistration from "./pages/PatientRegistration";
import DataUpload from "./pages/DataUpload";
=======
>>>>>>> 2780379dd618009a236aa9ed5d480c6018dc01f3
import Login from "./pages/Login";
import PatientRegistration from "./pages/PatientRegistration";
import Register from "./pages/Register";
import ProtectedRoute from "./components/ProtectedRoute";

const App = () => (
    <BrowserRouter>
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
                <Route
<<<<<<< HEAD
                    path="/*"
                    element={
                        <DashboardLayout>
                            <Routes>
                                <Route
                                    path="/dashboard"
                                    element={<Dashboard />}
                                />

                                <Route
                                    path="/patient-registration"
                                    element={<PatientRegistration />}
                                />

                                <Route
                                    path="/data-upload"
                                    element={<DataUpload />}
                                />

                                <Route
                                    path="/"
                                    element={
                                        <Navigate
                                            to="/dashboard"
                                            replace
                                        />
                                    }
                                />
                            </Routes>
                        </DashboardLayout>
                    }
=======
                    path="/patient-registration"
                    element={<PatientRegistration />}
>>>>>>> 2780379dd618009a236aa9ed5d480c6018dc01f3
                />
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
            </Route>

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
    </BrowserRouter>
);

export default App;
