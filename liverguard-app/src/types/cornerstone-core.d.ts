// Type definitions for cornerstone-core
declare module 'cornerstone-core' {
  export interface Image {
    imageId: string;
    minPixelValue: number;
    maxPixelValue: number;
    slope: number;
    intercept: number;
    windowCenter: number;
    windowWidth: number;
    render: any;
    getPixelData: () => Uint8Array | Int16Array | Uint16Array | Float32Array;
    rows: number;
    columns: number;
    height: number;
    width: number;
    color: boolean;
    columnPixelSpacing: number;
    rowPixelSpacing: number;
    sizeInBytes: number;
  }

  export interface Viewport {
    scale: number;
    translation: {
      x: number;
      y: number;
    };
    voi: {
      windowWidth: number;
      windowCenter: number;
    };
    invert: boolean;
    pixelReplication: boolean;
    rotation: number;
    hflip: boolean;
    vflip: boolean;
    modalityLUT?: any;
    voiLUT?: any;
  }

  export interface EnabledElement {
    element: HTMLElement;
    image?: Image;
    viewport?: Viewport;
    canvas?: HTMLCanvasElement;
    invalid: boolean;
    needsRedraw: boolean;
  }

  export function enable(element: HTMLElement): void;
  export function disable(element: HTMLElement): void;
  export function getEnabledElement(element: HTMLElement): EnabledElement;
  export function displayImage(element: HTMLElement, image: Image): void;
  export function loadAndCacheImage(imageId: string): Promise<Image>;
  export function getViewport(element: HTMLElement): Viewport;
  export function setViewport(element: HTMLElement, viewport: Viewport): void;
  export function getDefaultViewportForImage(element: HTMLElement, image: Image): Viewport;
  export function resize(element: HTMLElement, forcedRedraw?: boolean): void;
  export function reset(element: HTMLElement): void;

  const cornerstone: {
    enable: typeof enable;
    disable: typeof disable;
    getEnabledElement: typeof getEnabledElement;
    displayImage: typeof displayImage;
    loadAndCacheImage: typeof loadAndCacheImage;
    getViewport: typeof getViewport;
    setViewport: typeof setViewport;
    getDefaultViewportForImage: typeof getDefaultViewportForImage;
    resize: typeof resize;
    reset: typeof reset;
  };

  export default cornerstone;
}