// src/router/index.tsx
import {
  createBrowserRouter,
  createRoutesFromElements,
  Route,
} from "react-router-dom";

import HomePage from "../pages/home/HomePage";
import DoctorLoginPage from "../pages/doctor/LoginPage";
import DoctorHomePage from "../pages/doctor/HomePage";
import SchedulePage from "../pages/doctor/SchedulePage";
import TreatmentPage from "../pages/doctor/TreatmentPage";
import AdministrationLoginPage from "../pages/administration/LoginPage";
import AdministrationHomePage from "../pages/administration/HomePage";
import RadiologyLoginPage from "../pages/radiology/LoginPage";
import RadiologyHomePage from "../pages/radiology/HomePage";
import ProtectedRoute from "../components/auth/ProtectedRoute";

const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      <Route path="/" element={<HomePage />} />

      {/* doctor */}
      <Route path="/doctor/login" element={<DoctorLoginPage />} />
      <Route path="/doctor/home" element={<DoctorHomePage />} />
      <Route path="/doctor/schedule" element={<SchedulePage />} />
      <Route path="/doctor/treatment" element={<TreatmentPage />} />
      {/* 테스트용 - 나중에 ProtectedRoute 복원 필요 */}
      {/* <Route
        path="/doctor/home"
        element={
          <ProtectedRoute requiredRole="doctor">
            <DoctorHomePage />
          </ProtectedRoute>
        }
      /> */}

      {/* administration */}
      <Route path="/administration/login" element={<AdministrationLoginPage />} />
      <Route
        path="/administration/home"
        element={
          <ProtectedRoute requiredRole="administration">
            <AdministrationHomePage />
          </ProtectedRoute>
        }
      />

      {/* radiology */}
      <Route path="/radiology/login" element={<RadiologyLoginPage />} />
      <Route
        path="/radiology/home"
        element={
          <ProtectedRoute requiredRole="radiology">
            <RadiologyHomePage />
          </ProtectedRoute>
        }
      />
    </>
  )
);

export default router;
