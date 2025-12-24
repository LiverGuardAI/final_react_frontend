// src/pages/radiology/PostProcessingPage.tsx
import React, { useState } from 'react';
import PatientHeader from '../../components/radiology/PatientHeader';
import StudyListSidebar from '../../components/radiology/StudyListSidebar';
import './PostProcessingPage.css';

interface SeriesImage {
  id: string;
  name: string;
  thumbnail: string;
}

const PostProcessingPage: React.FC = () => {
  const [selectedStudyId, setSelectedStudyId] = useState<string>('study-1');
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null);

  // Mock data - 실제로는 API에서 가져옵니다
  const mockStudies = [
    { id: 'study-1', bodyPart: '복부', studyNumber: '981008 | ABD', modality: 'CT/SEG', date: '19970926' },
    { id: 'study-2', bodyPart: '흉부', studyNumber: '981009 | ABD', modality: 'CT/SEG', date: '19970926' },
    { id: 'study-3', bodyPart: '복부', studyNumber: '981010 | ABD', modality: 'CT/SEG', date: '3/243' },
  ];

  // Mock series data
  const mockSeries: SeriesImage[] = [
    { id: 'series-1', name: 'Series 1 (Scout)', thumbnail: '' },
    { id: 'series-2', name: 'Series 2 (Axial)', thumbnail: '' },
    { id: 'series-3', name: 'Series 3 (Coronal)', thumbnail: '' },
    { id: 'series-4', name: 'Series 4 (Sagittal)', thumbnail: '' },
  ];

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
        <StudyListSidebar
          studies={mockStudies}
          selectedStudyId={selectedStudyId}
          onStudySelect={setSelectedStudyId}
        />

        <div className="main-content">
          <div className="top-section">
            <div className="selected-series-panel">
              <h3>선택 Series</h3>
              <div className="series-viewer">
                {selectedSeriesId ? (
                  <div className="series-display">
                    선택된 Series: {selectedSeriesId}
                  </div>
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

          <div className="series-list-section">
            <h3>Series 목록</h3>
            <div className="series-thumbnails">
              <button className="nav-button prev">
                ‹
              </button>
              <div className="thumbnails-container">
                {mockSeries.map((series) => (
                  <div
                    key={series.id}
                    className={`series-thumbnail ${selectedSeriesId === series.id ? 'selected' : ''}`}
                    onClick={() => setSelectedSeriesId(series.id)}
                  >
                    <div className="thumbnail-placeholder">
                      {/* 실제로는 이미지 썸네일이 들어갑니다 */}
                      <div className="placeholder-content">
                        {series.name}
                      </div>
                    </div>
                    <div className="series-name">{series.name}</div>
                  </div>
                ))}
              </div>
              <button className="nav-button next">
                ›
              </button>
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
