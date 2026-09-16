import React from "react";
import {
    BrowserRouter,
    Routes,
    Route,
    Navigate,
} from "react-router-dom";

import DashboardLayout from "./layouts/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import PatientRegistration from "./pages/PatientRegistration";
import Login from "./pages/Login";
import Register from "./pages/Register";

const App = () => {
    return (
        <BrowserRouter>
            <Routes>

                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />

                <Route
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
                />

            </Routes>
        </BrowserRouter>
    );
};

export default App;