// src/api/axiosConfig.ts
import axios from "axios";

const rawBaseURL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/";
const baseURL = rawBaseURL.endsWith("/") ? rawBaseURL : `${rawBaseURL}/`;

const apiClient = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: false,
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

// 🔹 Response Interceptor - 토큰 자동 갱신
let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });

  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const data = error.response?.data;
    const isTokenInvalid = data?.code === "token_not_valid";
    const url = originalRequest.url || "";

    // 로그인 및 토큰 갱신 요청에서 발생한 에러는 인터셉터 처리하지 않음 (무한 루프 방지)
    if (url.includes("auth/login") ||
      url.includes("auth/doctor/login") ||
      url.includes("auth/administration/login") ||
      url.includes("auth/radiology/login") ||
      url.includes("auth/refresh/")) {
      return Promise.reject(error);
    }

    // 토큰이 만료되었거나 401 에러인 경우 (코드 무관)
    if ((isTokenInvalid || error.response?.status === 401) && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem("refresh_token");

      if (refreshToken) {
        try {
          // Refresh token으로 새 access token 받기
          console.log("Attempting to refresh token...");
          const response = await apiClient.post("auth/refresh/", {
            refresh: refreshToken,
          });

          const newAccessToken = response.data.access;
          const newRefreshToken = response.data.refresh;

          localStorage.setItem("access_token", newAccessToken);
          if (newRefreshToken) {
            localStorage.setItem("refresh_token", newRefreshToken);
            console.log("Refresh token updated via rotation.");
          }

          console.log("Token refreshed successfully.");
          apiClient.defaults.headers.common["Authorization"] = `Bearer ${newAccessToken}`;

          processQueue(null, newAccessToken);

          // 원래 요청을 새 토큰으로 재시도
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return apiClient(originalRequest);
        } catch (refreshError) {
          // Refresh token도 만료됨 - 로그아웃 처리
          processQueue(refreshError, null);
          console.error("Refresh token expired or invalid. Please login again.", refreshError);
          localStorage.clear(); // 모든 저장소 초기화

          // 로그인 페이지로 리다이렉트
          window.location.href = "/";
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      } else {
        // Refresh token이 없음 - 로그아웃 처리
        localStorage.clear();
        window.location.href = "/";
      }
    }

    console.error(data || error);
    return Promise.reject(error);
  }
);

export default apiClient;
