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
import AppointmentManagementPage from "../pages/administration/AppointmentManagementPage";
import PatientManagementPage from "../pages/administration/PatientManagementPage";
import RadiologyLoginPage from "../pages/radiology/LoginPage";
import RadiologyHomePage from "../pages/radiology/HomePage";
import AcquisitionPage from "../pages/radiology/AcquisitionPage";
import PostProcessingPage from "../pages/radiology/PostProcessingPage";
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
      <Route path="/administration/home" element={<AdministrationHomePage />} />
      <Route path="/administration/appointments" element={<AppointmentManagementPage />} />
      <Route path="/administration/patients" element={<PatientManagementPage />} />
      {/* 테스트용 - 나중에 ProtectedRoute 복원 필요 */}
      {/* <Route
        path="/administration/home"
        element={
          <ProtectedRoute requiredRole="administration">
            <AdministrationHomePage />
          </ProtectedRoute>
        }
      /> */}

      {/* radiology */}
      <Route path="/radiology/login" element={<RadiologyLoginPage />} />
      <Route path="/radiology/home" element={<RadiologyHomePage />} />
      <Route path="/radiology/acquisition" element={<AcquisitionPage />} />
      <Route path="/radiology/post-processing" element={<PostProcessingPage />} />
      {/* <Route
        path="/radiology/home"
        element={
          <ProtectedRoute requiredRole="radiology">
            <RadiologyHomePage />
          </ProtectedRoute>
        }
      /> */}
    </>
  )
);

export default router;
