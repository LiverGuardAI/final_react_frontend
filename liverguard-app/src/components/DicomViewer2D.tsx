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
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [currentSlice, setCurrentSlice] = useState(0);
  const [totalSlices, setTotalSlices] = useState(0);
  const [loading, setLoading] = useState(false);
  const renderingEngineRef = useRef<RenderingEngine | null>(null);
  const segImageIdsRef = useRef<string[]>([]);

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
    if (!overlayCanvasRef.current || !renderingEngineRef.current || segImageIdsRef.current.length === 0) {
      return;
    }

    const canvas = overlayCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Check if we have a corresponding SEG image for this slice
    if (sliceIndex >= segImageIdsRef.current.length) {
      console.log('DicomViewer2D: No SEG image for slice', sliceIndex);
      return;
    }

    try {
      const segImageId = segImageIdsRef.current[sliceIndex];
      console.log('DicomViewer2D: Loading SEG overlay for slice', sliceIndex);

      const image = await cornerstone.imageLoader.loadAndCacheImage(segImageId);
      const pixelData = image.getPixelData();
      const maskWidth = image.width;
      const maskHeight = image.height;

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
        return viewportElement.querySelector('canvas') as HTMLCanvasElement;
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
      const baseWidth = baseImage.width;
      const baseHeight = baseImage.height;

      // Calculate scaling if mask and base image sizes differ
      const scaleX = baseWidth / maskWidth;
      const scaleY = baseHeight / maskHeight;

      // Apply viewport transformation
      ctx.save();

      // Get viewport camera/properties for transformation
      const camera = viewport.getCamera();
      const { parallelScale } = camera;

      // Calculate scale based on canvas and image dimensions
      const canvasScale = Math.min(canvas.width / baseWidth, canvas.height / baseHeight);
      const viewportScale = canvasScale / parallelScale;

      // Center the canvas
      ctx.translate(canvas.width / 2, canvas.height / 2);

      // Apply scale
      ctx.scale(viewportScale, viewportScale);

      // Translate to image center
      ctx.translate(-baseWidth / 2, -baseHeight / 2);

      // Draw mask pixels
      let nonZeroCount = 0;
      for (let y = 0; y < maskHeight; y++) {
        for (let x = 0; x < maskWidth; x++) {
          const maskIndex = y * maskWidth + x;
          const maskValue = pixelData[maskIndex];

          if (maskValue > 0) {
            nonZeroCount++;
            // Map mask coordinates to base image coordinates
            const baseX = x * scaleX;
            const baseY = y * scaleY;

            ctx.fillStyle = 'rgba(255, 128, 0, 0.5)'; // Orange with 50% opacity
            ctx.fillRect(baseX, baseY, scaleX, scaleY);
          }
        }
      }

      ctx.restore();
      console.log('DicomViewer2D: SEG overlay rendered -', nonZeroCount, 'pixels');
    } catch (error) {
      console.error('DicomViewer2D: Failed to render SEG overlay:', error);
    }
  }, []);

  // Load SEG images when segmentationSeriesId changes
  useEffect(() => {
    if (!segmentationSeriesId) {
      segImageIdsRef.current = [];
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
        console.log('DicomViewer2D: Loaded', segImageIds.length, 'SEG images');
      } catch (error) {
        console.error('DicomViewer2D: Failed to load segmentation:', error);
      }
    };

    loadSegmentation();
  }, [segmentationSeriesId]);

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

        // Add event listener for viewport rendering to update overlay
        const viewportElement = viewport.element;
        const handleViewportRender = () => {
          const currentIndex = viewport.getCurrentImageIdIndex();
          renderSegmentationOverlay(currentIndex);
        };
        viewportElement.addEventListener(cornerstone.Enums.Events.IMAGE_RENDERED, handleViewportRender);

        // Apply windowing from DICOM metadata
        setTimeout(async () => {
          const currentViewport = renderingEngine.getViewport(viewportId) as any;
          if (currentViewport) {
            try {
              // Get current image ID
              const currentImageId = imageIds[0];

              // Try to get VOI LUT module from metadata
              const voiLutModule = cornerstone.metaData.get('voiLutModule', currentImageId);

              let windowCenter = 40;   // Default for soft tissue
              let windowWidth = 400;   // Default for soft tissue

              if (voiLutModule && voiLutModule.windowCenter && voiLutModule.windowWidth) {
                // DICOM can have multiple window settings, use the first one
                windowCenter = Array.isArray(voiLutModule.windowCenter)
                  ? voiLutModule.windowCenter[0]
                  : voiLutModule.windowCenter;
                windowWidth = Array.isArray(voiLutModule.windowWidth)
                  ? voiLutModule.windowWidth[0]
                  : voiLutModule.windowWidth;

                console.log('DicomViewer2D: Using DICOM metadata window - WC:', windowCenter, 'WW:', windowWidth);
              } else {
                // Fallback: Try to load the image and check its properties
                const image = await cornerstone.imageLoader.loadAndCacheImage(currentImageId);
                if (image.windowCenter && image.windowWidth) {
                  windowCenter = Array.isArray(image.windowCenter)
                    ? image.windowCenter[0]
                    : image.windowCenter;
                  windowWidth = Array.isArray(image.windowWidth)
                    ? image.windowWidth[0]
                    : image.windowWidth;
                  console.log('DicomViewer2D: Using image property window - WC:', windowCenter, 'WW:', windowWidth);
                } else {
                  console.log('DicomViewer2D: No window metadata found, using default - WC:', windowCenter, 'WW:', windowWidth);
                }
              }

              // Calculate VOI range from window center and width
              const lower = windowCenter - windowWidth / 2;
              const upper = windowCenter + windowWidth / 2;

              currentViewport.setProperties({
                voiRange: {
                  lower,
                  upper
                }
              });
              currentViewport.render();
              console.log('DicomViewer2D: Applied windowing - Lower:', lower, 'Upper:', upper);
            } catch (error) {
              console.error('DicomViewer2D: Error applying windowing:', error);
            }
          }

          // Render initial SEG overlay if available
          renderSegmentationOverlay(0);
        }, 200);
      } catch (error) {
        console.error('Failed to load series:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSeries();

    return () => {
      // Remove event listener
      if (renderingEngineRef.current) {
        try {
          const viewport = renderingEngineRef.current.getViewport('CT_STACK') as any;
          if (viewport && viewport.element) {
            viewport.element.removeEventListener(cornerstone.Enums.Events.IMAGE_RENDERED, () => {});
          }
        } catch (e) {
          // Ignore errors during cleanup
        }
        renderingEngineRef.current.destroy();
        renderingEngineRef.current = null;
      }
    };
  }, [seriesId, renderSegmentationOverlay]);

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
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            imageRendering: 'pixelated',
          }}
        />
      </div>
      {totalSlices > 0 && (
        <div style={{ marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
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