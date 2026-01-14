// src/pages/administration/LoginPage.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import apiClient from "../../api/axiosConfig";

export default function AdministrationLoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [employeeNo, setEmployeeNo] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const cleanedEmployeeNo = employeeNo.trim();
      const cleanedPhone = phone.trim();
      const response = await apiClient.post("auth/administration/login/", {
        employee_no: cleanedEmployeeNo,
        phone: cleanedPhone,
      });

      localStorage.setItem("access_token", response.data.access);
      localStorage.setItem("refresh_token", response.data.refresh);
      localStorage.setItem("user", JSON.stringify(response.data.user));
      localStorage.setItem("administration", JSON.stringify(response.data.administration));

      login("administration", response.data.user);
      navigate("/administration/home");
    } catch (err: any) {
      setError(
        err.response?.data?.error || "로그인에 실패했습니다. 다시 시도해주세요."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <form onSubmit={handleSubmit} style={{ maxWidth: "400px", margin: "0 auto" }}>
        <h2>원무과 로그인</h2>

        {error && (
          <div style={{ color: "red", marginBottom: "10px" }}>{error}</div>
        )}

        <input
          type="text"
          placeholder="사번 (Employee Number)"
          value={employeeNo}
          onChange={(e) => setEmployeeNo(e.target.value)}
          required
          style={{ width: "100%", padding: "10px", marginBottom: "10px", boxSizing: "border-box" }}
        />

        <input
          type="text"
          placeholder="전화번호 (Phone)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
          style={{ width: "100%", padding: "10px", marginBottom: "20px", boxSizing: "border-box" }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{ padding: "10px 20px", fontSize: "16px", cursor: loading ? "not-allowed" : "pointer" }}
        >
          {loading ? "로그인 중..." : "로그인"}
        </button>
      </form>
    </div>
  );
}
