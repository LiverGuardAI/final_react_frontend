// src/pages/Administration/LoginPage.tsx
import LoginForm from "../../components/auth/LoginForm";

export default function AdministrationLoginPage() {
  const handleLogin = (username: string, password: string) => {
    console.log("Administration login:", username, password);
    // 👉 원무과 로그인 API 요청
  };

  return <LoginForm role="원무과" onSubmit={handleLogin} />;
}
