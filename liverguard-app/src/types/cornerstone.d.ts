// Type declarations for cornerstone libraries
declare module 'cornerstone-core' {
  export function enable(element: HTMLElement): void;
  export function disable(element: HTMLElement): void;
  export function displayImage(element: HTMLElement, image: any): void;
  export function loadImage(imageId: string): Promise<any>;
  export function getEnabledElement(element: HTMLElement): any;
  export function reset(element: HTMLElement): void;
  export function resize(element: HTMLElement, forcedRerender?: boolean): void;
  export function getDefaultViewportForImage(element: HTMLElement, image: any): any;
  export function setViewport(element: HTMLElement, viewport: any): void;
  export function getViewport(element: HTMLElement): any;
}

declare module 'cornerstone-wado-image-loader' {
  export const external: {
    cornerstone: any;
    dicomParser: any;
  };
  export function configure(options: any): void;
}

declare module 'dicom-parser' {
  export function parseDicom(byteArray: Uint8Array): any;
}