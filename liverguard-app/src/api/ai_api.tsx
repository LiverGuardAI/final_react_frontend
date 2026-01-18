import apiClient from "./axiosConfig";

/**
 * AI Segmentation Mask 생성 요청
 * POST /api/ai/mosec/segmentation/create/
 */
export interface CreateSegmentationResponse {
  task_id: string;
  status: string;
  message: string;
  series_id: string;
}

export const createSegmentationMask = async (
  seriesId: string
): Promise<CreateSegmentationResponse> => {
  try {
    const response = await apiClient.post<CreateSegmentationResponse>(
      "ai/mosec/segmentation/create/",
      {
        series_id: seriesId,
      }
    );
    return response.data;
  } catch (error) {
    console.error("Failed to create segmentation mask:", error);
    throw error;
  }
};

/**
 * Segmentation Task 상태 조회
 * GET /api/ai/mosec/segmentation/status/{task_id}/
 */
export interface SegmentationTaskStatus {
  task_id: string;
  status: "PENDING" | "PROGRESS" | "SUCCESS" | "FAILURE";
  message?: string;
  progress?: {
    step: string;
    series_id: string;
    progress: number;
  };
  result?: {
    status: string;
    series_id: string;
    result: {
      original_series_id: string;
      mask_series_id: string;
      message: string;
    };
    message: string;
  };
  error?: string;
}

export const getSegmentationTaskStatus = async (
  taskId: string
): Promise<SegmentationTaskStatus> => {
  try {
    const response = await apiClient.get<SegmentationTaskStatus>(
      `ai/mosec/segmentation/status/${taskId}/`
    );
    return response.data;
  } catch (error) {
    console.error("Failed to get task status:", error);
    throw error;
  }
};

/**
 * AI Feature Extraction 요청
 * POST /api/ai/mosec/extract-feature/
 */
export interface CreateFeatureExtractionResponse {
  task_id: string;
  status: string;
  message: string;
  seriesinstanceuid: string;
}

export const createFeatureExtraction = async (
  seriesInstanceUid: string
): Promise<CreateFeatureExtractionResponse> => {
  try {
    const response = await apiClient.post<CreateFeatureExtractionResponse>(
      "ai/mosec/extract-feature/",
      {
        seriesinstanceuid: seriesInstanceUid,
      }
    );
    return response.data;
  } catch (error) {
    console.error("Failed to start feature extraction:", error);
    throw error;
  }
};

export interface FeatureExtractionTaskStatus {
  task_id: string;
  status: "PENDING" | "PROGRESS" | "SUCCESS" | "FAILURE";
  message?: string;
  progress?: {
    step: string;
    seriesinstanceuid: string;
    progress: number;
  };
  result?: {
    status: string;
    seriesinstanceuid: string;
    result: {
      success: boolean;
      feature_dim?: number;
      features?: number[];
      patient_id?: string;
      seriesinstanceuid?: string;
      original_shape?: number[];
      original_spacing?: number[];
      error?: string;
    };
    message: string;
  };
  error?: string;
}

export const getFeatureExtractionTaskStatus = async (
  taskId: string
): Promise<FeatureExtractionTaskStatus> => {
  try {
    const response = await apiClient.get<FeatureExtractionTaskStatus>(
      `ai/mosec/extract-feature/status/${taskId}/`
    );
    return response.data;
  } catch (error) {
    console.error("Failed to get feature extraction task status:", error);
    throw error;
  }
};

export interface ReportGenerateResponse {
  report: string;
}

/**
 * 자동 보고서 생성
 * POST /api/ai/openapi/ct-report/generate/
 */
export const generateReport = async (findings: any): Promise<ReportGenerateResponse> => {
  try {
    const response = await apiClient.post<ReportGenerateResponse>(
      "ai/openapi/ct-report/generate/",
      findings
    );
    return response.data;
  } catch (error) {
    console.error("Failed to generate report:", error);
    throw error;
  }
};

/**
 * 자동 보고서 생성 (LMStudio)
 * POST /api/ai/lmstudio/ct-report/generate/
 */
export const generateReportV2 = async (findings: any): Promise<ReportGenerateResponse> => {
  try {
    const response = await apiClient.post<ReportGenerateResponse>(
      "ai/lmstudio/ct-report/generate/",
      findings
    );
    return response.data;
  } catch (error) {
    console.error("Failed to generate report v2:", error);
    throw error;
  }
};



export interface ClinicalNoteSuggestionRequest {
  encounter_id: number;
  chief_complaint: string;
  clinical_notes: string;
  questionnaire_data?: any;
}

export interface ClinicalNoteSuggestionResponse {
  suggestion: string;
}

/**
 * Clinical note suggestion
 * POST /api/ai/openapi/clinical-note/generate/
 */
export const generateClinicalNoteSuggestion = async (
  payload: ClinicalNoteSuggestionRequest
): Promise<ClinicalNoteSuggestionResponse> => {
  try {
    const response = await apiClient.post<ClinicalNoteSuggestionResponse>(
      "ai/openapi/clinical-note/generate/",
      payload
    );
    return response.data;
  } catch (error) {
    console.error("Failed to generate clinical note suggestion:", error);
    throw error;
  }
};

// ===========================
// BentoML Prediction APIs
// ===========================

/**
 * BentoML Health Check
 * GET /api/ai/health/
 */
export const checkBentoMLHealth = async (): Promise<any> => {
  try {
    const response = await apiClient.get("ai/health/");
    return response.data;
  } catch (error) {
    console.error("Failed to check BentoML health:", error);
    throw error;
  }
};

/**
 * Stage Prediction Task Response
 */
export interface StagePredictionResponse {
  task_id: string;
  status: string;
  message: string;
  series_uid: string;
}

/**
 * Stage Prediction (병기 예측)
 * POST /api/ai/bentoml/predict/stage/
 */
export const predictStage = async (
  clinical: number[],
  seriesUid: string
): Promise<StagePredictionResponse> => {
  try {
    const response = await apiClient.post<StagePredictionResponse>(
      "ai/bentoml/predict/stage/",
      {
        clinical,
        series_uid: seriesUid,
      }
    );
    return response.data;
  } catch (error) {
    console.error("Failed to predict stage:", error);
    throw error;
  }
};

/**
 * Relapse Prediction Task Response
 */
export interface RelapsePredictionResponse {
  task_id: string;
  status: string;
  message: string;
  series_uid: string;
}

/**
 * Relapse Prediction (조기 재발 예측)
 * POST /api/ai/bentoml/predict/relapse/
 */
export const predictRelapse = async (
  clinical: number[],
  mrna: number[],
  seriesUid: string
): Promise<RelapsePredictionResponse> => {
  try {
    const response = await apiClient.post<RelapsePredictionResponse>(
      "ai/bentoml/predict/relapse/",
      {
        clinical,
        mrna,
        series_uid: seriesUid,
      }
    );
    return response.data;
  } catch (error) {
    console.error("Failed to predict relapse:", error);
    throw error;
  }
};

/**
 * Survival Prediction Task Response
 */
export interface SurvivalPredictionResponse {
  task_id: string;
  status: string;
  message: string;
  series_uid: string;
}

/**
 * Survival Prediction (생존 분석)
 * POST /api/ai/bentoml/predict/survival/
 */
export const predictSurvival = async (
  clinical: number[],
  mrna: number[],
  seriesUid: string
): Promise<SurvivalPredictionResponse> => {
  try {
    const response = await apiClient.post<SurvivalPredictionResponse>(
      "ai/bentoml/predict/survival/",
      {
        clinical,
        mrna,
        series_uid: seriesUid,
      }
    );
    return response.data;
  } catch (error) {
    console.error("Failed to predict survival:", error);
    throw error;
  }
};

/**
 * All Predictions Task Response
 */
export interface AllPredictionsResponse {
  task_id: string;
  status: string;
  message: string;
  series_uid: string;
}

/**
 * All Predictions (전체 예측)
 * POST /api/ai/bentoml/predict/all/
 */
export const predictAll = async (
  clinical: number[],
  mrna: number[],
  seriesUid: string
): Promise<AllPredictionsResponse> => {
  try {
    const response = await apiClient.post<AllPredictionsResponse>(
      "ai/bentoml/predict/all/",
      {
        clinical,
        mrna,
        series_uid: seriesUid,
      }
    );
    return response.data;
  } catch (error) {
    console.error("Failed to predict all:", error);
    throw error;
  }
};

/**
 * Prediction Task Status
 */
export interface PredictionTaskStatus {
  task_id: string;
  status: "PENDING" | "PROGRESS" | "SUCCESS" | "FAILURE";
  message?: string;
  progress?: {
    step: string;
    series_uid?: string;
    progress: number;
  };
  result?: {
    status: string;
    result: any;
    message: string;
  };
  error?: string;
}

/**
 * Get Prediction Task Status
 * GET /api/ai/bentoml/prediction/status/{task_id}/
 */
export const getPredictionTaskStatus = async (
  taskId: string
): Promise<PredictionTaskStatus> => {
  try {
    const response = await apiClient.get<PredictionTaskStatus>(
      `ai/bentoml/prediction/status/${taskId}/`
    );
    return response.data;
  } catch (error) {
    console.error("Failed to get prediction task status:", error);
    throw error;
  }
};

// ===========================
// Clinical Data Utilities
// ===========================

/**
 * Clinical Data Builder Parameters
 */
export interface ClinicalDataParams {
  age?: number | null;
  gender?: string | null; // "M" or "F"
  grade?: string | null; // "G1", "G2", "G3", "G4"
  vascularInvasion?: string | null; // "Yes", "No", "Micro", "Macro"
  ishakScore?: number | null;
  afp?: number | null;
  albumin?: number | null;
  bilirubinTotal?: number | null;
  platelet?: number | null;
  inr?: number | null;
  creatinine?: number | null;
}

/**
 * 성별 매핑 함수
 * M = 1, F = 0
 */
const mapGender = (gender?: string | null): number => {
  if (!gender) return 0;
  const g = gender.trim().toUpperCase();
  return g === 'M' ? 1 : 0;
};

/**
 * Grade 매핑 함수
 * G1 = 1, G2 = 2, G3 = 3, G4 = 4
 */
const mapGrade = (grade?: string | null): number => {
  if (!grade) return 0;
  const g = grade.trim().toUpperCase();
  const match = g.match(/G(\d)/);
  if (match) {
    const num = parseInt(match[1]);
    return num >= 1 && num <= 4 ? num : 0;
  }
  return 0;
};

/**
 * Vascular Invasion 매핑 함수
 * "None" or "No" = 0, "Yes" or "Micro" = 1, "Macro" = 2
 */
const mapVascularInvasion = (vi?: string | null): number => {
  if (!vi) return 0;
  const v = vi.trim().toUpperCase();
  if (v === 'NONE' || v === 'NO') return 0;
  if (v === 'MACRO') return 2;
  if (v === 'YES' || v === 'MICRO') return 1;
  return 0;
};

/**
 * Clinical 데이터를 11개 변수 배열로 구성
 * 순서: age, sex, grade, vascular_invasion, ishak_fibrosis_score,
 *      afp_at_procurement, serum_albumin_preresection, bilirubin_total,
 *      platelet_count_preresection, prothrombin_time_inr_at_procurement,
 *      creatinine_level_preresection
 */
export const buildClinicalArray = (params: ClinicalDataParams): number[] => {
  return [
    params.age ?? 0,
    mapGender(params.gender),
    mapGrade(params.grade),
    mapVascularInvasion(params.vascularInvasion),
    params.ishakScore ?? 0,
    params.afp ?? 0,
    params.albumin ?? 0,
    params.bilirubinTotal ?? 0,
    params.platelet ?? 0,
    params.inr ?? 0,
    params.creatinine ?? 0,
  ];
};

/**
 * mRNA pathway scores를 20개 변수 배열로 변환
 * Record<string, number> 또는 number[]를 number[]로 변환
 */
export const buildMRNAArray = (
  pathwayScores?: Record<string, number> | number[] | null
): number[] => {
  if (!pathwayScores) return [];

  if (Array.isArray(pathwayScores)) {
    return pathwayScores;
  }

  // Record<string, number>인 경우 값들을 배열로 변환
  return Object.values(pathwayScores);
};


// ===========================
// DDI (Drug-Drug Interaction) API
// ===========================

/**
 * DDI 분석 결과 데이터 구조
 */
export interface DDIAnalysisResponse {
  cases: {
    standard_dur: {
      found: boolean;
      description: string;
    };
    ai_personalized: {
      found: boolean;
      description: string;
      mechanism: string;
      risk_level: 'RED' | 'YELLOW' | 'GREEN';
      alternatives: string[];
    };
  };
}

/**
 * DDI 상호작용 분석 요청
 * POST /api/ai/bentoml/ddi/analyze/
 */
export const analyzeDDI = async (drugs: string[]): Promise<DDIAnalysisResponse> => {
  try {
    // apiClient는 내부적으로 'api/'를 base로 가질 것이므로 'doctor/ddi/analyze/'만 적습니다.
    const response = await apiClient.post<DDIAnalysisResponse>(
      "ai/bentoml/ddi/analyze/",
      { drugs }
    );
    return response.data;
  } catch (error) {
    console.error("Failed to analyze DDI:", error);
    throw error;
  }
};
