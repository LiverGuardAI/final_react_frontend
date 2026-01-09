import { RouterProvider } from "react-router-dom";
import router from "./router";
import { AuthProvider } from "./context/AuthContext";
import { TreatmentProvider } from "./contexts/TreatmentContext";
import { WebSocketProvider } from "./context/WebSocketContext";

function App() {
  return (
    <AuthProvider>
      <WebSocketProvider>
        <TreatmentProvider>
          <RouterProvider router={router} />
        </TreatmentProvider>
      </WebSocketProvider>
    </AuthProvider>
  );
}

export default App;
