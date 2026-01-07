import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import apiClient from "../../api/axiosConfig";
import "./LoginPage.css";

type RoleKey = "doctor" | "administration" | "radiology";

type RoleConfig = {
  key: RoleKey;
  label: string;
  endpoint: string;
  redirect: string;
  storageKey: string;
};

const ROLE_CONFIGS: RoleConfig[] = [
  {
    key: "doctor",
    label: "의사",
    endpoint: "auth/doctor/login/",
    redirect: "/doctor/home",
    storageKey: "doctor",
  },
  {
    key: "administration",
    label: "원무과",
    endpoint: "auth/administration/login/",
    redirect: "/administration/home",
    storageKey: "administration",
  },
  {
    key: "radiology",
    label: "영상의학과",
    endpoint: "auth/radiology/login/",
    redirect: "/radiology/home",
    storageKey: "radiology",
  },
];

type UnifiedLoginPageProps = {
  initialRole?: RoleKey;
};

export default function LoginPage({ initialRole }: UnifiedLoginPageProps) {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [role, setRole] = useState<RoleKey>(initialRole ?? "doctor");
  const [employeeNo, setEmployeeNo] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const roleConfig = useMemo(
    () => ROLE_CONFIGS.find((item) => item.key === role) ?? ROLE_CONFIGS[0],
    [role]
  );

  useEffect(() => {
    if (initialRole && initialRole !== role) {
      setRole(initialRole);
    }
  }, [initialRole, role]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const cleanedEmployeeNo = employeeNo.trim();
      const cleanedPhone = phone.trim();
      const response = await apiClient.post(roleConfig.endpoint, {
        employee_no: cleanedEmployeeNo,
        phone: cleanedPhone,
      });

      localStorage.setItem("access_token", response.data.access);
      localStorage.setItem("refresh_token", response.data.refresh);
      localStorage.setItem("user", JSON.stringify(response.data.user));

      if (response.data[roleConfig.storageKey]) {
        localStorage.setItem(
          roleConfig.storageKey,
          JSON.stringify(response.data[roleConfig.storageKey])
        );
      }

      login(roleConfig.key);
      navigate(roleConfig.redirect);
    } catch (err: any) {
      setError(
        err.response?.data?.error || "로그인에 실패했습니다. 다시 시도해주세요."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-logo" aria-label="LiverGuard">
        <span className="brand-title">
          L<span className="logo-i">i</span>verGuard
        </span>
      </div>

      <form onSubmit={handleSubmit} className="login-card">
        <div className="card-header">
          <h2>통합 로그인</h2>
          <p>역할과 계정을 선택해 안전하게 접속하세요.</p>
        </div>

          {error && (
            <div className="login-error">{error}</div>
          )}

          <label className="field">
            <span>역할</span>
            <select
              value={role}
              onChange={(e) => {
                setRole(e.target.value as RoleKey);
                setError("");
              }}
            >
              {ROLE_CONFIGS.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>사번</span>
            <input
              type="text"
              placeholder="Employee Number"
              value={employeeNo}
              onChange={(e) => setEmployeeNo(e.target.value)}
              required
            />
          </label>

          <label className="field">
            <span>전화번호</span>
            <input
              type="text"
              placeholder="Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </label>

          <button
            type="submit"
            className="login-submit"
            disabled={loading}
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>
    </div>
  );
}
