// src/pages/radiology/LoginPage.tsx
import { useNavigate } from "react-router-dom";
import LoginForm from "../../components/auth/LoginForm";
import { useAuth } from "../../context/AuthContext";

export default function RadiologyLoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = (username: string, password: string) => {
    console.log("Radiology login:", username, password);
    // 👉 영상의학과 로그인 API 요청
    // API 요청 성공 시:
    login("radiology");
    navigate("/radiology/home");
  };

  return <LoginForm role="영상의학과" onSubmit={handleLogin} />;
}
