import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactElement;
  requiredRole: "doctor" | "administration" | "radiology";
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { isAuthenticated, role } = useAuth();

  if (!isAuthenticated || role !== requiredRole) {
    return <Navigate to={`/${requiredRole}/login`} replace />;
  }

  return children;
}
