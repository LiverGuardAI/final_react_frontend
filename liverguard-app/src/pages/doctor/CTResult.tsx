// src/pages/doctor/CTResult.tsx
import { useState, useEffect } from 'react';
import { getPatientStudies, getStudySeries } from '../../api/orthanc_api';
import DoctorLayout from '../../layouts/DoctorLayout';
import DicomViewer2D from '../../components/DicomViewer2D';
import DicomViewer3D from '../../components/DicomViewer3D';
import styles from './CTResult.module.css';

interface Study {
  ID: string;
  PatientID: string;
  StudyDate: string;
  StudyDescription: string;
  [key: string]: any;
}

interface Series {
  ID: string;
  SeriesNumber: string;
  Modality: string;
  SeriesDescription: string;
  SeriesInstanceUID: string;
  ReferencedSeriesInstanceUID?: string;
  [key: string]: any;
}

export default function CTResultPage() {
  const [studies, setStudies] = useState<Study[]>([]);
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [selectedStudy, setSelectedStudy] = useState<string | null>(null);
  const [expandedSeriesId, setExpandedSeriesId] = useState<string | null>(null);
  const [selectedCtSeries, setSelectedCtSeries] = useState<Series | null>(null);
  const [selectedSegSeries, setSelectedSegSeries] = useState<Series | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 임시로 TCGA-BC-A3KF 환자 ID 사용
  const patientId = 'TCGA-BC-A3KF';

  // CT Series만 필터링
  const ctSeriesList = seriesList.filter(series => series.Modality === 'CT');

  // SEG Series만 필터링
  const segSeriesList = seriesList.filter(series => series.Modality === 'SEG');

  useEffect(() => {
    fetchStudies();
  }, []);

  const fetchStudies = async () => {
    try {
      setLoading(true);
      const studyData = await getPatientStudies(patientId);
      setStudies(studyData);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch studies:', err);
      setError('Study 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const fetchSeriesForStudy = async (studyId: string) => {
    try {
      const seriesData = await getStudySeries(studyId);
      setSeriesList(seriesData);
      setSelectedStudy(studyId);
    } catch (err) {
      console.error('Failed to fetch series:', err);
      setError('Series 목록을 불러오는데 실패했습니다.');
    }
  };

  const handleStudyClick = (studyId: string) => {
    fetchSeriesForStudy(studyId);
  };

  return (
    <DoctorLayout activeTab="examination">
      <div className={styles.container}>
        {/* 메인 컨텐츠 */}
        <div className={styles.mainContent}>
        {/* Study 목록 */}
        <div className={styles.studySection}>
          <h2 className={styles.sectionTitle}>Study 목록</h2>
          {loading ? (
            <div className={styles.loadingState}>로딩 중...</div>
          ) : error ? (
            <div className={styles.errorState}>{error}</div>
          ) : studies.length === 0 ? (
            <div className={styles.emptyState}>Study가 없습니다.</div>
          ) : (
            <div className={styles.studyList}>
              {studies.map((study) => (
                <div
                  key={study.ID}
                  className={`${styles.studyCard} ${selectedStudy === study.ID ? styles.selected : ''}`}
                  onClick={() => handleStudyClick(study.ID)}
                >
                  <div className={styles.studyHeader}>
                    <span className={styles.studyDate}>{study.StudyDate || 'N/A'}</span>
                  </div>
                  <div className={styles.studyDescription}>
                    {study.StudyDescription || 'No Description'}
                  </div>
                  <div className={styles.studyId}>ID: {study.ID}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Series 목록 (CT와 연결된 SEG 드롭다운) */}
        <div className={styles.seriesSection}>
          <h2 className={styles.sectionTitle}>Series 목록</h2>
          {selectedStudy ? (
            ctSeriesList.length === 0 ? (
              <div className={styles.emptyState}>CT Series가 없습니다.</div>
            ) : (
              <div className={styles.seriesList}>
                {ctSeriesList.map((ctSeries) => {
                  const isExpanded = expandedSeriesId === ctSeries.ID;

                  // 이 CT Series와 연결된 SEG Series만 필터링
                  const linkedSegSeries = segSeriesList.filter(segSeries => {
                    // 1. ReferencedSeriesInstanceUID가 있으면 그것으로 매칭
                    if (segSeries.ReferencedSeriesInstanceUID) {
                      return segSeries.ReferencedSeriesInstanceUID === ctSeries.SeriesInstanceUID;
                    }

                    // 2. SeriesNumber 기반 매칭 (SEG SeriesNumber - 1000 = CT SeriesNumber)
                    const ctSeriesNum = parseInt(ctSeries.SeriesNumber);
                    const segSeriesNum = parseInt(segSeries.SeriesNumber);
                    if (!isNaN(ctSeriesNum) && !isNaN(segSeriesNum)) {
                      return segSeriesNum === ctSeriesNum + 1000;
                    }

                    return false;
                  });

                  return (
                    <div key={ctSeries.ID} className={styles.dropdownWrapper}>
                      {/* CT Series 드롭다운 헤더 */}
                      <div
                        className={`${styles.dropdownHeader} ${isExpanded ? styles.expanded : ''}`}
                        onClick={() => setExpandedSeriesId(isExpanded ? null : ctSeries.ID)}
                      >
                        <div className={styles.dropdownHeaderLeft}>
                          <span className={styles.dropdownIcon}>{isExpanded ? '▼' : '▶'}</span>
                          <span className={styles.seriesNumber}>Series #{ctSeries.SeriesNumber}</span>
                          <span className={styles.ctBadge}>CT</span>
                        </div>
                        <div className={styles.dropdownHeaderRight}>
                          <span className={styles.seriesDescription}>
                            {ctSeries.SeriesDescription || 'No Description'}
                          </span>
                        </div>
                      </div>

                      {/* 드롭다운 컨텐츠 (펼쳐졌을 때만 표시) */}
                      {isExpanded && (
                        <div className={styles.dropdownContent}>
                          {/* CT Series 상세 정보 */}
                          <div className={styles.seriesDetail}>
                            <div className={styles.detailRow}>
                              <span className={styles.detailLabel}>Series ID:</span>
                              <span className={styles.detailValue}>{ctSeries.ID}</span>
                            </div>
                            <div className={styles.detailRow}>
                              <span className={styles.detailLabel}>Description:</span>
                              <span className={styles.detailValue}>{ctSeries.SeriesDescription || 'N/A'}</span>
                            </div>
                            <div className={styles.detailRow}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedCtSeries(ctSeries);
                                  setSelectedSegSeries(linkedSegSeries.length > 0 ? linkedSegSeries[0] : null);
                                }}
                                style={{
                                  padding: '4px 10px',
                                  backgroundColor: selectedCtSeries?.ID === ctSeries.ID ? '#3b82f6' : '#f59e0b',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontWeight: 600,
                                  fontSize: '11px',
                                }}
                              >
                                {selectedCtSeries?.ID === ctSeries.ID ? '선택됨' : 'Viewer에서 보기'}
                              </button>
                            </div>
                          </div>

                          {/* 연결된 SEG Series */}
                          {linkedSegSeries.length > 0 && (
                            <div className={styles.segSection}>
                              <div className={styles.segSectionTitle}>연결된 Segmentation</div>
                              {linkedSegSeries.map((segSeries) => (
                                <div key={segSeries.ID} className={styles.segItem}>
                                  <div className={styles.segItemHeader}>
                                    <span className={styles.segBadge}>SEG</span>
                                    <span className={styles.segNumber}>Series #{segSeries.SeriesNumber}</span>
                                  </div>
                                  <div className={styles.segItemDescription}>
                                    {segSeries.SeriesDescription || 'No Description'}
                                  </div>
                                  <div className={styles.segItemId}>ID: {segSeries.ID}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            <div className={styles.emptyState}>Study를 선택해주세요.</div>
          )}
        </div>
      </div>

        {/* Viewer 섹션 */}
        {selectedCtSeries && (
          <div className={styles.viewerSection}>
            <div className={styles.viewerContainer}>
              <DicomViewer2D
                seriesId={selectedCtSeries.ID}
                segmentationSeriesId={selectedSegSeries?.ID || null}
              />
            </div>
            <div className={styles.viewerContainer}>
              <DicomViewer3D
                seriesId={selectedCtSeries.ID}
                segmentationSeriesId={selectedSegSeries?.ID || null}
              />
            </div>
          </div>
        )}
      </div>
    </DoctorLayout>
  );
}