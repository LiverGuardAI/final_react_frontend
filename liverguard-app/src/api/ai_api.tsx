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
