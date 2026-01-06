// src/pages/radiology/AcquisitionPage.tsx
import React, { useState, useEffect } from 'react';
import PatientHeader from '../../components/radiology/PatientHeader';
import PatientQueueSidebar from '../../components/radiology/PatientQueueSidebar';
import SimpleDicomViewer from '../../components/radiology/SimpleDicomViewer';
import type { SelectedPatientData } from '../../components/radiology/PatientQueueSidebar';
import { endFilming, getWaitlist } from '../../api/radiology_api';
import { uploadMultipleDicomFiles } from '../../api/orthanc_api';
import './AcquisitionPage.css';

const AcquisitionPage: React.FC = () => {
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [selectedPatientData, setSelectedPatientData] = useState<SelectedPatientData | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [dicomFiles, setDicomFiles] = useState<File[]>([]);
  const [selectedFileNames, setSelectedFileNames] = useState<Set<string>>(new Set());
  const [uploadedInstances, setUploadedInstances] = useState<any[]>([]);
  const [uploadedSeriesId, setUploadedSeriesId] = useState<string>('');
  const [isLoadingPreview, setIsLoadingPreview] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const hasLocalPreview = dicomFiles.length > 0;
  const hasUploadedPreview = uploadedInstances.length > 0 && dicomFiles.length === 0;

  // 촬영중인 환자 자동 표시
  useEffect(() => {
    const fetchFilmingPatient = async () => {
      try {
        const response = await getWaitlist();
        // 촬영중인 환자 찾기
        const filmingPatient = response.patients.find(p => p.current_status === '촬영중');

        if (filmingPatient) {
          // 촬영중인 환자 정보 설정
          const patientData: SelectedPatientData = {
            patientId: filmingPatient.patient_id,
            patientName: filmingPatient.name,
            gender: filmingPatient.gender || 'N/A',
            birthDate: filmingPatient.date_of_birth || 'N/A',
            age: filmingPatient.age,
            sampleId: filmingPatient.sample_id,
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

  const handleEndFilming = async () => {
    if (!selectedPatientId) {
      alert('촬영 중인 환자가 없습니다.');
      return;
    }

    try {
      await endFilming(selectedPatientId);
      alert('촬영이 종료되었습니다.');
      // 환자 선택 초기화
      setSelectedPatientId('');
      setSelectedPatientData(null);
      // 페이지 새로고침으로 대기 목록 갱신
      window.location.reload();
    } catch (error) {
      console.error('Failed to end filming:', error);
      alert('촬영 종료에 실패했습니다.');
    }
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

    setUploading(true);
    setUploadProgress(0);

    try {
      console.log(`Uploading ${dicomFiles.length} file(s) to Orthanc...`);
      const results = await uploadMultipleDicomFiles(dicomFiles, {
        concurrency: 4,
        onProgress: (progress) => {
          setUploadProgress(progress.percent);
        },
      });

      console.log('Upload successful:', results);
      alert(`${dicomFiles.length}개의 DICOM 파일이 성공적으로 업로드되었습니다.`);

      setIsLoadingPreview(false);
      setUploadedInstances([]);
      setUploadedSeriesId('');

      // 업로드 성공 후 파일 목록 초기화
      setDicomFiles([]);
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

  return (
    <div className="acquisition-page">
      <div className="header-container">
        {selectedPatientData ? (
          <PatientHeader
            patientId={selectedPatientData.patientId}
            patientName={selectedPatientData.patientName}
            gender={selectedPatientData.gender}
            birthDate={selectedPatientData.birthDate}
            examType="CT Abdomen"
            examDate={new Date().toLocaleString('ko-KR')}
            actionButton={
              <button className="end-filming-button" onClick={handleEndFilming}>
                촬영 종료
              </button>
            }
          />
        ) : (
          <div className="no-patient-selected">
            환자를 선택해주세요
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
                <h3>{hasLocalPreview ? '로컬 미리보기' : '업로드 미리보기'}</h3>
              </div>
              <div className="viewer-panel-body">
                {hasLocalPreview ? (
                  <SimpleDicomViewer
                    seriesId="local-preview"
                    files={dicomFiles}
                  />
                ) : isLoadingPreview ? (
                  <div className="viewer-loading">로딩 중...</div>
                ) : hasUploadedPreview ? (
                  <SimpleDicomViewer
                    seriesId={uploadedSeriesId || 'uploaded'}
                    instances={uploadedInstances}
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
