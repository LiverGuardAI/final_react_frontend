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

interface DicomViewerProps {
  seriesId: string;
  instances: any[];
}

const DicomViewer: React.FC<DicomViewerProps> = ({ seriesId, instances }) => {
  const viewerRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const imageIdsRef = useRef<string[]>([]);

  useEffect(() => {
    if (!viewerRef.current || instances.length === 0) return;

    const element = viewerRef.current;

    // Cornerstone 활성화
    cornerstone.enable(element);

    // 이미지 ID 생성
    imageIdsRef.current = instances.map((instance) => {
      const instanceId = instance.ID;
      const url = getInstanceFileUrl(instanceId);
      return `wadouri:${url}`;
    });

    // 첫 번째 이미지 로드
    loadImage(0);

    return () => {
      try {
        cornerstone.disable(element);
      } catch (e) {
        console.error('Error disabling cornerstone:', e);
      }
    };
  }, [seriesId, instances]);

  const loadImage = async (index: number) => {
    if (!viewerRef.current || !imageIdsRef.current[index]) return;

    setIsLoading(true);
    setError(null);

    try {
      const image = await cornerstone.loadImage(imageIdsRef.current[index]);
      cornerstone.displayImage(viewerRef.current, image);
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
