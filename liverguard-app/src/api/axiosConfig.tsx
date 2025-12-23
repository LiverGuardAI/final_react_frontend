// src/api/axiosConfig.ts
import axios from "axios";

const baseURL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/";

const apiClient = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

// 🔹 Request Interceptor
apiClient.interceptors.request.use(
  (config) => {
    const url = config.url || "";
    const isAuthRequest =
      url.includes("auth/login/") ||
      url.includes("auth/refresh/") ||
      url.includes("auth/doctor/login/") ||
      url.includes("auth/radiology/login/") ||
      url.includes("auth/administration/login/");

    if (isAuthRequest) {
      return config;
    }

    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 🔹 Response Interceptor
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const data = error.response?.data;
    const isTokenInvalid = data?.code === "token_not_valid";
    if (isTokenInvalid) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
    }
    console.error(data || error);
    return Promise.reject(error);
  }
);

export default apiClient;
