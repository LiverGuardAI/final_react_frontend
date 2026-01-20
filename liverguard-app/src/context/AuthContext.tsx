import { createContext, useContext, useState, type ReactNode } from "react";

type UserRole = "doctor" | "administration" | "radiology" | null;

interface AuthContextType {
  role: UserRole;
  isAuthenticated: boolean;
  user: any;
  login: (role: UserRole, userData?: any) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole>(() => {
    return (localStorage.getItem("userRole") as UserRole) || null;
  });

  const [user, setUser] = useState<any>(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  });

  const login = (userRole: UserRole, userData?: any) => {
    setRole(userRole);
    if (userRole) {
      localStorage.setItem("userRole", userRole);
    }
    if (userData) {
      setUser(userData);
      // localStorage user is set by LoginPage, but managing state here is good
    }
  };

  const logout = () => {
    setRole(null);
    setUser(null);
    localStorage.removeItem("userRole");
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
  };

  const isAuthenticated = role !== null;

  return (
    <AuthContext.Provider value={{ role, user, isAuthenticated, login, logout }}>
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
