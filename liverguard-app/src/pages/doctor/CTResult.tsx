// src/pages/doctor/CTResult.tsx
import { useState, useEffect } from 'react';
import { getPatientStudies, getStudySeries } from '../../api/orthanc_api';
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
  const [selectedCtSeries, setSelectedCtSeries] = useState<Series | null>(null);
  const [selectedSegSeries, setSelectedSegSeries] = useState<Series | null>(null);
  const [loading, setLoading] = useState(true);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [studySectionExpanded, setStudySectionExpanded] = useState(false);
  const [seriesSectionExpanded, setSeriesSectionExpanded] = useState(false);
  const [segSectionExpanded, setSegSectionExpanded] = useState(false);

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
      setSeriesLoading(true);
      const seriesData = await getStudySeries(studyId);
      setSeriesList(seriesData);
      setSelectedStudy(studyId);
    } catch (err) {
      console.error('Failed to fetch series:', err);
      setError('Series 목록을 불러오는데 실패했습니다.');
    } finally {
      setSeriesLoading(false);
    }
  };

  const handleStudyClick = (studyId: string) => {
    fetchSeriesForStudy(studyId);
    setStudySectionExpanded(false); // 드롭다운 닫기
  };

  return (
      <div className={styles.container}>
        {/* 메인 컨텐츠 */}
        <div className={styles.mainContent}>
        {/* Study 목록 */}
        <div className={styles.studySection}>
          {/* 섹션 헤더 (드롭다운) */}
          <div
            className={`${styles.sectionHeader} ${!studySectionExpanded ? styles.collapsed : ''}`}
            onClick={() => setStudySectionExpanded(!studySectionExpanded)}
          >
            <span className={`${styles.sectionHeaderIcon} ${!studySectionExpanded ? styles.collapsed : ''}`}>
              ▼
            </span>
            <span className={styles.sectionHeaderTitle}>Study 목록</span>
            {!loading && !error && studies.length > 0 && (
              <span className={styles.sectionHeaderCount}>{studies.length}개</span>
            )}
          </div>

          {/* 섹션 컨텐츠 */}
          {studySectionExpanded && (
            <>
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
            </>
          )}
        </div>

        {/* CT Series 목록 */}
        <div className={styles.seriesSection}>
          <div
            className={`${styles.sectionHeader} ${!seriesSectionExpanded ? styles.collapsed : ''}`}
            onClick={() => setSeriesSectionExpanded(!seriesSectionExpanded)}
          >
            <span className={`${styles.sectionHeaderIcon} ${!seriesSectionExpanded ? styles.collapsed : ''}`}>
              ▼
            </span>
            <span className={styles.sectionHeaderTitle}>CT Series</span>
            {!seriesLoading && selectedStudy && ctSeriesList.length > 0 && (
              <span className={styles.sectionHeaderCount}>{ctSeriesList.length}개</span>
            )}
          </div>

          {seriesSectionExpanded && (
            <>
              {seriesLoading ? (
                <div className={styles.loadingState}>로딩 중...</div>
              ) : selectedStudy ? (
                ctSeriesList.length === 0 ? (
                  <div className={styles.emptyState}>CT Series가 없습니다.</div>
                ) : (
                  <div className={styles.seriesList}>
                    {ctSeriesList.map((ctSeries) => (
                      <div
                        key={ctSeries.ID}
                        className={`${styles.seriesCard} ${selectedCtSeries?.ID === ctSeries.ID ? styles.selected : ''}`}
                        onClick={() => {
                          setSelectedCtSeries(ctSeries);
                          setSeriesSectionExpanded(false); // 드롭다운 닫기
                          // CT 변경 시 이전 SEG 선택 해제
                          setSelectedSegSeries(null);
                        }}
                      >
                        <div className={styles.seriesHeader}>
                          <span className={styles.seriesNumber}>Series #{ctSeries.SeriesNumber}</span>
                          <span className={styles.ctBadge}>CT</span>
                        </div>
                        <div className={styles.seriesDescription}>
                          {ctSeries.SeriesDescription || 'No Description'}
                        </div>
                        <div className={styles.seriesId}>ID: {ctSeries.ID}</div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <div className={styles.emptyState}>Study를 선택해주세요.</div>
              )}
            </>
          )}
        </div>

        {/* SEG Series 목록 */}
        <div className={styles.segSection}>
          <div
            className={`${styles.sectionHeader} ${!segSectionExpanded ? styles.collapsed : ''}`}
            onClick={() => setSegSectionExpanded(!segSectionExpanded)}
          >
            <span className={`${styles.sectionHeaderIcon} ${!segSectionExpanded ? styles.collapsed : ''}`}>
              ▼
            </span>
            <span className={styles.sectionHeaderTitle}>Segmentation</span>
            {selectedCtSeries && (() => {
              // 선택된 CT Series와 연결된 SEG Series만 필터링
              const linkedSegSeries = segSeriesList.filter(segSeries => {
                if (segSeries.ReferencedSeriesInstanceUID) {
                  return segSeries.ReferencedSeriesInstanceUID === selectedCtSeries.SeriesInstanceUID;
                }
                const ctSeriesNum = parseInt(selectedCtSeries.SeriesNumber);
                const segSeriesNum = parseInt(segSeries.SeriesNumber);
                if (!isNaN(ctSeriesNum) && !isNaN(segSeriesNum)) {
                  return segSeriesNum === ctSeriesNum + 1000;
                }
                return false;
              });
              return linkedSegSeries.length > 0 && (
                <span className={styles.sectionHeaderCount}>{linkedSegSeries.length}개</span>
              );
            })()}
          </div>

          {segSectionExpanded && (
            <>
              {!selectedCtSeries ? (
                <div className={styles.emptyState}>CT Series를 선택해주세요.</div>
              ) : (() => {
                // 선택된 CT Series와 연결된 SEG Series만 필터링
                const linkedSegSeries = segSeriesList.filter(segSeries => {
                  if (segSeries.ReferencedSeriesInstanceUID) {
                    return segSeries.ReferencedSeriesInstanceUID === selectedCtSeries.SeriesInstanceUID;
                  }
                  const ctSeriesNum = parseInt(selectedCtSeries.SeriesNumber);
                  const segSeriesNum = parseInt(segSeries.SeriesNumber);
                  if (!isNaN(ctSeriesNum) && !isNaN(segSeriesNum)) {
                    return segSeriesNum === ctSeriesNum + 1000;
                  }
                  return false;
                });

                return linkedSegSeries.length === 0 ? (
                  <div className={styles.emptyState}>연결된 SEG가 없습니다.</div>
                ) : (
                  <div className={styles.segList}>
                    {linkedSegSeries.map((segSeries) => (
                      <div
                        key={segSeries.ID}
                        className={`${styles.segCard} ${selectedSegSeries?.ID === segSeries.ID ? styles.selected : ''}`}
                        onClick={() => {
                          setSelectedSegSeries(segSeries);
                          setSegSectionExpanded(false); // 드롭다운 닫기
                        }}
                      >
                        <div className={styles.segCardHeader}>
                          <span className={styles.segBadge}>SEG</span>
                          <span className={styles.segNumber}>Series #{segSeries.SeriesNumber}</span>
                        </div>
                        <div className={styles.segCardDescription}>
                          {segSeries.SeriesDescription || 'No Description'}
                        </div>
                        <div className={styles.segCardId}>ID: {segSeries.ID}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </>
          )}
        </div>
      </div>

        {/* Viewer 섹션 - 항상 표시 */}
        <div className={styles.viewerSection}>
          <div className={styles.viewerContainer}>
            {selectedCtSeries ? (
              <DicomViewer2D
                seriesId={selectedCtSeries.ID}
                segmentationSeriesId={selectedSegSeries?.ID || null}
              />
            ) : (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#9ca3af',
                textAlign: 'center',
                padding: '40px'
              }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 600 }}>
                  2D Viewer
                </h3>
                <div style={{ fontSize: '14px' }}>
                  CT Series를 선택하여 영상을 확인하세요
                </div>
              </div>
            )}
          </div>
          <div className={styles.viewerContainer}>
            {selectedSegSeries ? (
              <DicomViewer3D
                segmentationSeriesId={selectedSegSeries.ID}
              />
            ) : (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#9ca3af',
                textAlign: 'center',
                padding: '40px'
              }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 600 }}>
                  3D Segmentation Rendering
                </h3>
                <div style={{ fontSize: '14px' }}>
                  Segmentation이 있는 CT Series를 선택하여<br />
                  3D 영상을 확인하세요
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
  );
}
