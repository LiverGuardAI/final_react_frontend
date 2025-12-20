// src/pages/doctor/LoginPage.tsx
import { useNavigate } from "react-router-dom";
import LoginForm from "../../components/auth/LoginForm";
import { useAuth } from "../../context/AuthContext";

export default function DoctorLoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = (username: string, password: string) => {
    console.log("Doctor login:", username, password);
    // 👉 여기서 doctor 로그인 API 요청
    // API 요청 성공 시:
    login("doctor");
    navigate("/doctor/home");
  };

  return <LoginForm role="의사" onSubmit={handleLogin} />;
}