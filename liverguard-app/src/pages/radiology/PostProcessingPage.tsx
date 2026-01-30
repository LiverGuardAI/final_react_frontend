// src/pages/radiology/PostProcessingPage.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PatientHeader from '../../components/radiology/PatientHeader';
import SeriesListSidebar from '../../components/radiology/SeriesListSidebar';
import MaskOverlayViewer from '../../components/radiology/MaskOverlayViewer';
import DicomViewer3D from '../../components/DicomViewer3D';
import {
  getSeriesList,
  getSeriesInstances,
  getSeriesInfo,
  getInstanceInfo,
  getStudyInfo
} from '../../api/orthanc_api';
import type { MaskClass } from '../../api/radiology_api';
import {
  createSegmentationMask,
  getSegmentationTaskStatus,
  createFeatureExtraction,
  getFeatureExtractionTaskStatus,
  generateReport,
  generateReportV2
} from '../../api/ai_api';
import {
  analyzeTumor,
  getMaskClasses,
  addMaskClass,
  deleteMaskClass,
  saveMaskEdits,
  saveCtReport,
  endFilming,
  getEncounterStudy,
  getDicomStudySeries,
  getWaitlist,
} from '../../api/radiology_api';
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
      SeriesInstanceUID?: string;
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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const encounterIdParam = searchParams.get('encounter_id');
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
  const [maskFilter, setMaskFilter] = useState<'all' | 'liver' | 'tumor'>('all');
  const [maskOpacity, setMaskOpacity] = useState<number>(0.7);
  const [selectedSeriesInfo, setSelectedSeriesInfo] = useState<Series['data'] | null>(null);
  const [selectedStudyInfo, setSelectedStudyInfo] = useState<any | null>(null);
  const [isExtractingFeature, setIsExtractingFeature] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'viewer' | 'features'>('viewer');
  const [featureTaskId, setFeatureTaskId] = useState<string | null>(null);
  const [featureStatus, setFeatureStatus] = useState<string>('');
  const [featureResult, setFeatureResult] = useState<any | null>(null);
  const [featureTargetSeriesId, setFeatureTargetSeriesId] = useState<string | null>(null);
  const [aiRunSeriesIds, setAiRunSeriesIds] = useState<Set<string>>(new Set());
  const [encounterInfo, setEncounterInfo] = useState<any | null>(null);
  const [isAnalyzingTumor, setIsAnalyzingTumor] = useState<boolean>(false);
  const [tumorAnalysisResult, setTumorAnalysisResult] = useState<any | null>(null);
  const [tumorAnalysisError, setTumorAnalysisError] = useState<string>('');
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState<boolean>(false);
  const [isAutoReportModalOpen, setIsAutoReportModalOpen] = useState<boolean>(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState<boolean>(false);
  const [reportError, setReportError] = useState<string>('');
  const [isGeneratingReportV2, setIsGeneratingReportV2] = useState<boolean>(false);
  const [reportV2Error, setReportV2Error] = useState<string>('');
  const [isSavingReport, setIsSavingReport] = useState<boolean>(false);
  const [saveReportError, setSaveReportError] = useState<string>('');
  const [generatedReport, setGeneratedReport] = useState<string>('');
  const [isEndingFilming, setIsEndingFilming] = useState<boolean>(false);
  const [measurementEnabled, setMeasurementEnabled] = useState<boolean>(false);
  const [measurementDimensions, setMeasurementDimensions] = useState<{ widthMm: number; heightMm: number } | null>(null);
  const [measurementBoxes, setMeasurementBoxes] = useState<Array<{
    id: string;
    widthMm: number;
    heightMm: number;
    sliceIndex: number;
    start: { x: number; y: number };
    end: { x: number; y: number };
  }>>([]);
  const [measurementResetToken, setMeasurementResetToken] = useState<number>(0);
  const [zoomCommand, setZoomCommand] = useState<{ type: 'in' | 'out' | 'reset'; token: number } | null>(null);
  const [toolTab, setToolTab] = useState<'measure' | 'report' | 'label'>('measure');
  const [viewerMode, setViewerMode] = useState<'2d' | '3d'>('2d');
  const [maskClasses, setMaskClasses] = useState<MaskClass[]>([]);
  const [maskClassValues, setMaskClassValues] = useState<number[]>([]);
  const [isLoadingMaskClasses, setIsLoadingMaskClasses] = useState<boolean>(false);
  const [maskClassError, setMaskClassError] = useState<string>('');
  const [newClassName, setNewClassName] = useState<string>('');
  const [newClassValue, setNewClassValue] = useState<string>('');
  const [newClassColor, setNewClassColor] = useState<string>('#22c55e');
  const [isAddingMaskClass, setIsAddingMaskClass] = useState<boolean>(false);
  const [maskEditEnabled, setMaskEditEnabled] = useState<boolean>(false);
  const [maskEditMode, setMaskEditMode] = useState<'paint' | 'erase'>('paint');
  const [maskEditLabelValue, setMaskEditLabelValue] = useState<number>(1);
  const [maskBrushSize, setMaskBrushSize] = useState<number>(12);
  const [maskEditResetToken, setMaskEditResetToken] = useState<number>(0);
  const [maskEditUndoToken, setMaskEditUndoToken] = useState<number>(0);
  const [canUndoCurrentSlice, setCanUndoCurrentSlice] = useState<boolean>(false);
  const [selectedTumorIndex, setSelectedTumorIndex] = useState<number | null>(null);
  const [focusPoint3d, setFocusPoint3d] = useState<[number, number, number] | null>(null);
  const [focusPointToken, setFocusPointToken] = useState<number>(0);
  const [focusPointMode, setFocusPointMode] = useState<'world' | 'voxel'>('world');
  const [editedSliceCount, setEditedSliceCount] = useState<number>(0);
  const editedMaskSlicesRef = useRef<Map<number, { data: Uint16Array; width: number; height: number }>>(new Map());
  const [isSavingMaskEdits, setIsSavingMaskEdits] = useState<boolean>(false);
  const [saveMaskEditsError, setSaveMaskEditsError] = useState<string>('');
  const [deletingMaskClasses, setDeletingMaskClasses] = useState<Set<number>>(new Set());
  const studyCacheRef = useRef<Map<string, any>>(new Map());
  const seriesInfoCacheRef = useRef<Map<string, Series['data']>>(new Map());
  const seriesInstancesCacheRef = useRef<Map<string, Instance[]>>(new Map());
  const maskSeriesMapRef = useRef<Map<string, { maskSeriesId: string; maskInstances: Instance[] }>>(new Map());
  const featureResultMapRef = useRef<Map<string, { result: any; status: string }>>(new Map());
  const reportNoteRef = useRef<HTMLTextAreaElement>(null);
  const hasRunAiForSelected = Boolean(
    selectedSeriesId &&
      (aiRunSeriesIds.has(selectedSeriesId) ||
        maskSeriesMapRef.current.has(selectedSeriesId) ||
        featureResultMapRef.current.has(selectedSeriesId))
  );

  const loadMaskClasses = useCallback(async (seriesId: string) => {
    setIsLoadingMaskClasses(true);
    setMaskClassError('');
    try {
      const response = await getMaskClasses(seriesId);
      setMaskClasses(response.classes ?? []);
      setMaskClassValues(response.unique_values ?? []);
    } catch (error) {
      console.error('Failed to load mask classes:', error);
      setMaskClassError('마스크 클래스 정보를 불러오지 못했습니다.');
      setMaskClasses([]);
      setMaskClassValues([]);
    } finally {
      setIsLoadingMaskClasses(false);
    }
  }, []);

  const handleAddMaskClass = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!maskSeriesId) {
      setMaskClassError('마스크 시리즈가 없습니다.');
      return;
    }
    if (!newClassName.trim()) {
      setMaskClassError('클래스 이름을 입력해주세요.');
      return;
    }
    let parsedValue: number | undefined;
    if (newClassValue.trim()) {
      const value = Number(newClassValue);
      if (Number.isNaN(value)) {
        setMaskClassError('클래스 값은 숫자여야 합니다.');
        return;
      }
      parsedValue = value;
    }

    setIsAddingMaskClass(true);
    setMaskClassError('');
    try {
      const response = await addMaskClass(
        maskSeriesId,
        newClassName.trim(),
        parsedValue,
        newClassColor
      );
      const createdClass = response.class;
      setMaskClasses((prev) => {
        const next = [...prev.filter((item) => item.label_value !== createdClass.label_value), createdClass];
        return next.sort((a, b) => a.label_value - b.label_value);
      });
      setNewClassName('');
      setNewClassValue('');
    } catch (error) {
      console.error('Failed to add mask class:', error);
      setMaskClassError('클래스 추가에 실패했습니다.');
    } finally {
      setIsAddingMaskClass(false);
    }
  };

  const getDefaultClassColor = (value: number) => {
    const palette: Record<number, string> = {
      0: '#475569',
      1: '#ef4444',
      2: '#22c55e',
      3: '#3b82f6',
      4: '#facc15',
      5: '#a855f7',
      6: '#06b6d4',
      7: '#f97316',
      8: '#8b5cf6',
    };
    return palette[value] ?? '#64748b';
  };

  const getClassColor = (maskClass: MaskClass) => {
    return maskClass.color || getDefaultClassColor(maskClass.label_value);
  };

  const encodeUint16ToBase64 = (data: Uint16Array) => {
    const bytes = new Uint8Array(data.buffer);
    const chunkSize = 0x8000;
    let binary = '';
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return window.btoa(binary);
  };

  const handleMaskSliceEdited = useCallback(
    (sliceIndex: number, data: Uint16Array, width: number, height: number) => {
      editedMaskSlicesRef.current.set(sliceIndex, { data, width, height });
      setEditedSliceCount(editedMaskSlicesRef.current.size);
      setCanUndoCurrentSlice(true);
    },
    []
  );

  const handleSelectTumorComponent = (component: any, index: number) => {
    setSelectedTumorIndex(index);
    const centroid = component?.centroid_mm;
    const x = centroid?.x;
    const y = centroid?.y;
    const z = centroid?.z;
    if (typeof x === 'number' && typeof y === 'number' && typeof z === 'number') {
      const rows = tumorAnalysisResult?.metadata?.rows;
      const cols = tumorAnalysisResult?.metadata?.cols;
      const slices = tumorAnalysisResult?.metadata?.slice_count;
      const looksLikeVoxel =
        typeof rows === 'number' &&
        typeof cols === 'number' &&
        typeof slices === 'number' &&
        x >= 0 &&
        y >= 0 &&
        z >= 0 &&
        x <= cols &&
        y <= rows &&
        z <= slices &&
        Math.abs(x - Math.round(x)) < 0.5 &&
        Math.abs(y - Math.round(y)) < 0.5 &&
        Math.abs(z - Math.round(z)) < 0.5;

      setFocusPointMode(looksLikeVoxel ? 'voxel' : 'world');
      setViewerMode('3d');
      setFocusPoint3d([x, y, z]);
      setFocusPointToken((prev) => prev + 1);
    }
  };

  const handleSaveMaskEdits = async () => {
    if (!maskSeriesId) {
      setSaveMaskEditsError('마스크 시리즈가 없습니다.');
      return;
    }
    const editedEntries = Array.from(editedMaskSlicesRef.current.entries());
    if (editedEntries.length === 0) {
      setSaveMaskEditsError('수정된 슬라이스가 없습니다.');
      return;
    }
    setIsSavingMaskEdits(true);
    setSaveMaskEditsError('');
    try {
      const editedSlices = editedEntries.map(([sliceIndex, payload]) => ({
        slice_index: sliceIndex,
        width: payload.width,
        height: payload.height,
        pixels: encodeUint16ToBase64(payload.data),
      }));

      const response = await saveMaskEdits(maskSeriesId, editedSlices, true);
      const newSeriesId = response.mask_series_id || response.series_id || maskSeriesId;

      const instances = await getSeriesInstances(newSeriesId);
      setMaskSeriesId(newSeriesId);
      setMaskInstances(instances);
      if (selectedSeriesId) {
        maskSeriesMapRef.current.set(selectedSeriesId, {
          maskSeriesId: newSeriesId,
          maskInstances: instances,
        });
      }

      editedMaskSlicesRef.current.clear();
      setEditedSliceCount(0);
      setCanUndoCurrentSlice(false);
      setMaskEditResetToken((prev) => prev + 1);
    } catch (error) {
      console.error('Failed to save mask edits:', error);
      setSaveMaskEditsError('마스크 저장에 실패했습니다.');
    } finally {
      setIsSavingMaskEdits(false);
    }
  };

  const handleFullMaskReset = () => {
    editedMaskSlicesRef.current.clear();
    setEditedSliceCount(0);
    setCanUndoCurrentSlice(false);
    setSaveMaskEditsError('');
    setMaskEditResetToken((prev) => prev + 1);
  };

  const handleDeleteMaskClass = async (labelValue: number) => {
    if (!maskSeriesId) {
      setMaskClassError('마스크 시리즈가 없습니다.');
      return;
    }
    if (!window.confirm('해당 클래스를 삭제할까요?')) {
      return;
    }
    setDeletingMaskClasses((prev) => new Set(prev).add(labelValue));
    setMaskClassError('');
    try {
      await deleteMaskClass(maskSeriesId, labelValue);
      setMaskClasses((prev) => {
        const next = prev.filter((item) => item.label_value !== labelValue);
        if (maskEditLabelValue === labelValue && next.length > 0) {
          const fallback = next.find((item) => item.label_value !== 0) ?? next[0];
          setMaskEditLabelValue(fallback.label_value);
        }
        return next;
      });
    } catch (error) {
      console.error('Failed to delete mask class:', error);
      setMaskClassError('클래스 삭제에 실패했습니다.');
    } finally {
      setDeletingMaskClasses((prev) => {
        const next = new Set(prev);
        next.delete(labelValue);
        return next;
      });
    }
  };

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

  const formatNumber = (value?: number | null, digits = 2) => {
    if (typeof value !== 'number' || Number.isNaN(value)) return '—';
    return value.toFixed(digits);
  };

  const formatPercent = (value?: number | null, digits = 2) => {
    if (typeof value !== 'number' || Number.isNaN(value)) return '—';
    return `${value.toFixed(digits)}%`;
  };

  const formatValue = (value?: string | number | null) => {
    if (value === null || value === undefined || value === '') return '—';
    return value;
  };

  const formatArray = (values?: Array<string | number> | null) => {
    if (!values || values.length === 0) return '—';
    return values.join(', ');
  };

  const formatRange = (min?: number | null, max?: number | null) => {
    if (min === null || min === undefined || max === null || max === undefined) return '—';
    return `${min} ~ ${max}`;
  };

  const formatCoord = (
    coord?: { x?: number | null; y?: number | null; z?: number | null } | null,
    digits = 2
  ) => {
    if (!coord) return '—';
    return `Z ${formatNumber(coord.z ?? null, digits)} / Y ${formatNumber(coord.y ?? null, digits)} / X ${formatNumber(coord.x ?? null, digits)}`;
  };

  const buildHeatmapCells = (features: number[], size = 512) => {
    const sliced = features.slice(0, size);
    if (sliced.length === 0) {
      return [];
    }
    const minVal = Math.min(...sliced);
    const maxVal = Math.max(...sliced);
    const range = maxVal - minVal || 1;
    const colorFor = (t: number) => {
      // Gradient: navy -> blue -> cyan -> yellow -> red
      const stops = [
        { t: 0.0, c: [10, 20, 60] },
        { t: 0.25, c: [30, 90, 200] },
        { t: 0.5, c: [40, 200, 200] },
        { t: 0.75, c: [240, 200, 60] },
        { t: 1.0, c: [220, 60, 60] },
      ];
      for (let i = 0; i < stops.length - 1; i += 1) {
        const a = stops[i];
        const b = stops[i + 1];
        if (t >= a.t && t <= b.t) {
          const local = (t - a.t) / (b.t - a.t);
          const r = Math.round(a.c[0] + (b.c[0] - a.c[0]) * local);
          const g = Math.round(a.c[1] + (b.c[1] - a.c[1]) * local);
          const bch = Math.round(a.c[2] + (b.c[2] - a.c[2]) * local);
          return `rgb(${r}, ${g}, ${bch})`;
        }
      }
      return 'rgb(220, 60, 60)';
    };
    return sliced.map((value, index) => {
      const normalized = (value - minVal) / range;
      return {
        key: `cell-${index}`,
        color: colorFor(normalized),
        value
      };
    });
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
  const headerPatientId = encounterInfo?.patient_id || patientTags?.PatientID || 'N/A';
  const headerPatientName = encounterInfo?.patient_name
    ? encounterInfo.patient_name
    : formatPatientName(patientTags?.PatientName);
  const headerGender = encounterInfo?.gender || patientTags?.PatientSex || 'N/A';
  const headerBirthDate =
    encounterInfo?.date_of_birth || formatDicomDate(patientTags?.PatientBirthDate);
  const headerExamType = mainTags?.SeriesDescription || mainTags?.Modality || 'N/A';
  const headerExamDate = formatDicomDate(mainTags?.SeriesDate || studyTags?.StudyDate);
  const headerOrderNotes = encounterInfo?.order_notes ?? [];

  const handleGoToHome = () => {
    navigate('/radiology/home');
  };

  const handleGoToAcquisition = () => {
    const encounterId = encounterInfo?.encounter_id || encounterIdParam;
    const params = encounterId ? `?encounter_id=${encounterId}` : '';
    navigate(`/radiology/acquisition${params}`);
  };

  const handleEndFilming = async () => {
    const patientId = encounterInfo?.patient_id;
    if (!patientId) {
      alert('촬영 중인 환자가 없습니다.');
      return;
    }
    setIsEndingFilming(true);
    try {
      await endFilming(patientId);
      setEncounterInfo(null);
      setSelectedSeriesId(null);
      setSeriesList([]);
      setSeriesInstances([]);
      setSelectedSeriesInfo(null);
      setSelectedStudyInfo(null);
      setMaskSeriesId(null);
      setMaskInstances([]);
      setFeatureResult(null);
      setTumorAnalysisResult(null);
      setGeneratedReport('');
      alert('촬영이 종료되었습니다.');
      navigate('/radiology/acquisition');
    } catch (error) {
      console.error('Failed to end filming:', error);
      alert('촬영 종료에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsEndingFilming(false);
    }
  };

  const fetchSeriesList = useCallback(async (studyUid?: string | null) => {
    setIsLoadingSeries(true);
    try {
      if (studyUid) {
        const studySeries = await getDicomStudySeries(studyUid);
        const seriesData = await Promise.all(
          studySeries.series_ids.map(async (seriesId) => {
            try {
              const data = await getSeriesInfo(seriesId);
              return { id: seriesId, data };
            } catch (error) {
              console.error('Failed to fetch series info:', error);
              return null;
            }
          })
        );
        setSelectedSeriesId(null);
        setSeriesList(seriesData.filter((item): item is Series => Boolean(item)));
      } else {
        const data = await getSeriesList();
        setSelectedSeriesId(null);
        setSeriesList(data);
      }
    } catch (error) {
      console.error('Failed to fetch series list:', error);
    } finally {
      setIsLoadingSeries(false);
    }
  }, []);

  // Fetch series list from Orthanc on component mount
  useEffect(() => {
    const fetchForEncounter = async () => {
      if (!encounterIdParam) {
        try {
          const waitlist = await getWaitlist();
          const filmingPatient = waitlist.patients.find(
            (patient) =>
              (Array.isArray(patient?.imaging_orders) &&
                patient.imaging_orders.some((order: any) => order?.status === 'IN_PROGRESS')) ||
              patient?.workflow_state === 'IN_IMAGING' ||
              patient?.current_status === '촬영중' ||
              patient?.workflow_state_display === '촬영중'
          );
          if (!filmingPatient) {
            setEncounterInfo(null);
            setSelectedSeriesId(null);
            setSeriesList([]);
            return;
          }
          const orderNotes = Array.isArray(filmingPatient.imaging_orders)
            ? filmingPatient.imaging_orders
                .map((order: any) => order?.order_notes)
                .filter((note: any) => typeof note === 'string' && note.trim().length > 0)
            : [];
          const encounterData = {
            encounter_id: filmingPatient.encounter_id,
            study_uid: filmingPatient.active_study_uid || null,
            patient_id: filmingPatient.patient_id,
            patient_name: filmingPatient.patient_name || filmingPatient.name || 'N/A',
            gender: filmingPatient.gender || 'N/A',
            date_of_birth: filmingPatient.date_of_birth || null,
            age: filmingPatient.age ?? null,
            order_notes: orderNotes,
          };
          setEncounterInfo(encounterData);
          if (encounterData.study_uid) {
            await fetchSeriesList(encounterData.study_uid);
          } else {
            setSelectedSeriesId(null);
            setSeriesList([]);
          }
        } catch (error) {
          console.error('Failed to fetch filming patient info:', error);
          setEncounterInfo(null);
          setSelectedSeriesId(null);
          setSeriesList([]);
        }
        return;
      }
      try {
        const encounterData = await getEncounterStudy(encounterIdParam);
        setEncounterInfo(encounterData);
        if (encounterData.study_uid) {
          await fetchSeriesList(encounterData.study_uid);
        } else {
          setSelectedSeriesId(null);
          setSeriesList([]);
        }
      } catch (error) {
        console.error('Failed to fetch encounter study info:', error);
        setEncounterInfo(null);
        setSelectedSeriesId(null);
        setSeriesList([]);
      }
    };
    fetchForEncounter();
  }, [encounterIdParam, fetchSeriesList]);

  // Fetch instances when a series is selected
  useEffect(() => {
    if (!selectedSeriesId) {
      setSeriesInstances([]);
      setSelectedSeriesInfo(null);
      setSelectedStudyInfo(null);
      setMaskSeriesId(null);
      setMaskInstances([]);
      setFeatureResult(null);
      setFeatureStatus('');
      setFeatureTaskId(null);
      setIsExtractingFeature(false);
      setTumorAnalysisResult(null);
      setTumorAnalysisError('');
      setIsAnalyzingTumor(false);
      setIsGeneratingReport(false);
      setReportError('');
      setGeneratedReport('');
      if (reportNoteRef.current) {
        reportNoteRef.current.value = '';
      }
      return;
    }

    const fetchInstances = async () => {
      setIsLoadingInstances(true);
      try {
        const cachedFeature = featureResultMapRef.current.get(selectedSeriesId);
        if (cachedFeature) {
          setFeatureResult(cachedFeature.result);
          setFeatureStatus(cachedFeature.status);
        } else {
          setFeatureResult(null);
          setFeatureStatus('');
        }
        setFeatureTaskId(null);
        setIsExtractingFeature(false);
        const cachedInstances = seriesInstancesCacheRef.current.get(selectedSeriesId);
        const cachedInfo = seriesInfoCacheRef.current.get(selectedSeriesId);
        if (cachedInstances && cachedInfo) {
          setSeriesInstances(cachedInstances);
          setSelectedSeriesInfo(cachedInfo);
          if (cachedInfo?.ParentStudy) {
            const cachedStudy = studyCacheRef.current.get(cachedInfo.ParentStudy);
            if (cachedStudy) {
              setSelectedStudyInfo(cachedStudy);
            } else {
              try {
                const studyInfo = await getStudyInfo(cachedInfo.ParentStudy);
                studyCacheRef.current.set(cachedInfo.ParentStudy, studyInfo);
                setSelectedStudyInfo(studyInfo);
              } catch (studyError) {
                console.error('Failed to fetch study metadata:', studyError);
                setSelectedStudyInfo(null);
              }
            }
          } else {
            setSelectedStudyInfo(null);
          }
          const cachedMask = maskSeriesMapRef.current.get(selectedSeriesId);
          if (cachedMask) {
            setMaskSeriesId(cachedMask.maskSeriesId);
            setMaskInstances(cachedMask.maskInstances);
          } else {
            setMaskSeriesId(null);
            setMaskInstances([]);
          }
          setIsLoadingInstances(false);
          return;
        }
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
        seriesInstancesCacheRef.current.set(selectedSeriesId, instances);
        seriesInfoCacheRef.current.set(selectedSeriesId, mergedInfo);

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

        const cachedMask = maskSeriesMapRef.current.get(selectedSeriesId);
        if (cachedMask) {
          setMaskSeriesId(cachedMask.maskSeriesId);
          setMaskInstances(cachedMask.maskInstances);
        } else {
          setMaskSeriesId(null);
          setMaskInstances([]);
        }
        setTumorAnalysisResult(null);
        setTumorAnalysisError('');
        setIsAnalyzingTumor(false);
        setIsGeneratingReport(false);
        setReportError('');
        setGeneratedReport('');
        if (reportNoteRef.current) {
          reportNoteRef.current.value = '';
        }
      } catch (error) {
        console.error('Failed to fetch series instances:', error);
        setSeriesInstances([]);
        setSelectedSeriesInfo(null);
        setSelectedStudyInfo(null);
        setMaskSeriesId(null);
        setMaskInstances([]);
        setTumorAnalysisResult(null);
        setTumorAnalysisError('');
        setIsAnalyzingTumor(false);
        setIsGeneratingReport(false);
        setReportError('');
        setGeneratedReport('');
        if (reportNoteRef.current) {
          reportNoteRef.current.value = '';
        }
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
            setTumorAnalysisResult(null);
            setTumorAnalysisError('');
            setIsAnalyzingTumor(false);
            setIsGeneratingReport(false);
            setReportError('');
            setGeneratedReport('');
            if (reportNoteRef.current) {
              reportNoteRef.current.value = '';
            }

            // Fetch mask instances
            const instances = await getSeriesInstances(resultMaskSeriesId);
            setMaskInstances(instances);
            if (selectedSeriesId) {
              maskSeriesMapRef.current.set(selectedSeriesId, {
                maskSeriesId: resultMaskSeriesId,
                maskInstances: instances,
              });
            }

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

  useEffect(() => {
    if (activeTab !== 'viewer') {
      setMeasurementEnabled(false);
    }
  }, [activeTab]);

  useEffect(() => {
    if (!featureTaskId) return;

    const pollInterval = setInterval(async () => {
      try {
        const taskStatus = await getFeatureExtractionTaskStatus(featureTaskId);

        if (taskStatus.status === 'PROGRESS' && taskStatus.progress) {
          setFeatureStatus(`${taskStatus.progress.step} (${taskStatus.progress.progress}%)`);
        } else if (taskStatus.status === 'SUCCESS' && taskStatus.result) {
          const result = taskStatus.result as any;
          if (result.status === 'failed') {
            setFeatureStatus(`Error: ${result.error || result.result?.error || 'AI processing failed'}`);
            setIsExtractingFeature(false);
            setFeatureTaskId(null);
            clearInterval(pollInterval);
          } else if (result.status === 'success') {
            const mergedResult = {
              ...result.result,
              seriesinstanceuid: result.result?.seriesinstanceuid ?? result.seriesinstanceuid,
            };
            setFeatureResult(mergedResult);
            setFeatureStatus('Feature extraction completed!');
            setIsExtractingFeature(false);
            setFeatureTaskId(null);
            if (featureTargetSeriesId) {
              featureResultMapRef.current.set(featureTargetSeriesId, {
                result: mergedResult,
                status: 'Feature extraction completed!',
              });
            }
            clearInterval(pollInterval);
          }
        } else if (taskStatus.status === 'FAILURE') {
          setFeatureStatus(`Error: ${taskStatus.error || 'Task execution failed'}`);
          setIsExtractingFeature(false);
          setFeatureTaskId(null);
          clearInterval(pollInterval);
        }
      } catch (error) {
        console.error('Failed to poll feature extraction task status:', error);
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [featureTaskId]);

  useEffect(() => {
    if (toolTab !== 'label') return;
    if (!maskSeriesId) {
      setMaskClasses([]);
      setMaskClassValues([]);
      setMaskClassError('');
      return;
    }
    loadMaskClasses(maskSeriesId);
  }, [toolTab, maskSeriesId, loadMaskClasses]);

  useEffect(() => {
    if (maskClasses.length === 0) return;
    const preferred = maskClasses.find((item) => item.label_value !== 0) ?? maskClasses[0];
    setMaskEditLabelValue(preferred.label_value);
  }, [maskClasses]);

  useEffect(() => {
    if (maskEditEnabled) {
      setShowOverlay(true);
    }
  }, [maskEditEnabled]);

  useEffect(() => {
    editedMaskSlicesRef.current.clear();
    setEditedSliceCount(0);
    setCanUndoCurrentSlice(false);
  }, [maskSeriesId]);

  useEffect(() => {
    setSelectedTumorIndex(null);
    setFocusPoint3d(null);
    setFocusPointMode('world');
  }, [tumorAnalysisResult, maskSeriesId]);

  const handleRunAi = async () => {
    if (!selectedSeriesId) {
      alert('Please select a series first');
      return;
    }

    const seriesInstanceUid = selectedSeriesInfo?.MainDicomTags?.SeriesInstanceUID;
    if (!seriesInstanceUid) {
      alert('SeriesInstanceUID가 없습니다. 다른 시리즈를 선택해주세요.');
      return;
    }

    if (isCreatingMask || isExtractingFeature) {
      alert('AI run is already in progress');
      return;
    }

    setIsCreatingMask(true);
    setMaskProgress('Starting segmentation...');
    setIsExtractingFeature(true);
    setFeatureStatus('Starting feature extraction...');
    setFeatureResult(null);
    setFeatureTargetSeriesId(selectedSeriesId);
    setAiRunSeriesIds((prev) => {
      const next = new Set(prev);
      next.add(selectedSeriesId);
      return next;
    });

    const [segResult, featureResult] = await Promise.allSettled([
      createSegmentationMask(selectedSeriesId),
      createFeatureExtraction(seriesInstanceUid),
    ]);

    if (segResult.status === 'fulfilled') {
      setCurrentTaskId(segResult.value.task_id);
      setMaskProgress('Task created, processing...');
    } else {
      console.error('Failed to create segmentation mask:', segResult.reason);
      setMaskProgress('Failed to start segmentation task');
      setIsCreatingMask(false);
    }

    if (featureResult.status === 'fulfilled') {
      setFeatureTaskId(featureResult.value.task_id);
      setFeatureStatus('Task created, processing...');
    } else {
      console.error('Failed to start feature extraction:', featureResult.reason);
      setFeatureStatus('Failed to start feature extraction task');
      setIsExtractingFeature(false);
    }
  };

  const handleTumorAnalysis = async () => {
    if (!maskSeriesId) {
      alert('마스크 시리즈가 없습니다. 먼저 AI Segmentation을 실행해주세요.');
      return;
    }
    if (isAnalyzingTumor) {
      return;
    }

    setIsAnalyzingTumor(true);
    setTumorAnalysisError('');
    try {
      const result = await analyzeTumor(maskSeriesId);
      setTumorAnalysisResult(result);
    } catch (error) {
      console.error('Failed to analyze tumor:', error);
      setTumorAnalysisError('종양 분석에 실패했습니다.');
    } finally {
      setIsAnalyzingTumor(false);
    }
  };

  const handleOpenAnalysisModal = () => {
    if (!tumorAnalysisResult) {
      alert('종양 분석 결과가 없습니다. 먼저 종양 분석을 실행해주세요.');
      return;
    }
    setIsAnalysisModalOpen(true);
  };

  const handleOpenAutoReportModal = () => {
    if (!generatedReport.trim()) {
      alert('자동 보고서가 없습니다. 먼저 자동 보고서를 생성해주세요.');
      return;
    }
    setIsAutoReportModalOpen(true);
  };

  const handleGenerateReport = async () => {
    if (!tumorAnalysisResult) {
      alert('종양 분석 결과가 없습니다. 먼저 종양 분석을 실행해주세요.');
      return;
    }
    if (isGeneratingReport || isGeneratingReportV2) {
      return;
    }

    setIsGeneratingReport(true);
    setReportError('');
    try {
      const payload = buildReportPayload();
      if (!payload) {
        setReportError('종양 분석 결과가 없습니다.');
        return;
      }
      const result = await generateReport(payload);
      setGeneratedReport(result.report || '');
    } catch (error) {
      console.error('Failed to generate report:', error);
      setReportError('자동 보고서 생성에 실패했습니다.');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleGenerateReportV2 = async () => {
    if (!tumorAnalysisResult) {
      alert('종양 분석 결과가 없습니다. 먼저 종양 분석을 실행해주세요.');
      return;
    }
    if (isGeneratingReport || isGeneratingReportV2) {
      return;
    }

    setIsGeneratingReportV2(true);
    setReportV2Error('');
    try {
      const payload = buildReportPayload();
      if (!payload) {
        setReportV2Error('종양 분석 결과가 없습니다.');
        return;
      }
      const result = await generateReportV2(payload);
      setGeneratedReport(result.report || '');
    } catch (error) {
      console.error('Failed to generate report v2:', error);
      setReportV2Error('자동 보고서 생성 V2에 실패했습니다.');
    } finally {
      setIsGeneratingReportV2(false);
    }
  };

  const handleSaveReport = async () => {
    if (!generatedReport.trim()) {
      alert('저장할 보고서가 없습니다.');
      return;
    }
    const seriesInstanceUid = selectedSeriesInfo?.MainDicomTags?.SeriesInstanceUID;
    if (!seriesInstanceUid) {
      alert('SeriesInstanceUID가 없습니다. 다른 시리즈를 선택해주세요.');
      return;
    }
    if (isSavingReport) {
      return;
    }

    setIsSavingReport(true);
    setSaveReportError('');
    try {
      await saveCtReport(seriesInstanceUid, generatedReport, tumorAnalysisResult);
      alert('보고서가 저장되었습니다.');
    } catch (error) {
      console.error('Failed to save CT report:', error);
      setSaveReportError('보고서 저장에 실패했습니다.');
    } finally {
      setIsSavingReport(false);
    }
  };

  const analysis = tumorAnalysisResult?.analysis;
  const analysisComponents = analysis?.components ?? [];
  const analysisWarnings = tumorAnalysisResult?.warnings ?? [];
  const tumorBurdenPercent =
    analysis?.tumor_burden_percent ??
    (analysis?.tumor_to_liver_ratio !== null && analysis?.tumor_to_liver_ratio !== undefined
      ? analysis.tumor_to_liver_ratio * 100
      : null);

  const buildReportPayload = () => {
    if (!tumorAnalysisResult) {
      return null;
    }
    const reportNote = reportNoteRef.current?.value?.trim() || '';
    return {
      note: reportNote,
      basic_info: {
        spacing_mm: tumorAnalysisResult.spacing_mm
          ? {
              x: tumorAnalysisResult.spacing_mm.x ?? null,
              y: tumorAnalysisResult.spacing_mm.y ?? null,
              z: tumorAnalysisResult.spacing_mm.z ?? null,
            }
          : null,
        slice_rows_cols: {
          slices: tumorAnalysisResult.metadata?.slice_count ?? null,
          rows: tumorAnalysisResult.metadata?.rows ?? null,
          cols: tumorAnalysisResult.metadata?.cols ?? null,
        },
      },
      overall_metrics: {
        tumor_count: analysis?.tumor_count ?? null,
        total_tumor_volume_ml: analysis?.total_tumor_volume_ml ?? null,
        liver_volume_ml: analysis?.liver_volume_ml ?? null,
        tumor_burden_percent: tumorBurdenPercent ?? null,
      },
      tumors: analysisComponents.map((component: any, index: number) => ({
        tumor_index: index + 1,
        volume_ml: component?.volume_ml ?? null,
        max_diameter_mm: component?.max_diameter_mm ?? null,
        centroid_mm: component?.centroid_mm ?? null,
        surface_area_mm2: component?.boundary_features?.surface_area_mm2 ?? null,
        surface_area_to_volume_ratio:
          component?.boundary_features?.surface_area_to_volume_ratio ?? null,
        distance_to_capsule_mm: component?.distance_to_liver_capsule_mm ?? null,
        sphericity: component?.shape_metrics?.sphericity ?? null,
        compactness: component?.shape_metrics?.compactness ?? null,
        elongation: component?.shape_metrics?.elongation ?? null,
      })),
      warnings: analysisWarnings,
    };
  };

  const renderAnalysisDetails = () => (
    <div className="analysis-details">
      <div className="analysis-section">
        <div className="analysis-section-title">기본 정보</div>
        <div className="analysis-grid">
          <div className="analysis-row">
            <span className="analysis-label">Spacing (mm)</span>
            <span className="analysis-value">
              {formatNumber(tumorAnalysisResult.spacing_mm?.x, 3)} x {formatNumber(tumorAnalysisResult.spacing_mm?.y, 3)} x {formatNumber(tumorAnalysisResult.spacing_mm?.z, 3)}
            </span>
          </div>
          <div className="analysis-row">
            <span className="analysis-label">Slice / Rows / Cols</span>
            <span className="analysis-value">
              {formatValue(tumorAnalysisResult.metadata?.slice_count)} / {formatValue(tumorAnalysisResult.metadata?.rows)} / {formatValue(tumorAnalysisResult.metadata?.cols)}
            </span>
          </div>
        </div>
      </div>

      <div className="analysis-section">
        <div className="analysis-section-title">전체 지표</div>
        <div className="analysis-grid">
          <div className="analysis-row">
            <span className="analysis-label">종양 개수</span>
            <span className="analysis-value">{formatValue(analysis?.tumor_count)}</span>
          </div>
          <div className="analysis-row">
            <span className="analysis-label">총 종양 부피 (mL)</span>
            <span className="analysis-value">{formatNumber(analysis?.total_tumor_volume_ml, 2)}</span>
          </div>
          <div className="analysis-row">
            <span className="analysis-label">간 부피 (mL)</span>
            <span className="analysis-value">{formatNumber(analysis?.liver_volume_ml, 2)}</span>
          </div>
          <div className="analysis-row">
            <span className="analysis-label">간 대비 종양 비율 (%)</span>
            <span className="analysis-value">{formatPercent(tumorBurdenPercent, 2)}</span>
          </div>
        </div>
      </div>

      <div className="analysis-section">
        <div className="analysis-section-title">종양 상세</div>
        {analysisComponents.length === 0 ? (
          <div className="analysis-empty">종양 정보가 없습니다.</div>
        ) : (
          <div className="analysis-components">
            {analysisComponents.map((component: any, index: number) => (
              <div
                key={`${component.label}-${index}`}
                className={`analysis-component clickable${selectedTumorIndex === index ? ' active' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => handleSelectTumorComponent(component, index)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handleSelectTumorComponent(component, index);
                  }
                }}
              >
                <div className="analysis-component-title">
                  종양 {index + 1}
                </div>
                <div className="analysis-grid">
                  <div className="analysis-row full">
                    <span className="analysis-label">Centroid (mm)</span>
                    <span className="analysis-value">{formatCoord(component.centroid_mm, 2)}</span>
                  </div>
                  <div className="analysis-row">
                    <span className="analysis-label">Volume (mL)</span>
                    <span className="analysis-value">{formatNumber(component.volume_ml, 2)}</span>
                  </div>
                  <div className="analysis-row">
                    <span className="analysis-label">Max Diameter (mm)</span>
                    <span className="analysis-value">{formatNumber(component.max_diameter_mm, 2)}</span>
                  </div>
                  <div className="analysis-row">
                    <span className="analysis-label">Surface Area (mm²)</span>
                    <span className="analysis-value">{formatNumber(component.boundary_features?.surface_area_mm2, 2)}</span>
                  </div>
                  <div className="analysis-row">
                    <span className="analysis-label">Surface/Volume</span>
                    <span className="analysis-value">{formatNumber(component.boundary_features?.surface_area_to_volume_ratio, 4)}</span>
                  </div>
                  <div className="analysis-row">
                    <span className="analysis-label">Distance to Capsule (mm)</span>
                    <span className="analysis-value">{formatNumber(component.distance_to_liver_capsule_mm, 2)}</span>
                  </div>
                  <div className="analysis-row">
                    <span className="analysis-label">Sphericity</span>
                    <span className="analysis-value">{formatNumber(component.shape_metrics?.sphericity, 4)}</span>
                  </div>
                  <div className="analysis-row">
                    <span className="analysis-label">Compactness</span>
                    <span className="analysis-value">{formatNumber(component.shape_metrics?.compactness, 4)}</span>
                  </div>
                  <div className="analysis-row">
                    <span className="analysis-label">Elongation</span>
                    <span className="analysis-value">{formatNumber(component.shape_metrics?.elongation, 4)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {analysisWarnings.length > 0 && (
        <div className="analysis-section">
          <div className="analysis-section-title">경고</div>
          <div className="analysis-warning-list">
            {analysisWarnings.map((warning: string, index: number) => (
              <div key={`${warning}-${index}`} className="analysis-warning-item">
                {warning}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="post-processing-page">
      <PatientHeader
        patientId={headerPatientId}
        patientName={headerPatientName}
        gender={headerGender}
        birthDate={headerBirthDate}
        examType={headerExamType}
        examDate={headerExamDate}
        onBrandClick={handleGoToHome}
        actionButton={
          <div className="header-action-group">
            <button className="header-action-button" onClick={handleGoToAcquisition}>
              업로드 이동
            </button>
            <button
              className="header-action-button"
              onClick={handleEndFilming}
              disabled={isEndingFilming}
            >
              {isEndingFilming ? '촬영 종료 중...' : '촬영종료'}
            </button>
          </div>
        }
      />

      <div className="post-processing-content">
        <SeriesListSidebar
          seriesList={seriesList}
          selectedSeriesId={selectedSeriesId}
          onSeriesSelect={setSelectedSeriesId}
          isLoading={isLoadingSeries}
          orderNotes={headerOrderNotes}
          headerAction={
            <button
              type="button"
              className="series-refresh-button"
              onClick={() => fetchSeriesList(encounterInfo?.study_uid ?? null)}
              disabled={isLoadingSeries}
              title="Series 목록 새로고침"
              aria-label="Series 목록 새로고침"
            >
              {isLoadingSeries ? (
                <span className="series-refresh-spinner" aria-hidden="true" />
              ) : (
                <svg
                  className="series-refresh-icon"
                  viewBox="0 0 24 24"
                  role="img"
                  aria-hidden="true"
                >
                  <path
                    d="M17.65 6.35A7.95 7.95 0 0012 4a8 8 0 108 8h-2a6 6 0 11-1.76-4.24L14 10h6V4l-2.35 2.35z"
                    fill="currentColor"
                  />
                </svg>
              )}
            </button>
          }
        />

        <div className="main-content">
          <div className="tab-bar">
            <button
              className={`tab-button ${activeTab === 'viewer' ? 'active' : ''}`}
              onClick={() => setActiveTab('viewer')}
            >
              3D Segmentation
            </button>
            <button
              className={`tab-button ${activeTab === 'features' ? 'active' : ''}`}
              onClick={() => setActiveTab('features')}
            >
              Feature Extractor
            </button>
          </div>
          <div className="top-section">
            {activeTab === 'viewer' && (
              <div className="mask-panel">
                <div className="viewer-with-tools">
                  <div className="viewer-card">
                  <div className="viewer-card-header">
                    <div className="viewer-header-left">
                      <span>Viewer</span>
                      <div className="viewer-mode-toggle">
                        <button
                          type="button"
                          className={`viewer-mode-btn ${viewerMode === '2d' ? 'active' : ''}`}
                          onClick={() => setViewerMode('2d')}
                        >
                          2D
                        </button>
                        <button
                          type="button"
                          className={`viewer-mode-btn ${viewerMode === '3d' ? 'active' : ''}`}
                          onClick={() => setViewerMode('3d')}
                        >
                          3D
                        </button>
                      </div>
                    </div>
                    {viewerMode === '2d' && maskSeriesId && maskInstances.length > 0 && (
                      <div className="overlay-controls">
                        <label className="overlay-toggle">
                          <input
                            type="checkbox"
                            checked={showOverlay}
                            onChange={(e) => setShowOverlay(e.target.checked)}
                          />
                          <span>Overlay 표시</span>
                        </label>
                        <select
                          className="overlay-select"
                          value={maskFilter}
                          onChange={(e) => setMaskFilter(e.target.value as 'all' | 'liver' | 'tumor')}
                          disabled={!showOverlay}
                        >
                          <option value="all">전체</option>
                          <option value="liver">Liver만</option>
                          <option value="tumor">Tumor만</option>
                        </select>
                        <label className="overlay-opacity">
                          <span>투명도</span>
                          <input
                            type="range"
                            min={0.1}
                            max={1}
                            step={0.05}
                            value={maskOpacity}
                            onChange={(e) => setMaskOpacity(Number(e.target.value))}
                            disabled={!showOverlay}
                          />
                        </label>
                      </div>
                    )}
                  </div>
                  <div className="mask-viewer">
                  {selectedSeriesId && seriesInstances.length > 0 ? (
                    viewerMode === '3d' ? (
                      <div className="viewer-3d-wrapper">
                        <DicomViewer3D
                          segmentationSeriesId={maskSeriesId}
                          focusPoint={focusPoint3d}
                          focusToken={focusPointToken}
                          focusMode={focusPointMode}
                          highlightBoundsVoxel={
                            selectedTumorIndex !== null
                              ? tumorAnalysisResult?.analysis?.components?.[selectedTumorIndex]?.bbox_voxel ?? null
                              : null
                          }
                        />
                      </div>
                    ) : (
                      <MaskOverlayViewer
                        seriesId={selectedSeriesId}
                        instances={seriesInstances}
                        maskSeriesId={maskSeriesId ?? ''}
                        maskInstances={maskInstances}
                        showOverlay={showOverlay && Boolean(maskSeriesId) && maskInstances.length > 0}
                        maskFilter={maskFilter}
                        maskOpacity={maskOpacity}
                        measurementEnabled={measurementEnabled}
                        measurementResetToken={measurementResetToken}
                        zoomCommand={zoomCommand}
                        measurementBoxes={measurementBoxes as any}
                        editEnabled={maskEditEnabled}
                        editMode={maskEditMode}
                        editLabelValue={maskEditLabelValue}
                        editBrushSize={maskBrushSize}
                        editResetToken={maskEditResetToken}
                        editUndoToken={maskEditUndoToken}
                        onUndoAvailabilityChange={(canUndo) => {
                          setCanUndoCurrentSlice(canUndo);
                        }}
                        onEditedSlicesChange={(count) => setEditedSliceCount(count)}
                        onMaskSliceEdited={handleMaskSliceEdited}
                        onMeasurementBoxesChange={(boxes) => {
                          setMeasurementBoxes(
                            boxes.map((box) => ({
                              id: box.id,
                              widthMm: box.widthMm,
                              heightMm: box.heightMm,
                              sliceIndex: box.sliceIndex,
                              start: box.start,
                              end: box.end,
                            }))
                          );
                          if (boxes.length > 0) {
                            const last = boxes[boxes.length - 1];
                            setMeasurementDimensions({
                              widthMm: last.widthMm,
                              heightMm: last.heightMm,
                            });
                          } else {
                            setMeasurementDimensions(null);
                          }
                        }}
                      />
                    )
                  ) : isLoadingInstances ? (
                    <div className="loading-state">Loading images...</div>
                  ) : (
                    <div className="empty-state">Series를 선택하세요</div>
                  )}
                  {isCreatingMask && (
                    <div className="viewer-status-overlay">
                      <div className="viewer-status-badge">
                        <span className="loading-spinner small" aria-label="Loading" />
                        Segmentation running...
                      </div>
                    </div>
                  )}
                  </div>
                  <div className="mask-buttons">
                    <button
                      className="btn-create-mask"
                      onClick={handleRunAi}
                      disabled={!selectedSeriesId || isCreatingMask || isExtractingFeature || hasRunAiForSelected}
                    >
                      {isCreatingMask || isExtractingFeature ? 'Running...' : 'AI Run'}
                    </button>
                  </div>
                  </div>
                  <div className="viewer-tools">
                    <div className="viewer-tools-tabs">
                      <button
                        className={`viewer-tools-tab ${toolTab === 'measure' ? 'active' : ''}`}
                        onClick={() => setToolTab('measure')}
                        type="button"
                      >
                        크기 측정
                      </button>
                      <button
                        className={`viewer-tools-tab ${toolTab === 'label' ? 'active' : ''}`}
                        onClick={() => setToolTab('label')}
                        type="button"
                      >
                        라벨링
                      </button>
                      <button
                        className={`viewer-tools-tab ${toolTab === 'report' ? 'active' : ''}`}
                        onClick={() => setToolTab('report')}
                        type="button"
                      >
                        분석/보고서
                      </button>
                    </div>
                    <div className="viewer-tools-body">
                    {toolTab === 'measure' && (
                      <div className="viewer-tools-panel">
                    <h4>종양 크기 측정</h4>
                    <p className="tool-hint">드래그로 가로/세로 길이를 측정하세요.</p>
                    <div className="tool-actions">
                      <button
                        className={`tool-btn ${measurementEnabled ? 'active' : ''}`}
                        onClick={() => setMeasurementEnabled((prev) => !prev)}
                        disabled={!selectedSeriesId}
                      >
                        {measurementEnabled ? '측정 종료' : '측정 시작'}
                      </button>
                      <button
                        className="tool-btn secondary"
                        onClick={() => {
                          setMeasurementResetToken((prev) => prev + 1);
                          setMeasurementDimensions(null);
                          setMeasurementBoxes([]);
                        }}
                        disabled={!selectedSeriesId}
                      >
                        초기화
                      </button>
                    </div>
                    <div className="tool-actions">
                      <button
                        className="tool-btn secondary"
                        onClick={() => setZoomCommand({ type: 'out', token: Date.now() })}
                        disabled={!selectedSeriesId}
                      >
                        축소
                      </button>
                      <button
                        className="tool-btn secondary"
                        onClick={() => setZoomCommand({ type: 'reset', token: Date.now() })}
                        disabled={!selectedSeriesId}
                      >
                        리셋
                      </button>
                      <button
                        className="tool-btn secondary"
                        onClick={() => setZoomCommand({ type: 'in', token: Date.now() })}
                        disabled={!selectedSeriesId}
                      >
                        확대
                      </button>
                    </div>
                    <div className="tool-result">
                      <span>가로 / 세로</span>
                      <strong>
                        {measurementDimensions
                          ? `${measurementDimensions.widthMm.toFixed(1)} x ${measurementDimensions.heightMm.toFixed(1)} mm`
                          : '—'}
                      </strong>
                    </div>
                    <div className="tool-box-list">
                      <div className="tool-box-header">측정 박스</div>
                      {measurementBoxes.length === 0 ? (
                        <div className="tool-box-empty">측정된 박스가 없습니다.</div>
                      ) : (
                        measurementBoxes.map((box, index) => (
                          <div key={box.id} className="tool-box-item">
                            <div className="tool-box-info">
                              <span>
                                {index + 1}. Slice {box.sliceIndex + 1} · {box.widthMm.toFixed(1)} x {box.heightMm.toFixed(1)} mm
                              </span>
                              <span className="tool-box-coords">
                                ({box.start.x.toFixed(0)}, {box.start.y.toFixed(0)}) → ({box.end.x.toFixed(0)}, {box.end.y.toFixed(0)})
                              </span>
                            </div>
                            <button
                              className="tool-box-delete"
                              onClick={() => {
                                const next = measurementBoxes.filter((item) => item.id !== box.id);
                                setMeasurementBoxes(next);
                                if (next.length === 0) {
                                  setMeasurementDimensions(null);
                                } else {
                                  const last = next[next.length - 1];
                                  setMeasurementDimensions({ widthMm: last.widthMm, heightMm: last.heightMm });
                                }
                              }}
                            >
                              삭제
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                      </div>
                    )}
                    {toolTab === 'label' && (
                      <div className="viewer-tools-panel labeling-panel">
                        <div className="labeling-header">
                          <div>
                            <div className="labeling-title">세그멘테이션 마스크 클래스</div>
                            <div className="labeling-subtitle">
                              {maskSeriesId && maskInstances.length > 0
                                ? `마스크 ${maskInstances.length}장 로드됨`
                                : '마스크 데이터가 없습니다.'}
                            </div>
                          </div>
                          <span className={`labeling-status ${maskSeriesId ? 'ready' : 'empty'}`}>
                            {maskSeriesId ? '마스크 사용 가능' : '마스크 없음'}
                          </span>
                        </div>
                        {maskClassError && (
                          <div className="analysis-error">{maskClassError}</div>
                        )}
                        {maskClassValues.length > 0 && (
                          <div className="labeling-values">
                            <span className="labeling-values-title">현재 마스크 라벨</span>
                            <div className="labeling-values-list">
                              {maskClassValues.map((value) => (
                                <span
                                  key={value}
                                  className="labeling-value-chip"
                                  style={{ '--label-color': getDefaultClassColor(value) } as React.CSSProperties}
                                >
                                  {value}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {isLoadingMaskClasses ? (
                          <div className="loading-state">
                            <div className="loading-spinner" aria-label="Loading" />
                          </div>
                        ) : (
                          <div className="labeling-classes">
                            {maskClasses.length === 0 ? (
                              <div className="viewer-tools-empty">
                                표시할 클래스가 없습니다.
                              </div>
                            ) : (
                              maskClasses.map((maskClass) => {
                                const color = getClassColor(maskClass);
                                return (
                                  <div
                                    key={maskClass.label_value}
                                    className="labeling-class-card"
                                    style={{ '--label-color': color } as React.CSSProperties}
                                  >
                                  <div className="labeling-class-top">
                                    <div className="labeling-class-chip">
                                      <span className="labeling-color" />
                                      {maskClass.label_name}
                                    </div>
                                    <div className="labeling-class-actions">
                                      <span
                                        className={`labeling-class-status ${
                                          maskClass.is_present ? 'present' : 'missing'
                                        }`}
                                      >
                                        {maskClass.is_present ? '마스크 포함' : '미사용'}
                                      </span>
                                      {maskClass.is_custom && (
                                        <button
                                          type="button"
                                          className="labeling-class-delete"
                                          onClick={() => handleDeleteMaskClass(maskClass.label_value)}
                                          disabled={deletingMaskClasses.has(maskClass.label_value)}
                                        >
                                          삭제
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                    <div className="labeling-class-desc">
                                      값 {maskClass.label_value}
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}
                        <div className="labeling-edit">
                          <div className="labeling-edit-header">
                            <span>마스크 수정</span>
                            <label className="labeling-toggle">
                              <input
                                type="checkbox"
                                checked={maskEditEnabled}
                                onChange={(event) => setMaskEditEnabled(event.target.checked)}
                                disabled={!maskSeriesId}
                              />
                              편집 모드
                            </label>
                          </div>
                          <div className="labeling-edit-controls">
                            <div className="labeling-edit-row">
                              <label>
                                모드
                                <select
                                  value={maskEditMode}
                                  onChange={(event) => setMaskEditMode(event.target.value as 'paint' | 'erase')}
                                  disabled={!maskEditEnabled}
                                >
                                  <option value="paint">그리기</option>
                                  <option value="erase">지우기</option>
                                </select>
                              </label>
                              <label>
                                클래스
                                <select
                                  value={maskEditLabelValue}
                                  onChange={(event) => setMaskEditLabelValue(Number(event.target.value))}
                                  disabled={!maskEditEnabled || maskClasses.length === 0}
                                >
                                  {maskClasses.map((maskClass) => (
                                    <option key={maskClass.label_value} value={maskClass.label_value}>
                                      {maskClass.label_name} (값 {maskClass.label_value})
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </div>
                            <label className="labeling-range">
                              브러시 크기
                              <input
                                type="range"
                                min={4}
                                max={40}
                                value={maskBrushSize}
                                onChange={(event) => setMaskBrushSize(Number(event.target.value))}
                                disabled={!maskEditEnabled}
                              />
                              <span>{maskBrushSize}px</span>
                            </label>
                            <div className="labeling-edit-actions">
                              <button
                                type="button"
                                className="tool-btn secondary"
                                disabled={!canUndoCurrentSlice}
                                onClick={() => setMaskEditUndoToken((prev) => prev + 1)}
                              >
                                이전
                              </button>
                              <button
                                type="button"
                                className="tool-btn secondary"
                                disabled={editedSliceCount === 0}
                                onClick={handleFullMaskReset}
                              >
                                전체 초기화
                              </button>
                              <button
                                type="button"
                                className="tool-btn"
                                onClick={handleSaveMaskEdits}
                                disabled={isSavingMaskEdits || editedSliceCount === 0 || !maskSeriesId}
                              >
                                {isSavingMaskEdits ? '저장 중...' : '저장'}
                              </button>
                            </div>
                            {saveMaskEditsError && (
                              <div className="analysis-error">{saveMaskEditsError}</div>
                            )}
                            <div className="labeling-edit-hint">
                              저장 시 기존 마스크를 덮어쓰고 새 마스크를 다시 불러옵니다.
                            </div>
                          </div>
                        </div>
                        <form className="labeling-form" onSubmit={handleAddMaskClass}>
                          <div className="labeling-form-row">
                            <label className="labeling-field">
                              클래스 이름
                              <input
                                type="text"
                                value={newClassName}
                                onChange={(event) => setNewClassName(event.target.value)}
                                placeholder="예: Vessel"
                              />
                            </label>
                            <label className="labeling-field">
                              값(선택)
                              <input
                                type="number"
                                value={newClassValue}
                                onChange={(event) => setNewClassValue(event.target.value)}
                                placeholder="자동"
                                min={1}
                              />
                            </label>
                            <label className="labeling-field">
                              색상
                              <input
                                type="color"
                                value={newClassColor}
                                onChange={(event) => setNewClassColor(event.target.value)}
                              />
                            </label>
                            <button
                              className="tool-btn"
                              type="submit"
                              disabled={isAddingMaskClass || !maskSeriesId}
                            >
                              {isAddingMaskClass ? '추가 중...' : '클래스 추가'}
                            </button>
                          </div>
                          <div className="labeling-form-hint">
                            값 입력을 비우면 자동으로 다음 번호가 할당됩니다.
                          </div>
                        </form>
                        <div className="labeling-note">
                          오버레이 필터에서 클래스별 표시를 선택할 수 있습니다.
                        </div>
                      </div>
                    )}
                    {toolTab === 'report' && (
                      <div className="viewer-tools-panel">
                    <div className="report-form">
                      <div className="report-section">
                        <div className="report-section-header">
                          <div className="report-section-title">종양 분석</div>
                          <div className="report-section-actions">
                            <button
                              className="tool-btn secondary"
                              disabled={!maskSeriesId || isAnalyzingTumor}
                              onClick={handleTumorAnalysis}
                            >
                              {isAnalyzingTumor ? '분석 중...' : '종양 분석'}
                            </button>
                            <button
                              type="button"
                              className="analysis-icon-button"
                              onClick={handleOpenAnalysisModal}
                              aria-label="종양 분석 보고서 보기"
                              title="종양 분석 보고서"
                            >
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path
                                  d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"
                                  fill="currentColor"
                                  opacity="0.18"
                                />
                                <path
                                  d="M14 3v5h5"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.6"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <path
                                  d="M8.5 12h7M8.5 15.5h7M8.5 9h4"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.6"
                                  strokeLinecap="round"
                                />
                              </svg>
                            </button>
                          </div>
                        </div>
                        {tumorAnalysisError && (
                          <div className="analysis-error">{tumorAnalysisError}</div>
                        )}
                        {tumorAnalysisResult && renderAnalysisDetails()}
                      </div>

                      <div className="report-section">
                        <div className="report-section-header">
                          <div className="report-section-title">자동 보고서 생성</div>
                          <div className="report-section-actions">
                            <button
                              type="button"
                              className="analysis-icon-button"
                              onClick={handleOpenAutoReportModal}
                              aria-label="자동 보고서 보기"
                              title="자동 보고서"
                            >
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path
                                  d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"
                                  fill="currentColor"
                                  opacity="0.18"
                                />
                                <path
                                  d="M14 3v5h5"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.6"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <path
                                  d="M8.5 12h7M8.5 15.5h7M8.5 9h4"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.6"
                                  strokeLinecap="round"
                                />
                              </svg>
                            </button>
                          </div>
                        </div>
                        <div className="report-generate-row">
                          <button
                            className="tool-btn secondary"
                            disabled={!tumorAnalysisResult || isGeneratingReport || isGeneratingReportV2}
                            onClick={handleGenerateReport}
                          >
                            {isGeneratingReport ? '생성 중...' : '자동 보고서 생성'}
                          </button>
                          <button
                            className="tool-btn secondary"
                            disabled={!tumorAnalysisResult || isGeneratingReport || isGeneratingReportV2}
                            onClick={handleGenerateReportV2}
                          >
                            {isGeneratingReportV2 ? '생성 중...' : '자동 보고서 생성 V2'}
                          </button>
                        </div>
                        {reportError && (
                          <div className="analysis-error">{reportError}</div>
                        )}
                        {reportV2Error && (
                          <div className="analysis-error">{reportV2Error}</div>
                        )}
                      </div>

                      <div className="report-section">
                        <div className="report-section-title">자동 보고서</div>
                        <textarea
                          className="auto-report-textarea"
                          rows={12}
                          value={generatedReport}
                          onChange={(event) => setGeneratedReport(event.target.value)}
                          placeholder="자동 보고서 생성 결과가 여기에 표시됩니다."
                        />
                        <div className="report-save-row">
                          <button
                            className="tool-btn"
                            disabled={isSavingReport || !generatedReport.trim()}
                            onClick={handleSaveReport}
                          >
                            {isSavingReport ? '저장 중...' : '저장'}
                          </button>
                        </div>
                        {saveReportError && (
                          <div className="analysis-error">{saveReportError}</div>
                        )}
                      </div>
                    </div>
                      </div>
                    )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'features' && (
              <div className="mask-panel">
                <h3>Feature Summary</h3>
                <div className="feature-summary">
                  {isExtractingFeature ? (
                    <div className="loading-state">
                      <div className="loading-spinner" aria-label="Loading" />
                    </div>
                  ) : featureResult ? (
                    <div className="feature-grid">
                      <div className="feature-card">
                        <span className="feature-label">Dimension</span>
                        <span className="feature-value">{featureResult.feature_dim ?? 'N/A'}</span>
                      </div>
                      <div className="feature-card">
                        <span className="feature-label">SeriesInstanceUID</span>
                        <span className="feature-value">{featureResult.seriesinstanceuid ?? 'N/A'}</span>
                      </div>
                      <div className="feature-card">
                        <span className="feature-label">Original Shape</span>
                        <span className="feature-value">
                          {featureResult.original_shape ? featureResult.original_shape.join(' x ') : 'N/A'}
                        </span>
                      </div>
                      <div className="feature-card">
                        <span className="feature-label">Original Spacing</span>
                        <span className="feature-value">
                          {featureResult.original_spacing ? featureResult.original_spacing.join(' x ') : 'N/A'}
                        </span>
                      </div>
                      <div className="feature-card feature-heatmap">
                        <span className="feature-label">Heatmap (first 512)</span>
                        <div className="heatmap-grid">
                          {buildHeatmapCells(featureResult.features || []).map((cell) => (
                            <div
                              key={cell.key}
                              className="heatmap-cell"
                              style={{ backgroundColor: cell.color }}
                              data-value={cell.value.toFixed(4)}
                              title={cell.value.toFixed(4)}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="empty-state">
                      {featureStatus || 'Extract Feature를 실행하면 결과가 표시됩니다.'}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {isAnalysisModalOpen && (
        <div
          className="analysis-modal-backdrop"
          onClick={() => setIsAnalysisModalOpen(false)}
        >
          <div
            className="analysis-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="종양 분석 정보"
          >
            <div className="analysis-modal-header">
              <h4>종양 분석 정보</h4>
              <button
                className="analysis-modal-close"
                type="button"
                onClick={() => setIsAnalysisModalOpen(false)}
                aria-label="닫기"
              >
                ✕
              </button>
            </div>
            <div className="analysis-modal-body">
              {renderAnalysisDetails()}
            </div>
          </div>
        </div>
      )}

      {isAutoReportModalOpen && (
        <div
          className="analysis-modal-backdrop"
          onClick={() => setIsAutoReportModalOpen(false)}
        >
          <div
            className="analysis-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="자동 보고서"
          >
            <div className="analysis-modal-header">
              <h4>자동 보고서</h4>
              <button
                className="analysis-modal-close"
                type="button"
                onClick={() => setIsAutoReportModalOpen(false)}
                aria-label="닫기"
              >
                ✕
              </button>
            </div>
            <div className="analysis-modal-body">
              <div className="auto-report-modal">
                <div className="auto-report-meta">
                  <div className="auto-report-meta-row">
                    <span className="auto-report-meta-label">환자</span>
                    <span className="auto-report-meta-value">{headerPatientName || 'N/A'}</span>
                  </div>
                  <div className="auto-report-meta-row">
                    <span className="auto-report-meta-label">환자 ID</span>
                    <span className="auto-report-meta-value">{headerPatientId}</span>
                  </div>
                  <div className="auto-report-meta-row">
                    <span className="auto-report-meta-label">성별</span>
                    <span className="auto-report-meta-value">{headerGender}</span>
                  </div>
                  <div className="auto-report-meta-row">
                    <span className="auto-report-meta-label">생년월일</span>
                    <span className="auto-report-meta-value">{headerBirthDate || 'N/A'}</span>
                  </div>
                  <div className="auto-report-meta-row">
                    <span className="auto-report-meta-label">촬영 정보</span>
                    <span className="auto-report-meta-value">{headerExamType}</span>
                  </div>
                  <div className="auto-report-meta-row">
                    <span className="auto-report-meta-label">촬영일</span>
                    <span className="auto-report-meta-value">{headerExamDate || 'N/A'}</span>
                  </div>
                </div>
                <div className="auto-report-divider" />
                <div className="auto-report-content">
                  {generatedReport}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default PostProcessingPage;
