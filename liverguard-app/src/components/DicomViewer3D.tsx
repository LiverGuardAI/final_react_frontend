// src/components/DicomViewer3D.tsx
import { useEffect, useRef, useState } from 'react';
import * as cornerstone from '@cornerstonejs/core';
import { getSeriesInstances, getInstanceFileUrl } from '../api/orthanc_api';
import vtkImageData from '@kitware/vtk.js/Common/DataModel/ImageData';
import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';
import vtkMapper from '@kitware/vtk.js/Rendering/Core/Mapper';
import vtkImageMarchingCubes from '@kitware/vtk.js/Filters/General/ImageMarchingCubes';
import vtkDataArray from '@kitware/vtk.js/Common/Core/DataArray';
import vtkOpenGLRenderWindow from '@kitware/vtk.js/Rendering/OpenGL/RenderWindow';
import vtkRenderer from '@kitware/vtk.js/Rendering/Core/Renderer';
import vtkRenderWindow from '@kitware/vtk.js/Rendering/Core/RenderWindow';
import vtkPlane from '@kitware/vtk.js/Common/DataModel/Plane';
import vtkSphereSource from '@kitware/vtk.js/Filters/Sources/SphereSource';
import vtkLineSource from '@kitware/vtk.js/Filters/Sources/LineSource';
import vtkCellPicker from '@kitware/vtk.js/Rendering/Core/CellPicker';

// 성능 최적화 설정
const OPTIMIZATION_LEVEL = 2; // 1: 약간, 2: 중간, 3: 높음

interface DicomViewer3DProps {
  segmentationSeriesId: string | null;
}

// Storage keys for persisting viewer state
const STORAGE_KEYS = {
  LIVER_OPACITY: 'dicom-viewer-liver-opacity',
  TUMOR_OPACITY: 'dicom-viewer-tumor-opacity',
  SHOW_LIVER: 'dicom-viewer-show-liver',
  SHOW_TUMOR: 'dicom-viewer-show-tumor',
};

// Load saved state from localStorage
const loadSavedState = () => {
  try {
    return {
      liverOpacity: parseFloat(localStorage.getItem(STORAGE_KEYS.LIVER_OPACITY) || '0.6'),
      tumorOpacity: parseFloat(localStorage.getItem(STORAGE_KEYS.TUMOR_OPACITY) || '0.85'),
      showLiver: localStorage.getItem(STORAGE_KEYS.SHOW_LIVER) !== 'false',
      showTumor: localStorage.getItem(STORAGE_KEYS.SHOW_TUMOR) !== 'false',
    };
  } catch (e) {
    console.warn('DicomViewer3D: Failed to load saved state from localStorage', e);
    return {
      liverOpacity: 0.6,
      tumorOpacity: 0.85,
      showLiver: true,
      showTumor: true,
    };
  }
};

export default function DicomViewer3D({ segmentationSeriesId }: DicomViewer3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renderStats, setRenderStats] = useState<{ totalPolygons: number; loadTime: number } | null>(null);

  // Load initial state from localStorage
  const savedState = loadSavedState();
  const [liverOpacity, setLiverOpacity] = useState(savedState.liverOpacity);
  const [tumorOpacity, setTumorOpacity] = useState(savedState.tumorOpacity);
  const [showLiver, setShowLiver] = useState(savedState.showLiver);
  const [showTumor, setShowTumor] = useState(savedState.showTumor);

  // Clipping plane state
  const [clippingEnabled, setClippingEnabled] = useState(false);
  const [clippingPosition, setClippingPosition] = useState(0.5);
  const [clippingAxis, setClippingAxis] = useState<'X' | 'Y' | 'Z'>('Z');
  const [clipLiver, setClipLiver] = useState(true);
  const [clipTumor, setClipTumor] = useState(false);

  // Measurement state
  const [measurementMode, setMeasurementMode] = useState<'none' | 'distance'>('none');
  const [measurementPoints, setMeasurementPoints] = useState<Array<[number, number, number]>>([]);
  const [distanceMeasurement, setDistanceMeasurement] = useState<number | null>(null);

  // Coordinate display state
  const [currentCoordinate, setCurrentCoordinate] = useState<[number, number, number] | null>(null);

  // Crosshair state
  const [crosshairEnabled, setCrosshairEnabled] = useState(false);
  const [crosshairPosition, setCrosshairPosition] = useState<[number, number, number] | null>(null);

  const renderWindowRef = useRef<any>(null);
  const rendererRef = useRef<any>(null);
  const interactorRef = useRef<any>(null);
  const actorsRef = useRef<{ liver: any; tumor: any }>({ liver: null, tumor: null });
  const clippingPlaneRef = useRef<any>(null);
  const measurementActorsRef = useRef<any[]>([]);
  const crosshairActorsRef = useRef<any[]>([]);
  const boundsRef = useRef<number[] | null>(null);
  const initialCameraStateRef = useRef<{
    position: [number, number, number];
    focalPoint: [number, number, number];
    viewUp: [number, number, number];
  } | null>(null);

  useEffect(() => {
    if (!segmentationSeriesId || !containerRef.current) {
      console.log('DicomViewer3D: Missing required data', {
        segmentationSeriesId,
        hasContainerRef: !!containerRef.current
      });
      return;
    }

    const load3DVolume = async () => {
      const startTime = performance.now();
      console.log('DicomViewer3D: Starting 3D Surface Rendering from DICOM SEG');
      console.log('DicomViewer3D: SEG Series:', segmentationSeriesId);
      setLoading(true);
      setError(null);
      setRenderStats(null);

      try {
        // Step 1: Fetch all DICOM SEG instances
        const instances = await getSeriesInstances(segmentationSeriesId);
        console.log('DicomViewer3D: Found', instances.length, 'instances');

        if (instances.length === 0) {
          throw new Error('No instances found in SEG series');
        }

        // Step 2: Load DICOM images first (before sorting)
        const imageIds = instances.map((instance: any) =>
          `wadouri:${getInstanceFileUrl(instance.ID)}`
        );

        console.log('DicomViewer3D: Loading', imageIds.length, 'DICOM images...');

        // Load all images
        const loadedImages = await Promise.all(
          imageIds.map((imageId: string) => cornerstone.imageLoader.loadAndCacheImage(imageId))
        );

        console.log('DicomViewer3D: All images loaded, now sorting by ImagePositionPatient Z...');

        // Step 3: Sort images by ImagePositionPatient Z coordinate
        const imagesWithPosition = loadedImages.map((image, index) => {
          const imageId = imageIds[index];
          const imagePlaneModule = cornerstone.metaData.get('imagePlaneModule', imageId);
          const zPosition = imagePlaneModule?.imagePositionPatient?.[2] || index;
          return { image, imageId, zPosition };
        });

        // Sort by Z position (descending - reversed order)
        imagesWithPosition.sort((a, b) => b.zPosition - a.zPosition);

        console.log('DicomViewer3D: Images sorted. Z range:',
          imagesWithPosition[0].zPosition,
          'to',
          imagesWithPosition[imagesWithPosition.length - 1].zPosition
        );

        // Extract sorted images
        const images = imagesWithPosition.map(item => item.image);
        const sortedImageIds = imagesWithPosition.map(item => item.imageId);

        // Step 4: Extract volume dimensions from first image
        const firstImage = images[0];
        const width = firstImage.width;
        const height = firstImage.height;
        const depth = images.length;

        console.log('DicomViewer3D: Volume dimensions:', { width, height, depth });

        // Step 5: Extract spacing and origin information (using sorted image IDs)
        let spacing_x = 1.0;
        let spacing_y = 1.0;
        let spacing_z = 1.0;
        let origin_x = 0.0;
        let origin_y = 0.0;
        let origin_z = 0.0;

        // Try to get spacing and origin from SORTED image metadata
        const firstImageId = sortedImageIds[0];
        const imagePlaneModule = cornerstone.metaData.get('imagePlaneModule', firstImageId);

        if (imagePlaneModule) {
          if (imagePlaneModule.rowPixelSpacing) {
            spacing_y = imagePlaneModule.rowPixelSpacing;
          }
          if (imagePlaneModule.columnPixelSpacing) {
            spacing_x = imagePlaneModule.columnPixelSpacing;
          }

          // Get origin from imagePositionPatient (first slice after sorting)
          if (imagePlaneModule.imagePositionPatient) {
            origin_x = imagePlaneModule.imagePositionPatient[0];
            origin_y = imagePlaneModule.imagePositionPatient[1];
            origin_z = imagePlaneModule.imagePositionPatient[2];
          }

          // Calculate Z spacing from slice positions
          if (images.length > 1) {
            const imagePlaneModule2 = cornerstone.metaData.get('imagePlaneModule', sortedImageIds[1]);
            if (imagePlaneModule.imagePositionPatient && imagePlaneModule2?.imagePositionPatient) {
              const pos1 = imagePlaneModule.imagePositionPatient;
              const pos2 = imagePlaneModule2.imagePositionPatient;
              const dx = pos2[0] - pos1[0];
              const dy = pos2[1] - pos1[1];
              const dz = pos2[2] - pos1[2];
              spacing_z = Math.sqrt(dx * dx + dy * dy + dz * dz);
            }
          }
        }

        console.log('DicomViewer3D: Spacing:', { spacing_x, spacing_y, spacing_z });
        console.log('DicomViewer3D: Origin (from sorted first slice):', { origin_x, origin_y, origin_z });

        // Step 6: Build 3D volume from pixel data with downsampling
        // Apply downsampling based on optimization level
        const skipFactor = OPTIMIZATION_LEVEL; // Skip every N slices
        const downsampledDepth = Math.ceil(depth / skipFactor);
        const downsampledWidth = Math.ceil(width / skipFactor);
        const downsampledHeight = Math.ceil(height / skipFactor);

        console.log('DicomViewer3D: Applying downsampling - Level', OPTIMIZATION_LEVEL);
        console.log('DicomViewer3D: Original dimensions:', { width, height, depth });
        console.log('DicomViewer3D: Downsampled dimensions:', {
          width: downsampledWidth,
          height: downsampledHeight,
          depth: downsampledDepth
        });

        const totalVoxels = downsampledWidth * downsampledHeight * downsampledDepth;
        const volumeData = new Uint8Array(totalVoxels);

        // Downsample and copy data
        for (let z = 0; z < downsampledDepth; z++) {
          const sourceZ = Math.min(z * skipFactor, depth - 1);
          const image = images[sourceZ];
          const pixelData = image.getPixelData();

          for (let y = 0; y < downsampledHeight; y++) {
            for (let x = 0; x < downsampledWidth; x++) {
              const sourceX = Math.min(x * skipFactor, width - 1);
              const sourceY = Math.min(y * skipFactor, height - 1);
              const sourceIndex = sourceY * width + sourceX;
              const targetIndex = z * (downsampledWidth * downsampledHeight) + y * downsampledWidth + x;
              volumeData[targetIndex] = pixelData[sourceIndex];
            }
          }
        }

        // Update dimensions and spacing for downsampled volume
        const finalWidth = downsampledWidth;
        const finalHeight = downsampledHeight;
        const finalDepth = downsampledDepth;
        const finalSpacingX = spacing_x * skipFactor;
        const finalSpacingY = spacing_y * skipFactor;
        const finalSpacingZ = spacing_z * skipFactor;

        // Step 7: Count labels
        const labelCounts: Record<number, number> = {};
        for (let i = 0; i < volumeData.length; i++) {
          const label = volumeData[i];
          if (label > 0) {
            labelCounts[label] = (labelCounts[label] || 0) + 1;
          }
        }
        console.log('DicomViewer3D: Label distribution:', labelCounts);

        // Log sample values for debugging
        const sampleSize = Math.min(100, volumeData.length);
        const sampleValues = Array.from(volumeData.slice(0, sampleSize));
        const uniqueSamples = [...new Set(sampleValues)];
        console.log('DicomViewer3D: Unique values in first', sampleSize, 'voxels:', uniqueSamples.sort((a, b) => a - b));

        // Step 8: Setup VTK.js rendering pipeline
        console.log('DicomViewer3D: Setting up VTK.js rendering...');

        // Cleanup previous render window if exists
        if (interactorRef.current) {
          interactorRef.current.delete();
          interactorRef.current = null;
        }
        if (renderWindowRef.current) {
          renderWindowRef.current.delete();
          renderWindowRef.current = null;
        }
        if (rendererRef.current) {
          rendererRef.current.delete();
          rendererRef.current = null;
        }

        // Create VTK render window
        const renderWindow = vtkRenderWindow.newInstance();
        const renderer = vtkRenderer.newInstance();
        renderWindow.addRenderer(renderer);
        renderer.setBackground(0.1, 0.1, 0.1); // Dark background

        // Create OpenGL render window
        const openglRenderWindow = vtkOpenGLRenderWindow.newInstance();
        renderWindow.addView(openglRenderWindow);

        // Set container
        const container = containerRef.current;
        if (!container) {
          throw new Error('Container element not found');
        }

        openglRenderWindow.setContainer(container);

        // Set size with proper dimensions
        const { width: containerWidth, height: containerHeight } = container.getBoundingClientRect();
        console.log('DicomViewer3D: Container size:', { containerWidth, containerHeight });

        if (containerWidth === 0 || containerHeight === 0) {
          throw new Error('Container has zero size. Cannot initialize VTK rendering.');
        }

        // Set explicit size on canvas
        const canvasWidth = Math.floor(containerWidth);
        const canvasHeight = Math.floor(containerHeight);
        openglRenderWindow.setSize(canvasWidth, canvasHeight);

        // Store references early (before adding actors)
        renderWindowRef.current = renderWindow;
        rendererRef.current = renderer;

        console.log('DicomViewer3D: VTK.js basic setup complete, ready to add actors');

        // Step 9: Create meshes for each label using Marching Cubes
        // Get all non-zero labels and sort by voxel count (largest first)
        const labels = Object.keys(labelCounts)
          .map(Number)
          .sort((a, b) => labelCounts[b] - labelCounts[a]); // Sort by voxel count descending

        console.log('DicomViewer3D: Found labels (sorted by size):', labels.map(l => `${l} (${labelCounts[l]} voxels)`));

        // Define colors and names based on size assumption
        // Largest = Liver (Red), Second largest = Tumor (Green)
        const labelInfo = [
          { name: 'Liver', color: [1.0, 0.2, 0.2], opacity: 0.6 },  // Red, semi-transparent
          { name: 'Tumor', color: [0.2, 0.8, 0.4], opacity: 0.85 },  // Green, more opaque
          { name: 'Region 3', color: [0.3, 0.6, 1.0], opacity: 0.7 },  // Blue
          { name: 'Region 4', color: [0.9, 0.9, 0.2], opacity: 0.7 },  // Yellow
          { name: 'Region 5', color: [0.8, 0.2, 0.8], opacity: 0.7 },  // Purple
        ];

        // Create mesh for each label
        let totalPolygons = 0;
        labels.forEach((label, index) => {
          const info = labelInfo[index] || labelInfo[labelInfo.length - 1];
          console.log(`DicomViewer3D: Creating mesh for label ${label} = ${info.name} (${labelCounts[label]} voxels)...`);

          // Create VTK ImageData for this label (using downsampled dimensions and actual origin)
          const labelData = vtkImageData.newInstance();
          labelData.setDimensions([finalWidth, finalHeight, finalDepth]);
          labelData.setSpacing([finalSpacingX, finalSpacingY, finalSpacingZ]);
          labelData.setOrigin([origin_x, origin_y, origin_z]);

          // Extract binary volume for this label
          const labelVolume = new Uint8Array(volumeData.length);
          let labelVoxelCount = 0;
          for (let i = 0; i < volumeData.length; i++) {
            if (volumeData[i] === label) {
              labelVolume[i] = 1;
              labelVoxelCount++;
            } else {
              labelVolume[i] = 0;
            }
          }
          console.log(`DicomViewer3D: Label ${label} voxel count:`, labelVoxelCount);

          const labelScalars = vtkDataArray.newInstance({
            name: 'Scalars',
            values: labelVolume,
            numberOfComponents: 1
          });
          labelData.getPointData().setScalars(labelScalars);

          // Apply Marching Cubes with optimized settings
          const marchingCubes = vtkImageMarchingCubes.newInstance({
            contourValue: 0.5,
            computeNormals: OPTIMIZATION_LEVEL < 3, // Disable normals at high optimization
            mergePoints: OPTIMIZATION_LEVEL < 2,     // Disable merging at medium+ optimization
          });
          marchingCubes.setInputData(labelData);

          // Get output polydata to check mesh generation
          const polyData = marchingCubes.getOutputData();
          const numCells = polyData.getNumberOfCells();
          totalPolygons += numCells;
          console.log(`DicomViewer3D: Label ${label} mesh - Points:`, polyData.getNumberOfPoints(), 'Cells:', numCells);

          // Only add actor if mesh was generated
          if (polyData.getNumberOfPoints() > 0) {
            // Create mapper
            const mapper = vtkMapper.newInstance();
            mapper.setInputConnection(marchingCubes.getOutputPort());

            // Create actor
            const actor = vtkActor.newInstance();
            actor.setMapper(mapper);

            // Set color and opacity from label info
            actor.getProperty().setColor(info.color[0], info.color[1], info.color[2]);
            actor.getProperty().setOpacity(info.opacity);

            // Adjust rendering quality based on optimization level
            if (OPTIMIZATION_LEVEL >= 3) {
              // High optimization: Flat shading (fastest)
              actor.getProperty().setInterpolationToFlat();
            } else if (OPTIMIZATION_LEVEL === 2) {
              // Medium optimization: Gouraud shading (balanced)
              actor.getProperty().setInterpolationToGouraud();
            } else {
              // Low optimization: Phong shading (best quality)
              actor.getProperty().setInterpolationToPhong();
              actor.getProperty().setSpecular(0.3);
              actor.getProperty().setSpecularPower(20);
            }

            renderer.addActor(actor);

            // Store actor references for the first two labels (Liver and Tumor)
            // and apply saved state
            if (index === 0) {
              actorsRef.current.liver = actor;
              // Apply saved liver opacity and visibility
              actor.getProperty().setOpacity(liverOpacity);
              actor.setVisibility(showLiver);
              console.log('DicomViewer3D: Liver actor stored in ref with opacity', liverOpacity, 'visibility', showLiver);
            } else if (index === 1) {
              actorsRef.current.tumor = actor;
              // Apply saved tumor opacity and visibility
              actor.getProperty().setOpacity(tumorOpacity);
              actor.setVisibility(showTumor);
              console.log('DicomViewer3D: Tumor actor stored in ref with opacity', tumorOpacity, 'visibility', showTumor);
            }

            console.log(`DicomViewer3D: ${info.name} mesh added to renderer`);
          } else {
            console.warn(`DicomViewer3D: Label ${label} generated no mesh points`);
          }
        });

        // Step 10: Reset camera and render
        renderer.resetCamera();

        // Adjust camera position for better initial view
        const camera = renderer.getActiveCamera();
        const bounds = renderer.computeVisiblePropBounds();
        console.log('DicomViewer3D: Scene bounds:', bounds);

        // Store bounds for clipping and measurement
        if (bounds && bounds.length === 6 && isFinite(bounds[0])) {
          boundsRef.current = bounds;

          const centerX = (bounds[0] + bounds[1]) / 2;
          const centerY = (bounds[2] + bounds[3]) / 2;
          const centerZ = (bounds[4] + bounds[5]) / 2;

          const distance = Math.max(
            bounds[1] - bounds[0],
            bounds[3] - bounds[2],
            bounds[5] - bounds[4]
          ) * 2.0;

          camera.setPosition(
            centerX + distance * 0.7,
            centerY - distance * 0.5,
            centerZ + distance * 0.7
          );
          camera.setFocalPoint(centerX, centerY, centerZ);
          camera.setViewUp(0, 0, 1);

          console.log('DicomViewer3D: Camera positioned at:', camera.getPosition());
          console.log('DicomViewer3D: Camera focal point:', camera.getFocalPoint());
        } else {
          console.warn('DicomViewer3D: Invalid bounds, using default camera');
        }

        // Save initial camera state for reset functionality
        const initialPosition = camera.getPosition();
        const initialFocalPoint = camera.getFocalPoint();
        const initialViewUp = camera.getViewUp();
        initialCameraStateRef.current = {
          position: [initialPosition[0], initialPosition[1], initialPosition[2]],
          focalPoint: [initialFocalPoint[0], initialFocalPoint[1], initialFocalPoint[2]],
          viewUp: [initialViewUp[0], initialViewUp[1], initialViewUp[2]]
        };
        console.log('DicomViewer3D: Initial camera state saved');

        renderWindow.render();

        // Setup interactor AFTER rendering is complete
        if (container) {
          console.log('DicomViewer3D: Setting up mouse interactor...');

          // Get the canvas element directly from openglRenderWindow
          const canvas = openglRenderWindow.getCanvas();
          console.log('DicomViewer3D: Canvas from openglRenderWindow:', canvas);

          if (canvas) {
            console.log('DicomViewer3D: Setting up MANUAL mouse interaction...');

            // Style canvas for interaction
            canvas.style.position = 'absolute';
            canvas.style.top = '0';
            canvas.style.left = '0';
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            canvas.style.pointerEvents = 'auto';
            canvas.style.touchAction = 'none';
            canvas.style.cursor = measurementMode === 'distance' ? 'crosshair' : 'grab';
            canvas.style.zIndex = '1';
            canvas.setAttribute('tabindex', '0'); // Make canvas focusable for wheel events

            console.log('DicomViewer3D: Canvas styled with explicit positioning and z-index');

            const camera = renderer.getActiveCamera();
            let isDragging = false;
            let isPanning = false;
            let previousPosition = { x: 0, y: 0 };

            // Mouse down - start dragging or panning
            const handleMouseDown = (event: MouseEvent) => {
              if (event.button === 0) {
                // Left click - check if in measurement mode
                if (measurementMode === 'distance') {
                  // Use picker to get 3D position
                  const picker = vtkCellPicker.newInstance();
                  picker.setPickFromList(true);
                  picker.initializePickList();
                  if (actorsRef.current.liver) picker.addPickList(actorsRef.current.liver);
                  if (actorsRef.current.tumor) picker.addPickList(actorsRef.current.tumor);

                  const rect = canvas.getBoundingClientRect();
                  const x = event.clientX - rect.left;
                  const y = event.clientY - rect.top;

                  picker.pick([x, y, 0], renderer);
                  const pickPosition = picker.getPickPosition();

                  // Check if a valid position was picked
                  if (pickPosition && pickPosition.length === 3) {
                    addMeasurementPoint([pickPosition[0], pickPosition[1], pickPosition[2]]);
                    console.log('DicomViewer3D: Picked position:', pickPosition);
                  }
                  event.preventDefault();
                  return;
                }

                // Normal rotation mode
                isDragging = true;
                canvas.style.cursor = 'grabbing';
                console.log('DicomViewer3D: Mouse down - starting rotation');
              } else if (event.button === 2) {
                // Right click - pan
                isPanning = true;
                canvas.style.cursor = 'move';
                console.log('DicomViewer3D: Mouse down - starting pan');
              }
              previousPosition = { x: event.clientX, y: event.clientY };
              event.preventDefault();
            };

            // Mouse move - rotate or pan camera, and update coordinate display
            const handleMouseMove = (event: MouseEvent) => {
              // Always update coordinates when not in measurement mode and crosshair is disabled
              if (!crosshairEnabled && measurementMode !== 'distance' && !isDragging && !isPanning) {
                const picker = vtkCellPicker.newInstance();
                picker.setPickFromList(true);
                picker.initializePickList();
                if (actorsRef.current.liver) picker.addPickList(actorsRef.current.liver);
                if (actorsRef.current.tumor) picker.addPickList(actorsRef.current.tumor);

                const rect = canvas.getBoundingClientRect();
                const x = event.clientX - rect.left;
                const y = event.clientY - rect.top;

                picker.pick([x, y, 0], renderer);
                const pickPosition = picker.getPickPosition();

                if (pickPosition && pickPosition.length === 3) {
                  setCurrentCoordinate([pickPosition[0], pickPosition[1], pickPosition[2]]);
                } else {
                  setCurrentCoordinate(null);
                }
              }

              if (!isDragging && !isPanning) return;

              const deltaX = event.clientX - previousPosition.x;
              const deltaY = event.clientY - previousPosition.y;

              if (isDragging) {
                // Rotate around Y axis (left-right motion)
                if (Math.abs(deltaX) > 0) {
                  camera.azimuth(deltaX * 0.5);
                }

                // Rotate around X axis (up-down motion)
                if (Math.abs(deltaY) > 0) {
                  camera.elevation(deltaY * 0.5);
                }

                camera.orthogonalizeViewUp();
                console.log('DicomViewer3D: Rotating - delta:', deltaX, deltaY);
              } else if (isPanning) {
                // Pan camera (move focal point and position together)
                const bounds = renderer.computeVisiblePropBounds();
                const size = Math.max(
                  bounds[1] - bounds[0],
                  bounds[3] - bounds[2],
                  bounds[5] - bounds[4]
                );

                const scaleFactor = size * 0.001; // Adjust sensitivity

                // Get camera coordinate system
                const position = camera.getPosition();
                const focalPoint = camera.getFocalPoint();
                const viewUp = camera.getViewUp();

                // Calculate right vector (perpendicular to view direction and up)
                const viewDirection = [
                  focalPoint[0] - position[0],
                  focalPoint[1] - position[1],
                  focalPoint[2] - position[2]
                ];

                // Right = ViewDirection × ViewUp
                const right = [
                  viewDirection[1] * viewUp[2] - viewDirection[2] * viewUp[1],
                  viewDirection[2] * viewUp[0] - viewDirection[0] * viewUp[2],
                  viewDirection[0] * viewUp[1] - viewDirection[1] * viewUp[0]
                ];

                // Normalize right vector
                const rightLength = Math.sqrt(right[0] * right[0] + right[1] * right[1] + right[2] * right[2]);
                right[0] /= rightLength;
                right[1] /= rightLength;
                right[2] /= rightLength;

                // Calculate movement in camera space
                const moveX = -deltaX * scaleFactor;
                const moveY = deltaY * scaleFactor;

                // Update position and focal point
                const newPosition: [number, number, number] = [
                  position[0] + right[0] * moveX + viewUp[0] * moveY,
                  position[1] + right[1] * moveX + viewUp[1] * moveY,
                  position[2] + right[2] * moveX + viewUp[2] * moveY
                ];

                const newFocalPoint: [number, number, number] = [
                  focalPoint[0] + right[0] * moveX + viewUp[0] * moveY,
                  focalPoint[1] + right[1] * moveX + viewUp[1] * moveY,
                  focalPoint[2] + right[2] * moveX + viewUp[2] * moveY
                ];

                camera.setPosition(...newPosition);
                camera.setFocalPoint(...newFocalPoint);

                console.log('DicomViewer3D: Panning - delta:', deltaX, deltaY);
              }

              // Reset clipping range to prevent rendering issues
              renderer.resetCameraClippingRange();

              renderWindow.render();

              previousPosition = { x: event.clientX, y: event.clientY };
            };

            // Mouse up - stop dragging or panning
            const handleMouseUp = () => {
              if (isDragging || isPanning) {
                isDragging = false;
                isPanning = false;
                canvas.style.cursor = measurementMode === 'distance' ? 'crosshair' : 'grab';
                console.log('DicomViewer3D: Mouse up - stopped interaction');
              }
            };

            // Mouse leave - stop dragging or panning
            const handleMouseLeave = () => {
              if (isDragging || isPanning) {
                isDragging = false;
                isPanning = false;
                canvas.style.cursor = measurementMode === 'distance' ? 'crosshair' : 'grab';
                console.log('DicomViewer3D: Mouse left - stopped interaction');
              }
            };

            // Prevent context menu on right click
            const handleContextMenu = (event: MouseEvent) => {
              event.preventDefault();
              console.log('DicomViewer3D: Context menu prevented');
            };

            // Mouse wheel - zoom
            const handleWheel = (event: WheelEvent) => {
              event.preventDefault();

              const zoomFactor = event.deltaY > 0 ? 1.1 : 0.9;
              camera.dolly(zoomFactor);
              camera.orthogonalizeViewUp();

              // Reset clipping range to prevent black screen when zooming
              renderer.resetCameraClippingRange();

              renderWindow.render();

              console.log('DicomViewer3D: Zoom - factor:', zoomFactor);
            };

            // Add all event listeners
            canvas.addEventListener('mousedown', handleMouseDown);
            canvas.addEventListener('mousemove', handleMouseMove);
            canvas.addEventListener('mouseup', handleMouseUp);
            canvas.addEventListener('mouseleave', handleMouseLeave);
            canvas.addEventListener('wheel', handleWheel, { passive: false });
            canvas.addEventListener('contextmenu', handleContextMenu);

            console.log('DicomViewer3D: Manual interaction handlers installed (rotate + pan + zoom)');

            // Ensure container can receive events
            container.style.pointerEvents = 'auto';
            container.style.touchAction = 'none';
          } else {
            console.error('DicomViewer3D: Could not get canvas from openglRenderWindow');
          }
        }

        // Calculate and save rendering statistics
        const endTime = performance.now();
        const loadTime = (endTime - startTime) / 1000; // Convert to seconds
        setRenderStats({ totalPolygons, loadTime });

        console.log('DicomViewer3D: 3D Surface rendering complete');
        console.log(`DicomViewer3D: Total polygons: ${totalPolygons.toLocaleString()}, Load time: ${loadTime.toFixed(2)}s`);

      } catch (err) {
        console.error('DicomViewer3D: Failed to load 3D segmentation:', err);
        setError('Failed to load 3D segmentation');
      } finally {
        setLoading(false);
      }
    };

    load3DVolume();

    // Cleanup on unmount
    return () => {
      // Cleanup in reverse order: interactor -> renderWindow -> renderer
      if (interactorRef.current) {
        try {
          interactorRef.current.delete();
        } catch (e) {
          console.warn('Error deleting interactor:', e);
        }
        interactorRef.current = null;
      }
      if (renderWindowRef.current) {
        try {
          renderWindowRef.current.delete();
        } catch (e) {
          console.warn('Error deleting renderWindow:', e);
        }
        renderWindowRef.current = null;
      }
      if (rendererRef.current) {
        try {
          rendererRef.current.delete();
        } catch (e) {
          console.warn('Error deleting renderer:', e);
        }
        rendererRef.current = null;
      }
    };
  }, [segmentationSeriesId]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (renderWindowRef.current && containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        const openglRenderWindow = renderWindowRef.current.getViews()[0];
        if (openglRenderWindow) {
          openglRenderWindow.setSize(width, height);
          renderWindowRef.current.render();
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Update canvas cursor when measurement mode changes
  useEffect(() => {
    if (renderWindowRef.current && containerRef.current) {
      const openglRenderWindow = renderWindowRef.current.getViews()[0];
      if (openglRenderWindow) {
        const canvas = openglRenderWindow.getCanvas();
        if (canvas) {
          canvas.style.cursor = measurementMode === 'distance' ? 'crosshair' : 'grab';
        }
      }
    }
  }, [measurementMode]);

  // Reset camera to initial state
  const handleResetCamera = () => {
    if (!rendererRef.current || !renderWindowRef.current || !initialCameraStateRef.current) {
      console.warn('DicomViewer3D: Cannot reset camera - missing references');
      return;
    }

    const camera = rendererRef.current.getActiveCamera();
    const initialState = initialCameraStateRef.current;

    camera.setPosition(...initialState.position);
    camera.setFocalPoint(...initialState.focalPoint);
    camera.setViewUp(...initialState.viewUp);
    camera.orthogonalizeViewUp();

    rendererRef.current.resetCameraClippingRange();
    renderWindowRef.current.render();

    console.log('DicomViewer3D: Camera reset to initial state');
  };

  // Handle opacity changes
  const handleLiverOpacityChange = (value: number) => {
    setLiverOpacity(value);
    // Save to localStorage
    try {
      localStorage.setItem(STORAGE_KEYS.LIVER_OPACITY, value.toString());
    } catch (e) {
      console.warn('DicomViewer3D: Failed to save liver opacity to localStorage', e);
    }
    if (actorsRef.current.liver) {
      actorsRef.current.liver.getProperty().setOpacity(value);
      renderWindowRef.current?.render();
      console.log('DicomViewer3D: Liver opacity set to', value);
    }
  };

  const handleTumorOpacityChange = (value: number) => {
    setTumorOpacity(value);
    // Save to localStorage
    try {
      localStorage.setItem(STORAGE_KEYS.TUMOR_OPACITY, value.toString());
    } catch (e) {
      console.warn('DicomViewer3D: Failed to save tumor opacity to localStorage', e);
    }
    if (actorsRef.current.tumor) {
      actorsRef.current.tumor.getProperty().setOpacity(value);
      renderWindowRef.current?.render();
      console.log('DicomViewer3D: Tumor opacity set to', value);
    }
  };

  // Handle visibility toggles
  const handleLiverVisibilityToggle = () => {
    const newVisibility = !showLiver;
    setShowLiver(newVisibility);
    // Save to localStorage
    try {
      localStorage.setItem(STORAGE_KEYS.SHOW_LIVER, newVisibility.toString());
    } catch (e) {
      console.warn('DicomViewer3D: Failed to save liver visibility to localStorage', e);
    }
    if (actorsRef.current.liver) {
      actorsRef.current.liver.setVisibility(newVisibility);
      renderWindowRef.current?.render();
      console.log('DicomViewer3D: Liver visibility set to', newVisibility);
    }
  };

  const handleTumorVisibilityToggle = () => {
    const newVisibility = !showTumor;
    setShowTumor(newVisibility);
    // Save to localStorage
    try {
      localStorage.setItem(STORAGE_KEYS.SHOW_TUMOR, newVisibility.toString());
    } catch (e) {
      console.warn('DicomViewer3D: Failed to save tumor visibility to localStorage', e);
    }
    if (actorsRef.current.tumor) {
      actorsRef.current.tumor.setVisibility(newVisibility);
      renderWindowRef.current?.render();
      console.log('DicomViewer3D: Tumor visibility set to', newVisibility);
    }
  };

  // Handle view presets
  const handleViewPreset = (presetType: 'axial' | 'coronal' | 'sagittal') => {
    if (!rendererRef.current || !renderWindowRef.current) {
      console.warn('DicomViewer3D: Cannot set view preset - missing references');
      return;
    }

    const camera = rendererRef.current.getActiveCamera();
    const bounds = rendererRef.current.computeVisiblePropBounds();

    if (!bounds || bounds.length !== 6 || !isFinite(bounds[0])) {
      console.warn('DicomViewer3D: Invalid bounds for view preset');
      return;
    }

    const centerX = (bounds[0] + bounds[1]) / 2;
    const centerY = (bounds[2] + bounds[3]) / 2;
    const centerZ = (bounds[4] + bounds[5]) / 2;

    const distance = Math.max(
      bounds[1] - bounds[0],
      bounds[3] - bounds[2],
      bounds[5] - bounds[4]
    ) * 2.0;

    switch (presetType) {
      case 'axial':
        // Top-down view (looking down Z-axis)
        camera.setPosition(centerX, centerY, centerZ + distance);
        camera.setFocalPoint(centerX, centerY, centerZ);
        camera.setViewUp(0, 1, 0);
        console.log('DicomViewer3D: Axial view set');
        break;
      case 'coronal':
        // Front-to-back view (looking along Y-axis)
        camera.setPosition(centerX, centerY - distance, centerZ);
        camera.setFocalPoint(centerX, centerY, centerZ);
        camera.setViewUp(0, 0, 1);
        console.log('DicomViewer3D: Coronal view set');
        break;
      case 'sagittal':
        // Side view (looking along X-axis)
        camera.setPosition(centerX + distance, centerY, centerZ);
        camera.setFocalPoint(centerX, centerY, centerZ);
        camera.setViewUp(0, 0, 1);
        console.log('DicomViewer3D: Sagittal view set');
        break;
    }

    camera.orthogonalizeViewUp();
    rendererRef.current.resetCameraClippingRange();
    renderWindowRef.current.render();
  };

  // Handle clipping plane toggle
  const handleClippingToggle = () => {
    const newEnabled = !clippingEnabled;
    setClippingEnabled(newEnabled);

    if (!actorsRef.current.liver && !actorsRef.current.tumor) {
      console.warn('DicomViewer3D: No actors available for clipping');
      return;
    }

    if (newEnabled) {
      // Create clipping plane
      const plane = vtkPlane.newInstance();
      clippingPlaneRef.current = plane;
      updateClippingPlane(clippingAxis, clippingPosition);
      console.log('DicomViewer3D: Clipping plane enabled');
    } else {
      // Remove clipping plane
      if (actorsRef.current.liver) {
        actorsRef.current.liver.getMapper().removeAllClippingPlanes();
      }
      if (actorsRef.current.tumor) {
        actorsRef.current.tumor.getMapper().removeAllClippingPlanes();
      }
      clippingPlaneRef.current = null;
      renderWindowRef.current?.render();
      console.log('DicomViewer3D: Clipping plane disabled');
    }
  };

  // Update clipping plane position and orientation
  const updateClippingPlane = (axis: 'X' | 'Y' | 'Z', position: number) => {
    if (!clippingPlaneRef.current || !boundsRef.current) return;

    const bounds = boundsRef.current;
    const plane = clippingPlaneRef.current;

    // Calculate actual position based on bounds
    let origin: [number, number, number];
    let normal: [number, number, number];

    if (axis === 'X') {
      const x = bounds[0] + (bounds[1] - bounds[0]) * position;
      origin = [x, (bounds[2] + bounds[3]) / 2, (bounds[4] + bounds[5]) / 2];
      normal = [1, 0, 0];
    } else if (axis === 'Y') {
      const y = bounds[2] + (bounds[3] - bounds[2]) * position;
      origin = [(bounds[0] + bounds[1]) / 2, y, (bounds[4] + bounds[5]) / 2];
      normal = [0, 1, 0];
    } else {
      const z = bounds[4] + (bounds[5] - bounds[4]) * position;
      origin = [(bounds[0] + bounds[1]) / 2, (bounds[2] + bounds[3]) / 2, z];
      normal = [0, 0, 1];
    }

    plane.setOrigin(...origin);
    plane.setNormal(...normal);

    // Apply to selected actors only
    if (actorsRef.current.liver) {
      actorsRef.current.liver.getMapper().removeAllClippingPlanes();
      if (clipLiver) {
        actorsRef.current.liver.getMapper().addClippingPlane(plane);
      }
    }
    if (actorsRef.current.tumor) {
      actorsRef.current.tumor.getMapper().removeAllClippingPlanes();
      if (clipTumor) {
        actorsRef.current.tumor.getMapper().addClippingPlane(plane);
      }
    }

    renderWindowRef.current?.render();
  };

  // Handle clipping position change
  const handleClippingPositionChange = (value: number) => {
    setClippingPosition(value);
    if (clippingEnabled) {
      updateClippingPlane(clippingAxis, value);
    }
  };

  // Handle clipping axis change
  const handleClippingAxisChange = (axis: 'X' | 'Y' | 'Z') => {
    setClippingAxis(axis);
    if (clippingEnabled) {
      updateClippingPlane(axis, clippingPosition);
    }
  };

  // Handle clipping target toggles
  const handleClipLiverToggle = () => {
    const newValue = !clipLiver;
    setClipLiver(newValue);
    if (clippingEnabled) {
      updateClippingPlane(clippingAxis, clippingPosition);
    }
  };

  const handleClipTumorToggle = () => {
    const newValue = !clipTumor;
    setClipTumor(newValue);
    if (clippingEnabled) {
      updateClippingPlane(clippingAxis, clippingPosition);
    }
  };

  // Handle measurement mode toggle
  const handleMeasurementToggle = () => {
    if (measurementMode === 'none') {
      setMeasurementMode('distance');
      setMeasurementPoints([]);
      setDistanceMeasurement(null);
      console.log('DicomViewer3D: Distance measurement mode enabled');
    } else {
      setMeasurementMode('none');
      clearMeasurements();
      console.log('DicomViewer3D: Measurement mode disabled');
    }
  };

  // Clear all measurements
  const clearMeasurements = () => {
    // Remove all measurement actors
    if (rendererRef.current) {
      measurementActorsRef.current.forEach(actor => {
        rendererRef.current.removeActor(actor);
      });
      measurementActorsRef.current = [];
      renderWindowRef.current?.render();
    }
    setMeasurementPoints([]);
    setDistanceMeasurement(null);
  };

  // Add measurement point (called when user clicks on the 3D view)
  const addMeasurementPoint = (worldPos: [number, number, number]) => {
    if (measurementMode !== 'distance') return;

    const newPoints = [...measurementPoints, worldPos];
    setMeasurementPoints(newPoints);

    // Create sphere marker at the point
    const sphereSource = vtkSphereSource.newInstance({
      center: worldPos,
      radius: 2.0,
      thetaResolution: 16,
      phiResolution: 16,
    });

    const mapper = vtkMapper.newInstance();
    mapper.setInputConnection(sphereSource.getOutputPort());

    const actor = vtkActor.newInstance();
    actor.setMapper(mapper);
    actor.getProperty().setColor(1, 1, 0); // Yellow
    actor.getProperty().setOpacity(1.0);

    rendererRef.current?.addActor(actor);
    measurementActorsRef.current.push(actor);

    // If we have 2 points, draw line and calculate distance
    if (newPoints.length === 2) {
      const [p1, p2] = newPoints;

      // Create line between points
      const lineSource = vtkLineSource.newInstance({
        point1: p1,
        point2: p2,
      });

      const lineMapper = vtkMapper.newInstance();
      lineMapper.setInputConnection(lineSource.getOutputPort());

      const lineActor = vtkActor.newInstance();
      lineActor.setMapper(lineMapper);
      lineActor.getProperty().setColor(1, 1, 0); // Yellow
      lineActor.getProperty().setLineWidth(3);

      rendererRef.current?.addActor(lineActor);
      measurementActorsRef.current.push(lineActor);

      // Calculate distance
      const dx = p2[0] - p1[0];
      const dy = p2[1] - p1[1];
      const dz = p2[2] - p1[2];
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      setDistanceMeasurement(distance);

      console.log('DicomViewer3D: Distance measured:', distance.toFixed(2), 'mm');

      // Reset for next measurement
      setMeasurementPoints([]);
    }

    renderWindowRef.current?.render();
  };

  // Crosshair toggle
  const handleCrosshairToggle = () => {
    const newEnabled = !crosshairEnabled;
    setCrosshairEnabled(newEnabled);

    if (newEnabled) {
      // Initialize crosshair at center of bounds
      if (boundsRef.current) {
        const bounds = boundsRef.current;
        const centerX = (bounds[0] + bounds[1]) / 2;
        const centerY = (bounds[2] + bounds[3]) / 2;
        const centerZ = (bounds[4] + bounds[5]) / 2;
        const initialPos: [number, number, number] = [centerX, centerY, centerZ];
        setCrosshairPosition(initialPos);
        setCurrentCoordinate(initialPos);
        createCrosshair(initialPos);
        console.log('DicomViewer3D: Crosshair enabled at', initialPos);
      }
    } else {
      // Remove crosshair
      clearCrosshair();
      setCrosshairPosition(null);
      setCurrentCoordinate(null);
      console.log('DicomViewer3D: Crosshair disabled');
    }
  };

  // Create crosshair lines (X, Y, Z axes)
  const createCrosshair = (position: [number, number, number]) => {
    if (!rendererRef.current || !boundsRef.current) return;

    // Clear existing crosshair
    clearCrosshair();

    const bounds = boundsRef.current;
    const [x, y, z] = position;

    // Calculate line extent
    const extent = Math.max(
      bounds[1] - bounds[0],
      bounds[3] - bounds[2],
      bounds[5] - bounds[4]
    ) * 0.3; // 30% of max dimension

    // X-axis line (Red)
    const xLineSource = vtkLineSource.newInstance({
      point1: [x - extent, y, z],
      point2: [x + extent, y, z],
    });
    const xMapper = vtkMapper.newInstance();
    xMapper.setInputConnection(xLineSource.getOutputPort());
    const xActor = vtkActor.newInstance();
    xActor.setMapper(xMapper);
    xActor.getProperty().setColor(1, 0, 0); // Red
    xActor.getProperty().setLineWidth(2);
    rendererRef.current.addActor(xActor);
    crosshairActorsRef.current.push(xActor);

    // Y-axis line (Green)
    const yLineSource = vtkLineSource.newInstance({
      point1: [x, y - extent, z],
      point2: [x, y + extent, z],
    });
    const yMapper = vtkMapper.newInstance();
    yMapper.setInputConnection(yLineSource.getOutputPort());
    const yActor = vtkActor.newInstance();
    yActor.setMapper(yMapper);
    yActor.getProperty().setColor(0, 1, 0); // Green
    yActor.getProperty().setLineWidth(2);
    rendererRef.current.addActor(yActor);
    crosshairActorsRef.current.push(yActor);

    // Z-axis line (Blue)
    const zLineSource = vtkLineSource.newInstance({
      point1: [x, y, z - extent],
      point2: [x, y, z + extent],
    });
    const zMapper = vtkMapper.newInstance();
    zMapper.setInputConnection(zLineSource.getOutputPort());
    const zActor = vtkActor.newInstance();
    zActor.setMapper(zMapper);
    zActor.getProperty().setColor(0, 0, 1); // Blue
    zActor.getProperty().setLineWidth(2);
    rendererRef.current.addActor(zActor);
    crosshairActorsRef.current.push(zActor);

    // Center sphere marker
    const sphereSource = vtkSphereSource.newInstance({
      center: position,
      radius: 1.5,
      thetaResolution: 16,
      phiResolution: 16,
    });
    const sphereMapper = vtkMapper.newInstance();
    sphereMapper.setInputConnection(sphereSource.getOutputPort());
    const sphereActor = vtkActor.newInstance();
    sphereActor.setMapper(sphereMapper);
    sphereActor.getProperty().setColor(1, 1, 1); // White
    sphereActor.getProperty().setOpacity(1.0);
    rendererRef.current.addActor(sphereActor);
    crosshairActorsRef.current.push(sphereActor);

    renderWindowRef.current?.render();
  };

  // Clear crosshair
  const clearCrosshair = () => {
    if (rendererRef.current) {
      crosshairActorsRef.current.forEach(actor => {
        rendererRef.current.removeActor(actor);
      });
      crosshairActorsRef.current = [];
      renderWindowRef.current?.render();
    }
  };

  // Handle crosshair X position change
  const handleCrosshairXChange = (value: number) => {
    if (!crosshairPosition || !boundsRef.current) return;
    const newPosition: [number, number, number] = [value, crosshairPosition[1], crosshairPosition[2]];
    setCrosshairPosition(newPosition);
    setCurrentCoordinate(newPosition);
    createCrosshair(newPosition);
  };

  // Handle crosshair Y position change
  const handleCrosshairYChange = (value: number) => {
    if (!crosshairPosition || !boundsRef.current) return;
    const newPosition: [number, number, number] = [crosshairPosition[0], value, crosshairPosition[2]];
    setCrosshairPosition(newPosition);
    setCurrentCoordinate(newPosition);
    createCrosshair(newPosition);
  };

  // Handle crosshair Z position change
  const handleCrosshairZChange = (value: number) => {
    if (!crosshairPosition || !boundsRef.current) return;
    const newPosition: [number, number, number] = [crosshairPosition[0], crosshairPosition[1], value];
    setCrosshairPosition(newPosition);
    setCurrentCoordinate(newPosition);
    createCrosshair(newPosition);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexShrink: 0 }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
          3D Surface Rendering
        </h3>

        {/* Legend and Reset Button */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Legend - shows actual detected labels */}
          <div style={{ display: 'flex', gap: '16px', fontSize: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '16px',
                height: '16px',
                backgroundColor: 'rgb(255, 51, 51)',
                borderRadius: '3px',
                opacity: 0.8
              }} />
              <span style={{ color: '#6b7280' }}>Liver</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '16px',
                height: '16px',
                backgroundColor: 'rgb(51, 204, 102)',
                borderRadius: '3px',
                opacity: 0.85
              }} />
              <span style={{ color: '#6b7280' }}>Tumor</span>
            </div>
          </div>

          {/* Reset Camera Button */}
          <button
            onClick={handleResetCamera}
            disabled={!initialCameraStateRef.current}
            style={{
              padding: '4px 12px',
              fontSize: '12px',
              fontWeight: 500,
              color: initialCameraStateRef.current ? '#3b82f6' : '#9ca3af',
              backgroundColor: 'transparent',
              border: `1px solid ${initialCameraStateRef.current ? '#3b82f6' : '#e5e7eb'}`,
              borderRadius: '4px',
              cursor: initialCameraStateRef.current ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
              opacity: initialCameraStateRef.current ? 1 : 0.5,
            }}
            onMouseEnter={(e) => {
              if (initialCameraStateRef.current) {
                e.currentTarget.style.backgroundColor = '#eff6ff';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            title="Reset camera to initial view"
          >
            🔄 Reset View
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        style={{
          flex: 1,
          backgroundColor: '#1a1a1a',
          borderRadius: '4px',
          position: 'relative',
          width: '100%',
          overflow: 'hidden',
          cursor: 'grab',
          touchAction: 'none',
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
            pointerEvents: 'none',
            zIndex: 10,
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
            fontSize: '14px',
            pointerEvents: 'none',
            zIndex: 10,
          }}>
            Loading 3D Rendering...
          </div>
        )}
        {error && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: '#ef4444',
            fontSize: '14px',
            pointerEvents: 'none',
            zIndex: 10,
          }}>
            {error}
          </div>
        )}
        {/* Coordinate Display Overlay */}
        {currentCoordinate && (
          <div style={{
            position: 'absolute',
            top: '12px',
            left: '12px',
            backgroundColor: crosshairEnabled ? 'rgba(59, 130, 246, 0.95)' : 'rgba(0, 0, 0, 0.75)',
            color: '#ffffff',
            padding: crosshairEnabled ? '10px 14px' : '8px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            fontFamily: 'monospace',
            pointerEvents: 'none',
            zIndex: 20,
            lineHeight: '1.6',
            border: crosshairEnabled ? '2px solid rgba(255, 255, 255, 0.4)' : '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: crosshairEnabled ? '0 4px 12px rgba(0, 0, 0, 0.3)' : 'none',
          }}>
            <div style={{
              fontWeight: 700,
              marginBottom: '4px',
              color: crosshairEnabled ? '#ffffff' : '#60a5fa',
              fontSize: crosshairEnabled ? '13px' : '12px'
            }}>
              {crosshairEnabled ? '🎯 크로스헤어 좌표 (mm)' : '좌표 (mm)'}
            </div>
            <div style={{ color: '#fca5a5' }}>X: {currentCoordinate[0].toFixed(2)}</div>
            <div style={{ color: '#86efac' }}>Y: {currentCoordinate[1].toFixed(2)}</div>
            <div style={{ color: '#93c5fd' }}>Z: {currentCoordinate[2].toFixed(2)}</div>
          </div>
        )}
      </div>
      {/* Controls Panel */}
      <div style={{
        marginTop: '12px',
        padding: '12px',
        backgroundColor: '#f9fafb',
        borderRadius: '6px',
        flexShrink: 0,
      }}>
        {/* Opacity Controls */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
            투명도 조절
          </div>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            {/* Liver Opacity */}
            <div style={{ flex: '1', minWidth: '200px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ fontSize: '12px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '12px', height: '12px', backgroundColor: 'rgb(255, 51, 51)', borderRadius: '2px' }} />
                  Liver
                </label>
                <span style={{ fontSize: '12px', color: '#9ca3af' }}>{Math.round(liverOpacity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={liverOpacity}
                onChange={(e) => handleLiverOpacityChange(parseFloat(e.target.value))}
                style={{ width: '100%', cursor: 'pointer' }}
              />
            </div>
            {/* Tumor Opacity */}
            <div style={{ flex: '1', minWidth: '200px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ fontSize: '12px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '12px', height: '12px', backgroundColor: 'rgb(51, 204, 102)', borderRadius: '2px' }} />
                  Tumor
                </label>
                <span style={{ fontSize: '12px', color: '#9ca3af' }}>{Math.round(tumorOpacity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={tumorOpacity}
                onChange={(e) => handleTumorOpacityChange(parseFloat(e.target.value))}
                style={{ width: '100%', cursor: 'pointer' }}
              />
            </div>
          </div>
        </div>

        {/* Visibility Toggles and View Presets - Combined Row */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
            {/* Visibility Toggles */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
                표시/숨김
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleLiverVisibilityToggle}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: showLiver ? '#059669' : '#6b7280',
                    backgroundColor: showLiver ? '#d1fae5' : '#f3f4f6',
                    border: `1px solid ${showLiver ? '#10b981' : '#d1d5db'}`,
                    borderRadius: '4px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <div style={{ width: '12px', height: '12px', backgroundColor: 'rgb(255, 51, 51)', borderRadius: '2px' }} />
                  {showLiver ? '✓' : '✗'}
                </button>
                <button
                  onClick={handleTumorVisibilityToggle}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: showTumor ? '#059669' : '#6b7280',
                    backgroundColor: showTumor ? '#d1fae5' : '#f3f4f6',
                    border: `1px solid ${showTumor ? '#10b981' : '#d1d5db'}`,
                    borderRadius: '4px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <div style={{ width: '12px', height: '12px', backgroundColor: 'rgb(51, 204, 102)', borderRadius: '2px' }} />
                  {showTumor ? '✓' : '✗'}
                </button>
              </div>
            </div>

            {/* View Presets */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
                보기 방향
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => handleViewPreset('axial')}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: '#3b82f6',
                    backgroundColor: '#eff6ff',
                    border: '1px solid #3b82f6',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#dbeafe';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#eff6ff';
                  }}
                >
                  Axial
                </button>
                <button
                  onClick={() => handleViewPreset('coronal')}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: '#3b82f6',
                    backgroundColor: '#eff6ff',
                    border: '1px solid #3b82f6',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#dbeafe';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#eff6ff';
                  }}
                >
                  Coronal
                </button>
                <button
                  onClick={() => handleViewPreset('sagittal')}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: '#3b82f6',
                    backgroundColor: '#eff6ff',
                    border: '1px solid #3b82f6',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#dbeafe';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#eff6ff';
                  }}
                >
                  Sagittal
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Clipping Plane */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
            클리핑 평면
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              onClick={handleClippingToggle}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 500,
                color: clippingEnabled ? '#dc2626' : '#059669',
                backgroundColor: clippingEnabled ? '#fee2e2' : '#d1fae5',
                border: `1px solid ${clippingEnabled ? '#dc2626' : '#10b981'}`,
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {clippingEnabled ? '✗ 클리핑 끄기' : '✓ 클리핑 켜기'}
            </button>

            {clippingEnabled && (
              <>
                {/* Clipping Target Selection */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
                  <button
                    onClick={handleClipLiverToggle}
                    style={{
                      flex: 1,
                      padding: '4px 8px',
                      fontSize: '11px',
                      fontWeight: 500,
                      color: clipLiver ? '#059669' : '#6b7280',
                      backgroundColor: clipLiver ? '#d1fae5' : '#f3f4f6',
                      border: `1px solid ${clipLiver ? '#10b981' : '#d1d5db'}`,
                      borderRadius: '4px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                    }}
                  >
                    <div style={{ width: '8px', height: '8px', backgroundColor: 'rgb(255, 51, 51)', borderRadius: '2px' }} />
                    {clipLiver ? '✓' : ''} Liver
                  </button>
                  <button
                    onClick={handleClipTumorToggle}
                    style={{
                      flex: 1,
                      padding: '4px 8px',
                      fontSize: '11px',
                      fontWeight: 500,
                      color: clipTumor ? '#059669' : '#6b7280',
                      backgroundColor: clipTumor ? '#d1fae5' : '#f3f4f6',
                      border: `1px solid ${clipTumor ? '#10b981' : '#d1d5db'}`,
                      borderRadius: '4px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                    }}
                  >
                    <div style={{ width: '8px', height: '8px', backgroundColor: 'rgb(51, 204, 102)', borderRadius: '2px' }} />
                    {clipTumor ? '✓' : ''} Tumor
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {(['X', 'Y', 'Z'] as const).map((axis) => (
                    <button
                      key={axis}
                      onClick={() => handleClippingAxisChange(axis)}
                      style={{
                        flex: 1,
                        padding: '4px 8px',
                        fontSize: '11px',
                        fontWeight: 500,
                        color: clippingAxis === axis ? '#ffffff' : '#6b7280',
                        backgroundColor: clippingAxis === axis ? '#3b82f6' : '#f3f4f6',
                        border: `1px solid ${clippingAxis === axis ? '#3b82f6' : '#d1d5db'}`,
                        borderRadius: '4px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      {axis}축
                    </button>
                  ))}
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label style={{ fontSize: '11px', color: '#6b7280' }}>
                      {clippingAxis}축 위치
                    </label>
                    <span style={{ fontSize: '11px', color: '#9ca3af' }}>{Math.round(clippingPosition * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={clippingPosition}
                    onChange={(e) => handleClippingPositionChange(parseFloat(e.target.value))}
                    style={{ width: '100%', cursor: 'pointer' }}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Measurement Tools */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
            측정 도구
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              onClick={handleMeasurementToggle}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 500,
                color: measurementMode === 'distance' ? '#dc2626' : '#059669',
                backgroundColor: measurementMode === 'distance' ? '#fee2e2' : '#d1fae5',
                border: `1px solid ${measurementMode === 'distance' ? '#dc2626' : '#10b981'}`,
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {measurementMode === 'distance' ? '✗ 측정 종료' : '📏 거리 측정'}
            </button>

            {measurementMode === 'distance' && (
              <div style={{
                padding: '8px',
                backgroundColor: '#fffbeb',
                borderRadius: '4px',
                border: '1px solid #fbbf24',
                fontSize: '11px',
                color: '#92400e'
              }}>
                <div style={{ marginBottom: '4px', fontWeight: 600 }}>
                  📌 측정 방법:
                </div>
                <div>두 지점을 클릭하여 거리를 측정하세요</div>
                {measurementPoints.length === 1 && (
                  <div style={{ marginTop: '4px', color: '#f59e0b' }}>
                    ⚠️ 두 번째 지점을 클릭하세요
                  </div>
                )}
              </div>
            )}

            {distanceMeasurement !== null && (
              <div style={{
                padding: '8px',
                backgroundColor: '#dbeafe',
                borderRadius: '4px',
                border: '1px solid #3b82f6',
                fontSize: '12px',
                color: '#1e40af',
                fontWeight: 600
              }}>
                📊 측정 거리: {distanceMeasurement.toFixed(2)} mm
              </div>
            )}
          </div>
        </div>

        {/* Crosshair Tool */}
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
            좌표 표시선 (크로스헤어)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              onClick={handleCrosshairToggle}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 500,
                color: crosshairEnabled ? '#dc2626' : '#059669',
                backgroundColor: crosshairEnabled ? '#fee2e2' : '#d1fae5',
                border: `1px solid ${crosshairEnabled ? '#dc2626' : '#10b981'}`,
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {crosshairEnabled ? '✗ 크로스헤어 끄기' : '➕ 크로스헤어 켜기'}
            </button>

            {crosshairEnabled && boundsRef.current && crosshairPosition && (
              <>
                <div style={{
                  padding: '8px',
                  backgroundColor: '#fffbeb',
                  borderRadius: '4px',
                  border: '1px solid #fbbf24',
                  fontSize: '11px',
                  color: '#92400e'
                }}>
                  <div style={{ marginBottom: '4px', fontWeight: 600 }}>
                    🎯 슬라이더로 위치 조정:
                  </div>
                  <div style={{ marginBottom: '2px' }}>• <strong style={{ color: '#dc2626' }}>빨강(X축)</strong>, <strong style={{ color: '#059669' }}>초록(Y축)</strong>, <strong style={{ color: '#3b82f6' }}>파랑(Z축)</strong></div>
                  <div>• 좌측 상단에 좌표값 표시</div>
                </div>

                {/* X-axis slider */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label style={{ fontSize: '11px', color: '#dc2626', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <div style={{ width: '10px', height: '10px', backgroundColor: '#dc2626', borderRadius: '2px' }} />
                      X축
                    </label>
                    <span style={{ fontSize: '11px', color: '#6b7280', fontFamily: 'monospace' }}>
                      {crosshairPosition[0].toFixed(2)} mm
                    </span>
                  </div>
                  <input
                    type="range"
                    min={boundsRef.current[0]}
                    max={boundsRef.current[1]}
                    step="0.1"
                    value={crosshairPosition[0]}
                    onChange={(e) => handleCrosshairXChange(parseFloat(e.target.value))}
                    style={{ width: '100%', cursor: 'pointer' }}
                  />
                </div>

                {/* Y-axis slider */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label style={{ fontSize: '11px', color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <div style={{ width: '10px', height: '10px', backgroundColor: '#059669', borderRadius: '2px' }} />
                      Y축
                    </label>
                    <span style={{ fontSize: '11px', color: '#6b7280', fontFamily: 'monospace' }}>
                      {crosshairPosition[1].toFixed(2)} mm
                    </span>
                  </div>
                  <input
                    type="range"
                    min={boundsRef.current[2]}
                    max={boundsRef.current[3]}
                    step="0.1"
                    value={crosshairPosition[1]}
                    onChange={(e) => handleCrosshairYChange(parseFloat(e.target.value))}
                    style={{ width: '100%', cursor: 'pointer' }}
                  />
                </div>

                {/* Z-axis slider */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label style={{ fontSize: '11px', color: '#3b82f6', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <div style={{ width: '10px', height: '10px', backgroundColor: '#3b82f6', borderRadius: '2px' }} />
                      Z축
                    </label>
                    <span style={{ fontSize: '11px', color: '#6b7280', fontFamily: 'monospace' }}>
                      {crosshairPosition[2].toFixed(2)} mm
                    </span>
                  </div>
                  <input
                    type="range"
                    min={boundsRef.current[4]}
                    max={boundsRef.current[5]}
                    step="0.1"
                    value={crosshairPosition[2]}
                    onChange={(e) => handleCrosshairZChange(parseFloat(e.target.value))}
                    style={{ width: '100%', cursor: 'pointer' }}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {renderStats && (
        <div style={{ marginTop: '8px', fontSize: '11px', color: '#9ca3af', textAlign: 'center', flexShrink: 0 }}>
          📊 {renderStats.totalPolygons.toLocaleString()} polygons • ⚡ {renderStats.loadTime.toFixed(2)}s •
          🎯 Optimization Level {OPTIMIZATION_LEVEL}
        </div>
      )}
      <div style={{ marginTop: '8px', fontSize: '12px', color: '#6b7280', textAlign: 'center', flexShrink: 0 }}>
        <strong>Controls:</strong>{' '}
        {measurementMode === 'distance' ? (
          <span style={{ color: '#f59e0b', fontWeight: 600 }}>
            Click on the surface to measure distance
          </span>
        ) : crosshairEnabled ? (
          <span style={{ color: '#3b82f6', fontWeight: 600 }}>
            Use X/Y/Z sliders to adjust crosshair position • Left-click + drag to rotate • Scroll to zoom
          </span>
        ) : (
          'Left-click + drag to rotate • Scroll to zoom • Right-click + drag to pan'
        )}
      </div>
    </div>
  );
}