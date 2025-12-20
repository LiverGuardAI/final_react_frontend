// src/pages/administration/LoginPage.tsx
import { useNavigate } from "react-router-dom";
import LoginForm from "../../components/auth/LoginForm";
import { useAuth } from "../../context/AuthContext";

export default function AdministrationLoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = (username: string, password: string) => {
    console.log("Administration login:", username, password);
    // 👉 원무과 로그인 API 요청
    // API 요청 성공 시:
    login("administration");
    navigate("/administration/home");
  };

  return <LoginForm role="원무과" onSubmit={handleLogin} />;
}
