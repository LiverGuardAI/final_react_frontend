// src/pages/radiology/AcquisitionPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as dcmjs from 'dcmjs';
import PatientHeader from '../../components/radiology/PatientHeader';
import PatientQueueSidebar from '../../components/radiology/PatientQueueSidebar';
import SimpleDicomViewer from '../../components/radiology/SimpleDicomViewer';
import type { SelectedPatientData } from '../../components/radiology/PatientQueueSidebar';
import { getWaitlist } from '../../api/radiology_api';
import type { Patient as APIPatient } from '../../api/radiology_api';
import { uploadMultipleDicomFiles } from '../../api/orthanc_api';
import './AcquisitionPage.css';

const AcquisitionPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [selectedPatientData, setSelectedPatientData] = useState<SelectedPatientData | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [dicomFiles, setDicomFiles] = useState<File[]>([]);
  const [selectedFileNames, setSelectedFileNames] = useState<Set<string>>(new Set());
  const [uploadedInstances, setUploadedInstances] = useState<any[]>([]);
  const [uploadedSeriesId, setUploadedSeriesId] = useState<string>('');
  const [isLoadingPreview, setIsLoadingPreview] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const hasUploadedPreview = uploadedInstances.length > 0;
  const hasLocalPreview = dicomFiles.length > 0;
  const showUploadedPreview = hasUploadedPreview;
  const showLocalPreview = !showUploadedPreview && hasLocalPreview;
  const previewTitle = showUploadedPreview ? '업로드 미리보기' : hasLocalPreview ? '로컬 미리보기' : '업로드 미리보기';

  // 촬영중인 환자 자동 표시
  useEffect(() => {
    const fetchFilmingPatient = async () => {
      try {
        const response = await getWaitlist();
        const hasValidList = Array.isArray(response?.patients) || Array.isArray((response as any)?.results);
        const responsePatients: APIPatient[] = Array.isArray(response?.patients)
          ? response.patients
          : Array.isArray((response as any)?.results)
            ? (response as any).results
            : [];
        if (!hasValidList) {
          console.warn('Unexpected waitlist response shape:', response);
          setSelectedPatientId('');
          setSelectedPatientData(null);
          return;
        }
        const hasInProgressOrder = (patient: APIPatient) =>
          Array.isArray(patient?.imaging_orders) &&
          patient.imaging_orders.some((order: any) => order?.status === 'IN_PROGRESS');
        const isFilmingPatient = (patient: APIPatient) => {
          if (hasInProgressOrder(patient)) {
            return true;
          }
          if (patient?.workflow_state === 'IN_IMAGING') {
            return true;
          }
          if (patient?.current_status === '촬영중') {
            return true;
          }
          if (patient?.workflow_state_display === '촬영중') {
            return true;
          }
          return false;
        };
        const buildExamType = (orders: Array<Record<string, any>> | undefined) => {
          if (!Array.isArray(orders) || orders.length === 0) {
            return 'N/A';
          }
          const labels = orders
            .map((order) => {
              const modality = typeof order?.modality === 'string' ? order.modality.trim() : '';
              const bodyPart = typeof order?.body_part === 'string' ? order.body_part.trim() : '';
              if (modality && bodyPart && bodyPart !== 'N/A') {
                return `${modality} ${bodyPart}`;
              }
              if (modality) {
                return modality;
              }
              if (bodyPart && bodyPart !== 'N/A') {
                return bodyPart;
              }
              return '';
            })
            .filter((label) => label.length > 0);
          const uniqueLabels = Array.from(new Set(labels));
          return uniqueLabels.length > 0 ? uniqueLabels.join(' / ') : 'N/A';
        };
        const extractOrderNotes = (patient: any): string[] => {
          if (!Array.isArray(patient?.imaging_orders)) {
            return [];
          }
          return patient.imaging_orders
            .map((order: any) => order?.order_notes)
            .filter((note: any) => typeof note === 'string' && note.trim().length > 0);
        };
        const extractOrderMeta = (patient: any) => {
          if (!Array.isArray(patient?.imaging_orders)) {
            return { modality: undefined, bodyPart: undefined };
          }
          for (const order of patient.imaging_orders) {
            const modality = typeof order?.modality === 'string' ? order.modality.trim() : '';
            const bodyPart = typeof order?.body_part === 'string' ? order.body_part.trim() : '';
            if (modality || bodyPart) {
              return {
                modality: modality || undefined,
                bodyPart: bodyPart && bodyPart !== 'N/A' ? bodyPart : undefined,
              };
            }
          }
          return { modality: undefined, bodyPart: undefined };
        };
        // 촬영중인 환자 찾기
        const filmingPatient = responsePatients.find((p) => isFilmingPatient(p));

        if (filmingPatient) {
          // 촬영중인 환자 정보 설정
          const patientData: SelectedPatientData = {
            patientId: filmingPatient.patient_id,
            patientName: filmingPatient.patient_name || filmingPatient.name || 'N/A',
            gender: filmingPatient.gender || 'N/A',
            birthDate: filmingPatient.date_of_birth || 'N/A',
            age: filmingPatient.age ?? null,
            orderNotes: extractOrderNotes(filmingPatient),
            examType: buildExamType(filmingPatient.imaging_orders),
            ...extractOrderMeta(filmingPatient),
            studyInstanceUid: filmingPatient.active_study_uid || undefined,
            encounterId: filmingPatient.encounter_id ?? undefined,
          };
          setSelectedPatientId(filmingPatient.patient_id);
          setSelectedPatientData(patientData);
        } else {
          // 촬영중인 환자가 없으면 초기화
          setSelectedPatientId('');
          setSelectedPatientData(null);
        }
      } catch (error) {
        console.error('Failed to fetch filming patient:', error);
      }
    };

    fetchFilmingPatient();
  }, []);

  useEffect(() => {
    if (selectedFileNames.size === 0) {
      return;
    }
    const currentNames = new Set(dicomFiles.map((file) => file.name));
    const nextSelected = new Set<string>();
    selectedFileNames.forEach((name) => {
      if (currentNames.has(name)) {
        nextSelected.add(name);
      }
    });
    if (nextSelected.size !== selectedFileNames.size) {
      setSelectedFileNames(nextSelected);
    }
  }, [dicomFiles, selectedFileNames]);

  const handlePatientSelect = (patientId: string, patientData: SelectedPatientData) => {
    setSelectedPatientId(patientId);
    setSelectedPatientData(patientData);
  };

  const handleGoToHome = () => {
    navigate('/radiology/home');
  };

  const handleGoToPostProcessing = () => {
    const encounterId = selectedPatientData?.encounterId;
    if (!encounterId) {
      alert('촬영 중인 환자가 없습니다.');
      return;
    }
    const params = new URLSearchParams({ encounter_id: String(encounterId) });
    navigate(`/radiology/post-processing?${params.toString()}`);
  };

  const handleAddFiles = (files: FileList | null, type: 'file' | 'folder') => {
    if (!files || files.length === 0) {
      return;
    }

    // DICOM 또는 ZIP 파일만 필터링
    const newDicomFiles = Array.from(files).filter(file => {
      const lowerName = file.name.toLowerCase();
      return lowerName.endsWith('.dcm') || lowerName.endsWith('.dicom') || lowerName.endsWith('.zip');
    });

    if (newDicomFiles.length === 0) {
      alert('DICOM 파일(.dcm, .dicom) 또는 ZIP(.zip)만 업로드 가능합니다.');
      return;
    }

    // 기존 파일 목록에 추가 (중복 체크)
    setDicomFiles(prevFiles => {
      const existingFileNames = new Set(prevFiles.map(f => f.name));
      const uniqueNewFiles = newDicomFiles.filter(f => !existingFileNames.has(f.name));

      if (uniqueNewFiles.length < newDicomFiles.length) {
        alert(`${newDicomFiles.length - uniqueNewFiles.length}개의 중복 파일은 제외되었습니다.`);
      }

      if (uniqueNewFiles.length > 0) {
        setSelectedFileNames(prevSelected => {
          const next = new Set(prevSelected);
          uniqueNewFiles.forEach((file) => next.add(file.name));
          return next;
        });
      }

      return [...prevFiles, ...uniqueNewFiles];
    });

    const uploadType = type === 'folder' ? '폴더' : '파일';
    console.log(`Added ${newDicomFiles.length} DICOM files from ${uploadType}`);
  };

  const handleRemoveFile = (index: number) => {
    setDicomFiles(prevFiles => prevFiles.filter((_, i) => i !== index));
  };

  const handleSaveFiles = async () => {
    if (dicomFiles.length === 0) {
      alert('업로드할 파일이 없습니다.');
      return;
    }

    if (!selectedPatientId) {
      alert('촬영 중인 환자가 없습니다.');
      return;
    }

    const filesToUpload = dicomFiles.filter((file) => selectedFileNames.has(file.name));
    if (filesToUpload.length === 0) {
      alert('선택된 파일이 없습니다.');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      let studyInstanceUid = selectedPatientData?.studyInstanceUid;
      if (!studyInstanceUid) {
        studyInstanceUid = generateDicomUid();
        setSelectedPatientData((prev) =>
          prev ? { ...prev, studyInstanceUid } : prev
        );
      }
      const studyDate = formatDicomDateFromDate(new Date());
      const seriesInstanceUid = generateDicomUid();
      const dicomOverrides = {
        patientId: selectedPatientId,
        birthDate: selectedPatientData?.birthDate,
        gender: selectedPatientData?.gender,
        modality: selectedPatientData?.modality,
        bodyPart: selectedPatientData?.bodyPart,
        studyInstanceUid,
        seriesInstanceUid,
        studyDate,
      };
      const updatedFiles = await Promise.all(
        filesToUpload.map((file) => updateDicomMetadata(file, dicomOverrides))
      );

      console.log(`Uploading ${updatedFiles.length} file(s) to Orthanc...`);
      const results = await uploadMultipleDicomFiles(updatedFiles, {
        concurrency: 4,
        onProgress: (progress) => {
          setUploadProgress(progress.percent);
        },
      });

      console.log('Upload successful:', results);
      alert(`${filesToUpload.length}개의 DICOM 파일이 성공적으로 업로드되었습니다.`);

      setIsLoadingPreview(false);
      setUploadedInstances(results);
      setUploadedSeriesId(seriesInstanceUid);

      // 업로드 성공 후 선택된 파일만 목록에서 제거
      setDicomFiles((prevFiles) => prevFiles.filter((file) => !selectedFileNames.has(file.name)));
      setSelectedFileNames((prevSelected) => {
        const next = new Set(prevSelected);
        filesToUpload.forEach((file) => next.delete(file.name));
        return next;
      });
    } catch (error) {
      console.error('Upload failed:', error);
      alert('DICOM 파일 업로드에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleAddFiles(event.target.files, 'file');
    event.target.value = '';
  };

  const handleFolderUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleAddFiles(event.target.files, 'folder');
    event.target.value = '';
  };

  const handleToggleSelectAll = () => {
    if (dicomFiles.length === 0) {
      return;
    }
    if (selectedFileNames.size === dicomFiles.length) {
      setSelectedFileNames(new Set());
      return;
    }
    setSelectedFileNames(new Set(dicomFiles.map((file) => file.name)));
  };

  const handleToggleFileSelection = (fileName: string) => {
    setSelectedFileNames((prev) => {
      const next = new Set(prev);
      if (next.has(fileName)) {
        next.delete(fileName);
      } else {
        next.add(fileName);
      }
      return next;
    });
  };

  const handleDeleteSelected = () => {
    if (selectedFileNames.size === 0) {
      return;
    }
    setDicomFiles((prevFiles) => prevFiles.filter((file) => !selectedFileNames.has(file.name)));
    setSelectedFileNames(new Set());
  };

  type DicomOverrides = {
    patientId: string;
    birthDate?: string;
    gender?: string;
    modality?: string;
    bodyPart?: string;
    studyInstanceUid?: string;
    seriesInstanceUid?: string;
    studyDate?: string;
  };

  const generateDicomUid = () => {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      const hex = Array.from(bytes)
        .map((value) => value.toString(16).padStart(2, '0'))
        .join('');
      const uidInt = BigInt(`0x${hex}`);
      return `2.25.${uidInt.toString()}`;
    }
    return `2.25.${Date.now()}${Math.floor(Math.random() * 1e9)}`;
  };

  const formatDicomDate = (value?: string) => {
    if (!value || value === 'N/A') return undefined;
    const digits = value.replace(/\D/g, '');
    if (digits.length >= 8) {
      return digits.slice(0, 8);
    }
    return undefined;
  };

  const formatDicomDateFromDate = (date: Date) => {
    const year = date.getFullYear().toString().padStart(4, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}${month}${day}`;
  };

  const formatDicomSex = (value?: string) => {
    if (!value || value === 'N/A') return undefined;
    const normalized = value.toLowerCase();
    if (normalized === 'm' || normalized === 'male' || normalized === '남') return 'M';
    if (normalized === 'f' || normalized === 'female' || normalized === '여') return 'F';
    if (normalized === 'o' || normalized === 'other') return 'O';
    return undefined;
  };

  const updateDicomMetadata = async (file: File, overrides: DicomOverrides): Promise<File> => {
    const lowerName = file.name.toLowerCase();
    if (!(lowerName.endsWith('.dcm') || lowerName.endsWith('.dicom'))) {
      return file;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const dicomData: any = (dcmjs as any).data.DicomMessage.readFile(arrayBuffer);
      const dataset = (dcmjs as any).data.DicomMetaDictionary.naturalizeDataset(dicomData.dict);

      dataset.PatientID = overrides.patientId;
      dataset.PatientName = overrides.patientId;

      const dicomBirthDate = formatDicomDate(overrides.birthDate);
      if (dicomBirthDate) {
        dataset.PatientBirthDate = dicomBirthDate;
      }
      const dicomSex = formatDicomSex(overrides.gender);
      if (dicomSex) {
        dataset.PatientSex = dicomSex;
      }
      if (overrides.studyInstanceUid) {
        dataset.StudyInstanceUID = overrides.studyInstanceUid;
      }
      if (overrides.seriesInstanceUid) {
        dataset.SeriesInstanceUID = overrides.seriesInstanceUid;
      }
      if (overrides.studyDate) {
        dataset.StudyDate = overrides.studyDate;
        dataset.SeriesDate = overrides.studyDate;
        dataset.AcquisitionDate = overrides.studyDate;
      }
      if (overrides.modality && overrides.modality !== 'N/A') {
        dataset.Modality = overrides.modality;
      }
      if (overrides.bodyPart && overrides.bodyPart !== 'N/A') {
        dataset.BodyPartExamined = overrides.bodyPart;
      }

      const denormalized = (dcmjs as any).data.DicomMetaDictionary.denaturalizeDataset(dataset);
      const dicomDict = new (dcmjs as any).data.DicomDict(dicomData.meta);
      dicomDict.dict = denormalized;
      const updatedBuffer = dicomDict.write();

      return new File([updatedBuffer], file.name, {
        type: file.type || 'application/dicom',
      });
    } catch (error) {
      console.error('Failed to update DICOM metadata:', error);
      return file;
    }
  };

  return (
    <div className="acquisition-page">
      <div className="header-container">
        {selectedPatientData ? (
          <PatientHeader
            patientId={selectedPatientData.patientId}
            patientName={selectedPatientData.patientName}
            gender={selectedPatientData.gender}
            birthDate={selectedPatientData.birthDate}
            examType={selectedPatientData.examType || 'N/A'}
            examDate={new Date().toLocaleString('ko-KR')}
            onBrandClick={handleGoToHome}
            actionButton={
              <button className="header-action-button" onClick={handleGoToPostProcessing}>
                후처리 이동
              </button>
            }
          />
        ) : (
          <div className="patient-header patient-header-empty">
            <button
              type="button"
              className="patient-header-brand clickable"
              aria-label="LiverGuard"
              onClick={handleGoToHome}
            >
              LiverGuard
            </button>
            <div className="patient-header-content">
              <div className="patient-info-item">
                <span className="value">환자를 선택해주세요</span>
              </div>
            </div>
            <div className="header-action-group">
              <button className="header-action-button" onClick={handleGoToPostProcessing}>
                후처리 이동
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="acquisition-content">
        <PatientQueueSidebar
          selectedPatientId={selectedPatientId}
          onPatientSelect={handlePatientSelect}
        />

        <div className="main-content">
          <div className="acquisition-panels">
            <div className="viewer-panel">
              <div className="viewer-panel-header">
                <h3>{previewTitle}</h3>
              </div>
              <div className="viewer-panel-body">
                {isLoadingPreview ? (
                  <div className="viewer-loading">로딩 중...</div>
                ) : showUploadedPreview ? (
                  <SimpleDicomViewer
                    seriesId={uploadedSeriesId || 'uploaded'}
                    instances={uploadedInstances}
                  />
                ) : showLocalPreview ? (
                  <SimpleDicomViewer
                    seriesId="local-preview"
                    files={dicomFiles}
                  />
                ) : (
                  <div className="viewer-empty">파일을 추가하면 미리보기가 표시됩니다.</div>
                )}
              </div>
            </div>

            <div className="file-list-container">
              <div className="file-list-header">
                <h3>업로드할 파일 목록 ({dicomFiles.length}개)</h3>
                <div className="header-buttons">
                  <label htmlFor="file-upload-add" className="add-file-button">
                    파일 업로드
                  </label>
                  <input
                    type="file"
                    id="file-upload-add"
                    multiple
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                    accept=".dcm,.dicom,.zip"
                    disabled={uploading}
                  />
                  <label htmlFor="folder-upload-add" className="add-file-button">
                    폴더 업로드
                  </label>
                  <input
                    type="file"
                    id="folder-upload-add"
                    onChange={handleFolderUpload}
                    style={{ display: 'none' }}
                    disabled={uploading}
                    {...({ webkitdirectory: '', directory: '' } as any)}
                  />
                  <button
                    className="add-file-button"
                    onClick={handleToggleSelectAll}
                    disabled={uploading || dicomFiles.length === 0}
                  >
                    모두 선택
                  </button>
                  <button
                    className="add-file-button"
                    onClick={handleDeleteSelected}
                    disabled={uploading || selectedFileNames.size === 0}
                  >
                    선택 삭제
                  </button>
                  <button
                    className="save-button"
                    onClick={handleSaveFiles}
                    disabled={uploading}
                  >
                    {uploading ? '저장 중...' : '저장'}
                  </button>
                </div>
              </div>
              <div className="file-list">
                {dicomFiles.length === 0 ? (
                  <div className="file-list-empty">업로드할 파일을 추가해주세요.</div>
                ) : (
                  dicomFiles.map((file, index) => (
                    <div key={index} className="file-item">
                      <label className="file-select">
                        <input
                          type="checkbox"
                          checked={selectedFileNames.has(file.name)}
                          onChange={() => handleToggleFileSelection(file.name)}
                          disabled={uploading}
                        />
                      </label>
                      <span className="file-name">{file.name}</span>
                      <span className="file-size">
                        {(file.size / 1024).toFixed(2)} KB
                      </span>
                      <button
                        className="remove-button"
                        onClick={() => handleRemoveFile(index)}
                        disabled={uploading}
                      >
                        삭제
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
            {uploading && (
              <div className="upload-overlay" aria-live="polite">
                <div className="upload-overlay-content">
                  <div className="upload-spinner" aria-label="Uploading" />
                  <div className="upload-message">업로드 중입니다... {uploadProgress}%</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AcquisitionPage;
