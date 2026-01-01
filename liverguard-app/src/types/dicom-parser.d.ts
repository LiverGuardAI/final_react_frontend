// Type definitions for dicom-parser
declare module 'dicom-parser' {
  export interface DataSet {
    byteArray: Uint8Array;
    elements: any;
    string(tag: string): string | undefined;
    uint16(tag: string): number | undefined;
    uint32(tag: string): number | undefined;
    int16(tag: string): number | undefined;
    int32(tag: string): number | undefined;
    float(tag: string): number | undefined;
    double(tag: string): number | undefined;
  }

  export function parseDicom(byteArray: Uint8Array, options?: any): DataSet;

  const dicomParser: {
    parseDicom: typeof parseDicom;
  };

  export default dicomParser;
}