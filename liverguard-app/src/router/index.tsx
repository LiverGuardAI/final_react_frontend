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
import CTResultPage from "../pages/doctor/CTResult";
import RNAResultPage from "../pages/doctor/RNAResult";
import BloodResultPage from "../pages/doctor/BloodResult";
import AIResultPage from "../pages/doctor/AIResult";
import StagePredictionPage from "../pages/doctor/StagePrediction";
import RecurrencePredictionPage from "../pages/doctor/RecurrencePrediction";
import SurvivalAnalysisPage from "../pages/doctor/SurvivalAnalysis";
import DDIPage from "../pages/doctor/DDI";
import DoctorPatientManagementPage from "../pages/doctor/PatientManagementPage";
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
      <Route path="/doctor/ct-result" element={<CTResultPage />} />
      <Route path="/doctor/mrna-result" element={<RNAResultPage />} />
      <Route path="/doctor/blood-result" element={<BloodResultPage />} />
      <Route path="/doctor/ai-result" element={<AIResultPage />} />
      <Route path="/doctor/ai-stage-prediction" element={<StagePredictionPage />} />
      <Route path="/doctor/ai-recurrence-prediction" element={<RecurrencePredictionPage />} />
      <Route path="/doctor/ai-survival-analysis" element={<SurvivalAnalysisPage />} />
      <Route path="/doctor/ddi" element={<DDIPage />} />
      <Route path="/doctor/patient-management" element={<DoctorPatientManagementPage />} />
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
