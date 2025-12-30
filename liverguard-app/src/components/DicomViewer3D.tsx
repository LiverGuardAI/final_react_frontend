// src/components/DicomViewer3D.tsx
import { useEffect, useRef, useState } from 'react';
import { RenderingEngine, volumeLoader } from '@cornerstonejs/core';
import * as cornerstone from '@cornerstonejs/core';
import { getSeriesInstances, getInstanceFileUrl } from '../api/orthanc_api';

interface DicomViewer3DProps {
  seriesId: string | null;
  segmentationSeriesId?: string | null;
}

export default function DicomViewer3D({ seriesId, segmentationSeriesId }: DicomViewer3DProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const renderingEngineRef = useRef<RenderingEngine | null>(null);

  useEffect(() => {
    // Only load if we have a segmentation series
    if (!segmentationSeriesId || !viewportRef.current) return;

    const load3DVolume = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch segmentation instances
        const instances = await getSeriesInstances(segmentationSeriesId);

        if (instances.length === 0) {
          setError('No instances found');
          setLoading(false);
          return;
        }

        // Sort instances by InstanceNumber
        const sortedInstances = [...instances].sort((a: any, b: any) => {
          const aNum = parseInt(a.MainDicomTags?.InstanceNumber || a.IndexInSeries || '0');
          const bNum = parseInt(b.MainDicomTags?.InstanceNumber || b.IndexInSeries || '0');
          return aNum - bNum;
        });

        // Create rendering engine
        const renderingEngineId = 'dicomViewer3DEngine';
        if (renderingEngineRef.current) {
          renderingEngineRef.current.destroy();
        }

        const renderingEngine = new RenderingEngine(renderingEngineId);
        renderingEngineRef.current = renderingEngine;

        // Create viewport
        const viewportId = 'CT_VOLUME_3D';
        const viewportInput: cornerstone.Types.PublicViewportInput = {
          viewportId,
          type: cornerstone.Enums.ViewportType.ORTHOGRAPHIC as cornerstone.Enums.ViewportType,
          element: viewportRef.current as HTMLDivElement,
          defaultOptions: {
            orientation: cornerstone.Enums.OrientationAxis.SAGITTAL,
          },
        };

        renderingEngine.enableElement(viewportInput);

        // Create segmentation volume
        const volumeId = 'SEG_VOLUME_' + segmentationSeriesId;
        const imageIds = sortedInstances.map((instance: any) =>
          `wadouri:${getInstanceFileUrl(instance.ID)}`
        );

        const volume = await volumeLoader.createAndCacheVolume(volumeId, {
          imageIds,
        });

        await volume.load();

        const viewport = renderingEngine.getViewport(viewportId);
        if (viewport) {
          await (viewport as any).setVolumes([{ volumeId }]);
          viewport.render();
        }

      } catch (err) {
        console.error('Failed to load 3D segmentation:', err);
        setError('Failed to load 3D segmentation');
      } finally {
        setLoading(false);
      }
    };

    load3DVolume();

    return () => {
      if (renderingEngineRef.current) {
        renderingEngineRef.current.destroy();
        renderingEngineRef.current = null;
      }
    };
  }, [segmentationSeriesId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 600 }}>
        3D Segmentation Rendering
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
        {!segmentationSeriesId && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: '#9ca3af',
            textAlign: 'center',
          }}>
            No segmentation available
          </div>
        )}
        {loading && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: '#fff',
          }}>
            Loading 3D Segmentation...
          </div>
        )}
        {error && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: '#ef4444',
          }}>
            {error}
          </div>
        )}
      </div>
      <div style={{ marginTop: '12px', fontSize: '12px', color: '#6b7280' }}>
        Use mouse to rotate • Scroll to zoom
      </div>
    </div>
  );
}