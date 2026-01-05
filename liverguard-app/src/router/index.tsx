// src/router/index.tsx
import { lazy, Suspense } from "react";
import {
  createBrowserRouter,
  createRoutesFromElements,
  Route,
} from "react-router-dom";

// Lazy load all page components for code splitting
const HomePage = lazy(() => import("../pages/home/HomePage"));
const DoctorLoginPage = lazy(() => import("../pages/doctor/LoginPage"));
const DoctorHomePage = lazy(() => import("../pages/doctor/HomePage"));
const SchedulePage = lazy(() => import("../pages/doctor/SchedulePage"));
const TreatmentPage = lazy(() => import("../pages/doctor/TreatmentPage"));
const CTResultPage = lazy(() => import("../pages/doctor/CTResult"));
const RNAResultPage = lazy(() => import("../pages/doctor/RNAResult"));
const BloodResultPage = lazy(() => import("../pages/doctor/BloodResult"));
const AIResultPage = lazy(() => import("../pages/doctor/AIResult"));
const StagePredictionPage = lazy(() => import("../pages/doctor/StagePrediction"));
const RecurrencePredictionPage = lazy(() => import("../pages/doctor/RecurrencePrediction"));
const SurvivalAnalysisPage = lazy(() => import("../pages/doctor/SurvivalAnalysis"));
const DDIPage = lazy(() => import("../pages/doctor/DDI"));
const DoctorPatientManagementPage = lazy(() => import("../pages/doctor/PatientManagementPage"));
const AdministrationLoginPage = lazy(() => import("../pages/administration/LoginPage"));
const AdministrationHomePage = lazy(() => import("../pages/administration/HomePage"));
const AppointmentManagementPage = lazy(() => import("../pages/administration/AppointmentManagementPage"));
const PatientManagementPage = lazy(() => import("../pages/administration/PatientManagementPage"));
const RadiologyLoginPage = lazy(() => import("../pages/radiology/LoginPage"));
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
      <Route path="/" element={<Suspense fallback={<LoadingFallback />}><HomePage /></Suspense>} />

      {/* doctor */}
      <Route path="/doctor/login" element={<Suspense fallback={<LoadingFallback />}><DoctorLoginPage /></Suspense>} />
      <Route path="/doctor/home" element={<Suspense fallback={<LoadingFallback />}><DoctorHomePage /></Suspense>} />
      <Route path="/doctor/schedule" element={<Suspense fallback={<LoadingFallback />}><SchedulePage /></Suspense>} />
      <Route path="/doctor/treatment" element={<Suspense fallback={<LoadingFallback />}><TreatmentPage /></Suspense>} />
      <Route path="/doctor/ct-result" element={<Suspense fallback={<LoadingFallback />}><CTResultPage /></Suspense>} />
      <Route path="/doctor/mrna-result" element={<Suspense fallback={<LoadingFallback />}><RNAResultPage /></Suspense>} />
      <Route path="/doctor/blood-result" element={<Suspense fallback={<LoadingFallback />}><BloodResultPage /></Suspense>} />
      <Route path="/doctor/ai-result" element={<Suspense fallback={<LoadingFallback />}><AIResultPage /></Suspense>} />
      <Route path="/doctor/ai-stage-prediction" element={<Suspense fallback={<LoadingFallback />}><StagePredictionPage /></Suspense>} />
      <Route path="/doctor/ai-recurrence-prediction" element={<Suspense fallback={<LoadingFallback />}><RecurrencePredictionPage /></Suspense>} />
      <Route path="/doctor/ai-survival-analysis" element={<Suspense fallback={<LoadingFallback />}><SurvivalAnalysisPage /></Suspense>} />
      <Route path="/doctor/ddi" element={<Suspense fallback={<LoadingFallback />}><DDIPage /></Suspense>} />
      <Route path="/doctor/patient-management" element={<Suspense fallback={<LoadingFallback />}><DoctorPatientManagementPage /></Suspense>} />
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
      <Route path="/administration/login" element={<Suspense fallback={<LoadingFallback />}><AdministrationLoginPage /></Suspense>} />
      <Route path="/administration/home" element={<Suspense fallback={<LoadingFallback />}><AdministrationHomePage /></Suspense>} />
      <Route path="/administration/appointments" element={<Suspense fallback={<LoadingFallback />}><AppointmentManagementPage /></Suspense>} />
      <Route path="/administration/patients" element={<Suspense fallback={<LoadingFallback />}><PatientManagementPage /></Suspense>} />
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
      <Route path="/radiology/login" element={<Suspense fallback={<LoadingFallback />}><RadiologyLoginPage /></Suspense>} />
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
