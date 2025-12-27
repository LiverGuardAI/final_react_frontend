// src/api/orthanc_api.tsx
import apiClient from "./axiosConfig";

export interface UploadDicomResponse {
  ID: string;
  Path: string;
  Status: string;
}

/**
 * DICOM 파일을 Django를 통해 Orthanc 서버에 업로드
 * POST /api/orthanc/upload/
 *
 * @param file - 업로드할 DICOM 파일
 * @returns 업로드된 인스턴스 정보
 */
export const uploadDicomFile = async (file: File): Promise<UploadDicomResponse> => {
  try {
    // FormData로 파일 전송
    const formData = new FormData();
    formData.append('file', file);

    // Django API를 통해 Orthanc에 업로드
    const response = await apiClient.post<UploadDicomResponse>(
      'orthanc/upload/',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error('Failed to upload DICOM file:', error);
    throw error;
  }
};

/**
 * 여러 DICOM 파일을 Orthanc 서버에 업로드
 *
 * @param files - 업로드할 DICOM 파일 배열
 * @returns 업로드된 인스턴스 정보 배열
 */
export const uploadMultipleDicomFiles = async (files: File[]): Promise<UploadDicomResponse[]> => {
  const uploadPromises = files.map(file => uploadDicomFile(file));
  return Promise.all(uploadPromises);
};

/**
 * Orthanc 시스템 정보 조회
 * GET /api/orthanc/system/
 */
export const getOrthancSystemInfo = async () => {
  const response = await apiClient.get('orthanc/system/');
  return response.data;
};

/**
 * 특정 Study 정보 조회
 * GET /api/orthanc/studies/{id}/
 */
export const getStudyInfo = async (studyId: string) => {
  const response = await apiClient.get(`orthanc/studies/${studyId}/`);
  return response.data;
};

/**
 * 특정 Instance 정보 조회
 * GET /api/orthanc/instances/{id}/
 */
export const getInstanceInfo = async (instanceId: string) => {
  const response = await apiClient.get(`orthanc/instances/${instanceId}/`);
  return response.data;
};

/**
 * 모든 Series 목록 조회
 * GET /api/orthanc/series/
 */
export const getSeriesList = async () => {
  const response = await apiClient.get('orthanc/series/');
  return response.data;
};

/**
 * 특정 Series 정보 조회
 * GET /api/orthanc/series/{id}/
 */
export const getSeriesInfo = async (seriesId: string) => {
  const response = await apiClient.get(`orthanc/series/${seriesId}/`);
  return response.data;
};

/**
 * 특정 Series의 모든 Instances 조회
 * GET /api/orthanc/series/{id}/instances/
 */
export const getSeriesInstances = async (seriesId: string) => {
  const response = await apiClient.get(`orthanc/series/${seriesId}/instances/`);
  return response.data;
};

/**
 * Instance 파일 URL 생성
 * GET /api/orthanc/instances/{id}/file/
 */
export const getInstanceFileUrl = (instanceId: string): string => {
  const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/';
  return `${baseURL}orthanc/instances/${instanceId}/file/`;
};

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

export const createSegmentationMask = async (seriesId: string): Promise<CreateSegmentationResponse> => {
  try {
    const response = await apiClient.post<CreateSegmentationResponse>(
      'ai/mosec/segmentation/create/',
      {
        series_id: seriesId
      }
    );
    return response.data;
  } catch (error) {
    console.error('Failed to create segmentation mask:', error);
    throw error;
  }
};

/**
 * Segmentation Task 상태 조회
 * GET /api/ai/mosec/segmentation/status/{task_id}/
 */
export interface SegmentationTaskStatus {
  task_id: string;
  status: 'PENDING' | 'PROGRESS' | 'SUCCESS' | 'FAILURE';
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

export const getSegmentationTaskStatus = async (taskId: string): Promise<SegmentationTaskStatus> => {
  try {
    const response = await apiClient.get<SegmentationTaskStatus>(
      `ai/mosec/segmentation/status/${taskId}/`
    );
    return response.data;
  } catch (error) {
    console.error('Failed to get task status:', error);
    throw error;
  }
};