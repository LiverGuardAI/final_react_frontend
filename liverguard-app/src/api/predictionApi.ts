/**
 * Prediction API Service
 * Location: src/api/predictionApi.ts
 */

import axios, { type AxiosInstance } from 'axios';

// ============================================================
// Types
// ============================================================

export interface RadioFeature {
  radio_vector_id: string;
  feature_vector: number[];
  model_name: string;
  model_version: string;
  study_date: string | null;
  study_description: string | null;
  created_at: string;
}

export interface ClinicalFeature {
  clinical_vector_id: string;
  feature_vector: number[];
  lab_date: string;
  age: number | null;
  sex: number | null;
  grade: number | null;
  vascular_invasion: number | null;
  ishak_score: number | null;
  afp: number | null;
  albumin: number | null;
  bilirubin: number | null;
  platelet: number | null;
  created_at: string;
}

export interface GenomicFeature {
  genomic_id: string;
  pathway_scores: number[];
  sample_date: string;
  created_at: string;
}

export interface StagePrediction {
  predicted_stage: string;
  stage_code: number;
  probabilities: Record<string, number>;
  confidence: number;
  uses_mrna: boolean;
  error?: string;
}

export interface RelapsePrediction {
  relapse_probability: number;
  risk_level: string;
  prediction: number;
  threshold_used: number;
  uses_mrna: boolean;
  error?: string;
}

export interface SurvivalAnalysis {
  risk_score: number;
  risk_group: string;
  survival_probabilities: {
    months_12: number;
    months_24: number;
    months_36: number;
  };
  uses_mrna: boolean;
  note: string;
  error?: string;
}

export interface PredictionResult {
  model_version: string;
  prediction_timestamp: string;
  input_validation: {
    clinical_dim: number;
    ct_dim: number;
    mrna_provided: boolean;
    use_mrna: boolean;
  };
  stage_prediction: StagePrediction;
  relapse_prediction: RelapsePrediction;
  survival_analysis: SurvivalAnalysis;
  warnings?: {
    date_mismatch?: {
      mismatch: boolean;
      days: number;
      warning: string;
    };
  };
  error?: string;
}

// ============================================================
// API Client
// ============================================================

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const apiClient: AxiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/api/ai`,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ============================================================
// API Functions
// ============================================================

export const fetchRadioFeatures = async (patientId: string): Promise<RadioFeature[]> => {
  const response = await apiClient.get(`/patients/${patientId}/radio-features/`);
  return response.data;
};

export const fetchClinicalFeatures = async (patientId: string): Promise<ClinicalFeature[]> => {
  const response = await apiClient.get(`/patients/${patientId}/clinical-features/`);
  return response.data;
};

export const fetchGenomicFeatures = async (patientId: string): Promise<GenomicFeature[]> => {
  const response = await apiClient.get(`/patients/${patientId}/genomic-features/`);
  return response.data;
};

export const fetchAllFeatures = async (patientId: string) => {
  const [radio, clinical, genomic] = await Promise.all([
    fetchRadioFeatures(patientId),
    fetchClinicalFeatures(patientId),
    fetchGenomicFeatures(patientId),
  ]);
  return { radio, clinical, genomic };
};

export const runPredictionByIds = async (
  radioVectorId: string,
  clinicalVectorId: string,
  genomicId?: string
): Promise<PredictionResult> => {
  const response = await apiClient.post('/predict/by-ids/', {
    radio_vector_id: radioVectorId,
    clinical_vector_id: clinicalVectorId,
    genomic_id: genomicId || null,
  });
  return response.data;
};

export const saveAnalysisResult = async (
  patientId: string,
  result: PredictionResult,
  radioVectorId?: string,
  clinicalVectorId?: string,
  genomicVectorId?: string
): Promise<{ analysis_id: string; message: string }> => {
  const response = await apiClient.post('/analysis/save/', {
    patient_id: patientId,
    radio_vector_id: radioVectorId,
    clinical_vector_id: clinicalVectorId,
    genomic_vector_id: genomicVectorId,
    stage_prediction: result.stage_prediction,
    relapse_prediction: result.relapse_prediction,
    survival_prediction: result.survival_analysis,
    model_version: result.model_version,
  });
  return response.data;
};

export const checkHealth = async () => {
  const response = await apiClient.get('/health/');
  return response.data;
};

// ============================================================
// Utility Functions
// ============================================================

export const getRiskLevelBgClass = (level: string | undefined): string => {
  switch (level) {
    case 'High': return 'bg-red-100 text-red-700';
    case 'Medium': return 'bg-yellow-100 text-yellow-700';
    case 'Low': return 'bg-green-100 text-green-700';
    default: return 'bg-gray-100 text-gray-700';
  }
};

export const checkDateMismatch = (
  radioDate: string | null,
  clinicalDate: string | null,
  genomicDate: string | null,
  thresholdDays: number = 30
): { mismatch: boolean; maxDays: number; warning: string | null } => {
  const dates = [radioDate, clinicalDate, genomicDate].filter(Boolean) as string[];
  if (dates.length < 2) return { mismatch: false, maxDays: 0, warning: null };

  let maxDiff = 0;
  for (let i = 0; i < dates.length; i++) {
    for (let j = i + 1; j < dates.length; j++) {
      const d1 = new Date(dates[i]), d2 = new Date(dates[j]);
      const diff = Math.abs(Math.floor((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24)));
      if (diff > maxDiff) maxDiff = diff;
    }
  }

  if (maxDiff > thresholdDays) {
    return {
      mismatch: true,
      maxDays: maxDiff,
      warning: `데이터 수집 날짜가 ${maxDiff}일 차이납니다 (>${thresholdDays}일). 결과의 신뢰도가 낮을 수 있습니다.`,
    };
  }
  return { mismatch: false, maxDays: maxDiff, warning: null };
};