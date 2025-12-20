// src/pages/radiology/LoginPage.tsx
import LoginForm from "../../components/auth/LoginForm";

export default function RadiologyLoginPage() {
  const handleLogin = (username: string, password: string) => {
    console.log("Radiology login:", username, password);
    // 👉 영상의학과 로그인 API 요청
  };

  return <LoginForm role="영상의학과" onSubmit={handleLogin} />;
}
