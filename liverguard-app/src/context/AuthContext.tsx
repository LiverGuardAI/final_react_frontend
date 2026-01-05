import { createContext, useContext, useState, type ReactNode } from "react";

type UserRole = "doctor" | "administration" | "radiology" | null;

interface AuthContextType {
  role: UserRole;
  isAuthenticated: boolean;
  login: (role: UserRole) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole>(null);

  const login = (userRole: UserRole) => {
    setRole(userRole);
    if (userRole) {
      localStorage.setItem("userRole", userRole);
    }
  };

  const logout = () => {
    setRole(null);
    localStorage.removeItem("userRole");
    localStorage.removeItem("access_token");
  };

  const isAuthenticated = role !== null;

  return (
    <AuthContext.Provider value={{ role, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
