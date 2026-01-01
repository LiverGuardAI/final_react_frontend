// Type definitions for cornerstone-wado-image-loader
declare module 'cornerstone-wado-image-loader' {
  export interface ExternalModules {
    cornerstone: any;
    dicomParser: any;
  }

  export interface Config {
    useWebWorkers?: boolean;
    decodeConfig?: {
      convertFloatPixelDataToInt?: boolean;
      use16BitDataType?: boolean;
    };
    strict?: boolean;
    maxWebWorkers?: number;
  }

  export const external: ExternalModules;

  export function configure(config: Config): void;

  const cornerstoneWADOImageLoader: {
    external: ExternalModules;
    configure: typeof configure;
  };

  export default cornerstoneWADOImageLoader;
}