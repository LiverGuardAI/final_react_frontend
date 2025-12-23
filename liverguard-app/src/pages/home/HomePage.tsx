import { useNavigate } from "react-router-dom";

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <h1>LiverGuard 시스템</h1>
      <p>역할을 선택하세요</p>

      <div style={{ display: "flex", gap: "20px", justifyContent: "center", marginTop: "30px" }}>
        <button
          onClick={() => navigate("/doctor/login")}
          style={{ padding: "20px 40px", fontSize: "18px", cursor: "pointer" }}
        >
          의사
        </button>

        <button
          onClick={() => navigate("/administration/login")}
          style={{ padding: "20px 40px", fontSize: "18px", cursor: "pointer" }}
        >
          원무과
        </button>

        <button
          onClick={() => navigate("/radiology/login")}
          style={{ padding: "20px 40px", fontSize: "18px", cursor: "pointer" }}
        >
          영상의학과
        </button>
      </div>
    </div>
  );
}