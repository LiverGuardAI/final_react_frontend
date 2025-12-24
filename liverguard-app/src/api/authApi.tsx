// src/api/authApi.ts
import apiClient from "./axiosConfig";

export const login = async (username: string, password: string) => {
  const res = await apiClient.post("auth/login/", { username, password });
  return res.data;
};

export const logout = async () => {
  const res = await apiClient.post("auth/logout/");
  return res.data;
};

export const refreshToken = async () => {
  const res = await apiClient.post("auth/refresh/");
  return res.data;
};