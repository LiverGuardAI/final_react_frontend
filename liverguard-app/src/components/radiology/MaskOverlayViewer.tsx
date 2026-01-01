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
});

const PREFETCH_DISTANCE = 3;
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
}

const MaskOverlayViewer = ({
  seriesId,
  instances,
  maskSeriesId,
  maskInstances,
  showOverlay
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

  // Keep showOverlayRef in sync with showOverlay state
  useEffect(() => {
    showOverlayRef.current = showOverlay;
  }, [showOverlay]);

  // Render mask overlay on separate canvas layer
  const renderMaskOverlay = useCallback(() => {
    try {
      if (!currentMaskImageRef.current || !viewerRef.current) {
        return;
      }

      const maskImage = currentMaskImageRef.current;
      const maskPixelData = maskImage.getPixelData();

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

      // Step 2: Get Cornerstone canvas actual rendered dimensions
      const csRect = cornerstoneCanvas.getBoundingClientRect();

      // Step 3: Set overlay canvas to EXACT same rendered size (in pixels, not %)
      overlayCanvas.style.width = `${csRect.width}px`;
      overlayCanvas.style.height = `${csRect.height}px`;

      // Step 4: Position overlay exactly at the same location as Cornerstone canvas
      const parentRect = viewerRef.current.getBoundingClientRect();
      overlayCanvas.style.left = `${csRect.left - parentRect.left}px`;
      overlayCanvas.style.top = `${csRect.top - parentRect.top}px`;

      console.log('[MaskOverlay] Canvas - Pixel:', overlayCanvas.width, 'x', overlayCanvas.height, '/ Display:', csRect.width.toFixed(1), 'x', csRect.height.toFixed(1), '/ Pos:', overlayCanvas.style.left, overlayCanvas.style.top);

      const context = overlayCanvas.getContext('2d');
      if (!context) {
        console.warn('[MaskOverlay] Overlay canvas context not found!');
        return;
      }

      // Clear previous overlay
      context.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

      // If showOverlay is false, just clear and return
      if (!showOverlayRef.current) {
        return;
      }

      // Get Cornerstone viewport to match CT image transformation
      const enabledElement = cornerstone.getEnabledElement(viewerRef.current);
      const viewport = enabledElement.viewport;
      const baseImage = enabledElement.image;

      if (!viewport || !baseImage) {
        console.warn('[MaskOverlay] Viewport or base image not found');
        return;
      }

      // Get dimensions
      const maskWidth = maskImage.width;
      const maskHeight = maskImage.height;
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

      for (let y = 0; y < maskHeight; y++) {
        for (let x = 0; x < maskWidth; x++) {
          const maskIndex = y * maskWidth + x;
          const maskValue = maskPixelData[maskIndex];

          if (maskValue > 0) {
            totalOverlayPixels++;
            const color = getColorForMaskValue(maskValue, unknownColorMap);

            // Map mask coordinates to base image coordinates
            const baseX = x * scaleX;
            const baseY = y * scaleY;

            // Draw a rect scaled to match the base image pixel grid
            // The transform will map it to the correct canvas position
            context.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a / 255})`;
            context.fillRect(baseX, baseY, scaleX, scaleY);
          }
        }
      }

      context.restore();
      console.log('[MaskOverlay] ✓ Overlay applied -', totalOverlayPixels, 'pixels rendered');
    } catch (err) {
      console.error('Error rendering mask overlay:', err);
    }
  }, []);

  useEffect(() => {
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
    loadImage(0);

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
  }, [seriesId, instances, maskSeriesId, maskInstances]);

  // showOverlay 변경 시 오버레이 다시 렌더링
  useEffect(() => {
    renderMaskOverlay();
  }, [showOverlay, renderMaskOverlay]);

  const loadImage = async (index: number) => {
    if (!viewerRef.current || !baseImageIdsRef.current[index]) return;

    setIsLoading(true);
    setError(null);

    try {
      // Load base image
      const image = await cornerstone.loadAndCacheImage(baseImageIdsRef.current[index]);
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
      setIsLoading(false);

      // Prefetch adjacent slices for smoother scrolling
      for (let offset = 1; offset <= PREFETCH_DISTANCE; offset++) {
        const nextIndex = index + offset;
        const prevIndex = index - offset;

        if (baseImageIdsRef.current[nextIndex]) {
          cornerstone.loadAndCacheImage(baseImageIdsRef.current[nextIndex]).catch(() => undefined);
        }
        if (baseImageIdsRef.current[prevIndex]) {
          cornerstone.loadAndCacheImage(baseImageIdsRef.current[prevIndex]).catch(() => undefined);
        }

        if (maskImageIdsRef.current[nextIndex]) {
          cornerstone.loadAndCacheImage(maskImageIdsRef.current[nextIndex]).catch(() => undefined);
        }
        if (maskImageIdsRef.current[prevIndex]) {
          cornerstone.loadAndCacheImage(maskImageIdsRef.current[prevIndex]).catch(() => undefined);
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
      >
        {isLoading && <div className="viewer-loading">로딩 중...</div>}
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
