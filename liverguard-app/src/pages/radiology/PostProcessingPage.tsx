// src/pages/radiology/PostProcessingPage.tsx
import React, { useState, useEffect, useRef } from 'react';
import PatientHeader from '../../components/radiology/PatientHeader';
import SeriesListSidebar from '../../components/radiology/SeriesListSidebar';
import MaskOverlayViewer from '../../components/radiology/MaskOverlayViewer';
import {
  getSeriesList,
  getSeriesInstances,
  createSegmentationMask,
  getSegmentationTaskStatus,
  getSeriesInfo,
  getInstanceInfo,
  getStudyInfo
} from '../../api/orthanc_api';
import './PostProcessingPage.css';

interface Series {
  id: string;
  data: {
    ID: string;
    PatientMainDicomTags?: {
      PatientName?: string;
      PatientID?: string;
      PatientSex?: string;
      PatientBirthDate?: string;
    };
    StudyMainDicomTags?: {
      StudyDate?: string;
    };
    MainDicomTags: {
      Modality?: string;
      SeriesDescription?: string;
      SeriesNumber?: string;
      SeriesDate?: string;
      StudyDate?: string;
    };
    Instances?: string[];
    ParentStudy?: string;
  };
}

interface Instance {
  ID: string;
  MainDicomTags: {
    InstanceNumber?: string;
    SOPInstanceUID?: string;
  };
  PatientMainDicomTags?: {
    PatientName?: string;
    PatientID?: string;
    PatientSex?: string;
    PatientBirthDate?: string;
  };
}

const PostProcessingPage: React.FC = () => {
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null);
  const [seriesInstances, setSeriesInstances] = useState<Instance[]>([]);
  const [isLoadingSeries, setIsLoadingSeries] = useState<boolean>(false);
  const [isLoadingInstances, setIsLoadingInstances] = useState<boolean>(false);

  // Segmentation mask state
  const [maskSeriesId, setMaskSeriesId] = useState<string | null>(null);
  const [maskInstances, setMaskInstances] = useState<Instance[]>([]);
  const [isCreatingMask, setIsCreatingMask] = useState<boolean>(false);
  const [maskProgress, setMaskProgress] = useState<string>('');
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [showOverlay, setShowOverlay] = useState<boolean>(true);
  const [selectedSeriesInfo, setSelectedSeriesInfo] = useState<Series['data'] | null>(null);
  const [selectedStudyInfo, setSelectedStudyInfo] = useState<any | null>(null);
  const studyCacheRef = useRef<Map<string, any>>(new Map());

  const formatDicomDate = (date?: string) => {
    if (!date) return 'N/A';
    if (date.length === 8) {
      return `${date.substring(0, 4)}-${date.substring(4, 6)}-${date.substring(6, 8)}`;
    }
    return date;
  };

  const formatPatientName = (name?: string) => {
    if (!name) return 'N/A';
    return name.replace(/\^/g, ' ').trim();
  };

  const selectedSeries = selectedSeriesId
    ? seriesList.find((series) => series.id === selectedSeriesId)
    : null;
  const patientTags =
    selectedStudyInfo?.PatientMainDicomTags ||
    selectedSeriesInfo?.PatientMainDicomTags ||
    selectedSeries?.data.PatientMainDicomTags;
  const mainTags = selectedSeriesInfo?.MainDicomTags || selectedSeries?.data.MainDicomTags;
  const studyTags =
    selectedStudyInfo?.MainDicomTags ||
    selectedStudyInfo?.StudyMainDicomTags ||
    selectedSeriesInfo?.StudyMainDicomTags ||
    selectedSeries?.data.StudyMainDicomTags;

  // Fetch series list from Orthanc on component mount
  useEffect(() => {
    const fetchSeriesList = async () => {
      setIsLoadingSeries(true);
      try {
        const data = await getSeriesList();
        setSeriesList(data);
      } catch (error) {
        console.error('Failed to fetch series list:', error);
      } finally {
        setIsLoadingSeries(false);
      }
    };

    fetchSeriesList();
  }, []);

  // Fetch instances when a series is selected
  useEffect(() => {
    if (!selectedSeriesId) {
      setSeriesInstances([]);
      setSelectedSeriesInfo(null);
      setSelectedStudyInfo(null);
      return;
    }

    const fetchInstances = async () => {
      setIsLoadingInstances(true);
      try {
        const [instances, seriesInfo] = await Promise.all([
          getSeriesInstances(selectedSeriesId),
          getSeriesInfo(selectedSeriesId),
        ]);
        setSeriesInstances(instances);

        console.log('PostProcessingPage: seriesInfo metadata', seriesInfo);
        let mergedInfo = seriesInfo as Series['data'];

        const hasPatientTags = Boolean(mergedInfo?.PatientMainDicomTags?.PatientID);
        if (!hasPatientTags && instances.length > 0) {
          const instanceInfo = await getInstanceInfo(instances[0].ID);
          console.log('PostProcessingPage: instanceInfo metadata', instanceInfo);
          mergedInfo = {
            ...mergedInfo,
            PatientMainDicomTags:
              instanceInfo?.PatientMainDicomTags ||
              instanceInfo?.MainDicomTags ||
              mergedInfo?.PatientMainDicomTags,
          };
        }

        setSelectedSeriesInfo(mergedInfo);

        if (mergedInfo?.ParentStudy) {
          const cached = studyCacheRef.current.get(mergedInfo.ParentStudy);
          if (cached) {
            setSelectedStudyInfo(cached);
          } else {
            try {
              const studyInfo = await getStudyInfo(mergedInfo.ParentStudy);
              console.log('PostProcessingPage: studyInfo metadata', studyInfo);
              studyCacheRef.current.set(mergedInfo.ParentStudy, studyInfo);
              setSelectedStudyInfo(studyInfo);
            } catch (studyError) {
              console.error('Failed to fetch study metadata:', studyError);
              setSelectedStudyInfo(null);
            }
          }
        } else {
          setSelectedStudyInfo(null);
        }
      } catch (error) {
        console.error('Failed to fetch series instances:', error);
        setSeriesInstances([]);
        setSelectedSeriesInfo(null);
        setSelectedStudyInfo(null);
      } finally {
        setIsLoadingInstances(false);
      }
    };

    fetchInstances();
  }, [selectedSeriesId]);

  // Poll task status
  useEffect(() => {
    if (!currentTaskId) return;

    const pollInterval = setInterval(async () => {
      try {
        const taskStatus = await getSegmentationTaskStatus(currentTaskId);

        if (taskStatus.status === 'PROGRESS' && taskStatus.progress) {
          setMaskProgress(`${taskStatus.progress.step} (${taskStatus.progress.progress}%)`);
        } else if (taskStatus.status === 'SUCCESS' && taskStatus.result) {
          // Celery task completed - check internal status
          const result = taskStatus.result as any;
          if (result.status === 'failed') {
            // AI processing failed
            setMaskProgress(`Error: ${result.error || 'AI processing failed'}`);
            setIsCreatingMask(false);
            setCurrentTaskId(null);
            clearInterval(pollInterval);
          } else if (result.status === 'success' && result.result?.mask_series_id) {
            // Success - mask created
            const resultMaskSeriesId = result.result.mask_series_id;
            setMaskSeriesId(resultMaskSeriesId);
            setMaskProgress('Segmentation completed!');
            setIsCreatingMask(false);
            setCurrentTaskId(null);

            // Fetch mask instances
            const instances = await getSeriesInstances(resultMaskSeriesId);
            setMaskInstances(instances);

            clearInterval(pollInterval);
          }
        } else if (taskStatus.status === 'FAILURE') {
          // Celery task itself failed
          setMaskProgress(`Error: ${taskStatus.error || 'Task execution failed'}`);
          setIsCreatingMask(false);
          setCurrentTaskId(null);
          clearInterval(pollInterval);
        }
      } catch (error) {
        console.error('Failed to poll task status:', error);
      }
    }, 10000); // Poll every 10 seconds

    return () => clearInterval(pollInterval);
  }, [currentTaskId]);

  const handleCreateSegMask = async () => {
    if (!selectedSeriesId) {
      alert('Please select a series first');
      return;
    }

    if (isCreatingMask) {
      alert('Segmentation is already in progress');
      return;
    }

    try {
      setIsCreatingMask(true);
      setMaskProgress('Starting segmentation...');

      const response = await createSegmentationMask(selectedSeriesId);
      setCurrentTaskId(response.task_id);
      setMaskProgress('Task created, processing...');
    } catch (error) {
      console.error('Failed to create segmentation mask:', error);
      alert('Failed to start segmentation task');
      setIsCreatingMask(false);
      setMaskProgress('');
    }
  };

  const handleLoadSegMask = () => {
    console.log('Load Seg-Mask clicked');
    // TODO: Implement load mask logic
  };

  return (
    <div className="post-processing-page">
      <PatientHeader
        patientId={patientTags?.PatientID || 'N/A'}
        patientName={formatPatientName(patientTags?.PatientName)}
        gender={patientTags?.PatientSex || 'N/A'}
        birthDate={formatDicomDate(patientTags?.PatientBirthDate)}
        examType={mainTags?.SeriesDescription || mainTags?.Modality || 'N/A'}
        examDate={formatDicomDate(mainTags?.SeriesDate || studyTags?.StudyDate)}
      />

      <div className="post-processing-content">
        <SeriesListSidebar
          seriesList={seriesList}
          selectedSeriesId={selectedSeriesId}
          onSeriesSelect={setSelectedSeriesId}
          isLoading={isLoadingSeries}
        />

        <div className="main-content">
          <div className="top-section">
            <div className="mask-panel">
              <h3>뷰어 {maskSeriesId && maskInstances.length > 0 && (
                <label className="overlay-toggle">
                  <input
                    type="checkbox"
                    checked={showOverlay}
                    onChange={(e) => setShowOverlay(e.target.checked)}
                  />
                  <span>Overlay 표시</span>
                </label>
              )}</h3>
              <div className="mask-viewer">
                {isCreatingMask ? (
                  <div className="loading-state">
                    <div className="loading-spinner" aria-label="Loading" />
                  </div>
                ) : isLoadingInstances ? (
                  <div className="loading-state">Loading images...</div>
                ) : selectedSeriesId && seriesInstances.length > 0 ? (
                  <MaskOverlayViewer
                    seriesId={selectedSeriesId}
                    instances={seriesInstances}
                    maskSeriesId={maskSeriesId ?? ''}
                    maskInstances={maskInstances}
                    showOverlay={showOverlay && Boolean(maskSeriesId) && maskInstances.length > 0}
                  />
                ) : (
                  <div className="empty-state">Series를 선택하세요</div>
                )}
              </div>
              <div className="mask-buttons">
                <button
                  className="btn-create-mask"
                  onClick={handleCreateSegMask}
                  disabled={isCreatingMask || !selectedSeriesId}
                >
                  {isCreatingMask ? 'Creating...' : 'Create Seg-Mask'}
                </button>
                <button className="btn-load-mask" onClick={handleLoadSegMask}>
                  Load Seg-Mask
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bottom-toolbar">
        <button className="toolbar-btn">⊞</button>
        <button className="toolbar-btn">⊟</button>
        <button className="toolbar-btn">▲</button>
      </div>
    </div>
  );
};

export default PostProcessingPage;
