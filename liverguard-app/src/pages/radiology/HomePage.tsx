// src/pages/radiology/HomePage.tsx
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function RadiologyHomePage() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
    localStorage.removeItem("radiology");

    logout();
    navigate("/");
  };

  return (
    <div>
      <h1>영상의학과 홈페이지</h1>
      <p>개발 예정</p>
      <button type="button" onClick={handleLogout}>
        로그아웃
      </button>
    </div>
  );
}
