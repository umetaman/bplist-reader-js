export type Binary = ArrayBuffer;
export type PlistObject =
  | boolean
  | number
  | bigint
  | string
  | Date
  | Binary
  | PlistObject[];
export type PlistDictionary = Record<string, unknown>;
