// src/pages/doctor/LoginPage.tsx
import LoginForm from "../../components/auth/LoginForm";

export default function DoctorLoginPage() {
  const handleLogin = (username: string, password: string) => {
    console.log("Doctor login:", username, password);
    // 👉 여기서 doctor 로그인 API 요청
  };

  return <LoginForm role="의사" onSubmit={handleLogin} />;
}