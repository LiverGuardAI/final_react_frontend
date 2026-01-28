// src/pages/doctor/CTResult.tsx
import { useState, useEffect, useCallback } from 'react';
import { getPatientStudies, getStudySeries } from '../../api/orthanc_api';
import { getCtReports, type CTReportResponse } from '../../api/radiology_api';
import DicomViewer2D from '../../components/DicomViewer2D';
import DicomViewer3D from '../../components/DicomViewer3D';
import DicomViewerMPRPanel from '../../components/DicomViewerMPR';
import { useTreatment } from '../../contexts/TreatmentContext';
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
  const [reportList, setReportList] = useState<CTReportResponse[]>([]);
  const [selectedReport, setSelectedReport] = useState<CTReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [studySectionExpanded, setStudySectionExpanded] = useState(false);
  const [seriesSectionExpanded, setSeriesSectionExpanded] = useState(false);
  const [segSectionExpanded, setSegSectionExpanded] = useState(false);
  const [reportSectionExpanded, setReportSectionExpanded] = useState(false);

  const { selectedPatientId } = useTreatment();
  const patientId = selectedPatientId || '';
  const cacheKey = patientId ? `ct-result:${patientId}` : null;

  useEffect(() => {
    if (selectedPatientId !== null) {
      return;
    }
    setStudies([]);
    setSeriesList([]);
    setSelectedStudy(null);
    setSelectedCtSeries(null);
    setSelectedSegSeries(null);
    setReportList([]);
    setSelectedReport(null);
    setStudySectionExpanded(false);
    setSeriesSectionExpanded(false);
    setSegSectionExpanded(false);
    setReportSectionExpanded(false);
    setSeriesLoading(false);
    setReportLoading(false);
    setLoading(false);
    setError('진료 중인 환자가 없습니다.');
    setReportError(null);
  }, [selectedPatientId]);

  // CT Series만 필터링
  const ctSeriesList = seriesList.filter(series => series.Modality === 'CT');

  // SEG Series만 필터링
  const segSeriesList = seriesList.filter(series => series.Modality === 'SEG');

  const formatReportDate = (value?: string | null) => {
    if (!value) return 'N/A';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString('ko-KR');
  };

  const formatValue = (value?: string | number | null) => {
    if (value === null || value === undefined || value === '') return '—';
    return value;
  };

  const formatNumber = (value?: number | null, digits = 2) => {
    if (typeof value !== 'number' || Number.isNaN(value)) return '—';
    return value.toFixed(digits);
  };

  const formatPercent = (value?: number | null, digits = 2) => {
    if (typeof value !== 'number' || Number.isNaN(value)) return '—';
    return `${value.toFixed(digits)}%`;
  };

  const getReportPreview = (text?: string | null) => {
    const trimmed = (text || '').trim();
    if (!trimmed) return '내용이 없습니다.';
    const limit = 80;
    return trimmed.length > limit ? `${trimmed.slice(0, limit)}...` : trimmed;
  };

  const parseReportSections = (text?: string | null) => {
    const raw = (text || '').trim();
    if (!raw) {
      return [{ title: '보고서', content: '내용이 없습니다.' }];
    }
    const lines = raw.split(/\r?\n/);
    const sections: Array<{ title: string; content: string }> = [];
    let currentTitle: string | null = null;
    let currentLines: string[] = [];
    const pushSection = () => {
      const content = currentLines.join('\n').trim();
      if (currentTitle || content) {
        sections.push({
          title: currentTitle || '보고서',
          content: content || '내용이 없습니다.',
        });
      }
      currentLines = [];
    };
    lines.forEach((line) => {
      const match = line.match(/^\s*\[(.+?)\]\s*$/);
      if (match) {
        if (currentTitle !== null || currentLines.length > 0) {
          pushSection();
        }
        currentTitle = match[1].trim();
      } else {
        currentLines.push(line);
      }
    });
    pushSection();
    return sections.length > 0 ? sections : [{ title: '보고서', content: raw }];
  };

  const parseTumorAnalysis = (value: CTReportResponse['tumor_analysis']) => {
    if (!value) return null;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch (err) {
        console.warn('Failed to parse tumor_analysis:', err);
        return null;
      }
    }
    if (typeof value === 'object') {
      return value;
    }
    return null;
  };

  const getTumorSummary = (analysisData: any | null) => {
    if (!analysisData) return null;
    const analysis = analysisData.analysis ?? analysisData;
    const components = Array.isArray(analysis?.components) ? analysis.components : [];
    const tumorCount =
      analysis?.tumor_count ?? (components.length > 0 ? components.length : null);
    const totalTumorVolumeMl =
      analysis?.total_tumor_volume_ml ??
      (typeof analysis?.total_tumor_volume_mm3 === 'number'
        ? analysis.total_tumor_volume_mm3 / 1000
        : null);
    const liverVolumeMl =
      analysis?.liver_volume_ml ??
      (typeof analysis?.liver_volume_mm3 === 'number' ? analysis.liver_volume_mm3 / 1000 : null);
    const tumorBurdenPercent =
      analysis?.tumor_burden_percent ??
      (typeof analysis?.tumor_to_liver_ratio === 'number'
        ? analysis.tumor_to_liver_ratio * 100
        : null);
    const maxDiameter = components.reduce((max: number | null, item: any) => {
      const value = typeof item?.max_diameter_mm === 'number' ? item.max_diameter_mm : null;
      if (value === null) return max;
      if (max === null) return value;
      return Math.max(max, value);
    }, null);

    return {
      tumorCount,
      totalTumorVolumeMl,
      liverVolumeMl,
      tumorBurdenPercent,
      maxDiameter,
      components,
    };
  };

  const fetchStudies = useCallback(async () => {
    if (!patientId) {
      setStudies([]);
      setSeriesList([]);
      setSelectedStudy(null);
      setSelectedCtSeries(null);
      setSelectedSegSeries(null);
      setReportList([]);
      setSelectedReport(null);
      setStudySectionExpanded(false);
      setSeriesSectionExpanded(false);
      setSegSectionExpanded(false);
      setReportSectionExpanded(false);
      setSeriesLoading(false);
      setReportLoading(false);
      setLoading(false);
      setError('진료 중인 환자가 없습니다.');
      setReportError(null);
      return;
    }
    try {
      setLoading(true);
      const studyData = await getPatientStudies(patientId);
      setStudies(studyData);
      setError(null);
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setStudies([]);
        setError(null);
      } else {
        console.error('Failed to fetch studies:', err);
        setError('Study 목록을 불러오는데 실패했습니다.');
      }
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    if (!cacheKey) {
      setStudies([]);
      setSeriesList([]);
      setSelectedStudy(null);
      setSelectedCtSeries(null);
      setSelectedSegSeries(null);
      setReportList([]);
      setSelectedReport(null);
      setStudySectionExpanded(false);
      setSeriesSectionExpanded(false);
      setSegSectionExpanded(false);
      setReportSectionExpanded(false);
      setSeriesLoading(false);
      setReportLoading(false);
      setLoading(false);
      setError('진료 중인 환자가 없습니다.');
      setReportError(null);
      return;
    }
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setStudies(parsed.studies || []);
        setSeriesList(parsed.seriesList || []);
        setSelectedStudy(parsed.selectedStudy ?? null);
        setSelectedCtSeries(parsed.selectedCtSeries ?? null);
        setSelectedSegSeries(parsed.selectedSegSeries ?? null);
        setReportList(parsed.reportList || []);
        setStudySectionExpanded(Boolean(parsed.studySectionExpanded));
        setSeriesSectionExpanded(Boolean(parsed.seriesSectionExpanded));
        setSegSectionExpanded(Boolean(parsed.segSectionExpanded));
        setReportSectionExpanded(Boolean(parsed.reportSectionExpanded));
        setSelectedReport(null);
        setLoading(false);
        setSeriesLoading(false);
        setReportLoading(false);
        setError(null);
        setReportError(null);
        return;
      } catch (err) {
        console.warn('Failed to parse CTResult cache:', err);
        sessionStorage.removeItem(cacheKey);
      }
    }
    fetchStudies();
  }, [cacheKey, fetchStudies]);

  useEffect(() => {
    if (!cacheKey) {
      return;
    }
    if (
      studies.length === 0 &&
      seriesList.length === 0 &&
      !selectedStudy &&
      !selectedCtSeries &&
      !selectedSegSeries
    ) {
      return;
    }
    const payload = {
      studies,
      seriesList,
      selectedStudy,
      selectedCtSeries,
      selectedSegSeries,
      reportList,
      studySectionExpanded,
      seriesSectionExpanded,
      segSectionExpanded,
      reportSectionExpanded,
    };
    sessionStorage.setItem(cacheKey, JSON.stringify(payload));
  }, [
    cacheKey,
    studies,
    seriesList,
    selectedStudy,
    selectedCtSeries,
    selectedSegSeries,
    reportList,
    studySectionExpanded,
    seriesSectionExpanded,
    segSectionExpanded,
    reportSectionExpanded,
  ]);

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

  useEffect(() => {
    if (!selectedCtSeries?.SeriesInstanceUID) {
      setReportList([]);
      setSelectedReport(null);
      setReportError(null);
      setReportLoading(false);
      return;
    }
    let isMounted = true;
    const loadReports = async () => {
      setReportList([]);
      setSelectedReport(null);
      setReportLoading(true);
      setReportError(null);
      try {
        const data = await getCtReports(selectedCtSeries.SeriesInstanceUID);
        if (isMounted) {
          setReportList(data || []);
        }
      } catch (err) {
        console.error('Failed to fetch CT reports:', err);
        if (isMounted) {
          setReportError('Report 목록을 불러오는데 실패했습니다.');
        }
      } finally {
        if (isMounted) {
          setReportLoading(false);
        }
      }
    };
    loadReports();
    return () => {
      isMounted = false;
    };
  }, [selectedCtSeries?.SeriesInstanceUID]);

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
                <div className={styles.emptyState}>Study 목록이 없습니다.</div>
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
            <span className={styles.sectionHeaderTitle}>Series 목록</span>
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
            <span className={styles.sectionHeaderTitle}>Mask 목록</span>
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
                          <span className={styles.segNumber}>Series #{segSeries.SeriesNumber}</span>
                          <span className={styles.segBadge}>SEG</span>
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

        {/* Report 목록 */}
        <div className={styles.reportSection}>
          <div
            className={`${styles.sectionHeader} ${!reportSectionExpanded ? styles.collapsed : ''}`}
            onClick={() => setReportSectionExpanded(!reportSectionExpanded)}
          >
            <span className={`${styles.sectionHeaderIcon} ${!reportSectionExpanded ? styles.collapsed : ''}`}>
              ▼
            </span>
            <span className={styles.sectionHeaderTitle}>Report 목록</span>
            {!reportLoading && selectedCtSeries && reportList.length > 0 && (
              <span className={styles.sectionHeaderCount}>{reportList.length}개</span>
            )}
          </div>

          {reportSectionExpanded && (
            <>
              {reportLoading ? (
                <div className={styles.loadingState}>로딩 중...</div>
              ) : reportError ? (
                <div className={styles.errorState}>{reportError}</div>
              ) : !selectedCtSeries ? (
                <div className={styles.emptyState}>Series를 선택해주세요.</div>
              ) : reportList.length === 0 ? (
                <div className={styles.emptyState}>Report가 없습니다.</div>
              ) : (
                <div className={styles.reportList}>
                  {reportList.map((report) => (
                    <div
                      key={report.report_id}
                      className={`${styles.reportCard} ${selectedReport?.report_id === report.report_id ? styles.selected : ''}`}
                      onClick={() => {
                        setSelectedReport(report);
                        setReportSectionExpanded(false);
                      }}
                    >
                      <div className={styles.reportHeader}>
                        <span className={styles.reportDate}>{formatReportDate(report.created_at)}</span>
                        <span className={styles.reportBadge}>REPORT</span>
                      </div>
                      <div className={styles.reportPreview}>{getReportPreview(report.report_text)}</div>
                      <div className={styles.reportId}>ID: {report.report_id}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

        {/* Viewer 섹션 - 항상 표시 */}
        <div className={styles.viewerSection}>
          {/* 좌측: Axial 2D + MPR (Sagittal/Coronal) */}
          <div className={styles.viewerLeft}>
            <div className={styles.viewerContainer} style={{ flex: 2 }}>
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
            {selectedCtSeries && (
              <div className={styles.mprRow}>
                <div className={styles.mprContainer}>
                  <DicomViewerMPRPanel
                    seriesId={selectedCtSeries.ID}
                    segmentationSeriesId={selectedSegSeries?.ID || null}
                    orientation="sagittal"
                  />
                </div>
                <div className={styles.mprContainer}>
                  <DicomViewerMPRPanel
                    seriesId={selectedCtSeries.ID}
                    segmentationSeriesId={selectedSegSeries?.ID || null}
                    orientation="coronal"
                  />
                </div>
              </div>
            )}
          </div>
          {/* 우측: 3D Segmentation */}
          <div className={styles.viewerRight}>
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
        {selectedReport && (
          <div className={styles.reportModalOverlay} onClick={() => setSelectedReport(null)}>
            <div className={styles.reportModal} onClick={(e) => e.stopPropagation()}>
              <div className={styles.reportModalHeader}>
                <h3 className={styles.reportModalTitle}>CT Report</h3>
                <button className={styles.reportModalClose} onClick={() => setSelectedReport(null)}>
                  ✕
                </button>
              </div>
              <div className={styles.reportModalContent}>
                <div className={styles.reportMeta}>
                  <span>작성일: {formatReportDate(selectedReport.created_at)}</span>
                </div>
                {(() => {
                  const tumorAnalysis = parseTumorAnalysis(selectedReport.tumor_analysis);
                  const summary = getTumorSummary(tumorAnalysis);
                  if (!summary) {
                    return (
                      <div className={styles.reportAnalysis}>
                        <div className={styles.reportAnalysisHeader}>종양 분석 요약</div>
                        <div className={styles.reportAnalysisEmpty}>종양 분석 데이터가 없습니다.</div>
                      </div>
                    );
                  }

                  const topTumors = summary.components
                    .map((component: any, index: number) => ({
                      index: index + 1,
                      volumeMl:
                        typeof component?.volume_ml === 'number'
                          ? component.volume_ml
                          : typeof component?.volume_mm3 === 'number'
                            ? component.volume_mm3 / 1000
                            : null,
                      diameterMm:
                        typeof component?.max_diameter_mm === 'number' ? component.max_diameter_mm : null,
                    }))
                    .filter((item) => item.volumeMl !== null || item.diameterMm !== null)
                    .slice(0, 6);

                  return (
                    <div className={styles.reportAnalysis}>
                      <div className={styles.reportAnalysisHeader}>종양 분석 요약</div>
                      <div className={styles.reportAnalysisGrid}>
                        <div className={styles.reportAnalysisCard}>
                          <span className={styles.reportAnalysisLabel}>종양 개수</span>
                          <span className={styles.reportAnalysisValue}>{formatValue(summary.tumorCount)}</span>
                        </div>
                        <div className={styles.reportAnalysisCard}>
                          <span className={styles.reportAnalysisLabel}>총 종양 부피</span>
                          <span className={styles.reportAnalysisValue}>
                            {typeof summary.totalTumorVolumeMl === 'number'
                              ? `${formatNumber(summary.totalTumorVolumeMl, 2)} ml`
                              : '—'}
                          </span>
                        </div>
                        <div className={styles.reportAnalysisCard}>
                          <span className={styles.reportAnalysisLabel}>간 부피</span>
                          <span className={styles.reportAnalysisValue}>
                            {typeof summary.liverVolumeMl === 'number'
                              ? `${formatNumber(summary.liverVolumeMl, 2)} ml`
                              : '—'}
                          </span>
                        </div>
                        <div className={styles.reportAnalysisCard}>
                          <span className={styles.reportAnalysisLabel}>종양 부담률</span>
                          <span className={styles.reportAnalysisValue}>
                            {formatPercent(summary.tumorBurdenPercent, 2)}
                          </span>
                        </div>
                        <div className={styles.reportAnalysisCard}>
                          <span className={styles.reportAnalysisLabel}>최대 직경</span>
                          <span className={styles.reportAnalysisValue}>
                            {typeof summary.maxDiameter === 'number'
                              ? `${formatNumber(summary.maxDiameter, 1)} mm`
                              : '—'}
                          </span>
                        </div>
                      </div>
                      {topTumors.length > 0 && (
                        <div className={styles.reportAnalysisList}>
                          {topTumors.map((tumor) => (
                            <div key={tumor.index} className={styles.reportAnalysisItem}>
                              <span>종양 {tumor.index}</span>
                              <span>
                                {tumor.diameterMm !== null
                                  ? `직경 ${formatNumber(tumor.diameterMm, 1)} mm`
                                  : '직경 —'}
                                {' · '}
                                {tumor.volumeMl !== null
                                  ? `부피 ${formatNumber(tumor.volumeMl, 2)} ml`
                                  : '부피 —'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
                <div className={styles.reportContentSections}>
                  {parseReportSections(selectedReport.report_text).map((section, index) => (
                    <div key={`${section.title}-${index}`} className={styles.reportContentSection}>
                      <div className={styles.reportContentSectionTitle}>{section.title}</div>
                      <div className={styles.reportContentSectionBody}>{section.content}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
  );
}
