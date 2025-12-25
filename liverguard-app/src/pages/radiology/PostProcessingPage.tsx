// src/pages/radiology/PostProcessingPage.tsx
import React, { useState, useEffect } from 'react';
import PatientHeader from '../../components/radiology/PatientHeader';
import SeriesListSidebar from '../../components/radiology/SeriesListSidebar';
import DicomViewer from '../../components/radiology/DicomViewer';
import { getSeriesList, getSeriesInstances } from '../../api/orthanc_api';
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

  const handleCreateSegMask = () => {
    console.log('Create Seg-Mask clicked');
    // Seg-Mask 생성 로직 구현
  };

  const handleLoadSegMask = () => {
    console.log('Load Seg-Mask clicked');
    // Seg-Mask 로드 로직 구현
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
                <div className="empty-state">Mask가 없습니다</div>
              </div>
              <div className="mask-buttons">
                <button className="btn-create-mask" onClick={handleCreateSegMask}>
                  Create Seg-Mask
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
