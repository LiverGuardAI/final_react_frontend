// src/components/radiology/SimpleDicomViewer.tsx
import React, { useEffect, useRef, useState } from 'react';
import * as cornerstone from 'cornerstone-core';
import * as cornerstoneWADOImageLoader from 'cornerstone-wado-image-loader';
import * as dicomParser from 'dicom-parser';
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

interface SimpleDicomViewerProps {
  seriesId?: string;
  instances?: any[];
  files?: File[];
}

const EMPTY_INSTANCES: any[] = [];
const EMPTY_FILES: File[] = [];

const SimpleDicomViewer: React.FC<SimpleDicomViewerProps> = ({
  seriesId,
  instances,
  files
}) => {
  const resolvedInstances = instances ?? EMPTY_INSTANCES;
  const resolvedFiles = files ?? EMPTY_FILES;
  const viewerRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalImages, setTotalImages] = useState(0);
  const imageIdsRef = useRef<string[]>([]);
  const hasViewportRef = useRef(false);
  const currentIndexRef = useRef(0);
  const isLoadingRef = useRef(false);
  const totalImagesRef = useRef(0);

  useEffect(() => {
    if (!viewerRef.current || (resolvedInstances.length === 0 && resolvedFiles.length === 0)) return;

    const element = viewerRef.current;

    // Cornerstone 활성화
    try {
      cornerstone.enable(element);
    } catch (e) {
      console.error('Error enabling cornerstone:', e);
    }

    setError(null);
    setCurrentIndex(0);
    hasViewportRef.current = false;

    if (resolvedFiles.length > 0) {
      imageIdsRef.current = resolvedFiles.map((file) =>
        cornerstoneWADOImageLoader.wadouri.fileManager.add(file)
      );
    } else {
      const normalizedInstances = resolvedInstances.map((instance, index) => {
        if (typeof instance === 'string') {
          return { id: instance, instanceNumber: index, order: index };
        }

        const instanceId = instance?.ID || instance?.id;
        const tagNumber = instance?.MainDicomTags?.InstanceNumber;
        const parsedNumber = Number.parseInt(tagNumber || '', 10);
        const instanceNumber = Number.isFinite(parsedNumber) ? parsedNumber : index;

        return { id: instanceId, instanceNumber, order: index };
      });

      // InstanceNumber로 정렬, 동일한 경우 원본 순서 유지
      normalizedInstances.sort((a, b) => {
        if (a.instanceNumber !== b.instanceNumber) {
          return a.instanceNumber - b.instanceNumber;
        }
        return a.order - b.order;
      });

      // 이미지 ID 생성
      imageIdsRef.current = normalizedInstances
        .map((instance) => instance.id)
        .filter((instanceId): instanceId is string => Boolean(instanceId))
        .map((instanceId) => `wadouri:${getInstanceFileUrl(instanceId)}`);
    }

    setTotalImages(imageIdsRef.current.length);
    setCurrentIndex(0);

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
      window.removeEventListener('resize', handleResize);
      try {
        cornerstone.disable(element);
      } catch (e) {
        console.error('Error disabling cornerstone:', e);
      }
    };
  }, [seriesId, instances, files, resolvedInstances.length, resolvedFiles.length]);

  const prefetchImages = (index: number) => {
    const ids = imageIdsRef.current;
    if (!ids.length) return;

    for (let offset = 1; offset <= PREFETCH_DISTANCE; offset++) {
      const nextIndex = index + offset;
      const prevIndex = index - offset;

      if (ids[nextIndex]) {
        cornerstone.loadAndCacheImage(ids[nextIndex]).catch(() => undefined);
      }
      if (ids[prevIndex]) {
        cornerstone.loadAndCacheImage(ids[prevIndex]).catch(() => undefined);
      }
    }
  };

  const loadImage = async (index: number) => {
    if (!viewerRef.current || !imageIdsRef.current[index]) return;

    setIsLoading(true);
    setError(null);

    try {
      const image = await cornerstone.loadAndCacheImage(imageIdsRef.current[index]);
      const element = viewerRef.current;

      cornerstone.displayImage(element, image);

      // Fit image to viewport (only on first load to reduce overhead)
      if (!hasViewportRef.current) {
        const viewport = cornerstone.getDefaultViewportForImage(element, image);
        cornerstone.setViewport(element, viewport);
        cornerstone.resize(element, true);
        hasViewportRef.current = true;
      }

      setIsLoading(false);
      prefetchImages(index);
    } catch (err) {
      console.error('Error loading image:', err);
      setError('이미지 로드에 실패했습니다.');
      setIsLoading(false);
    }
  };

  const handlePrevious = () => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => Math.min(prev + 1, totalImages - 1));
  };

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  useEffect(() => {
    totalImagesRef.current = totalImages;
  }, [totalImages]);

  useEffect(() => {
    if (!imageIdsRef.current.length) {
      return;
    }

    const maxIndex = imageIdsRef.current.length - 1;
    if (currentIndex > maxIndex) {
      setCurrentIndex(maxIndex);
      return;
    }

    loadImage(currentIndex);
  }, [currentIndex, totalImages]);

  useEffect(() => {
    const element = viewerRef.current;
    if (!element) return;

    const handleWheelNative = (event: WheelEvent) => {
      if (isLoadingRef.current || totalImagesRef.current <= 1) {
        return;
      }

      event.preventDefault();

      const delta = event.deltaY < 0 ? -1 : 1;
      const nextIndex = currentIndexRef.current + delta;

      if (nextIndex < 0 || nextIndex >= totalImagesRef.current) {
        return;
      }

      setCurrentIndex(nextIndex);
    };

    element.addEventListener('wheel', handleWheelNative, { passive: false });
    return () => {
      element.removeEventListener('wheel', handleWheelNative);
    };
  }, []);

  return (
    <div className="dicom-viewer">
      <div
        ref={viewerRef}
        className="dicom-canvas"
      >
        {isLoading && <div className="viewer-loading">로딩 중...</div>}
        {error && <div className="viewer-error">{error}</div>}
      </div>
      <div className="viewer-controls">
        <button
          onClick={handlePrevious}
          disabled={currentIndex === 0 || isLoading || totalImages === 0}
          className="control-btn"
        >
          ◀ 이전
        </button>
        <span className="viewer-info">
          {totalImages === 0 ? 0 : currentIndex + 1} / {totalImages}
        </span>
        <button
          onClick={handleNext}
          disabled={currentIndex === totalImages - 1 || isLoading || totalImages === 0}
          className="control-btn"
        >
          다음 ▶
        </button>
      </div>
    </div>
  );
};

export default SimpleDicomViewer;
