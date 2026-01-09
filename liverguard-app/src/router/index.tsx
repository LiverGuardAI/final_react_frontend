// src/router/index.tsx
import { lazy, Suspense } from "react";
import {
  createBrowserRouter,
  createRoutesFromElements,
  Route,
} from "react-router-dom";

// Lazy load all page components for code splitting
const UnifiedLoginPage = lazy(() => import("../pages/login/LoginPage"));
const DoctorLayout = lazy(() => import("../layouts/DoctorLayout"));
const DoctorHomePage = lazy(() => import("../pages/doctor/HomePage"));
const SchedulePage = lazy(() => import("../pages/doctor/SchedulePage"));
const TreatmentPage = lazy(() => import("../pages/doctor/TreatmentPage"));
const CTResultPage = lazy(() => import("../pages/doctor/CTResult"));
const RNAResultPage = lazy(() => import("../pages/doctor/RNAResult"));
const BloodResultPage = lazy(() => import("../pages/doctor/BloodResult"));
const StagePredictionPage = lazy(() => import("../pages/doctor/StagePrediction"));
const RecurrencePredictionPage = lazy(() => import("../pages/doctor/RecurrencePrediction"));
const SurvivalAnalysisPage = lazy(() => import("../pages/doctor/SurvivalAnalysis"));
const DDIPage = lazy(() => import("../pages/doctor/DDI"));
const DoctorPatientManagementPage = lazy(() => import("../pages/doctor/PatientManagementPage"));
const AdministrationLayout = lazy(() => import("../layouts/AdministrationLayout"));
const AdministrationHomePage = lazy(() => import("../pages/administration/HomePage"));
const AppointmentManagementPage = lazy(() => import("../pages/administration/AppointmentManagementPage"));
const PatientManagementPage = lazy(() => import("../pages/administration/PatientManagementPage"));
const RadiologyHomePage = lazy(() => import("../pages/radiology/HomePage"));
const AcquisitionPage = lazy(() => import("../pages/radiology/AcquisitionPage"));
const PostProcessingPage = lazy(() => import("../pages/radiology/PostProcessingPage"));
const ProtectedRoute = lazy(() => import("../components/auth/ProtectedRoute"));

// Loading fallback component
const LoadingFallback = () => (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    fontSize: '18px',
    color: '#666'
  }}>
    Loading...
  </div>
);

const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      <Route path="/" element={<Suspense fallback={<LoadingFallback />}><UnifiedLoginPage /></Suspense>} />

      {/* doctor - nested routes with shared layout */}
      <Route path="/doctor/login" element={<Suspense fallback={<LoadingFallback />}><UnifiedLoginPage initialRole="doctor" /></Suspense>} />
      <Route path="/doctor" element={<Suspense fallback={<LoadingFallback />}><DoctorLayout /></Suspense>}>
        <Route path="home" element={<Suspense fallback={<LoadingFallback />}><DoctorHomePage /></Suspense>} />
        <Route path="schedule" element={<Suspense fallback={<LoadingFallback />}><SchedulePage /></Suspense>} />
        <Route path="treatment" element={<Suspense fallback={<LoadingFallback />}><TreatmentPage /></Suspense>} />
        <Route path="ct-result" element={<Suspense fallback={<LoadingFallback />}><CTResultPage /></Suspense>} />
        <Route path="mrna-result" element={<Suspense fallback={<LoadingFallback />}><RNAResultPage /></Suspense>} />
        <Route path="blood-result" element={<Suspense fallback={<LoadingFallback />}><BloodResultPage /></Suspense>} />
        <Route path="ai-stage-prediction/:patientId?" element={<Suspense fallback={<LoadingFallback />}><StagePredictionPage /></Suspense>} />
        <Route path="ai-recurrence-prediction/:patientId?" element={<Suspense fallback={<LoadingFallback />}><RecurrencePredictionPage /></Suspense>} />
        <Route path="ai-survival-analysis/:patientId?" element={<Suspense fallback={<LoadingFallback />}><SurvivalAnalysisPage /></Suspense>} />
        <Route path="ddi" element={<Suspense fallback={<LoadingFallback />}><DDIPage /></Suspense>} />
        <Route path="patient-management" element={<Suspense fallback={<LoadingFallback />}><DoctorPatientManagementPage /></Suspense>} />
      </Route>
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
      <Route path="/administration/login" element={<Suspense fallback={<LoadingFallback />}><UnifiedLoginPage initialRole="administration" /></Suspense>} />
      <Route path="/administration" element={<Suspense fallback={<LoadingFallback />}><AdministrationLayout /></Suspense>}>
        <Route path="home" element={<Suspense fallback={<LoadingFallback />}><AdministrationHomePage /></Suspense>} />
        <Route path="appointments" element={<Suspense fallback={<LoadingFallback />}><AppointmentManagementPage /></Suspense>} />
        <Route path="patients" element={<Suspense fallback={<LoadingFallback />}><PatientManagementPage /></Suspense>} />
      </Route>
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
      <Route path="/radiology/login" element={<Suspense fallback={<LoadingFallback />}><UnifiedLoginPage initialRole="radiology" /></Suspense>} />
      <Route path="/radiology/home" element={<Suspense fallback={<LoadingFallback />}><RadiologyHomePage /></Suspense>} />
      <Route path="/radiology/acquisition" element={<Suspense fallback={<LoadingFallback />}><AcquisitionPage /></Suspense>} />
      <Route path="/radiology/post-processing" element={<Suspense fallback={<LoadingFallback />}><PostProcessingPage /></Suspense>} />
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
