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

function initializeWADOImageLoader() {
  cornerstoneWADOImageLoader.external.cornerstone = cornerstone;
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
  const [currentSlice, setCurrentSlice] = useState(0);
  const [totalSlices, setTotalSlices] = useState(0);
  const [loading, setLoading] = useState(false);
  const renderingEngineRef = useRef<RenderingEngine | null>(null);

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

  useEffect(() => {
    if (!seriesId || !viewportRef.current) return;

    const loadSeries = async () => {
      setLoading(true);
      try {
        // Fetch instances
        const instances = await getSeriesInstances(seriesId);

        // Sort instances by InstanceNumber
        const sortedInstances = [...instances].sort((a: any, b: any) => {
          const aNum = parseInt(a.MainDicomTags?.InstanceNumber || a.IndexInSeries || '0');
          const bNum = parseInt(b.MainDicomTags?.InstanceNumber || b.IndexInSeries || '0');
          return aNum - bNum;
        });

        setTotalSlices(sortedInstances.length);

        // Create rendering engine
        const renderingEngineId = 'dicomViewer2DEngine';
        if (renderingEngineRef.current) {
          renderingEngineRef.current.destroy();
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
        await viewport.setStack(imageIds);
        viewport.render();

        setCurrentSlice(1);

        // Apply abdomen/liver window after initial render
        // Soft tissue window: WW=400, WC=40
        setTimeout(() => {
          const currentViewport = renderingEngine.getViewport(viewportId) as any;
          if (currentViewport) {
            currentViewport.setProperties({
              voiRange: {
                lower: 40 - 200,   // WC - WW/2 = -160
                upper: 40 + 200    // WC + WW/2 = 240
              }
            });
            currentViewport.render();
            console.log('Applied liver window. New properties:', currentViewport.getProperties());
          }
        }, 200);
      } catch (error) {
        console.error('Failed to load series:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSeries();

    return () => {
      if (renderingEngineRef.current) {
        renderingEngineRef.current.destroy();
        renderingEngineRef.current = null;
      }
    };
  }, [seriesId]);

  const handleSliceChange = useCallback((delta: number) => {
    if (!renderingEngineRef.current) return;

    const viewport = renderingEngineRef.current.getViewport('CT_STACK') as any;
    if (viewport) {
      const currentImageIdIndex = viewport.getCurrentImageIdIndex();
      const newIndex = Math.max(0, Math.min(totalSlices - 1, currentImageIdIndex + delta));
      viewport.setImageIdIndex(newIndex);
      viewport.render();
      setCurrentSlice(newIndex + 1);
    }
  }, [totalSlices]);

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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 600 }}>
        2D Viewer {segmentationSeriesId && '(with Overlay)'}
      </h3>
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
      </div>
      {totalSlices > 0 && (
        <div style={{ marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
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
      )}
    </div>
  );
}