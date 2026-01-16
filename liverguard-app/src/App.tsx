import { RouterProvider } from "react-router-dom";
import router from "./router";
import { AuthProvider } from "./context/AuthContext";
import { TreatmentProvider } from "./contexts/TreatmentContext";
import { WebSocketProvider } from "./context/WebSocketContext";
import { NotificationProvider } from "./context/NotificationContext";
import { ChatProvider } from "./context/ChatContext";

function App() {
  return (
    <AuthProvider>
      <WebSocketProvider>
        <NotificationProvider>
          <ChatProvider>
            <TreatmentProvider>
              <RouterProvider router={router} />
            </TreatmentProvider>
          </ChatProvider>
        </NotificationProvider>
      </WebSocketProvider>
    </AuthProvider>
  );
}

export default App;
