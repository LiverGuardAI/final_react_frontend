// src/components/DicomViewerMPR.tsx
// Canvas-based manual MPR viewer (Sagittal / Coronal)
// 3D 볼륨을 직접 구성하고 절단면을 렌더링
import { useEffect, useRef, useState, useCallback } from 'react';
import * as cornerstone from '@cornerstonejs/core';
import { getSeriesInstances, getInstanceFileUrl } from '../api/orthanc_api';

// ── 색상 (DicomViewer2D와 동일) ──
const MASK_COLORS: Record<number, [number, number, number]> = {
  1: [255, 0, 0],      // liver
  1000: [255, 0, 0],
  232: [255, 0, 0],
  2: [0, 255, 0],      // tumor
  2000: [0, 255, 0],
  208: [0, 255, 0],
  3: [0, 0, 255],
  4: [255, 255, 0],
  5: [255, 0, 255],
  6: [0, 255, 255],
};

function getMaskColor(v: number): [number, number, number] | null {
  if (v === 0) return null;
  return MASK_COLORS[v] ?? [255, 165, 0];
}

function getClassKey(v: number): string {
  if (v === 0) return 'background';
  if (v === 1 || v === 1000 || v === 232) return 'liver';
  if (v === 2 || v === 2000 || v === 208) return 'tumor';
  return 'other';
}

// ── 타입 ──
type Orientation = 'sagittal' | 'coronal';

interface Props {
  seriesId: string;
  segmentationSeriesId?: string | null;
  orientation: Orientation;
}

// ── 컴포넌트 ──
export default function DicomViewerMPRPanel({ seriesId, segmentationSeriesId, orientation }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 볼륨 데이터
  const ctVolumeRef = useRef<Float32Array | null>(null);
  const segVolumeRef = useRef<Uint16Array | null>(null);
  const dimsRef = useRef<{ cols: number; rows: number; slices: number }>({ cols: 0, rows: 0, slices: 0 });
  const windowRef = useRef<{ wc: number; ww: number }>({ wc: 40, ww: 400 });
  const spacingRef = useRef<{ pixelX: number; pixelY: number; sliceZ: number }>({ pixelX: 1, pixelY: 1, sliceZ: 1 });

  const [sliceIndex, setSliceIndex] = useState(0);
  const [maxSlice, setMaxSlice] = useState(0);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [overlayEnabled, setOverlayEnabled] = useState(true);
  const [classVisibility, setClassVisibility] = useState<Record<string, boolean>>({
    liver: true, tumor: true, other: true,
  });

  // ── 렌더링 ──
  const renderSlice = useCallback((idx: number) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const ct = ctVolumeRef.current;
    const seg = segVolumeRef.current;
    const { cols, rows, slices } = dimsRef.current;
    const { wc, ww } = windowRef.current;
    const { pixelX, pixelY, sliceZ } = spacingRef.current;
    if (!ct || cols === 0) return;

    // sagittal: Z(slices) x Y(rows), 선택값=X(cols)
    // coronal:  Z(slices) x X(cols), 선택값=Y(rows)
    const viewW = orientation === 'sagittal' ? rows : cols;
    const viewH = slices;

    canvas.width = viewW;
    canvas.height = viewH;

    const imageData = ctx.createImageData(viewW, viewH);
    const data = imageData.data;
    const lower = wc - ww / 2;

    for (let z = 0; z < slices; z++) {
      for (let i = 0; i < viewW; i++) {
        let ctIdx: number;
        if (orientation === 'sagittal') {
          // sagittal: 고정 X=idx, 순회 Y=i, Z=z
          ctIdx = z * rows * cols + i * cols + idx;
        } else {
          // coronal: 고정 Y=idx, 순회 X=i, Z=z
          ctIdx = z * rows * cols + idx * cols + i;
        }

        const raw = ct[ctIdx];
        let gray = ((raw - lower) / ww) * 255;
        gray = gray < 0 ? 0 : gray > 255 ? 255 : gray;

        const pixIdx = (z * viewW + i) * 4;
        data[pixIdx] = gray;
        data[pixIdx + 1] = gray;
        data[pixIdx + 2] = gray;
        data[pixIdx + 3] = 255;

        // 오버레이
        if (overlayEnabled && seg) {
          const maskVal = seg[ctIdx];
          if (maskVal !== 0) {
            const classKey = getClassKey(maskVal);
            if (classKey !== 'background' && classVisibility[classKey]) {
              const color = getMaskColor(maskVal);
              if (color) {
                const alpha = 0.5;
                data[pixIdx] = gray * (1 - alpha) + color[0] * alpha;
                data[pixIdx + 1] = gray * (1 - alpha) + color[1] * alpha;
                data[pixIdx + 2] = gray * (1 - alpha) + color[2] * alpha;
              }
            }
          }
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);

    // ── Canvas CSS 크기 조정 (objectFit: contain 수동 구현) ──
    const containerW = container.clientWidth;
    const containerH = container.clientHeight;
    if (containerW === 0 || containerH === 0) return;

    // 물리적 크기 계산 (spacing 반영)
    const physW = orientation === 'sagittal' ? viewW * pixelY : viewW * pixelX;
    const physH = viewH * sliceZ;
    const aspectRatio = physW / physH;

    // contain: 컨테이너에 맞추되 비율 유지
    let cssW: number;
    let cssH: number;
    if (containerW / containerH > aspectRatio) {
      // 컨테이너가 더 넓음 → 높이 기준
      cssH = containerH;
      cssW = containerH * aspectRatio;
    } else {
      // 컨테이너가 더 좁음 → 너비 기준
      cssW = containerW;
      cssH = containerW / aspectRatio;
    }

    canvas.style.width = `${Math.round(cssW)}px`;
    canvas.style.height = `${Math.round(cssH)}px`;
  }, [orientation, overlayEnabled, classVisibility]);

  // ── CT 볼륨 로드 ──
  useEffect(() => {
    if (!seriesId) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setProgress(0);

      try {
        const instances = await getSeriesInstances(seriesId);
        if (cancelled) return;

        const sorted = [...instances].sort((a: any, b: any) => {
          const aNum = parseInt(a.MainDicomTags?.InstanceNumber || a.IndexInSeries || '0');
          const bNum = parseInt(b.MainDicomTags?.InstanceNumber || b.IndexInSeries || '0');
          return aNum - bNum;
        });

        const imageIds = sorted.map((inst: any) => `wadouri:${getInstanceFileUrl(inst.ID)}`);
        const numSlices = imageIds.length;
        if (numSlices === 0) { setLoading(false); return; }

        // 첫 이미지로 dimensions 파악
        const firstImg = await cornerstone.imageLoader.loadAndCacheImage(imageIds[0]);
        if (cancelled) return;

        const imgCols = firstImg.columns;
        const imgRows = firstImg.rows;
        const slope = (firstImg as any).slope ?? 1;
        const intercept = (firstImg as any).intercept ?? 0;

        // VOI
        const voiLut = cornerstone.metaData.get('voiLutModule', imageIds[0]);
        const wc = voiLut?.windowCenter?.[0] ?? voiLut?.windowCenter ?? (firstImg as any).windowCenter ?? 40;
        const ww = voiLut?.windowWidth?.[0] ?? voiLut?.windowWidth ?? (firstImg as any).windowWidth ?? 400;
        windowRef.current = { wc: Number(wc), ww: Number(ww) };

        // Spacing
        const pixelSpacingX = (firstImg as any).columnPixelSpacing ?? 1;
        const pixelSpacingY = (firstImg as any).rowPixelSpacing ?? 1;
        const imagePlane = cornerstone.metaData.get('imagePlaneModule', imageIds[0]);
        const sliceThickness = imagePlane?.sliceThickness ?? (firstImg as any).sliceThickness ?? 1;
        spacingRef.current = { pixelX: pixelSpacingX, pixelY: pixelSpacingY, sliceZ: sliceThickness };

        dimsRef.current = { cols: imgCols, rows: imgRows, slices: numSlices };
        const volume = new Float32Array(numSlices * imgRows * imgCols);

        // 모든 슬라이스 로드
        for (let z = 0; z < numSlices; z++) {
          if (cancelled) return;
          const img = await cornerstone.imageLoader.loadAndCacheImage(imageIds[z]);
          const pixelData = img.getPixelData();
          const s = (img as any).slope ?? slope;
          const ic = (img as any).intercept ?? intercept;
          const offset = z * imgRows * imgCols;
          for (let i = 0; i < imgRows * imgCols; i++) {
            volume[offset + i] = pixelData[i] * s + ic;
          }
          setProgress(Math.round(((z + 1) / numSlices) * 100));
        }

        if (cancelled) return;
        ctVolumeRef.current = volume;

        // max slice 설정
        const max = orientation === 'sagittal' ? imgCols - 1 : imgRows - 1;
        setMaxSlice(max);
        setSliceIndex(Math.floor(max / 2));
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          console.error(`DicomViewerMPR [${orientation}]: CT load failed`, err);
          setLoading(false);
        }
      }
    };

    load();
    return () => { cancelled = true; };
  }, [seriesId, orientation]);

  // ── SEG 볼륨 로드 ──
  useEffect(() => {
    if (!segmentationSeriesId || !seriesId) {
      segVolumeRef.current = null;
      return;
    }
    let cancelled = false;

    const load = async () => {
      try {
        const instances = await getSeriesInstances(segmentationSeriesId);
        if (cancelled) return;

        const sorted = [...instances].sort((a: any, b: any) => {
          const aNum = parseInt(a.MainDicomTags?.InstanceNumber || a.IndexInSeries || '0');
          const bNum = parseInt(b.MainDicomTags?.InstanceNumber || b.IndexInSeries || '0');
          return aNum - bNum;
        });

        const imageIds = sorted.map((inst: any) => `wadouri:${getInstanceFileUrl(inst.ID)}`);
        const { cols, rows, slices } = dimsRef.current;
        if (cols === 0 || imageIds.length === 0) return;

        const mask = new Uint16Array(slices * rows * cols);
        const numSeg = Math.min(imageIds.length, slices);

        for (let z = 0; z < numSeg; z++) {
          if (cancelled) return;
          const img = await cornerstone.imageLoader.loadAndCacheImage(imageIds[z]);
          const pixelData = img.getPixelData();
          const offset = z * rows * cols;
          const len = Math.min(pixelData.length, rows * cols);
          for (let i = 0; i < len; i++) {
            mask[offset + i] = pixelData[i];
          }
        }

        if (cancelled) return;
        segVolumeRef.current = mask;
        // Re-render with overlay
        renderSlice(sliceIndex);
      } catch (err) {
        if (!cancelled) {
          console.error(`DicomViewerMPR [${orientation}]: SEG load failed`, err);
        }
      }
    };

    load();
    return () => { cancelled = true; };
  }, [segmentationSeriesId, seriesId, orientation, sliceIndex, renderSlice]);

  // ── 슬라이스 변경 시 렌더 ──
  useEffect(() => {
    renderSlice(sliceIndex);
  }, [sliceIndex, renderSlice]);

  // ── Resize observer ──
  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => {
      renderSlice(sliceIndex);
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [sliceIndex, renderSlice]);

  // ── 마우스 휠 ──
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 1 : -1;
      setSliceIndex((prev) => Math.max(0, Math.min(maxSlice, prev + delta)));
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [maxSlice]);

  const label = orientation === 'sagittal' ? 'Sagittal' : 'Coronal';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexShrink: 0, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>{label}</h3>
        {segmentationSeriesId && (
          <>
            <button
              onClick={() => setOverlayEnabled(p => !p)}
              style={{
                padding: '3px 8px', fontSize: '11px', borderRadius: '4px', cursor: 'pointer',
                border: '1px solid #d1d5db',
                backgroundColor: overlayEnabled ? '#111827' : '#f3f4f6',
                color: overlayEnabled ? '#fff' : '#111827',
              }}
            >
              Overlay {overlayEnabled ? 'On' : 'Off'}
            </button>
            <button
              onClick={() => setClassVisibility(p => ({ ...p, liver: !p.liver }))}
              style={{
                padding: '3px 8px', fontSize: '11px', borderRadius: '4px', cursor: 'pointer',
                border: '1px solid #d1d5db',
                backgroundColor: classVisibility.liver ? '#ef4444' : '#f3f4f6',
                color: classVisibility.liver ? '#fff' : '#111827',
              }}
            >
              Liver
            </button>
            <button
              onClick={() => setClassVisibility(p => ({ ...p, tumor: !p.tumor }))}
              style={{
                padding: '3px 8px', fontSize: '11px', borderRadius: '4px', cursor: 'pointer',
                border: '1px solid #d1d5db',
                backgroundColor: classVisibility.tumor ? '#22c55e' : '#f3f4f6',
                color: classVisibility.tumor ? '#fff' : '#111827',
              }}
            >
              Tumor
            </button>
          </>
        )}
      </div>

      <div
        ref={containerRef}
        style={{
          flex: 1,
          backgroundColor: '#000',
          borderRadius: '4px',
          position: 'relative',
          minHeight: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <canvas
          ref={canvasRef}
          style={{ imageRendering: 'auto' }}
        />
        {loading && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            color: '#9ca3af', fontSize: '13px', gap: '8px',
          }}>
            <span>Loading... {progress}%</span>
            <div style={{
              width: '120px', height: '4px',
              backgroundColor: '#374151', borderRadius: '2px', overflow: 'hidden',
            }}>
              <div style={{
                width: `${progress}%`, height: '100%',
                backgroundColor: '#3b82f6', transition: 'width 0.2s',
              }} />
            </div>
          </div>
        )}
      </div>

      {maxSlice > 0 && (
        <div style={{ marginTop: '6px', fontSize: '12px', color: '#6b7280', flexShrink: 0, textAlign: 'center' }}>
          Slice {sliceIndex + 1} / {maxSlice + 1}
        </div>
      )}
    </div>
  );
}
