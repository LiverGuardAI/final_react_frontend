// src/components/radiology/MaskOverlayViewer.tsx
import { useEffect, useRef, useState, useCallback } from 'react';
import cornerstone from 'cornerstone-core';
import cornerstoneWADOImageLoader from 'cornerstone-wado-image-loader';
import dicomParser from 'dicom-parser';
import { getInstanceFileUrl } from '../../api/orthanc_api';
import './DicomViewer.css';

// Cornerstone 설정
cornerstoneWADOImageLoader.external.cornerstone = cornerstone;
cornerstoneWADOImageLoader.external.dicomParser = dicomParser;

// Configure WADO Image Loader
cornerstoneWADOImageLoader.configure({
  useWebWorkers: true,
  decodeConfig: {
    convertFloatPixelDataToInt: false,
  },
});

const PREFETCH_DISTANCE = 3;
const PREFETCH_CONCURRENCY = 12;
// Fixed color mapping for specific mask values
// This ensures consistent colors across all slices
const FIXED_MASK_COLORS: { [key: number]: { r: number; g: number; b: number; a: number } } = {
  1: { r: 255, g: 0, b: 0, a: 180 },      // Red - Liver (일반적으로 1)
  2: { r: 0, g: 255, b: 0, a: 180 },      // Green - Tumor (일반적으로 2)
  1000: { r: 255, g: 0, b: 0, a: 180 },   // Red - Liver (큰 값 사용 시)
  2000: { r: 0, g: 255, b: 0, a: 180 },   // Green - Tumor (큰 값 사용 시)
  3: { r: 0, g: 0, b: 255, a: 180 },      // Blue
  4: { r: 255, g: 255, b: 0, a: 180 },    // Yellow
  5: { r: 255, g: 0, b: 255, a: 180 },    // Magenta
  6: { r: 0, g: 255, b: 255, a: 180 },    // Cyan
  7: { r: 255, g: 128, b: 0, a: 180 },    // Orange
  8: { r: 128, g: 0, b: 255, a: 180 },    // Purple
};

// Fallback color palette for unknown mask values
const FALLBACK_COLOR_PALETTE = [
  { r: 255, g: 165, b: 0, a: 180 },    // Orange
  { r: 128, g: 0, b: 128, a: 180 },    // Purple
  { r: 255, g: 192, b: 203, a: 180 },  // Pink
  { r: 165, g: 42, b: 42, a: 180 },    // Brown
];

// Helper function to get color for any mask value
const getColorForMaskValue = (maskValue: number, unknownColorMap: Map<number, { r: number; g: number; b: number; a: number }>): { r: number; g: number; b: number; a: number } => {
  if (maskValue === 0) {
    return { r: 0, g: 0, b: 0, a: 0 }; // Background (transparent)
  }

  // First, check if we have a fixed color for this mask value
  if (FIXED_MASK_COLORS[maskValue]) {
    return FIXED_MASK_COLORS[maskValue];
  }

  // If not in fixed mapping, assign from fallback palette
  if (!unknownColorMap.has(maskValue)) {
    const colorIndex = unknownColorMap.size % FALLBACK_COLOR_PALETTE.length;
    unknownColorMap.set(maskValue, FALLBACK_COLOR_PALETTE[colorIndex]);
    console.warn(`[MaskOverlay] ⚠️ Unknown mask value ${maskValue} - assigned fallback color:`, FALLBACK_COLOR_PALETTE[colorIndex]);
  }

  return unknownColorMap.get(maskValue)!;
};

interface MaskOverlayViewerProps {
  seriesId: string;
  instances: any[];
  maskSeriesId: string;
  maskInstances: any[];
  showOverlay: boolean;
  maskFilter?: 'all' | 'liver' | 'tumor';
  maskOpacity?: number;
  measurementEnabled?: boolean;
  measurementResetToken?: number;
  measurementBoxes?: Array<{
    id: string;
    sliceIndex: number;
    start: { x: number; y: number };
    end: { x: number; y: number };
    widthMm: number;
    heightMm: number;
  }>;
  onMeasurementBoxesChange?: (boxes: Array<{
    id: string;
    sliceIndex: number;
    start: { x: number; y: number };
    end: { x: number; y: number };
    widthMm: number;
    heightMm: number;
  }>) => void;
  zoomCommand?: { type: 'in' | 'out' | 'reset'; token: number } | null;
}

const MaskOverlayViewer = ({
  seriesId,
  instances,
  maskSeriesId,
  maskInstances,
  showOverlay,
  maskFilter = 'all',
  maskOpacity = 0.7,
  measurementEnabled = false,
  measurementResetToken = 0,
  measurementBoxes = [],
  onMeasurementBoxesChange,
  zoomCommand = null
}: MaskOverlayViewerProps) => {
  const viewerRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const baseImageIdsRef = useRef<string[]>([]);
  const maskImageIdsRef = useRef<string[]>([]);
  const currentMaskImageRef = useRef<any>(null);
  const showOverlayRef = useRef<boolean>(showOverlay);
  const hasViewportRef = useRef(false);
  const measurementEnabledRef = useRef<boolean>(measurementEnabled);
  const [measurementBox, setMeasurementBox] = useState<{
    start: { x: number; y: number };
    end: { x: number; y: number };
  } | null>(null);
  const measurementBoxRef = useRef<typeof measurementBox>(null);
  const isDraggingRef = useRef(false);
  const prefetchTokenRef = useRef(0);

  // Keep showOverlayRef in sync with showOverlay state
  useEffect(() => {
    showOverlayRef.current = showOverlay;
  }, [showOverlay]);

  useEffect(() => {
    measurementEnabledRef.current = measurementEnabled;
    if (viewerRef.current) {
      viewerRef.current.style.cursor = measurementEnabled ? 'crosshair' : 'default';
    }
  }, [measurementEnabled]);

  useEffect(() => {
    measurementBoxRef.current = measurementBox;
  }, [measurementBox]);

  useEffect(() => {
    if (!zoomCommand || !viewerRef.current) return;
    const element = viewerRef.current;
    let viewport;
    try {
      const enabledElement = cornerstone.getEnabledElement(element);
      viewport = enabledElement?.viewport;
    } catch (_err) {
      return;
    }
    if (!viewport) return;
    let nextScale = viewport.scale || 1;
    if (zoomCommand.type === 'in') {
      nextScale = nextScale * 1.2;
    } else if (zoomCommand.type === 'out') {
      nextScale = nextScale / 1.2;
    } else {
      nextScale = 1;
    }
    cornerstone.setViewport(element, { ...viewport, scale: nextScale });
  }, [zoomCommand]);

  useEffect(() => {
    setMeasurementBox(null);
    onMeasurementBoxesChange?.([]);
    renderMaskOverlay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measurementResetToken]);

  const isImageCached = useCallback((imageId?: string) => {
    if (!imageId) return false;
    const cache = (cornerstone as any).imageCache;
    if (!cache || typeof cache.getImageLoadObject !== 'function') {
      return false;
    }
    return Boolean(cache.getImageLoadObject(imageId));
  }, []);

  const prefetchAllImages = useCallback((startIndex: number) => {
    const total = baseImageIdsRef.current.length;
    if (!total) return;
    const token = ++prefetchTokenRef.current;

    const loadCached = (imageId?: string) => {
      if (!imageId || isImageCached(imageId)) {
        return Promise.resolve();
      }
      return cornerstone.loadAndCacheImage(imageId).catch(() => undefined);
    };

    const nearbyIndices: number[] = [];
    const farIndices: number[] = [];
    for (let i = 0; i < total; i += 1) {
      if (i === startIndex) continue;
      if (Math.abs(i - startIndex) <= 10) {
        nearbyIndices.push(i);
      } else {
        farIndices.push(i);
      }
    }

    const loadIndex = async (index: number) => {
      await Promise.all([
        loadCached(baseImageIdsRef.current[index]),
        loadCached(maskImageIdsRef.current[index]),
      ]);
    };

    const runQueue = async (queue: number[]) => {
      for (let i = 0; i < queue.length; i += PREFETCH_CONCURRENCY) {
        if (token !== prefetchTokenRef.current) return;
        const chunk = queue.slice(i, i + PREFETCH_CONCURRENCY);
        await Promise.all(chunk.map(loadIndex));
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
    };

    void (async () => {
      await runQueue(nearbyIndices);
      await runQueue(farIndices);
    })();
  }, [isImageCached]);

  // Render mask overlay on separate canvas layer
  const renderMaskOverlay = useCallback(() => {
    try {
      if (!viewerRef.current) {
        return;
      }

      const maskImage = currentMaskImageRef.current;
      const maskPixelData = maskImage ? maskImage.getPixelData() : null;

      // Get Cornerstone canvas to match dimensions (exclude overlay-canvas)
      const cornerstoneCanvas = viewerRef.current.querySelector('canvas:not(.overlay-canvas)') as HTMLCanvasElement;
      if (!cornerstoneCanvas) {
        console.warn('[MaskOverlay] Cornerstone canvas not found!');
        return;
      }

      // Get or create overlay canvas
      let overlayCanvas = viewerRef.current.querySelector('.overlay-canvas') as HTMLCanvasElement;
      if (!overlayCanvas) {
        console.log('[MaskOverlay] Creating overlay canvas layer');
        overlayCanvas = document.createElement('canvas');
        overlayCanvas.className = 'overlay-canvas';
        viewerRef.current.appendChild(overlayCanvas);
      }

      // Match overlay canvas to Cornerstone canvas EXACTLY
      // Step 1: Set internal pixel resolution
      overlayCanvas.width = cornerstoneCanvas.width;
      overlayCanvas.height = cornerstoneCanvas.height;

      // Step 2: Match rendered size + position using offsets (keeps center aligned)
      overlayCanvas.style.width = `${cornerstoneCanvas.offsetWidth}px`;
      overlayCanvas.style.height = `${cornerstoneCanvas.offsetHeight}px`;
      overlayCanvas.style.left = `${cornerstoneCanvas.offsetLeft}px`;
      overlayCanvas.style.top = `${cornerstoneCanvas.offsetTop}px`;

      console.log('[MaskOverlay] Canvas - Pixel:', overlayCanvas.width, 'x', overlayCanvas.height, '/ Display:', cornerstoneCanvas.offsetWidth, 'x', cornerstoneCanvas.offsetHeight, '/ Pos:', overlayCanvas.style.left, overlayCanvas.style.top);

      const context = overlayCanvas.getContext('2d');
      if (!context) {
        console.warn('[MaskOverlay] Overlay canvas context not found!');
        return;
      }

      // Clear previous overlay
      context.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

      // Get Cornerstone viewport to match CT image transformation
      const enabledElement = cornerstone.getEnabledElement(viewerRef.current);
      const viewport = enabledElement.viewport;
      const baseImage = enabledElement.image;

      if (!viewport || !baseImage) {
        console.warn('[MaskOverlay] Viewport or base image not found');
        return;
      }

      // Get dimensions
      const maskWidth = maskImage ? maskImage.width : baseImage.width;
      const maskHeight = maskImage ? maskImage.height : baseImage.height;
      const baseWidth = baseImage.width;
      const baseHeight = baseImage.height;

      console.log('[MaskOverlay] Base:', baseWidth, 'x', baseHeight, '/ Mask:', maskWidth, 'x', maskHeight, '/ Scale:', viewport.scale);

      // Warn if dimensions don't match
      if (maskWidth !== baseWidth || maskHeight !== baseHeight) {
        console.warn('[MaskOverlay] ⚠️ Mask and base image dimensions do not match! This may cause alignment issues.');
      }

      // Build color map for unknown mask values (values not in FIXED_MASK_COLORS)
      const unknownColorMap = new Map<number, { r: number; g: number; b: number; a: number }>();

      // First pass: detect unique mask values and log them
      if (showOverlayRef.current && maskPixelData) {
        const uniqueMaskValues = new Set<number>();
        for (let i = 0; i < maskPixelData.length; i++) {
          const maskValue = maskPixelData[i];
          if (maskValue > 0) {
            uniqueMaskValues.add(maskValue);
          }
        }

        const maskValuesArray = Array.from(uniqueMaskValues).sort((a, b) => a - b);
        console.log('[MaskOverlay] Unique mask values found:', maskValuesArray);

        // Log which colors will be assigned
        maskValuesArray.forEach(value => {
          if (FIXED_MASK_COLORS[value]) {
            console.log(`  - Value ${value}: Fixed color`, FIXED_MASK_COLORS[value]);
          } else {
            console.log(`  - Value ${value}: Will use fallback color`);
          }
        });
      }

      // Apply Cornerstone viewport transformation using Canvas 2D transform
      // This matches exactly how Cornerstone renders the base image
      // IMPORTANT: Use BASE image dimensions, not mask dimensions!
      context.save();

      // 1. Translate to canvas center
      context.translate(overlayCanvas.width / 2, overlayCanvas.height / 2);

      // 2. Apply viewport translation
      context.translate(viewport.translation.x, viewport.translation.y);

      // 3. Apply scale
      context.scale(viewport.scale, viewport.scale);

      // 4. Translate to make image center the origin (use BASE image size!)
      context.translate(-baseWidth / 2, -baseHeight / 2);

      // Calculate scaling factor if mask and base image sizes differ
      const scaleX = baseWidth / maskWidth;
      const scaleY = baseHeight / maskHeight;

      if (scaleX !== 1 || scaleY !== 1) {
        console.log(`[MaskOverlay] Scaling mask (${maskWidth}x${maskHeight}) to match base (${baseWidth}x${baseHeight}): scaleX=${scaleX.toFixed(2)}, scaleY=${scaleY.toFixed(2)}`);
      }

      // Now draw the mask with the same transformation as the base image
      let totalOverlayPixels = 0;

      if (showOverlayRef.current && maskPixelData) {
        for (let y = 0; y < maskHeight; y++) {
          for (let x = 0; x < maskWidth; x++) {
            const maskIndex = y * maskWidth + x;
            const maskValue = maskPixelData[maskIndex];

          const isLiver = maskValue === 1 || maskValue === 1000;
          const isTumor = maskValue === 2 || maskValue === 2000;
          const shouldDraw = maskFilter === 'all' || (maskFilter === 'liver' && isLiver) || (maskFilter === 'tumor' && isTumor);

          if (maskValue > 0 && shouldDraw) {
            totalOverlayPixels++;
            const color = getColorForMaskValue(maskValue, unknownColorMap);

            // Map mask coordinates to base image coordinates
            const baseX = x * scaleX;
            const baseY = y * scaleY;

            // Draw a rect scaled to match the base image pixel grid
            // The transform will map it to the correct canvas position
            const alpha = (color.a / 255) * maskOpacity;
            context.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
            context.fillRect(baseX, baseY, scaleX, scaleY);
          }
        }
      }
      }

      const boxes = measurementBoxes.filter((box) => box.sliceIndex === currentIndex);
      const activeBox = measurementBoxRef.current;
      if (boxes.length > 0 || activeBox) {
        const lineWidth = Math.max(1, 2 / viewport.scale);
        context.lineWidth = lineWidth;

        const drawBox = (box: { start: { x: number; y: number }; end: { x: number; y: number } }, fill: string) => {
          const x = Math.min(box.start.x, box.end.x);
          const y = Math.min(box.start.y, box.end.y);
          const width = Math.abs(box.end.x - box.start.x);
          const height = Math.abs(box.end.y - box.start.y);

          context.fillStyle = fill;
          context.strokeStyle = 'rgba(34, 197, 94, 0.95)';
          context.fillRect(x, y, width, height);
          context.strokeRect(x, y, width, height);
        };

        boxes.forEach((box, index) => {
          const hue = (index * 53) % 360;
          const color = `hsla(${hue}, 85%, 55%, 0.28)`;
          context.strokeStyle = `hsla(${hue}, 85%, 45%, 0.9)`;
          drawBox(box, color);
        });

        if (activeBox) {
          drawBox(activeBox, 'rgba(34, 197, 94, 0.2)');
        }
      }

      context.restore();
      if (maskPixelData) {
        console.log('[MaskOverlay] ✓ Overlay applied -', totalOverlayPixels, 'pixels rendered');
      }
    } catch (err) {
      console.error('Error rendering mask overlay:', err);
    }
  }, [currentIndex, measurementBoxes, maskFilter, maskOpacity]);

  useEffect(() => {
    prefetchTokenRef.current += 1;
    if (!viewerRef.current || instances.length === 0) return;

    const element = viewerRef.current;

    // Cornerstone 활성화
    try {
      cornerstone.enable(element);
    } catch (e) {
      console.error('Error enabling cornerstone:', e);
    }

    // InstanceNumber로 정렬 - 원본 이미지
    const sortedInstances = [...instances].sort((a, b) => {
      const numA = parseInt(a.MainDicomTags?.InstanceNumber || '0', 10);
      const numB = parseInt(b.MainDicomTags?.InstanceNumber || '0', 10);
      return numA - numB;
    });

    baseImageIdsRef.current = sortedInstances.map((instance) => {
      const instanceId = instance.ID;
      const url = getInstanceFileUrl(instanceId);
      return `wadouri:${url}`;
    });

    // InstanceNumber로 정렬 - 마스크 이미지
    if (maskInstances && maskInstances.length > 0) {
      const sortedMaskInstances = [...maskInstances].sort((a, b) => {
        const numA = parseInt(a.MainDicomTags?.InstanceNumber || '0', 10);
        const numB = parseInt(b.MainDicomTags?.InstanceNumber || '0', 10);
        return numA - numB;
      });

      maskImageIdsRef.current = sortedMaskInstances.map((instance) => {
        const instanceId = instance.ID;
        const url = getInstanceFileUrl(instanceId);
        return `wadouri:${url}`;
      });
    }

    // 첫 번째 이미지 로드
    loadImage(0).catch(() => undefined);

    // IMAGE_RENDERED event handler - called whenever image is rendered
    const handleImageRendered = () => {
      if (showOverlayRef.current && currentMaskImageRef.current) {
        // Use requestAnimationFrame to ensure overlay is applied AFTER Cornerstone's rendering is complete
        requestAnimationFrame(() => {
          renderMaskOverlay();
        });
      }
    };

    // Add event listener for image rendering
    element.addEventListener('cornerstoneimagerendered', handleImageRendered);

    // Window resize handler
    const handleResize = () => {
      try {
        cornerstone.resize(element, true);
      } catch (e) {
        console.error('Error resizing on window resize:', e);
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      element.removeEventListener('cornerstoneimagerendered', handleImageRendered);
      window.removeEventListener('resize', handleResize);
      try {
        cornerstone.disable(element);
      } catch (e) {
        console.error('Error disabling cornerstone:', e);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesId, instances, maskSeriesId, maskInstances, prefetchAllImages]);

  // showOverlay 변경 시 오버레이 다시 렌더링
  useEffect(() => {
    renderMaskOverlay();
  }, [showOverlay, renderMaskOverlay]);

  useEffect(() => {
    renderMaskOverlay();
  }, [measurementBox, measurementBoxes, renderMaskOverlay]);

  useEffect(() => {
    renderMaskOverlay();
  }, [maskFilter, maskOpacity, renderMaskOverlay]);

  const pageToPixel = (element: HTMLDivElement, pageX: number, pageY: number) => {
    try {
      const enabledElement = cornerstone.getEnabledElement(element);
      const canvas = element.querySelector('canvas') as HTMLCanvasElement;
      if (!canvas || !enabledElement) return null;

      const rect = canvas.getBoundingClientRect();
      const canvasX = pageX - rect.left;
      const canvasY = pageY - rect.top;

      const viewport = enabledElement.viewport;
      const image = enabledElement.image;

      // Convert canvas coordinates to pixel coordinates
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const pixelX = (canvasX * scaleX - canvas.width / 2 - viewport.translation.x) / viewport.scale + image.width / 2;
      const pixelY = (canvasY * scaleY - canvas.height / 2 - viewport.translation.y) / viewport.scale + image.height / 2;

      return { x: pixelX, y: pixelY };
    } catch (err) {
      console.error('Error converting page to pixel coordinates:', err);
      return null;
    }
  };

  const updateMeasurement = (start: { x: number; y: number }, end: { x: number; y: number }) => {
    if (!viewerRef.current) return;
    const enabledElement = cornerstone.getEnabledElement(viewerRef.current);
    const image = enabledElement?.image;
    const rowSpacing = image?.rowPixelSpacing ?? 1;
    const colSpacing = image?.columnPixelSpacing ?? 1;
    const widthMm = Math.abs(end.x - start.x) * colSpacing;
    const heightMm = Math.abs(end.y - start.y) * rowSpacing;
    return { widthMm, heightMm };
  };

  const handleMeasurementMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!measurementEnabledRef.current || !viewerRef.current) {
      return;
    }
    const coords = pageToPixel(viewerRef.current, event.pageX, event.pageY);
    if (!coords) return;
    isDraggingRef.current = true;
    const start = { x: coords.x, y: coords.y };
    setMeasurementBox({ start, end: start });
  };

  const handleMeasurementMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !viewerRef.current) return;
    const coords = pageToPixel(viewerRef.current, event.pageX, event.pageY);
    if (!coords) return;
    setMeasurementBox((prev) => {
      if (!prev) return prev;
      const next = { start: prev.start, end: { x: coords.x, y: coords.y } };
      return next;
    });
  };

  const handleMeasurementMouseUp = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !viewerRef.current) return;
    isDraggingRef.current = false;
    const coords = pageToPixel(viewerRef.current, event.pageX, event.pageY);
    if (!coords) return;
    setMeasurementBox((prev) => {
      if (!prev) return prev;
      const next = { start: prev.start, end: { x: coords.x, y: coords.y } };
      const dimensions = updateMeasurement(next.start, next.end);
      if (dimensions) {
        const newBox = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          sliceIndex: currentIndex,
          start: next.start,
          end: next.end,
          ...dimensions,
        };
        onMeasurementBoxesChange?.([...measurementBoxes, newBox]);
      }
      return null;
    });
  };

  const loadImage = async (index: number) => {
    if (!viewerRef.current || !baseImageIdsRef.current[index]) return;

    const baseImageId = baseImageIdsRef.current[index];
    const cached = isImageCached(baseImageId);
    if (!cached) {
      setIsLoading(true);
    }
    setError(null);

    try {
      // Load base image
      const image = await cornerstone.loadAndCacheImage(baseImageId);
      const element = viewerRef.current;

      // Load corresponding mask image if available
      if (maskImageIdsRef.current[index]) {
        try {
          const maskImage = await cornerstone.loadAndCacheImage(maskImageIdsRef.current[index]);
          currentMaskImageRef.current = maskImage;

          // Debug: Check mask values
          const maskPixelData = maskImage.getPixelData();
          const uniqueValues = new Set<number>();
          for (let i = 0; i < maskPixelData.length; i++) {
            uniqueValues.add(maskPixelData[i]);
          }
          console.log('[MaskOverlay] Mask loaded:', Array.from(uniqueValues).sort(), `(${maskImage.width}x${maskImage.height})`);
        } catch (maskErr) {
          console.error('Failed to load mask:', maskErr);
          currentMaskImageRef.current = null;
        }
      } else {
        currentMaskImageRef.current = null;
      }

      // Display base image
      cornerstone.displayImage(element, image);

      // Set viewport (only on first load to reduce overhead)
      if (!hasViewportRef.current) {
        const viewport = cornerstone.getDefaultViewportForImage(element, image);
        cornerstone.setViewport(element, viewport);
        cornerstone.resize(element, true);
        hasViewportRef.current = true;
      }

      // Force one more render to ensure overlay is applied after all Cornerstone operations
      // Use setTimeout to ensure it happens after Cornerstone's internal rendering is complete
      setTimeout(() => {
        try {
          // Trigger one more render event to apply overlay
          const currentViewport = cornerstone.getViewport(element);
          if (currentViewport) {
            cornerstone.setViewport(element, currentViewport);
          }
        } catch (e) {
          console.error('Error in delayed overlay trigger:', e);
        }
      }, 50);

      setCurrentIndex(index);
      if (!cached) {
        setIsLoading(false);
      }

      prefetchAllImages(index);

      // Prefetch adjacent slices for smoother scrolling (small priority boost)
      for (let offset = 1; offset <= PREFETCH_DISTANCE; offset++) {
        const nextIndex = index + offset;
        const prevIndex = index - offset;

        const nextBase = baseImageIdsRef.current[nextIndex];
        const prevBase = baseImageIdsRef.current[prevIndex];
        const nextMask = maskImageIdsRef.current[nextIndex];
        const prevMask = maskImageIdsRef.current[prevIndex];

        if (nextBase && !isImageCached(nextBase)) {
          cornerstone.loadAndCacheImage(nextBase).catch(() => undefined);
        }
        if (prevBase && !isImageCached(prevBase)) {
          cornerstone.loadAndCacheImage(prevBase).catch(() => undefined);
        }

        if (nextMask && !isImageCached(nextMask)) {
          cornerstone.loadAndCacheImage(nextMask).catch(() => undefined);
        }
        if (prevMask && !isImageCached(prevMask)) {
          cornerstone.loadAndCacheImage(prevMask).catch(() => undefined);
        }
      }
    } catch (err) {
      console.error('Error loading image:', err);
      setError('이미지 로드에 실패했습니다.');
      setIsLoading(false);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      loadImage(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < instances.length - 1) {
      loadImage(currentIndex + 1);
    }
  };

  const handleWheel = (event: React.WheelEvent) => {
    event.preventDefault();
    if (event.deltaY < 0) {
      handlePrevious();
    } else {
      handleNext();
    }
  };

  return (
    <div className="dicom-viewer">
      <div
        ref={viewerRef}
        className="dicom-canvas"
        onWheel={handleWheel}
        onMouseDown={handleMeasurementMouseDown}
        onMouseMove={handleMeasurementMouseMove}
        onMouseUp={handleMeasurementMouseUp}
        onMouseLeave={handleMeasurementMouseUp}
      >
        {error && <div className="viewer-error">{error}</div>}
      </div>
      <div className="viewer-controls">
        <button
          onClick={handlePrevious}
          disabled={currentIndex === 0 || isLoading}
          className="control-btn"
        >
          ◀ 이전
        </button>
        <span className="viewer-info">
          {currentIndex + 1} / {instances.length}
        </span>
        <button
          onClick={handleNext}
          disabled={currentIndex === instances.length - 1 || isLoading}
          className="control-btn"
        >
          다음 ▶
        </button>
      </div>
    </div>
  );
};

export default MaskOverlayViewer;
