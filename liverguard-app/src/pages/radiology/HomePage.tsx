// src/pages/radiology/HomePage.tsx
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import "./HomePage.css";

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
    <div className="radiology-home-page">
      <header className="radiology-header">
        <h1>영상의학과 홈페이지</h1>
        <button type="button" onClick={handleLogout} className="logout-btn">
          로그아웃
        </button>
      </header>

      <div className="radiology-content">
        <div className="nav-cards">
          <div className="nav-card" onClick={() => navigate("/radiology/acquisition")}>
            <div className="card-icon">📷</div>
            <h2>촬영 페이지</h2>
            <p>DICOM 영상 촬영 및 업로드</p>
          </div>

          <div className="nav-card" onClick={() => navigate("/radiology/post-processing")}>
            <div className="card-icon">🖼️</div>
            <h2>영상 후처리 페이지</h2>
            <p>Segmentation 및 후처리 작업</p>
          </div>
        </div>
      </div>
    </div>
  );
}
