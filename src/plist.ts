export const BaseTime = new Date(Date.UTC(31, 1, 1, 0, 0, 0, 0));

// Bits
// True, False
export const BIT_TRUE = 0x09;
export const BIT_FALSE = 0x08;

// Types
export const TYPE_BOOL_OR_NULL = 0x00;
export const TYPE_INT = 0x10;
export const TYPE_REAL = 0x20;
export const TYPE_DATE = 0x30;
export const TYPE_BINARY = 0x40;
export const TYPE_STRING_ASCII = 0x50;
export const TYPE_STRING_UTF16 = 0x60;
export const TYPE_ARRAY = 0xa0;
export const TYPE_DICT = 0xd0;

// BPlist Headers
const magicBPlist = ['b', 'p', 'l', 'i', 's', 't'].map((c) => c.charCodeAt(0));
const version00 = ['0', '0'].map((c) => c.charCodeAt(0));
const version01 = ['0', '1'].map((c) => c.charCodeAt(0));

export const isBinaryPlist = (buffer: ArrayBuffer): boolean => {
  const data = new Uint8Array(buffer);

  if (data.length < 8) {
    console.warn('Data is too short to be a binary plist');
    return false;
  }

  const isMagicBPlist = data.slice(0, 6).every((v, i) => v === magicBPlist[i]);
  const isVersion = data
    .slice(6, 8)
    .every((v, i) => v === version00[i] || v === version01[i]);

  return isMagicBPlist && isVersion;
};

export class Trailer {
  shortVersion: number;
  offsetSize: number;
  objectRefSize: number;
  numObjects: bigint;
  topObject: bigint;
  offsetTableOffset: bigint;

  public static Read(buffer: ArrayBuffer): Trailer {
    // Trailerは末尾に配置される
    // 末尾から8バイトを読み取る
    const data = new DataView(buffer);
    const length = buffer.byteLength;

    const trailer = new Trailer();
    trailer.shortVersion = data.getUint8(length - 27);
    trailer.offsetSize = data.getUint8(length - 26);
    trailer.objectRefSize = data.getUint8(length - 25);
    trailer.numObjects = data.getBigUint64(length - 24);
    trailer.topObject = data.getBigUint64(length - 16);
    trailer.offsetTableOffset = data.getBigUint64(length - 8);
    return trailer;
  }
}

export type PlistObject = boolean | number | bigint | string | Date | ArrayBuffer;
export type PlistArray = PlistObject[];
export type PlistDictionary = Map<string, PlistObject>;

/**
 * オブジェクトのオフセットを計算する
 */
const readOffset = (
  dataView: DataView,
  trailer: Trailer,
  objectIndex: bigint,
): bigint => {
  const index = trailer.offsetTableOffset + objectIndex * BigInt(trailer.offsetSize);
  return index;
};

/**
 * 指定したバイト数で整数を読み取る
 * @param dataView
 * @param offset
 * @param length
 * @param littleEndian
 * @returns
 */
// const readInteger = (
//   dataView: DataView,
//   offset: number,
//   length: number,
//   littleEndian: boolean = false,
// ): number | bigint => {
//   switch (length) {
//     case 1:
//       return dataView.getInt8(offset);
//     case 2:
//       return dataView.getInt16(offset, littleEndian);
//     case 4:
//       return dataView.getInt32(offset, littleEndian);
//     case 8:
//       return dataView.getBigInt64(offset, littleEndian);
//     default:
//       throw new Error(`Invalid length: ${length}`);
//   }
// };

const powObjectLength = (n: number) => {
  if (n == 0) {
    return 1;
  }
  return Math.pow(2, n);
};

const readInteger = (dataView: DataView, offset: number, nnnn: number) => {
  const byteLength = powObjectLength(nnnn);
  switch (byteLength) {
    case 1:
      return dataView.getInt8(offset);
    case 2:
      return dataView.getInt16(offset);
    case 4:
      return dataView.getInt32(offset);
    case 8:
      return dataView.getBigInt64(offset);
    default:
      throw new Error(`Invalid length: ${byteLength}`);
  }
};

const readReal = (dataView: DataView, offset: number, nnnn: number) => {
  const byteLength = powObjectLength(nnnn);
  switch (byteLength) {
    case 4:
      return dataView.getFloat32(offset);
    case 8:
      return dataView.getFloat64(offset);
    default:
      throw new Error(`Invalid length: ${byteLength}`);
  }
};

/**
 * bool or nullを読み取る
 * @param n
 * @returns
 */
const readBooleanOrNull = (n: number | bigint): null | boolean => {
  switch (n) {
    case 0b0000:
      return null;
    case 0b1000:
      return false;
    case 0b1001:
      return true;
    default:
      throw new Error(`Invalid boolean value: ${n}`);
  }
};

const readObject = (
  dataView: DataView,
  trailer: Trailer,
  objectIndex: bigint,
): PlistObject | PlistArray | PlistDictionary | null => {
  const offset: bigint = readOffset(dataView, trailer, objectIndex);
  const head = dataView.getUint8(Number(offset));

  // 型とサイズを読み取る
  const type = head & 0xf0;
  const size = head & 0x0f;

  switch (type) {
    case TYPE_BOOL_OR_NULL:
      return readBooleanOrNull(size);
    case TYPE_INT: {
      const valueAt = offset + BigInt(1);
      return readInteger(dataView, valueAt, size);
    }
    case TYPE_REAL: {
      const valueAt = head + 1;
      return readReal(dataView, valueAt, size);
    }
    case TYPE_DATE: {
      const valueAt = head + 1;
      // Fixed 8 bytes (64bits)
      const seconds = dataView.getFloat64(valueAt, false);
      return new Date(BaseTime.getTime() + seconds * 1000);
    }
    case TYPE_BINARY: {
        if(size <= 15)
        {
            const valueAt = head + 1;
            return dataView.buffer.slice(valueAt, valueAt + size);
        }else{
            const intAt = 
        }
    }
  }
};
