// src/api/orthanc_api.tsx
import apiClient from "./axiosConfig";

export interface UploadDicomResponse {
  ID: string;
  Path: string;
  Status: string;
}

export interface UploadDicomBatchResponse {
  Status: string;
  Count: number;
  Instances: UploadDicomResponse[];
  Errors?: Array<{ file: string; error: string }>;
}

/**
 * DICOM 파일을 Django를 통해 Orthanc 서버에 업로드
 * POST /api/orthanc/upload/
 *
 * @param file - 업로드할 DICOM 파일
 * @returns 업로드된 인스턴스 정보
 */
type UploadProgress = {
  loaded: number;
  total: number;
  percent: number;
};

type UploadOptions = {
  onProgress?: (progress: UploadProgress) => void;
  concurrency?: number;
};

export const uploadDicomFile = async (
  file: File,
  onProgress?: (loaded: number) => void
): Promise<UploadDicomResponse[]> => {
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
        onUploadProgress: (event) => {
          if (typeof onProgress !== 'function') return;
          const loaded = Math.min(event.loaded ?? 0, file.size);
          onProgress(loaded);
        },
      }
    );

    const data = response.data as UploadDicomResponse | UploadDicomResponse[] | UploadDicomBatchResponse;

    if (Array.isArray(data)) {
      return data;
    }
    if ((data as UploadDicomBatchResponse).Instances) {
      return (data as UploadDicomBatchResponse).Instances;
    }
    return [data as UploadDicomResponse];
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
export const uploadMultipleDicomFiles = async (
  files: File[],
  options: UploadOptions = {}
): Promise<UploadDicomResponse[]> => {
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  const loadedByFile = new Array(files.length).fill(0);
  const concurrency = Math.max(1, options.concurrency ?? 4);

  const reportProgress = () => {
    if (!options.onProgress) return;
    const loaded = loadedByFile.reduce((sum, value) => sum + value, 0);
    const percent = totalBytes ? Math.round((loaded / totalBytes) * 100) : 0;
    options.onProgress({ loaded, total: totalBytes, percent });
  };

  const uploadSingle = async (file: File, index: number) => {
    const result = await uploadDicomFile(file, (loaded) => {
      loadedByFile[index] = loaded;
      reportProgress();
    });
    loadedByFile[index] = file.size;
    reportProgress();
    return result;
  };

  let cursor = 0;
  const results: UploadDicomResponse[][] = new Array(files.length);

  const worker = async () => {
    while (cursor < files.length) {
      const current = cursor;
      cursor += 1;
      results[current] = await uploadSingle(files[current], current);
    }
  };

  const workers = Array.from(
    { length: Math.min(concurrency, files.length) },
    () => worker()
  );

  await Promise.all(workers);
  return results.flat();
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
 * Series NIfTI 파일 URL 생성
 * GET /api/orthanc/series/{series_id}/nifti/
 */
export const getSeriesNiftiUrl = (seriesId: string): string => {
  const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/';
  return `${baseURL}orthanc/series/${seriesId}/nifti/`;
};

/**
 * Series Archive(ZIP) 다운로드
 * GET /api/orthanc/series/{series_id}/archive/
 */
export const getSeriesArchive = async (seriesId: string): Promise<ArrayBuffer> => {
  try {
    const response = await apiClient.get(`orthanc/series/${seriesId}/archive/`, {
      responseType: 'arraybuffer'
    });
    return response.data;
  } catch (error) {
    console.error('Failed to download series archive:', error);
    throw error;
  }
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
      'ai/mosec/extract-feature/',
      {
        seriesinstanceuid: seriesInstanceUid
      }
    );
    return response.data;
  } catch (error) {
    console.error('Failed to start feature extraction:', error);
    throw error;
  }
};

export interface FeatureExtractionTaskStatus {
  task_id: string;
  status: 'PENDING' | 'PROGRESS' | 'SUCCESS' | 'FAILURE';
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
    console.error('Failed to get feature extraction task status:', error);
    throw error;
  }
};

/**
 * 특정 환자의 모든 Studies 조회
 * GET /api/orthanc/patients/{patient_id}/studies/
 */
export const getPatientStudies = async (patientId: string) => {
  const response = await apiClient.get(`orthanc/patients/${patientId}/studies/`);
  return response.data;
};

/**
 * 특정 Study의 모든 Series 조회
 * GET /api/orthanc/studies/{study_id}/series/
 */
export const getStudySeries = async (studyId: string) => {
  const response = await apiClient.get(`orthanc/studies/${studyId}/series/`);
  return response.data;
};

/**
 * 특정 Series의 모든 Instances 조회
//  * GET /api/orthanc/series/{series_id}/instances/
//  */
// export const getSeriesInstances = async (seriesId: string) => {
//   const response = await apiClient.get(`orthanc/series/${seriesId}/instances/`);
//   return response.data;
// };

// /**
//  * 특정 Instance의 DICOM 파일 다운로드 URL 반환
//  * GET /api/orthanc/instances/{instance_id}/file/
//  */
// export const getInstanceFileUrl = (instanceId: string) => {
//   return `/api/orthanc/instances/${instanceId}/file/`;
// };
