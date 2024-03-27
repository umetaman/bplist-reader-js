import fs from 'fs';
import { readPlist } from '../index';

const bufferToArrayBuffer = (buffer: Buffer) => {
  const arrayBuffer = new ArrayBuffer(buffer.length);
  const view = new Uint8Array(arrayBuffer);
  for (let i = 0; i < buffer.length; i++) {
    view[i] = buffer[i];
  }
  return arrayBuffer;
};

const data = fs.readFileSync('./Document2.bf');
const arrayBuffer = bufferToArrayBuffer(data);
console.log(arrayBuffer.byteLength);
const plist = readPlist(arrayBuffer) as any;

console.log(plist);

const coverImage = plist.notebooks[0].pages[0].presentation.elements[6].members[
  'Common.BackgroundImageBytes'
] as ArrayBuffer;
fs.writeFileSync('./cover.jpg', Buffer.from(coverImage));

const json = JSON.stringify(plist);
fs.writeFileSync('./Document2.json', json);
