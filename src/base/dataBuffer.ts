/**
 * Copyright 2014 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

///<reference path='references.ts' />
module Shumway.ArrayUtilities {
  import notImplemented = Shumway.Debug.notImplemented;

  import utf8decode = Shumway.StringUtilities.utf8decode;
  import utf8encode = Shumway.StringUtilities.utf8encode;
  import clamp = Shumway.NumberUtilities.clamp;
  import swap16 = Shumway.IntegerUtilities.swap16;
  import swap32 = Shumway.IntegerUtilities.swap32;
  import floatToInt32 = Shumway.IntegerUtilities.floatToInt32;
  import int32ToFloat = Shumway.IntegerUtilities.int32ToFloat;

  function throwEOFError() {
    notImplemented("throwEOFError");
    // Runtime.throwErrorFromVM(AVM2.currentDomain(), "flash.errors.EOFError", "End of file was encountered.");
  }

  function throwRangeError() {
    notImplemented("throwRangeError");
    // var error = Errors.ParamRangeError;
    // Runtime.throwErrorFromVM("RangeError", getErrorMessage(error.code), error.code);
  }

  function throwCompressedDataError() {
    notImplemented("throwCompressedDataError");
//    var error = Errors.CompressedDataError;
//    Runtime.throwErrorFromVM("CompressedDataError", getErrorMessage(error.code), error.code);
  }

  function checkRange(x: number, min: number, max: number) {
    if (x !== clamp(x, min, max)) {
      throwRangeError();
    }
  }

  function asCoerceString(x): string {
    if (typeof x === "string") {
      return x;
    } else if (x == undefined) {
      return null;
    }
    return x + '';
  }

  export interface IDataInput {
    readBytes: (bytes: DataBuffer, offset?: number /*uint*/, length?: number /*uint*/) => void;
    readBoolean: () => boolean;
    readByte: () => number /*int*/;
    readUnsignedByte: () => number /*uint*/;
    readShort: () => number /*int*/;
    readUnsignedShort: () => number /*uint*/;
    readInt: () => number /*int*/;
    readUnsignedInt: () => number /*uint*/;
    readFloat: () => number;
    readDouble: () => number;
    readMultiByte: (length: number /*uint*/, charSet: string) => string;
    readUTF: () => string;
    readUTFBytes: (length: number /*uint*/) => string;
    bytesAvailable: number /*uint*/;
    objectEncoding: number /*uint*/;
    endian: string;
  }

  export interface IDataOutput {
    writeBytes: (bytes: DataBuffer, offset?: number /*uint*/, length?: number /*uint*/) => void;
    writeBoolean: (value: boolean) => void;
    writeByte: (value: number /*int*/) => void;
    writeShort: (value: number /*int*/) => void;
    writeInt: (value: number /*int*/) => void;
    writeUnsignedInt: (value: number /*uint*/) => void;
    writeFloat: (value: number) => void;
    writeDouble: (value: number) => void;
    writeMultiByte: (value: string, charSet: string) => void;
    writeUTF: (value: string) => void;
    writeUTFBytes: (value: string) => void;
    objectEncoding: number /*uint*/;
    endian: string;
  }

  export class PlainObjectDataBuffer {
    constructor(public buffer: ArrayBuffer, public length: number, public littleEndian: boolean) {
    }
  }

  var bitMasks = new Uint32Array(33);
  for (var i = 1, mask = 0; i <= 32; i++) {
    bitMasks[i] = mask = (mask << 1) | 1;
  }

  export class DataBuffer implements IDataInput, IDataOutput {
    private static _nativeLittleEndian = new Int8Array(new Int32Array([1]).buffer)[0] === 1;

    /* The initial size of the backing, in bytes. Doubled every OOM. */
    private static INITIAL_SIZE = 128;

    private _buffer: ArrayBuffer;
    private _length: number;
    private _position: number;
    private _littleEndian: boolean;
    private _objectEncoding: number;
    private _u8: Uint8Array;
    private _i32: Int32Array;

    private _bitBuffer: number;
    private _bitLength: number;

    private static _arrayBufferPool = new ArrayBufferPool();
    
    constructor(initialSize: number = DataBuffer.INITIAL_SIZE) {
      // If we're constructing a child class of DataBuffer (or ByteArray), buffer initialization
      // has already happened at this point.
      if (this._buffer) {
        return;
      }
      this._buffer = new ArrayBuffer(initialSize);
      this._length = 0;
      this._position = 0;
      this._updateViews();
      this._littleEndian = false; // AS3 is bigEndian by default.
      this._bitBuffer = 0;
      this._bitLength = 0;
    }

    static FromArrayBuffer(buffer: ArrayBuffer, length: number = -1) : DataBuffer {
      var dataBuffer: DataBuffer = Object.create(DataBuffer.prototype);
      dataBuffer._buffer = buffer;
      dataBuffer._length = length === -1 ? buffer.byteLength : length;
      dataBuffer._position = 0;
      dataBuffer._updateViews();
      dataBuffer._littleEndian = false; // AS3 is bigEndian by default.
      dataBuffer._bitBuffer = 0;
      dataBuffer._bitLength = 0;
      return dataBuffer;
    }

    static FromPlainObject(source: PlainObjectDataBuffer): DataBuffer {
      var dataBuffer = DataBuffer.FromArrayBuffer(source.buffer, source.length);
      dataBuffer._littleEndian = source.littleEndian;
      return dataBuffer;
    }

    toPlainObject(): PlainObjectDataBuffer {
      return new PlainObjectDataBuffer(this._buffer, this._length, this._littleEndian);
    }

    private _updateViews() {
      this._u8 = new Uint8Array(this._buffer);
      if ((this._buffer.byteLength & 0x3) === 0) {
        this._i32 = new Int32Array(this._buffer);
      }
    }

    getBytes(): Uint8Array {
      return new Uint8Array(this._buffer, 0, this._length);
    }

    private _ensureCapacity(length: number) {
      var currentBuffer = this._buffer;
      if (currentBuffer.byteLength < length) {
        var newLength = Math.max(currentBuffer.byteLength, 1);
        while (newLength < length) {
          newLength *= 2;
        }
        var newBuffer = DataBuffer._arrayBufferPool.acquire(newLength);
        var curentView = this._u8;
        this._buffer = newBuffer;
        this._updateViews();
        this._u8.set(curentView);
        DataBuffer._arrayBufferPool.release(currentBuffer);
      }
    }

    clear() {
      this._length = 0;
      this._position = 0;
    }

    readBoolean(): boolean {
      return this.readUnsignedByte() !== 0;
    }

    readByte(): number /*int*/ {
      return this.readUnsignedByte() << 24 >> 24;
    }

    readUnsignedByte(): number /*uint*/ {
      if (this._position + 1 > this._length) {
        throwEOFError();
      }
      return this._u8[this._position++];
    }

    readBytes(bytes: DataBuffer, offset: number /*uint*/ = 0, length: number /*uint*/ = 0): void {
      var position = this._position;
      if (!offset) {
        offset = 0;
      }
      if (!length) {
        length = this._length - position;
      }
      if (position + length > this._length) {
        throwEOFError();
      }
      if (bytes.length < offset + length) {
        bytes._ensureCapacity(offset + length);
        bytes.length = offset + length;
      }
      bytes._u8.set(new Uint8Array(this._buffer, position, length), offset);
      this._position += length;
    }

    readShort(): number /*int*/ {
      return this.readUnsignedShort() << 16 >> 16;
    }

    readUnsignedShort(): number /*uint*/ {
      var u8 = this._u8;
      var position = this._position;
      if (position + 2 > this._length) {
        throwEOFError();
      }
      var a = u8[position + 0];
      var b = u8[position + 1];
      this._position = position + 2;
      return this._littleEndian ? (b << 8) | a : (a << 8) | b;
    }

    readInt(): number /*int*/ {
      var u8 = this._u8;
      var position = this._position;
      if (position + 4 > this._length) {
        throwEOFError();
      }
      var a = u8[position + 0];
      var b = u8[position + 1];
      var c = u8[position + 2];
      var d = u8[position + 3];
      this._position = position + 4;
      return this._littleEndian ?
        (d << 24) | (c << 16) | (b << 8) | a :
        (a << 24) | (b << 16) | (c << 8) | d;
    }

    readUnsignedInt(): number /*uint*/ {
      return this.readInt() >>> 0;
    }

    readFloat(): number {
      var u8 = this._u8;
      var position = this._position;
      if (position + 4 > this._length) {
        throwEOFError();
      }
      var t8 = IntegerUtilities.u8;
      if (this._littleEndian) {
        t8[0] = u8[position + 0];
        t8[1] = u8[position + 1];
        t8[2] = u8[position + 2];
        t8[3] = u8[position + 3];
      } else {
        t8[3] = u8[position + 0];
        t8[2] = u8[position + 1];
        t8[1] = u8[position + 2];
        t8[0] = u8[position + 3];
      }
      this._position = position + 4;
      return IntegerUtilities.f32[0];
    }

    readDouble(): number {
      var u8 = this._u8;
      var position = this._position;
      if (position + 8 > this._length) {
        throwEOFError();
      }
      var t8 = IntegerUtilities.u8;
      if (this._littleEndian) {
        t8[0] = u8[position + 0];
        t8[1] = u8[position + 1];
        t8[2] = u8[position + 2];
        t8[3] = u8[position + 3];
        t8[4] = u8[position + 4];
        t8[5] = u8[position + 5];
        t8[6] = u8[position + 6];
        t8[7] = u8[position + 7];
      } else {
        t8[0] = u8[position + 7];
        t8[1] = u8[position + 6];
        t8[2] = u8[position + 5];
        t8[3] = u8[position + 4];
        t8[4] = u8[position + 3];
        t8[5] = u8[position + 2];
        t8[6] = u8[position + 1];
        t8[7] = u8[position + 0];
      }
      this._position = position + 8;
      return IntegerUtilities.f64[0];
    }

    writeBoolean(value: boolean): void {
      this.writeByte(!!value ? 1 : 0)
    }

    writeByte(value: number /*int*/): void {
      var length = this._position + 1;
      this._ensureCapacity(length);
      this._u8[this._position++] = value;
      if (length > this._length) {
        this._length = length;
      }
    }

    writeUnsignedByte(value: number /*uint*/): void {
      var length = this._position + 1;
      this._ensureCapacity(length);
      this._u8[this._position++] = value;
      if (length > this._length) {
        this._length = length;
      }
    }

    writeRawBytes(bytes: Uint8Array): void {
      var length = this._position + bytes.length;
      this._ensureCapacity(length);
      this._u8.set(bytes, this._position);
      this._position = length;
      if (length > this._length) {
        this._length = length;
      }
    }

    writeBytes(bytes: DataBuffer, offset: number /*uint*/ = 0, length: number /*uint*/ = 0): void {
      if (arguments.length < 2) {
        offset = 0;
      }
      if (arguments.length < 3) {
        length = 0;
      }
      checkRange(offset, 0, bytes.length);
      checkRange(offset + length, 0, bytes.length);
      if (length === 0) {
        length = bytes.length - offset;
      }
      this.writeRawBytes(new Int8Array(bytes._buffer, offset, length));
    }

    writeShort(value: number /*int*/): void {
      this.writeUnsignedShort(value);
    }

    writeUnsignedShort(value: number /*uint*/): void {
      var position = this._position;
      this._ensureCapacity(position + 2);
      var u8 = this._u8;
      if (this._littleEndian) {
        u8[position + 0] = value;
        u8[position + 1] = value >> 8;
      } else {
        u8[position + 0] = value >> 8;
        u8[position + 1] = value;
      }
      position += 2;
      this._position = position;
      if (position > this._length) {
        this._length = position;
      }
    }

    writeInt(value: number /*int*/): void {
      this.writeUnsignedInt(value);
    }

    writeUnsignedInt(value: number /*uint*/): void {
      var position = this._position;
      this._ensureCapacity(position + 4);
      var u8 = this._u8;
      if (this._littleEndian) {
        u8[position + 0] = value;
        u8[position + 1] = value >> 8;
        u8[position + 2] = value >> 16;
        u8[position + 3] = value >> 24;
      } else {
        u8[position + 0] = value >> 24;
        u8[position + 1] = value >> 16;
        u8[position + 2] = value >> 8;
        u8[position + 3] = value;
      }
      position += 4;
      this._position = position;
      if (position > this._length) {
        this._length = position;
      }
    }

    writeFloat(value: number): void {
      var position = this._position;
      this._ensureCapacity(position + 4);
      var u8 = this._u8;
      IntegerUtilities.f32[0] = value;
      var t8 = IntegerUtilities.u8;
      if (this._littleEndian) {
        u8[position + 0] = t8[0];
        u8[position + 1] = t8[1];
        u8[position + 2] = t8[2];
        u8[position + 3] = t8[3];
      } else {
        u8[position + 0] = t8[3];
        u8[position + 1] = t8[2];
        u8[position + 2] = t8[1];
        u8[position + 3] = t8[0];
      }
      position += 4;
      this._position = position;
      if (position > this._length) {
        this._length = position;
      }
    }

    writeDouble(value: number): void {
      var position = this._position;
      this._ensureCapacity(position + 8);
      var u8 = this._u8;
      IntegerUtilities.f64[0] = value;
      var t8 = IntegerUtilities.u8;
      if (this._littleEndian) {
        u8[position + 0] = t8[0];
        u8[position + 1] = t8[1];
        u8[position + 2] = t8[2];
        u8[position + 3] = t8[3];
        u8[position + 4] = t8[4];
        u8[position + 5] = t8[5];
        u8[position + 6] = t8[6];
        u8[position + 7] = t8[7];
      } else {
        u8[position + 0] = t8[7];
        u8[position + 1] = t8[6];
        u8[position + 2] = t8[5];
        u8[position + 3] = t8[4];
        u8[position + 4] = t8[3];
        u8[position + 5] = t8[2];
        u8[position + 6] = t8[1];
        u8[position + 7] = t8[0];
      }
      position += 8;
      this._position = position;
      if (position > this._length) {
        this._length = position;
      }
    }

    readRawBytes(): Int8Array {
      return new Int8Array(this._buffer, 0, this._length);
    }

    writeUTF(value: string): void {
      value = asCoerceString(value);
      var bytes = utf8decode(value);
      this.writeShort(bytes.length);
      this.writeRawBytes(bytes);
    }

    writeUTFBytes(value: string): void {
      value = asCoerceString(value);
      var bytes = utf8decode(value);
      this.writeRawBytes(bytes);
    }

    readUTF(): string {
      return this.readUTFBytes(this.readShort());
    }

    readUTFBytes(length: number /*uint*/): string {
      length = length >>> 0;
      var pos = this._position;
      if (pos + length > this._length) {
        throwEOFError();
      }
      this._position += length;
      return utf8encode(new Int8Array(this._buffer, pos, length));
    }

    get length(): number /*uint*/ {
      return this._length;
    }

    set length(value: number /*uint*/) {
      value = value >>> 0;
      var capacity = this._buffer.byteLength;
      /* XXX: Do we need to zero the difference if length <= cap? */
      if (value > capacity) {
        this._ensureCapacity(value);
      }
      this._length = value;
      this._position = clamp(this._position, 0, this._length);
    }

    get bytesAvailable(): number /*uint*/ {
      return this._length - this._position;
    }

    get position(): number /*uint*/ {
      return this._position;
    }

    get buffer(): ArrayBuffer {
      return this._buffer;
    }

    get bytes(): Uint8Array {
      return this._u8;
    }

    get ints(): Int32Array {
      return this._i32;
    }

    set position(position: number /*uint*/) {
      this._position = position >>> 0;
    }

    get objectEncoding(): number /*uint*/ {
      return this._objectEncoding;
    }

    set objectEncoding(version: number /*uint*/) {
      version = version >>> 0;
      this._objectEncoding = version;
    }

    get endian(): string {
      return this._littleEndian ? "littleEndian" : "bigEndian";
    }

    set endian(type: string) {
      type = asCoerceString(type);
      if (type === "auto") {
        this._littleEndian = DataBuffer._nativeLittleEndian;
      } else {
        this._littleEndian = type === "littleEndian";
      }
    }

    toString(): string {
      return utf8encode(new Int8Array(this._buffer, 0, this._length));
    }

    toBlob(): Blob {
      return new Blob([new Int8Array(this._buffer, this._position, this._length)]);
    }

    writeMultiByte(value: string, charSet: string): void {
      value = asCoerceString(value); charSet = asCoerceString(charSet);
      notImplemented("packageInternal flash.utils.ObjectOutput::writeMultiByte"); return;
    }

    readMultiByte(length: number /*uint*/, charSet: string): string {
      length = length >>> 0; charSet = asCoerceString(charSet);
      notImplemented("packageInternal flash.utils.ObjectInput::readMultiByte"); return;
    }

    getValue(name: number): any {
      name = name | 0;
      if (name >= this._length) {
        return undefined;
      }
      return this._u8[name];
    }

    setValue(name: number, value: any) {
      name = name | 0;
      var length = name + 1;
      this._ensureCapacity(length);
      this._u8[name] = value;
      if (length > this._length) {
        this._length = length;
      }
    }

    readFixed(): number {
      return this.readInt() / 65536;
    }

    readFixed8(): number {
      return this.readShort() / 256;
    }

    readFloat16(): number {
      var uint16 = this.readUnsignedShort();
      var sign = uint16 >> 15 ? -1 : 1;
      var exponent = (uint16 & 0x7c00) >> 10;
      var fraction = uint16 & 0x03ff;
      if (!exponent) {
        return sign * Math.pow(2, -14) * (fraction / 1024);
      }
      if (exponent === 0x1f) {
        return fraction ? NaN : sign * Infinity;
      }
      return sign * Math.pow(2, exponent - 15) * (1 + (fraction / 1024));
    }

    readEncodedU32(): number {
      var value = this.readUnsignedByte();
      if (!(value & 0x080)) {
        return value;
      }
      value = (value & 0x7f) | this.readUnsignedByte() << 7;
      if (!(value & 0x4000)) {
        return value;
      }
      value = (value & 0x3fff)| this.readUnsignedByte() << 14;
      if (!(value & 0x200000)) {
        return value;
      }
      value = (value & 0x1FFFFF) | this.readUnsignedByte() << 21;
      if (!(value & 0x10000000)) {
        return value;
      }
      return (value & 0xFFFFFFF) | (this.readUnsignedByte() << 28);
    }

    readBits(size: number): number {
      return (this.readUnsignedBits(size) << (32 - size)) >> (32 - size);
    }

    readUnsignedBits(size: number): number {
      var buffer = this._bitBuffer;
      var length = this._bitLength;
      while (size > length) {
        buffer = (buffer << 8) | this.readUnsignedByte();
        length += 8;
      }
      length -= size;
      var value = (buffer >>> length) & bitMasks[size];
      this._bitBuffer = buffer;
      this._bitLength = length;
      return value;
    }

    readFixedBits(size: number): number {
      return this.readBits(size) / 65536;
    }

    readString(length?: number): string {
      var position = this._position;
      if (length) {
        if (position + length > this._length) {
          throwEOFError();
        }
        this._position += length;
      } else {
        length = 0;
        for (var i = position; i < this._length && this._u8[i]; i++) {
          length++;
        }
        this._position += length + 1;
      }
      return utf8encode(new Int8Array(this._buffer, position, length));
    }

    align() {
      this._bitBuffer = 0;
      this._bitLength = 0;
    }

    private _compress(algorithm: string): void {
      algorithm = asCoerceString(algorithm);

      var deflate: Deflate;
      switch (algorithm) {
        case 'zlib':
          deflate = new Deflate(true);
          break;
        case 'deflate':
          deflate = new Deflate(false);
          break;
        default:
          return;
      }

      var output = new DataBuffer();
      deflate.onData = output.writeRawBytes.bind(output);
      deflate.push(this._u8.subarray(0, this._length));
      deflate.finish();

      this._ensureCapacity(output._u8.length);
      this._u8.set(output._u8);
      this.length = output.length;
      this._position = 0;
    }

    private _uncompress(algorithm: string): void {
      algorithm = asCoerceString(algorithm);

      var inflate: Inflate;
      switch (algorithm) {
        case 'zlib':
          inflate = new Inflate(true);
          break;
        case 'deflate':
          inflate = new Inflate(false);
          break;
        default:
          return;
      }

      var output = new DataBuffer();
      inflate.onData = output.writeRawBytes.bind(output);
      inflate.push(this._u8.subarray(0, this._length));
      if (inflate.error) {
        throwCompressedDataError();
      }

      this._ensureCapacity(output._u8.length);
      this._u8.set(output._u8);
      this.length = output.length;
      this._position = 0;
    }

  }
}
