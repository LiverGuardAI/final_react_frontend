import { RouterProvider } from "react-router-dom";
import router from "./router";
import { AuthProvider } from "./context/AuthContext";
import { TreatmentProvider } from "./contexts/TreatmentContext";

function App() {
  return (
    <AuthProvider>
      <TreatmentProvider>
        <RouterProvider router={router} />
      </TreatmentProvider>
    </AuthProvider>
  );
}

export default App;
