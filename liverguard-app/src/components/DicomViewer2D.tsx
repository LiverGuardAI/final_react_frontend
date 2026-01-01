// src/components/DicomViewer2D.tsx
import { useEffect, useRef, useState, useCallback } from 'react';
import { init as csRenderInit, RenderingEngine } from '@cornerstonejs/core';
import { init as csToolsInit } from '@cornerstonejs/tools';
import * as cornerstone from '@cornerstonejs/core';
import cornerstoneWADOImageLoader from 'cornerstone-wado-image-loader';
import dicomParser from 'dicom-parser';
import { getSeriesInstances, getInstanceFileUrl } from '../api/orthanc_api';

interface DicomViewer2DProps {
  seriesId: string | null;
  segmentationSeriesId?: string | null;
}

let initialized = false;

const FIXED_MASK_COLORS: Record<number, { r: number; g: number; b: number; a: number }> = {
  1: { r: 255, g: 0, b: 0, a: 180 },
  2: { r: 0, g: 255, b: 0, a: 180 },
  1000: { r: 255, g: 0, b: 0, a: 180 },
  2000: { r: 0, g: 255, b: 0, a: 180 },
  208: { r: 0, g: 255, b: 0, a: 180 },
  232: { r: 255, g: 0, b: 0, a: 180 },
  3: { r: 0, g: 0, b: 255, a: 180 },
  4: { r: 255, g: 255, b: 0, a: 180 },
  5: { r: 255, g: 0, b: 255, a: 180 },
  6: { r: 0, g: 255, b: 255, a: 180 },
};

const FALLBACK_COLOR_PALETTE = [
  { r: 255, g: 165, b: 0, a: 180 },
  { r: 128, g: 0, b: 128, a: 180 },
  { r: 255, g: 192, b: 203, a: 180 },
  { r: 165, g: 42, b: 42, a: 180 },
];

const getColorForMaskValue = (
  maskValue: number,
  unknownColorMap: Map<number, { r: number; g: number; b: number; a: number }>
) => {
  if (maskValue === 0) {
    return { r: 0, g: 0, b: 0, a: 0 };
  }
  if (FIXED_MASK_COLORS[maskValue]) {
    return FIXED_MASK_COLORS[maskValue];
  }
  if (!unknownColorMap.has(maskValue)) {
    const colorIndex = unknownColorMap.size % FALLBACK_COLOR_PALETTE.length;
    unknownColorMap.set(maskValue, FALLBACK_COLOR_PALETTE[colorIndex]);
  }
  return unknownColorMap.get(maskValue)!;
};

const getDicomNumber = (value: unknown): number | null => {
  if (value === undefined || value === null) return null;
  if (Array.isArray(value)) {
    return getDicomNumber(value[0]);
  }
  if (typeof value === 'string') {
    const first = value.split('\\')[0];
    const parsed = parseFloat(first);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  return null;
};

const getDicomString = (value: unknown): string | null => {
  if (value === undefined || value === null) return null;
  if (Array.isArray(value)) {
    return getDicomString(value[0]);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : null;
  }
  return null;
};

const formatDicomDateParts = (value: any): string | null => {
  if (!value || typeof value !== 'object') return null;
  const year = typeof value.year === 'number' ? value.year : Number(value.year);
  const month = typeof value.month === 'number' ? value.month : Number(value.month);
  const day = typeof value.day === 'number' ? value.day : Number(value.day);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  const y = String(year).padStart(4, '0');
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}${m}${d}`;
};

const getDicomTagString = (image: any, tag: string): string | null => {
  const data = image?.data;
  if (!data || typeof data.string !== 'function') return null;
  return getDicomString(data.string(tag));
};

function initializeWADOImageLoader() {
  const cornerstoneWithEvents = cornerstone as typeof cornerstone & { EVENTS?: typeof cornerstone.Enums.Events };
  if (!cornerstoneWithEvents.EVENTS) {
    cornerstoneWithEvents.EVENTS = cornerstone.Enums.Events;
  }
  cornerstoneWADOImageLoader.external.cornerstone = cornerstoneWithEvents;
  cornerstoneWADOImageLoader.external.dicomParser = dicomParser;
  cornerstoneWADOImageLoader.configure({
    useWebWorkers: true,
    decodeConfig: {
      convertFloatPixelDataToInt: false,
    },
  });
}

export default function DicomViewer2D({ seriesId, segmentationSeriesId }: DicomViewer2DProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [currentSlice, setCurrentSlice] = useState(0);
  const [totalSlices, setTotalSlices] = useState(0);
  const [loading, setLoading] = useState(false);
  const [overlayEnabled, setOverlayEnabled] = useState(true);
  const [overlayOpacity, setOverlayOpacity] = useState(0.6);
  const [classVisibility, setClassVisibility] = useState<Record<string, boolean>>({
    liver: true,
    tumor: true,
    other: true,
  });
  const renderingEngineRef = useRef<RenderingEngine | null>(null);
  const renderHandlerRef = useRef<((evt: Event) => void) | null>(null);
  const overlayRenderTokenRef = useRef(0);
  const segImageIdsRef = useRef<string[]>([]);
  const ctInstancesRef = useRef<any[]>([]);
  const segInstanceNumberMapRef = useRef<Map<number, string>>(new Map());
  const preloadCancelledRef = useRef(false);
  const [preloadProgress, setPreloadProgress] = useState(0);
  const renderSegmentationOverlayRef = useRef<((sliceIndex: number, retryCount?: number) => Promise<void>) | null>(null);
  const [seriesMetadata, setSeriesMetadata] = useState<{
    studyDate?: string;
    seriesLabel?: string;
    modality?: string;
    pixelSpacing?: string;
  } | null>(null);

  const getClassKeyForValue = useCallback((value: number) => {
    if (value === 0) return 'background';
    if (value === 1 || value === 1000 || value === 232) return 'liver';
    if (value === 2 || value === 2000 || value === 208) return 'tumor';
    return 'other';
  }, []);

  const getInstanceNumber = useCallback((instance: any): number | null => {
    const rawValue = instance?.MainDicomTags?.InstanceNumber ?? instance?.IndexInSeries;
    if (rawValue === undefined || rawValue === null) return null;
    const parsed = parseInt(String(rawValue), 10);
    return Number.isFinite(parsed) ? parsed : null;
  }, []);

  useEffect(() => {
    const initializeCornerstone = async () => {
      if (!initialized) {
        try {
          await csRenderInit();
          await csToolsInit();
          initializeWADOImageLoader();
          initialized = true;
        } catch (error) {
          console.error('Failed to initialize Cornerstone:', error);
        }
      }
    };

    initializeCornerstone();
  }, []);

  // Render SEG overlay on canvas with viewport transformation
  const renderSegmentationOverlay = useCallback(async (sliceIndex: number, retryCount = 0) => {
    const renderToken = ++overlayRenderTokenRef.current;
    const canvas = overlayCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }

    if (
      !overlayCanvasRef.current ||
      !renderingEngineRef.current ||
      segImageIdsRef.current.length === 0 ||
      !overlayEnabled
    ) {
      return;
    }

    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    const ctInstance = ctInstancesRef.current[sliceIndex];
    const ctInstanceNumber = getInstanceNumber(ctInstance);
    let segImageId: string | undefined;

    if (ctInstanceNumber !== null) {
      segImageId = segInstanceNumberMapRef.current.get(ctInstanceNumber);
    }

    if (!segImageId) {
      segImageId = segImageIdsRef.current[sliceIndex];
    }

    if (!segImageId) {
      console.log('DicomViewer2D: No SEG image for slice', sliceIndex, 'instance', ctInstanceNumber);
      return;
    }

    try {
      console.log('DicomViewer2D: Loading SEG overlay for slice', sliceIndex);

      const image = await cornerstone.imageLoader.loadAndCacheImage(segImageId);
      if (renderToken !== overlayRenderTokenRef.current) {
        return;
      }
      const pixelData = image.getPixelData();
      const maskWidth = image.width;
      const maskHeight = image.height;
      const maskLength = pixelData.length;

      // Sample pixel values to diagnose empty/flat masks without heavy cost
      const sampleStep = Math.max(1, Math.floor(maskLength / 5000));
      const uniqueSampleValues = new Set<number>();
      let sampleNonZero = 0;
      for (let i = 0; i < maskLength; i += sampleStep) {
        const value = pixelData[i];
        uniqueSampleValues.add(value);
        if (value !== 0) {
          sampleNonZero++;
        }
      }
      const sampleValues = Array.from(uniqueSampleValues).slice(0, 12);
      console.log(
        'DicomViewer2D: SEG pixel sample',
        {
          type: pixelData.constructor?.name,
          length: maskLength,
          uniqueSampleValues: sampleValues,
          sampleNonZero,
        }
      );

      // Get viewport and base image from Cornerstone3D
      const viewport = renderingEngineRef.current.getViewport('CT_STACK') as any;
      if (!viewport) {
        console.warn('DicomViewer2D: Viewport not found');
        return;
      }

      // Get canvas element from viewport to match dimensions
      // Use requestAnimationFrame to ensure DOM is ready
      const getCanvas = (): HTMLCanvasElement | null => {
        const viewportElement = viewport.element;
        return viewportElement.querySelector('canvas:not([data-overlay])') as HTMLCanvasElement;
      };

      let cornerstoneCanvas = getCanvas();

      // Retry mechanism: if canvas not found, wait and retry
      if (!cornerstoneCanvas && retryCount < 10) {
        console.log('DicomViewer2D: Canvas not found, retrying... (attempt', retryCount + 1, ')');
        requestAnimationFrame(() => {
          renderSegmentationOverlay(sliceIndex, retryCount + 1);
        });
        return;
      }

      if (!cornerstoneCanvas) {
        console.warn('DicomViewer2D: Cornerstone canvas not found after retries');
        return;
      }

      // Match overlay canvas to Cornerstone canvas
      if (!canvas) {
        console.warn('DicomViewer2D: Overlay canvas not available');
        return;
      }

      canvas.width = cornerstoneCanvas.width;
      canvas.height = cornerstoneCanvas.height;

      const csRect = cornerstoneCanvas.getBoundingClientRect();
      canvas.style.width = `${csRect.width}px`;
      canvas.style.height = `${csRect.height}px`;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      console.log('DicomViewer2D: Canvas dimensions:', canvas.width, 'x', canvas.height);
      console.log('DicomViewer2D: SEG dimensions:', maskWidth, 'x', maskHeight);

      // Get current image to match dimensions
      const currentImageIdIndex = viewport.getCurrentImageIdIndex();
      const currentImageId = viewport.imageIds[currentImageIdIndex];
      const baseImage = await cornerstone.imageLoader.loadAndCacheImage(currentImageId);
      if (renderToken !== overlayRenderTokenRef.current) {
        return;
      }
      const baseWidth = baseImage.width;
      const baseHeight = baseImage.height;

      // Calculate scaling if mask and base image sizes differ
      const scaleX = baseWidth / maskWidth;
      const scaleY = baseHeight / maskHeight;

      const imagePlaneModule = cornerstone.metaData.get('imagePlaneModule', currentImageId);
      const imageOrientation = imagePlaneModule?.imageOrientationPatient;
      const rowCosines = imagePlaneModule?.rowCosines ??
        (imageOrientation ? imageOrientation.slice(0, 3) : [1, 0, 0]);
      const columnCosines = imagePlaneModule?.columnCosines ??
        (imageOrientation ? imageOrientation.slice(3, 6) : [0, 1, 0]);
      const rowPixelSpacing = imagePlaneModule?.rowPixelSpacing ?? imagePlaneModule?.pixelSpacing?.[0] ?? 1;
      const columnPixelSpacing = imagePlaneModule?.columnPixelSpacing ?? imagePlaneModule?.pixelSpacing?.[1] ?? 1;
      const originWorld = imagePlaneModule?.imagePositionPatient ?? [0, 0, 0];

      // Build an affine transform from image IJK to canvas using worldToCanvas
      const worldToCanvas = typeof viewport.worldToCanvas === 'function'
        ? viewport.worldToCanvas.bind(viewport)
        : null;

      if (!worldToCanvas) {
        console.warn('DicomViewer2D: worldToCanvas not available, using fallback transform');
      }

      const originCanvas = worldToCanvas
        ? worldToCanvas(originWorld)
        : [0, 0];
      // DICOM: rowCosines = image x-axis (columns), columnCosines = image y-axis (rows)
      const xWorld = [
        originWorld[0] + rowCosines[0] * columnPixelSpacing,
        originWorld[1] + rowCosines[1] * columnPixelSpacing,
        originWorld[2] + rowCosines[2] * columnPixelSpacing,
      ];
      const yWorld = [
        originWorld[0] + columnCosines[0] * rowPixelSpacing,
        originWorld[1] + columnCosines[1] * rowPixelSpacing,
        originWorld[2] + columnCosines[2] * rowPixelSpacing,
      ];
      const xCanvas = worldToCanvas ? worldToCanvas(xWorld) : [1, 0];
      const yCanvas = worldToCanvas ? worldToCanvas(yWorld) : [0, 1];
      const basisX = [xCanvas[0] - originCanvas[0], xCanvas[1] - originCanvas[1]];
      const basisY = [yCanvas[0] - originCanvas[0], yCanvas[1] - originCanvas[1]];

      ctx.save();
      ctx.setTransform(basisX[0], basisX[1], basisY[0], basisY[1], originCanvas[0], originCanvas[1]);

      // Pre-compute min/max for dynamic masks (not just 0/1/2)
      let minValue = Number.POSITIVE_INFINITY;
      let maxValue = Number.NEGATIVE_INFINITY;
      for (let i = 0; i < pixelData.length; i++) {
        const v = pixelData[i];
        if (!Number.isFinite(v)) continue;
        if (v < minValue) minValue = v;
        if (v > maxValue) maxValue = v;
      }

      const hasDynamicRange =
        Number.isFinite(minValue) &&
        Number.isFinite(maxValue) &&
        maxValue > minValue;

      const unknownColorMap = new Map<number, { r: number; g: number; b: number; a: number }>();

      // Draw mask pixels
      let nonZeroCount = 0;
      for (let y = 0; y < maskHeight; y++) {
        for (let x = 0; x < maskWidth; x++) {
          const maskIndex = y * maskWidth + x;
          const maskValue = pixelData[maskIndex];

          // Treat any non-zero value as mask; handle float/large values too
          if (maskValue !== 0) {
            const classKey = getClassKeyForValue(maskValue);
            if (classKey !== 'background' && !classVisibility[classKey]) {
              continue;
            }

            nonZeroCount++;
            // Map mask coordinates to base image coordinates
            const baseX = x * scaleX;
            const baseY = y * scaleY;

            const color = getColorForMaskValue(maskValue, unknownColorMap);
            let alpha = (color.a / 255) * overlayOpacity;
            if (hasDynamicRange && maskValue !== 0) {
              const normalized = (maskValue - minValue) / (maxValue - minValue);
              alpha = Math.max(alpha, (0.2 + Math.min(0.6, Math.max(0, normalized)) * 0.6) * overlayOpacity);
            }

            ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
            ctx.fillRect(baseX, baseY, scaleX, scaleY);
          }
        }
      }

      if (renderToken !== overlayRenderTokenRef.current) {
        return;
      }
      ctx.restore();
      console.log('DicomViewer2D: SEG overlay rendered -', nonZeroCount, 'pixels');
    } catch (error) {
      console.error('DicomViewer2D: Failed to render SEG overlay:', error);
    }
  }, [classVisibility, getClassKeyForValue, overlayEnabled, overlayOpacity]);

  // Update ref whenever renderSegmentationOverlay changes
  useEffect(() => {
    renderSegmentationOverlayRef.current = renderSegmentationOverlay;
  }, [renderSegmentationOverlay]);

  // Keep viewport sized to container so overlay matches visible canvas
  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    if (typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => {
      if (!renderingEngineRef.current) return;
      renderingEngineRef.current.resize();
      const viewport = renderingEngineRef.current.getViewport('CT_STACK') as any;
      if (viewport) {
        viewport.render();
        const currentIndex = viewport.getCurrentImageIdIndex();
        renderSegmentationOverlay(currentIndex);
      }
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [renderSegmentationOverlay]);

  // Load SEG images when segmentationSeriesId changes
  useEffect(() => {
    if (!segmentationSeriesId) {
      segImageIdsRef.current = [];
      segInstanceNumberMapRef.current = new Map();
      const canvas = overlayCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
      return;
    }

    const loadSegmentation = async () => {
      try {
        console.log('DicomViewer2D: Loading SEG series:', segmentationSeriesId);
        const segInstances = await getSeriesInstances(segmentationSeriesId);

        // Sort SEG instances by InstanceNumber
        const sortedSegInstances = [...segInstances].sort((a: any, b: any) => {
          const aNum = parseInt(a.MainDicomTags?.InstanceNumber || a.IndexInSeries || '0');
          const bNum = parseInt(b.MainDicomTags?.InstanceNumber || b.IndexInSeries || '0');
          return aNum - bNum;
        });

        const segImageIds = sortedSegInstances.map((instance: any) =>
          `wadouri:${getInstanceFileUrl(instance.ID)}`
        );

        segImageIdsRef.current = segImageIds;
        const instanceNumberMap = new Map<number, string>();
        sortedSegInstances.forEach((instance: any, index: number) => {
          const instanceNumber = getInstanceNumber(instance);
          if (instanceNumber !== null) {
            instanceNumberMap.set(instanceNumber, segImageIds[index]);
          }
        });
        segInstanceNumberMapRef.current = instanceNumberMap;
        console.log('DicomViewer2D: Loaded', segImageIds.length, 'SEG images');

        const renderingEngine = renderingEngineRef.current;
        if (renderingEngine) {
          const viewport = renderingEngine.getViewport('CT_STACK') as any;
          if (viewport) {
            const currentIndex = viewport.getCurrentImageIdIndex();
            renderSegmentationOverlay(currentIndex);
          }
        }
      } catch (error) {
        console.error('DicomViewer2D: Failed to load segmentation:', error);
      }
    };

    loadSegmentation();
  }, [segmentationSeriesId, getInstanceNumber, renderSegmentationOverlay]);

  useEffect(() => {
    if (!seriesId || !viewportRef.current) return;

    let isCancelled = false;

    const loadSeries = async () => {
      setLoading(true);
      try {
        // Fetch instances
        const instances = await getSeriesInstances(seriesId);

        if (isCancelled) {
          console.log('DicomViewer2D: Load cancelled after fetching instances');
          return;
        }

        // Sort instances by InstanceNumber
        const sortedInstances = [...instances].sort((a: any, b: any) => {
          const aNum = parseInt(a.MainDicomTags?.InstanceNumber || a.IndexInSeries || '0');
          const bNum = parseInt(b.MainDicomTags?.InstanceNumber || b.IndexInSeries || '0');
          return aNum - bNum;
        });

        setTotalSlices(sortedInstances.length);
        ctInstancesRef.current = sortedInstances;

        // Create rendering engine
        const renderingEngineId = 'dicomViewer2DEngine';
        if (renderingEngineRef.current) {
          renderingEngineRef.current.destroy();
        }

        if (isCancelled) {
          console.log('DicomViewer2D: Load cancelled before creating rendering engine');
          return;
        }

        const renderingEngine = new RenderingEngine(renderingEngineId);
        renderingEngineRef.current = renderingEngine;

        // Create viewport
        const viewportId = 'CT_STACK';
        const viewportInput: cornerstone.Types.PublicViewportInput = {
          viewportId,
          type: cornerstone.Enums.ViewportType.STACK as cornerstone.Enums.ViewportType,
          element: viewportRef.current as HTMLDivElement,
        };

        renderingEngine.enableElement(viewportInput);

        // Load images
        const imageIds = sortedInstances.map((instance: any) =>
          `wadouri:${getInstanceFileUrl(instance.ID)}`
        );

        const viewport = renderingEngine.getViewport(viewportId) as any;

        if (isCancelled) {
          console.log('DicomViewer2D: Load cancelled before setting stack');
          renderingEngine.destroy();
          renderingEngineRef.current = null;
          return;
        }

        await viewport.setStack(imageIds);

        if (isCancelled) {
          console.log('DicomViewer2D: Load cancelled after setting stack');
          renderingEngine.destroy();
          renderingEngineRef.current = null;
          return;
        }

        // Apply windowing before the first render to avoid the initial white flash
        try {
          const currentImageId = imageIds[0];
          const image = await cornerstone.imageLoader.loadAndCacheImage(currentImageId);

          const voiLutModule = cornerstone.metaData.get('voiLutModule', currentImageId);
          const modalityLutModule = cornerstone.metaData.get('modalityLutModule', currentImageId) || {};

          const voiWindowCenter = getDicomNumber(voiLutModule?.windowCenter ?? image.windowCenter);
          const voiWindowWidth = getDicomNumber(voiLutModule?.windowWidth ?? image.windowWidth);

          let windowCenter = voiWindowCenter ?? 40;   // Default for soft tissue
          let windowWidth = voiWindowWidth ?? 400;   // Default for soft tissue

          if (voiWindowCenter !== null && voiWindowWidth !== null) {
            console.log('DicomViewer2D: Using DICOM window - WC:', windowCenter, 'WW:', windowWidth);
          } else {
            console.log('DicomViewer2D: No window metadata found, using default - WC:', windowCenter, 'WW:', windowWidth);
          }

          const rescaleSlope = getDicomNumber(modalityLutModule?.rescaleSlope ?? image.slope) ?? 1;
          const rescaleIntercept = getDicomNumber(modalityLutModule?.rescaleIntercept ?? image.intercept) ?? 0;
          const pixelMin = image.minPixelValue ?? 0;

          if (
            Number.isFinite(rescaleSlope) &&
            Number.isFinite(rescaleIntercept) &&
            rescaleSlope !== 0 &&
            pixelMin >= 0 &&
            rescaleIntercept !== 0
          ) {
            windowCenter = (windowCenter - rescaleIntercept) / rescaleSlope;
            windowWidth = windowWidth / Math.abs(rescaleSlope);
            console.log(
              'DicomViewer2D: Adjusted window for rescale - WC:',
              windowCenter,
              'WW:',
              windowWidth
            );
          }

          if (!Number.isFinite(windowCenter) || !Number.isFinite(windowWidth) || windowWidth <= 1) {
            const min = image.minPixelValue ?? 0;
            const max = image.maxPixelValue ?? 1;
            windowCenter = (max + min) / 2;
            windowWidth = Math.max(1, max - min);
            console.log('DicomViewer2D: Fallback window from pixel range - WC:', windowCenter, 'WW:', windowWidth);
          }

          const lower = windowCenter - windowWidth / 2;
          const upper = windowCenter + windowWidth / 2;

          viewport.setProperties({
            voiRange: {
              lower,
              upper
            }
          });
          console.log('DicomViewer2D: Applied windowing - Lower:', lower, 'Upper:', upper);

          // Extract series metadata
          const generalSeriesModule = cornerstone.metaData.get('generalSeriesModule', currentImageId);
          const generalStudyModule = cornerstone.metaData.get('generalStudyModule', currentImageId);
          const imagePlaneModule = cornerstone.metaData.get('imagePlaneModule', currentImageId);
          const firstInstance = sortedInstances[0];
          const mainTags = firstInstance?.MainDicomTags || {};

          console.log('DicomViewer2D: Metadata debug', {
            currentImageId,
            mainTags,
            generalStudyModule,
            generalSeriesModule,
            imagePlaneModule,
            imageSpacing: {
              rowPixelSpacing: image.rowPixelSpacing,
              columnPixelSpacing: image.columnPixelSpacing,
            },
          });

          setSeriesMetadata({
            studyDate: getDicomTagString(image, 'x00080020')
              || getDicomString(mainTags?.StudyDate)
              || getDicomTagString(image, 'x00080021')
              || getDicomString(mainTags?.SeriesDate)
              || getDicomTagString(image, 'x00080022')
              || getDicomString(mainTags?.AcquisitionDate)
              || getDicomTagString(image, 'x00080012')
              || getDicomString(mainTags?.InstanceCreationDate)
              || formatDicomDateParts(generalStudyModule?.studyDate)
              || formatDicomDateParts(generalSeriesModule?.seriesDate)
              || getDicomString(generalStudyModule?.studyDate)
              || 'N/A',
            seriesLabel: getDicomTagString(image, 'x0008103e')
              || getDicomString(mainTags?.SeriesDescription)
              || getDicomString(generalSeriesModule?.seriesDescription)
              || getDicomString(generalSeriesModule?.bodyPartExamined)
              || 'N/A',
            modality: getDicomString(mainTags?.Modality)
              || getDicomString(generalSeriesModule?.modality)
              || 'N/A',
            pixelSpacing: imagePlaneModule?.pixelSpacing
              ? `${imagePlaneModule.pixelSpacing[0]?.toFixed(2)} × ${imagePlaneModule.pixelSpacing[1]?.toFixed(2)}`
              : (image.columnPixelSpacing && image.rowPixelSpacing)
                ? `${Number(image.rowPixelSpacing).toFixed(2)} × ${Number(image.columnPixelSpacing).toFixed(2)}`
                : 'N/A',
          });
        } catch (error) {
          console.error('DicomViewer2D: Error applying windowing:', error);
        }

        viewport.render();
        setCurrentSlice(1);

        // Add event listener for viewport rendering to update overlay
        const viewportElement = viewport.element;
        const handleViewportRender = () => {
          const currentIndex = viewport.getCurrentImageIdIndex();
          // Use ref to always call the latest renderSegmentationOverlay function
          if (renderSegmentationOverlayRef.current) {
            renderSegmentationOverlayRef.current(currentIndex);
          }
        };
        renderHandlerRef.current = handleViewportRender;
        viewportElement.addEventListener(cornerstone.Enums.Events.IMAGE_RENDERED, handleViewportRender);

        // Render initial SEG overlay if available
        renderSegmentationOverlay(0);

        // Start preloading all images in the background
        if (!isCancelled) {
          preloadImages(imageIds);
        }
      } catch (error) {
        console.error('Failed to load series:', error);
      } finally {
        setLoading(false);
      }
    };

    // Preload all images progressively in the background
    const preloadImages = async (imageIds: string[]) => {
      preloadCancelledRef.current = false;
      console.log('DicomViewer2D: Starting background preload of', imageIds.length, 'images');

      const totalImages = imageIds.length;
      let loadedCount = 0;

      // Strategy: Load images in chunks with prioritization
      // Priority 1: Current image (index 0) - already loaded
      // Priority 2: Images near current position (1-10)
      // Priority 3: Rest of the series

      const loadImage = async (index: number) => {
        if (preloadCancelledRef.current || isCancelled) {
          return;
        }

        try {
          await cornerstone.imageLoader.loadAndCacheImage(imageIds[index]);
          loadedCount++;
          const progress = Math.round((loadedCount / totalImages) * 100);
          setPreloadProgress(progress);

          if (loadedCount % 10 === 0 || loadedCount === totalImages) {
            console.log(`DicomViewer2D: Preloaded ${loadedCount}/${totalImages} images (${progress}%)`);
          }
        } catch (error) {
          console.warn(`DicomViewer2D: Failed to preload image ${index}:`, error);
        }
      };

      // Priority queue: nearby images first, then the rest
      const nearbyIndices: number[] = [];
      const farIndices: number[] = [];

      for (let i = 1; i < totalImages; i++) {
        if (i <= 10) {
          nearbyIndices.push(i);
        } else {
          farIndices.push(i);
        }
      }

      // Load nearby images first (with concurrency limit)
      const concurrencyLimit = 3;
      for (let i = 0; i < nearbyIndices.length; i += concurrencyLimit) {
        if (preloadCancelledRef.current || isCancelled) break;

        const chunk = nearbyIndices.slice(i, i + concurrencyLimit);
        await Promise.all(chunk.map(idx => loadImage(idx)));

        // Small delay to avoid overwhelming the browser
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Load remaining images
      for (let i = 0; i < farIndices.length; i += concurrencyLimit) {
        if (preloadCancelledRef.current || isCancelled) break;

        const chunk = farIndices.slice(i, i + concurrencyLimit);
        await Promise.all(chunk.map(idx => loadImage(idx)));

        await new Promise(resolve => setTimeout(resolve, 10));
      }

      if (!preloadCancelledRef.current && !isCancelled) {
        console.log('DicomViewer2D: Preloading complete - all images cached');
        setPreloadProgress(100);
      }
    };

    loadSeries();

    return () => {
      // Cancel any ongoing load operations
      isCancelled = true;
      preloadCancelledRef.current = true;
      console.log('DicomViewer2D: Cleanup - cancelling load and preload operations');

      // Remove event listener
      if (renderingEngineRef.current) {
        try {
          const viewport = renderingEngineRef.current.getViewport('CT_STACK') as any;
          if (viewport && viewport.element) {
            if (renderHandlerRef.current) {
              viewport.element.removeEventListener(
                cornerstone.Enums.Events.IMAGE_RENDERED,
                renderHandlerRef.current
              );
            }
          }
        } catch (e) {
          // Ignore errors during cleanup
        }
        renderingEngineRef.current.destroy();
        renderingEngineRef.current = null;
      }
    };
  }, [seriesId]);

  // Re-render overlay when visibility settings change (without reloading the series)
  useEffect(() => {
    if (!renderingEngineRef.current) return;

    try {
      const viewport = renderingEngineRef.current.getViewport('CT_STACK') as any;
      if (viewport) {
        const currentIndex = viewport.getCurrentImageIdIndex();
        renderSegmentationOverlay(currentIndex);
      }
    } catch (error) {
      // Viewport might not be ready yet, ignore
    }
  }, [classVisibility, overlayEnabled, overlayOpacity, renderSegmentationOverlay]);

  const handleSliceChange = useCallback((delta: number) => {
    if (!renderingEngineRef.current) return;

    const viewport = renderingEngineRef.current.getViewport('CT_STACK') as any;
    if (viewport) {
      const currentImageIdIndex = viewport.getCurrentImageIdIndex();
      const newIndex = Math.max(0, Math.min(totalSlices - 1, currentImageIdIndex + delta));
      viewport.setImageIdIndex(newIndex);
      viewport.render();
      setCurrentSlice(newIndex + 1);

      // Render SEG overlay for new slice
      renderSegmentationOverlay(newIndex);
    }
  }, [totalSlices, renderSegmentationOverlay]);

  // Add mouse wheel event handler for slice navigation
  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 1 : -1;
      handleSliceChange(delta);
    };

    element.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      element.removeEventListener('wheel', handleWheel);
    };
  }, [handleSliceChange]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 600, flexShrink: 0 }}>
        2D Viewer {segmentationSeriesId && '(with Overlay)'}
      </h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
        <button
          onClick={() => setOverlayEnabled((prev) => !prev)}
          style={{
            padding: '6px 12px',
            backgroundColor: overlayEnabled ? '#111827' : '#f3f4f6',
            color: overlayEnabled ? '#fff' : '#111827',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          Overlay {overlayEnabled ? 'On' : 'Off'}
        </button>
        <button
          onClick={() => setClassVisibility((prev) => ({ ...prev, liver: !prev.liver }))}
          style={{
            padding: '6px 12px',
            backgroundColor: classVisibility.liver ? '#ef4444' : '#f3f4f6',
            color: classVisibility.liver ? '#fff' : '#111827',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          Liver
        </button>
        <button
          onClick={() => setClassVisibility((prev) => ({ ...prev, tumor: !prev.tumor }))}
          style={{
            padding: '6px 12px',
            backgroundColor: classVisibility.tumor ? '#22c55e' : '#f3f4f6',
            color: classVisibility.tumor ? '#fff' : '#111827',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          Tumor
        </button>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#374151' }}>
          Opacity
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.05}
            value={overlayOpacity}
            onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
          />
        </label>
      </div>
      <div
        ref={viewportRef}
        style={{
          flex: 1,
          backgroundColor: '#000',
          borderRadius: '4px',
          position: 'relative',
        }}
      >
        {loading && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: '#fff',
          }}>
            Loading...
          </div>
        )}
        {/* SEG Overlay Canvas */}
        <canvas
          ref={overlayCanvasRef}
          data-overlay="true"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 2,
            pointerEvents: 'none',
            imageRendering: 'pixelated',
          }}
        />
        {/* Series Metadata Overlay */}
        {seriesMetadata && (
          <div style={{
            position: 'absolute',
            top: '12px',
            left: '12px',
            color: '#ffffff',
            fontSize: '11px',
            fontFamily: 'monospace',
            pointerEvents: 'none',
            zIndex: 10,
            lineHeight: '1.5',
            textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)',
          }}>
            <div>{seriesMetadata.studyDate}</div>
            <div>{seriesMetadata.seriesLabel}</div>
            <div>{seriesMetadata.modality}</div>
            <div>Spacing: {seriesMetadata.pixelSpacing} mm</div>
          </div>
        )}
      </div>
      {totalSlices > 0 && (
        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={() => handleSliceChange(-1)}
              style={{
                padding: '8px 16px',
                backgroundColor: '#f3f4f6',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              Previous
            </button>
            <span style={{ fontSize: '13px', color: '#6b7280' }}>
              Slice {currentSlice} / {totalSlices}
            </span>
            <button
              onClick={() => handleSliceChange(1)}
              style={{
                padding: '8px 16px',
                backgroundColor: '#f3f4f6',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              Next
            </button>
          </div>
          {preloadProgress > 0 && preloadProgress < 100 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                flex: 1,
                height: '4px',
                backgroundColor: '#e5e7eb',
                borderRadius: '2px',
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${preloadProgress}%`,
                  height: '100%',
                  backgroundColor: '#3b82f6',
                  transition: 'width 0.3s ease',
                }} />
              </div>
              <span style={{ fontSize: '11px', color: '#9ca3af', minWidth: '45px' }}>
                {preloadProgress}%
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
