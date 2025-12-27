// src/pages/radiology/PostProcessingPage.tsx
import React, { useState, useEffect } from 'react';
import PatientHeader from '../../components/radiology/PatientHeader';
import SeriesListSidebar from '../../components/radiology/SeriesListSidebar';
import DicomViewer from '../../components/radiology/DicomViewer';
import {
  getSeriesList,
  getSeriesInstances,
  createSegmentationMask,
  getSegmentationTaskStatus
} from '../../api/orthanc_api';
import './PostProcessingPage.css';

interface Series {
  id: string;
  data: {
    ID: string;
    MainDicomTags: {
      Modality?: string;
      SeriesDescription?: string;
      SeriesNumber?: string;
      SeriesDate?: string;
    };
    Instances?: string[];
  };
}

interface Instance {
  ID: string;
  MainDicomTags: {
    InstanceNumber?: string;
    SOPInstanceUID?: string;
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
      return;
    }

    const fetchInstances = async () => {
      setIsLoadingInstances(true);
      try {
        const instances = await getSeriesInstances(selectedSeriesId);
        setSeriesInstances(instances);
      } catch (error) {
        console.error('Failed to fetch series instances:', error);
        setSeriesInstances([]);
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
        patientId="TCGA-BC-4073"
        patientName="홍길동"
        gender="M"
        birthDate="1998-10-08"
        examType="CT Abdomen"
        examDate="2025-12-11 11:17 AM"
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
            <div className="selected-series-panel">
              <h3>선택 Series</h3>
              <div className="series-viewer">
                {isLoadingInstances ? (
                  <div className="loading-state">Loading images...</div>
                ) : selectedSeriesId && seriesInstances.length > 0 ? (
                  <DicomViewer
                    seriesId={selectedSeriesId}
                    instances={seriesInstances}
                  />
                ) : (
                  <div className="empty-state">Series를 선택하세요</div>
                )}
              </div>
            </div>

            <div className="mask-panel">
              <h3>생성 Mask</h3>
              <div className="mask-viewer">
                {isCreatingMask ? (
                  <div className="loading-state">{maskProgress}</div>
                ) : maskSeriesId && maskInstances.length > 0 ? (
                  <DicomViewer
                    seriesId={maskSeriesId}
                    instances={maskInstances}
                  />
                ) : (
                  <div className="empty-state">Mask가 없습니다</div>
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
