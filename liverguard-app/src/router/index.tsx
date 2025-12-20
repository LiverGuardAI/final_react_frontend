// src/router/index.tsx
import {
  createBrowserRouter,
  createRoutesFromElements,
  Route,
} from "react-router-dom";

import HomePage from "../pages/home/HomePage";
import DoctorLoginPage from "../pages/doctor/LoginPage";
import AdministrationLoginPage from "../pages/administration/LoginPage";
import RadiologyLoginPage from "../pages/radiology/LoginPage";

const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      <Route path="/" element={<HomePage />} />
      <Route path="/doctor/login" element={<DoctorLoginPage />} />
      <Route path="/administration/login" element={<AdministrationLoginPage />} />
      <Route path="/radiology/login" element={<RadiologyLoginPage />} />
    </>
  )
);

export default router;
