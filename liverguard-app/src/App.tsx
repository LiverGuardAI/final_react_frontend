import { RouterProvider } from "react-router-dom";
import router from "./router";
import { AuthProvider } from "./context/AuthContext";
import { TreatmentProvider } from "./contexts/TreatmentContext";
import { WebSocketProvider } from "./context/WebSocketContext";
import { NotificationProvider } from "./context/NotificationContext";

function App() {
  return (
    <AuthProvider>
      <WebSocketProvider>
        <NotificationProvider>
          <TreatmentProvider>
            <RouterProvider router={router} />
          </TreatmentProvider>
        </NotificationProvider>
      </WebSocketProvider>
    </AuthProvider>
  );
}

export default App;
