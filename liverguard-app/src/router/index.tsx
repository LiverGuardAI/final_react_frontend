// src/router/index.tsx
import { lazy, Suspense } from "react";
import {
  createBrowserRouter,
  createRoutesFromElements,
  Route,
  Outlet
} from "react-router-dom";

// Lazy load all page components for code splitting
const UnifiedLoginPage = lazy(() => import("../pages/login/LoginPage"));
const DoctorLayout = lazy(() => import("../layouts/DoctorLayout"));
const DoctorHomePage = lazy(() => import("../pages/doctor/HomePage"));
const SchedulePage = lazy(() => import("../pages/common/PersonalSchedulePage"));
const TreatmentPage = lazy(() => import("../pages/doctor/TreatmentPage"));
const EncounterDetailPopupPage = lazy(() => import("../pages/doctor/EncounterDetailPopupPage"));
const CTResultPage = lazy(() => import("../pages/doctor/CTResult"));
const RNAResultPage = lazy(() => import("../pages/doctor/RNAResult"));
const BloodResultPage = lazy(() => import("../pages/doctor/BloodResult"));
const IntegratedResultPage = lazy(() => import("../pages/doctor/IntegratedResult"));
const StagePredictionPage = lazy(() => import("../pages/doctor/StagePrediction"));
const RecurrencePredictionPage = lazy(() => import("../pages/doctor/RecurrencePrediction"));
const SurvivalAnalysisPage = lazy(() => import("../pages/doctor/SurvivalAnalysis"));
const DDIPage = lazy(() => import("../pages/doctor/DDI"));
const MedicalRecordPage = lazy(() => import("../pages/doctor/MedicalRecordPage"));
const AdministrationLayout = lazy(() => import("../layouts/AdministrationLayout"));
const AdministrationDashboard = lazy(() => import("../pages/administration/Dashboard"));
const AdminSchedulePage = lazy(() => import("../pages/administration/SchedulePage"));
const AdminMySchedulePage = lazy(() => import("../pages/common/PersonalSchedulePage"));
const PatientManagementPage = lazy(() => import("../pages/administration/PatientManagementPage"));
const PatientStatusPage = lazy(() => import("../pages/administration/PatientStatusPage"));
const RadiologyHomePage = lazy(() => import("../pages/radiology/HomePage"));
const AcquisitionPage = lazy(() => import("../pages/radiology/AcquisitionPage"));
const PostProcessingPage = lazy(() => import("../pages/radiology/PostProcessingPage"));
const LisHomePage = lazy(() => import("../pages/lis/HomePage"));
const LisReceptionPage = lazy(() => import("../pages/lis/ReceptionPage"));
const LisResultEntryPage = lazy(() => import("../pages/lis/ResultEntryPage"));
const LisLabResultFormPage = lazy(() => import("../pages/lis/LabResultFormPage"));
const ProtectedRoute = lazy(() => import("../components/auth/ProtectedRoute"));
const ErrorPage = lazy(() => import("../pages/ErrorPage"));

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
      <Route path="/"
        errorElement={<Suspense fallback={<LoadingFallback />}><ErrorPage /></Suspense>}
        element={<Suspense fallback={<LoadingFallback />}><UnifiedLoginPage /></Suspense>}
      />

      {/* doctor - nested routes with shared layout */}
      <Route path="/doctor/login" element={<Suspense fallback={<LoadingFallback />}><UnifiedLoginPage initialRole="doctor" /></Suspense>} />
      <Route
        path="/doctor/encounter/:encounterId"
        element={
          <ProtectedRoute requiredRole="doctor">
            <Suspense fallback={<LoadingFallback />}><EncounterDetailPopupPage /></Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/doctor"
        errorElement={<Suspense fallback={<LoadingFallback />}><ErrorPage /></Suspense>}
        element={
          <ProtectedRoute requiredRole="doctor">
            <Suspense fallback={<LoadingFallback />}><DoctorLayout /></Suspense>
          </ProtectedRoute>
        }
      >
        <Route path="home" element={<Suspense fallback={<LoadingFallback />}><DoctorHomePage /></Suspense>} />
        <Route path="schedule" element={<Suspense fallback={<LoadingFallback />}><SchedulePage /></Suspense>} />
        <Route path="treatment" element={<Suspense fallback={<LoadingFallback />}><TreatmentPage /></Suspense>} />
        <Route path="ct-result" element={<Suspense fallback={<LoadingFallback />}><CTResultPage /></Suspense>} />
        <Route path="mrna-result" element={<Suspense fallback={<LoadingFallback />}><RNAResultPage /></Suspense>} />
        <Route path="blood-result" element={<Suspense fallback={<LoadingFallback />}><BloodResultPage /></Suspense>} />
        <Route path="integrated-result" element={<Suspense fallback={<LoadingFallback />}><IntegratedResultPage /></Suspense>} />
        <Route path="ai-stage-prediction/:patientId?" element={<Suspense fallback={<LoadingFallback />}><StagePredictionPage /></Suspense>} />
        <Route path="ai-recurrence-prediction/:patientId?" element={<Suspense fallback={<LoadingFallback />}><RecurrencePredictionPage /></Suspense>} />
        <Route path="ai-survival-analysis/:patientId?" element={<Suspense fallback={<LoadingFallback />}><SurvivalAnalysisPage /></Suspense>} />
        <Route path="ddi" element={<Suspense fallback={<LoadingFallback />}><DDIPage /></Suspense>} />
        <Route path="medical-record" element={<Suspense fallback={<LoadingFallback />}><MedicalRecordPage /></Suspense>} />
      </Route>

      {/* administration */}
      <Route path="/administration/login" element={<Suspense fallback={<LoadingFallback />}><UnifiedLoginPage initialRole="administration" /></Suspense>} />
      <Route
        path="/administration"
        element={
          <ProtectedRoute requiredRole="administration">
            <Suspense fallback={<LoadingFallback />}><AdministrationLayout /></Suspense>
          </ProtectedRoute>
        }
      >
        <Route path="home" element={<Suspense fallback={<LoadingFallback />}><AdministrationDashboard /></Suspense>} />
        <Route path="appointments" element={<Suspense fallback={<LoadingFallback />}><AdminSchedulePage /></Suspense>} />
        <Route path="schedule" element={<Suspense fallback={<LoadingFallback />}><AdminMySchedulePage /></Suspense>} />
        <Route path="patientstatus" element={<Suspense fallback={<LoadingFallback />}><PatientStatusPage /></Suspense>} />
        <Route path="patients" element={<Suspense fallback={<LoadingFallback />}><PatientManagementPage /></Suspense>} />
      </Route>

      {/* radiology */}
      <Route path="/radiology/login" element={<Suspense fallback={<LoadingFallback />}><UnifiedLoginPage initialRole="radiology" /></Suspense>} />
      <Route
        path="/radiology"
        element={
          <ProtectedRoute requiredRole="radiology">
            <Outlet />
          </ProtectedRoute>
        }
      >
        <Route path="home" element={<Suspense fallback={<LoadingFallback />}><RadiologyHomePage /></Suspense>} />
        <Route path="acquisition" element={<Suspense fallback={<LoadingFallback />}><AcquisitionPage /></Suspense>} />
        <Route path="post-processing" element={<Suspense fallback={<LoadingFallback />}><PostProcessingPage /></Suspense>} />
      </Route>

      {/* lis */}
      <Route path="/lis/home" element={<Suspense fallback={<LoadingFallback />}><LisHomePage /></Suspense>} />
      <Route path="/lis/reception" element={<Suspense fallback={<LoadingFallback />}><LisReceptionPage /></Suspense>} />
      <Route path="/lis/result-entry" element={<Suspense fallback={<LoadingFallback />}><LisResultEntryPage /></Suspense>} />
      <Route path="/lis/lab-result/new" element={<Suspense fallback={<LoadingFallback />}><LisLabResultFormPage /></Suspense>} />
    </>
  )
);

export default router;
