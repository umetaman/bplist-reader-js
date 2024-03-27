export default class Trailer {
  sortVersion: number = 0;
  offsetTableOffsetSize: number = 0;
  objectRefSize: number = 0;
  numObjects: bigint = BigInt(0);
  topObjectOffset: bigint = BigInt(0);
  offsetTableOffset: bigint = BigInt(0);

  public static Read(dataView: DataView): Trailer {
    const length = dataView.byteLength;

    const trailer = new Trailer();
    trailer.sortVersion = dataView.getUint8(length - 27);
    trailer.offsetTableOffsetSize = dataView.getUint8(length - 26);
    trailer.objectRefSize = dataView.getUint8(length - 25);
    trailer.numObjects = dataView.getBigUint64(length - 24);
    trailer.topObjectOffset = dataView.getBigUint64(length - 16);
    trailer.offsetTableOffset = dataView.getBigUint64(length - 8);
    return trailer;
  }
}
