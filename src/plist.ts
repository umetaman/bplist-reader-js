export const BaseTime = new Date(Date.UTC(31, 1, 1, 0, 0, 0, 0));

// Bits
// True, False
export const BIT_TRUE = 0x09;
export const BIT_FALSE = 0x08;

// Types
export const TYPE_BOOL = 0x00;
export const TYPE_NIL = 0x00;
export const TYPE_INT = 0x10;
export const TYPE_REAL = 0x20;
export const TYPE_DATE = 0x30;
export const TYPE_BINARY = 0x40;
export const TYPE_STRING_ASCII = 0x50;
export const TYPE_STRING_UTF16 = 0x60;
export const TYPE_ARRAY = 0xa0;
export const TYPE_DICT = 0xd0;
