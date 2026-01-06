// src/components/radiology/DicomViewer.tsx
import React, { useEffect, useRef, useState } from 'react';
import * as cornerstone from 'cornerstone-core';
import * as cornerstoneWADOImageLoader from 'cornerstone-wado-image-loader';
import * as dicomParser from 'dicom-parser';
import { getInstanceFileUrl } from '../../api/orthanc_api';
import './DicomViewer.css';

// Cornerstone 설정
cornerstoneWADOImageLoader.external.cornerstone = cornerstone;
cornerstoneWADOImageLoader.external.dicomParser = dicomParser;

// Segmentation mask class colors
const MASK_COLORS = {
  0: { r: 0, g: 0, b: 0, a: 0 },       // Background (transparent)
  1: { r: 255, g: 0, b: 0, a: 128 },   // Class 1: Red (Liver)
  2: { r: 0, g: 255, b: 0, a: 128 },   // Class 2: Green (Tumor)
  3: { r: 0, g: 0, b: 255, a: 128 },   // Class 3: Blue
  4: { r: 255, g: 255, b: 0, a: 128 }, // Class 4: Yellow
  5: { r: 255, g: 0, b: 255, a: 128 }, // Class 5: Magenta
};

interface DicomViewerProps {
  seriesId: string;
  instances: any[];
  overlaySeriesId?: string | null;
  overlayInstances?: any[];
  showOverlay?: boolean;
}

const DicomViewer: React.FC<DicomViewerProps> = ({
  seriesId,
  instances,
  overlaySeriesId,
  overlayInstances = [],
  showOverlay = false
}) => {
  const viewerRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const imageIdsRef = useRef<string[]>([]);
  const overlayImageIdsRef = useRef<string[]>([]);

  useEffect(() => {
    if (!viewerRef.current || instances.length === 0) return;

    const element = viewerRef.current;

    // Cornerstone 활성화
    cornerstone.enable(element);

    // InstanceNumber로 정렬
    const sortedInstances = [...instances].sort((a, b) => {
      const numA = parseInt(a.MainDicomTags?.InstanceNumber || '0', 10);
      const numB = parseInt(b.MainDicomTags?.InstanceNumber || '0', 10);
      return numA - numB;
    });

    // 이미지 ID 생성
    imageIdsRef.current = sortedInstances.map((instance) => {
      const instanceId = instance.ID;
      const url = getInstanceFileUrl(instanceId);
      return `wadouri:${url}`;
    });

    // Overlay 이미지 ID 생성
    if (overlayInstances && overlayInstances.length > 0) {
      const sortedOverlayInstances = [...overlayInstances].sort((a, b) => {
        const numA = parseInt(a.MainDicomTags?.InstanceNumber || '0', 10);
        const numB = parseInt(b.MainDicomTags?.InstanceNumber || '0', 10);
        return numA - numB;
      });

      overlayImageIdsRef.current = sortedOverlayInstances.map((instance) => {
        const instanceId = instance.ID;
        const url = getInstanceFileUrl(instanceId);
        return `wadouri:${url}`;
      });
    } else {
      overlayImageIdsRef.current = [];
    }

    // 첫 번째 이미지 로드
    loadImage(0);

    return () => {
      try {
        cornerstone.disable(element);
      } catch (e) {
        console.error('Error disabling cornerstone:', e);
      }
    };
  }, [seriesId, instances, overlaySeriesId, overlayInstances]);

  // showOverlay 변경 시 현재 이미지 다시 로드
  useEffect(() => {
    if (viewerRef.current && imageIdsRef.current.length > 0) {
      loadImage(currentIndex);
    }
  }, [showOverlay]);

  const applyMaskOverlay = async (element: HTMLDivElement, baseImage: any, maskImageId: string) => {
    try {
      // Load mask image
      const maskImage = await cornerstone.loadImage(maskImageId);

      // Get pixel data from both images
      const maskPixelData = maskImage.getPixelData();

      // Create overlay canvas
      const canvas = element.querySelector('canvas');
      if (!canvas) return;

      const context = canvas.getContext('2d');
      if (!context) return;

      // Get current displayed image
      const displayedImage = context.getImageData(0, 0, canvas.width, canvas.height);
      const data = displayedImage.data;

      // Apply mask overlay
      const width = baseImage.width;
      const height = baseImage.height;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const pixelIndex = y * width + x;
          const maskValue = maskPixelData[pixelIndex];

          if (maskValue > 0) {
            // Get color for this class
            const color = MASK_COLORS[maskValue as keyof typeof MASK_COLORS] || MASK_COLORS[1];

            // Calculate overlay position in canvas
            const canvasX = Math.floor(x * canvas.width / width);
            const canvasY = Math.floor(y * canvas.height / height);
            const canvasIndex = (canvasY * canvas.width + canvasX) * 4;

            // Blend colors
            const alpha = color.a / 255;
            data[canvasIndex] = data[canvasIndex] * (1 - alpha) + color.r * alpha;
            data[canvasIndex + 1] = data[canvasIndex + 1] * (1 - alpha) + color.g * alpha;
            data[canvasIndex + 2] = data[canvasIndex + 2] * (1 - alpha) + color.b * alpha;
          }
        }
      }

      // Put the blended image back
      context.putImageData(displayedImage, 0, 0);
    } catch (err) {
      console.error('Error applying mask overlay:', err);
    }
  };

  const loadImage = async (index: number) => {
    if (!viewerRef.current || !imageIdsRef.current[index]) return;

    setIsLoading(true);
    setError(null);

    try {
      const image = await cornerstone.loadImage(imageIdsRef.current[index]);
      cornerstone.displayImage(viewerRef.current, image);

      // Apply overlay if available
      if (showOverlay && overlayImageIdsRef.current[index]) {
        await applyMaskOverlay(viewerRef.current, image, overlayImageIdsRef.current[index]);
      }

      setCurrentIndex(index);
      setIsLoading(false);
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

export default DicomViewer;