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

const SimpleDicomViewer: React.FC<SimpleDicomViewerProps> = ({
  seriesId,
  instances = [],
  files = []
}) => {
  const viewerRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalImages, setTotalImages] = useState(0);
  const imageIdsRef = useRef<string[]>([]);
  const hasViewportRef = useRef(false);

  useEffect(() => {
    if (!viewerRef.current || (instances.length === 0 && files.length === 0)) return;

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

    if (files.length > 0) {
      imageIdsRef.current = files.map((file) =>
        cornerstoneWADOImageLoader.wadouri.fileManager.add(file)
      );
    } else {
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
    }

    setTotalImages(imageIdsRef.current.length);

    // 첫 번째 이미지 로드
    loadImage(0);

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
  }, [seriesId, instances, files]);

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

      setCurrentIndex(index);
      setIsLoading(false);
      prefetchImages(index);
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
    if (currentIndex < totalImages - 1) {
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
