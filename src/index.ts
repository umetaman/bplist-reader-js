import Trailer from './trailer';
import { type PlistObject, type PlistDictionary } from './types';

const MARKER_BYTE_LENGTH = 1;

// BaseTime: 2001/1/1 UTC
const DATE_BASE = new Date(Date.UTC(31, 1, 1, 0, 0, 0, 0));

// Bit Values
const BIT_FALSE = 0x08;
const BIT_TRUE = 0x09;

// Types
const TYPE_BOOL_OR_NULL = 0x00;
const TYPE_INT = 0x10;
const TYPE_REAL = 0x20;
const TYPE_DATE = 0x30;
const TYPE_BINARY = 0x40;
const TYPE_STRING_ASCII = 0x50;
const TYPE_STRING_UTF16 = 0x60;
const TYPE_ARRAY = 0xa0;
const TYPE_DICT = 0xd0;

// Header: Magic Numbers
const MAGIC_NUMBERS = 'bplist'.split('').map((c) => c.charCodeAt(0));
const VERSION_00 = '00'.split('').map((c) => c.charCodeAt(0));
const VERSION_01 = '01'.split('').map((c) => c.charCodeAt(0));

/**
 * Binary Plistかどうか
 * @param buffer
 * @returns
 */
export const isBPlist = (buffer: ArrayBuffer): boolean => {
  if (buffer.byteLength < 8) {
    console.error('Buffer is too short to be a bplist');
    return false;
  }

  const bytes = new Uint8Array(buffer);
  const isMagicBPlist = bytes
    .slice(0, 6)
    .every((value, index) => value === MAGIC_NUMBERS[index]);
  const isVersionValid = bytes
    .slice(6, 8)
    .every((value, index) => value === VERSION_00[index] || value === VERSION_01[index]);

  return isMagicBPlist && isVersionValid;
};

const readBooleanOrNull = (bits: number): boolean => {
  switch (bits) {
    case 0x00:
      throw new Error('Unsupport null.');
    case BIT_FALSE:
      return false;
    case BIT_TRUE:
      return true;
    default:
      throw new Error('Invalid Bits');
  }
};

const bytesToUnsignedInteger = (
  dataView: DataView,
  offset: number,
  length: number,
): number => {
  switch (length) {
    case 1:
      return dataView.getUint8(offset);
    case 2:
      return dataView.getUint16(offset);
    case 4:
      return dataView.getUint32(offset);
    case 8:
      return Number(dataView.getBigUint64(offset));
    default:
      throw new Error('Invalid Integer Length.');
  }
};

const Pow2 = (n: number): number => {
  return n === 0 ? 1 : 2 << (n - 1);
};

const readInteger = (
  bits: number,
  dataView: DataView,
  offset: number,
): number | bigint => {
  const length = Pow2(bits);
  switch (length) {
    case 1:
      return dataView.getInt8(offset);
    case 2:
      return dataView.getInt16(offset);
    case 4:
      return dataView.getInt32(offset);
    case 8:
      return dataView.getBigInt64(offset);
    default:
      throw new Error('Invalid Integer Length.');
  }
};

const readReal = (bits: number, dataView: DataView, offset: number): number => {
  const length = Pow2(bits);
  switch (length) {
    case 4:
      return dataView.getFloat32(offset);
    case 8:
      return dataView.getFloat64(offset);
    default:
      throw new Error(`Invalid ${length} bits Real.`);
  }
};

const readDate = (dataView: DataView, offset: number): Date => {
  // 必ずFloat64である
  const seconds = dataView.getFloat64(offset);
  return new Date(DATE_BASE.getSeconds() + seconds);
};

const readBinary = (bits: number, dataView: DataView, offset: number): ArrayBuffer => {
  if (bits < 15) {
    return dataView.buffer.slice(offset, offset + bits);
  } else {
    const marker = dataView.getUint8(offset);
    const type = marker & 0xf0;
    const bits = marker & 0x0f;
    if (type !== TYPE_INT) {
      throw new Error('Invalid Length Data.');
    }
    //           v
    // 0100 nnnn 0001 nnnn [...bits] [...binary]
    const binaryLength = readInteger(bits, dataView, offset + MARKER_BYTE_LENGTH);
    const integerLength = Pow2(bits);
    const binaryOffset = offset + MARKER_BYTE_LENGTH + integerLength;
    const arrayBuffer = dataView.buffer.slice(
      binaryOffset,
      binaryOffset + Number(binaryLength),
    );
    return arrayBuffer;
  }
};

const readAscii = (bits: number, dataView: DataView, offset: number): string => {
  if (bits < 15) {
    const length = bits;
    const buffer = dataView.buffer.slice(offset, offset + length);
    return new TextDecoder('ascii').decode(buffer);
  } else {
    const marker = dataView.getUint8(offset);
    const type = marker & 0xf0;
    const bits = marker & 0x0f;
    if (type !== TYPE_INT) {
      throw new Error('Invalid Length Data.');
    }
    const stringLength = readInteger(bits, dataView, offset + MARKER_BYTE_LENGTH);
    const integerLength = Pow2(bits);
    const stringOffset = offset + MARKER_BYTE_LENGTH + integerLength;
    const buffer = dataView.buffer.slice(
      stringOffset,
      stringOffset + Number(stringLength),
    );
    return new TextDecoder('ascii').decode(buffer);
  }
};

const readUTF16 = (bits: number, dataView: DataView, offset: number): string => {
  if (bits < 15) {
    // ここのビットが示すのは文字数
    const strCount = bits;
    // UTF-16は1文字につき2byteなので、2倍する
    const buffer = dataView.buffer.slice(offset, offset + strCount * 2);
    return new TextDecoder('utf-16be').decode(buffer);
  } else {
    const marker = dataView.getUint8(offset);
    const type = marker & 0xf0;
    const bits = marker & 0x0f;
    if (type !== TYPE_INT) {
      throw new Error('Invalid Length Data.');
    }
    // ここのIntが示すのは文字数
    const stringCount = readInteger(bits, dataView, offset + MARKER_BYTE_LENGTH);
    const integerLength = Pow2(bits);
    const stringOffset = offset + MARKER_BYTE_LENGTH + integerLength;
    const buffer = dataView.buffer.slice(
      stringOffset,
      stringOffset + Number(stringCount) * 2,
    );
    return new TextDecoder('utf-16be').decode(buffer);
  }
};

const readArray = (
  bits: number,
  dataView: DataView,
  offset: number,
  trailer: Trailer,
): unknown[] => {
  let length = 0;
  let arrayOffset = offset;
  if (bits < 15) {
    length = bits;
    // marker分進める
  } else {
    const marker = dataView.getUint8(offset);
    const type = marker & 0xf0;
    const bits = marker & 0x0f;
    if (type !== TYPE_INT) {
      throw new Error('Invalid Length Data.');
    }
    length = Number(readInteger(bits, dataView, offset + MARKER_BYTE_LENGTH));
    arrayOffset += MARKER_BYTE_LENGTH + Pow2(bits);
  }

  const array: unknown[] = [];
  // 指定された要素分、ObjectRefが配置されている
  // 1010 nnnn [int] [...objectRef]
  for (let i = 0; i < length; i++) {
    // OffsetTableにおけるOffset
    const objectRef = bytesToUnsignedInteger(
      dataView,
      arrayOffset + i * trailer.objectRefSize,
      trailer.objectRefSize,
    );
    array.push(readObject(dataView, trailer, objectRef));
  }

  return array;
};

const readDictionary = (
  bits: number,
  dataView: DataView,
  offset: number,
  trailer: Trailer,
): PlistDictionary => {
  let length = 0;
  let dictOffset = offset;
  if (bits < 15) {
    length = bits;
  } else {
    const marker = dataView.getUint8(offset);
    const type = marker & 0xf0;
    const bits = marker & 0x0f;
    if (type !== TYPE_INT) {
      throw new Error('Invalid Length Data.');
    }
    length = Number(readInteger(bits, dataView, offset + MARKER_BYTE_LENGTH));
    dictOffset += MARKER_BYTE_LENGTH + Pow2(bits);
  }

  const dict: PlistDictionary = {};
  // 指定された要素分、ObjectRefが配置されている
  // 1101 nnnn [int] [...objectRef]
  for (let i = 0; i < length; i++) {
    // OffsetTableにおけるOffset
    const keyRef = bytesToUnsignedInteger(
      dataView,
      dictOffset + i * trailer.objectRefSize,
      trailer.objectRefSize,
    );
    const key = readObject(dataView, trailer, keyRef) as string;

    const valueRef = bytesToUnsignedInteger(
      dataView,
      dictOffset + trailer.objectRefSize * length + i * trailer.objectRefSize,
      trailer.objectRefSize,
    );
    const value = readObject(dataView, trailer, valueRef);

    dict[key] = value;
  }

  return dict;
};

export const readObject = (
  dataView: DataView,
  trailer: Trailer,
  objectRef: number,
): PlistObject | PlistDictionary | unknown[] => {
  // Rootのオブジェクトから読む
  // まずはmarkerから
  const offset = readOffset(dataView, trailer, objectRef);
  const marker = dataView.getUint8(offset);
  const type = marker & 0xf0;
  const bits = marker & 0x0f;

  switch (type) {
    case TYPE_BOOL_OR_NULL:
      return readBooleanOrNull(bits);
    case TYPE_INT:
      return readInteger(bits, dataView, offset + MARKER_BYTE_LENGTH);
    case TYPE_REAL:
      return readReal(bits, dataView, offset + MARKER_BYTE_LENGTH);
    case TYPE_DATE:
      return readDate(dataView, offset + MARKER_BYTE_LENGTH);
    case TYPE_BINARY:
      return readBinary(bits, dataView, offset + MARKER_BYTE_LENGTH);
    case TYPE_STRING_ASCII:
      return readAscii(bits, dataView, offset + MARKER_BYTE_LENGTH);
    case TYPE_STRING_UTF16:
      return readUTF16(bits, dataView, offset + MARKER_BYTE_LENGTH);
    case TYPE_ARRAY:
      return readArray(bits, dataView, offset + MARKER_BYTE_LENGTH, trailer);
    case TYPE_DICT:
      return readDictionary(bits, dataView, offset + MARKER_BYTE_LENGTH, trailer);
    default:
      throw new Error('Invalid Type.');
  }
};

export const readOffset = (
  dataView: DataView,
  trailer: Trailer,
  offset: number,
): number => {
  return bytesToUnsignedInteger(
    dataView,
    Number(trailer.offsetTableOffset) + offset * trailer.offsetTableOffsetSize,
    trailer.offsetTableOffsetSize,
  );
};

export const readPlist = (buffer: ArrayBuffer): unknown => {
  const dataView = new DataView(buffer);
  // まずはTrailerを読む
  const trailer = Trailer.Read(dataView);

  return readObject(dataView, trailer, Number(trailer.topObjectOffset));
};
