import pako from "pako";
import ADLER32 from 'adler-32';
import MD5 from "crypto-js/md5";
import CryptoJS from "crypto-js";

const WBITS_VALUE = -15
const HEADER_LENGTH = 53
const ZLIB_HEADER = Uint8Array.from([0x78, 0x9c]) // b'\x78\x9c'

export type DecodedFileType = {
    fileContent: Uint8Array<ArrayBufferLike>;
    decompressedData: Uint8Array<ArrayBuffer>;
};

function tryDecompressZlibBlock(data: Uint8Array, startOffset=0)
{
    let zlibBlock = data.slice(startOffset);

    const uncompressedSize = ToInt32(zlibBlock.slice(0, 4));

    const compressedSize = ToInt32(zlibBlock.slice(4, 8));

    if (!areBytewiseEqual(zlibBlock.slice(8, 10), ZLIB_HEADER))
        console.log("Not a zlib header");

    let decompressed = null;

    try {
        decompressed = pako.inflate(zlibBlock.slice(10), {windowBits: WBITS_VALUE});
    } catch (err) {
        console.log(err);
    }

    return { uncompressedSize, compressedSize, decompressed }
}

export async function decodeFile(file: File): Promise<DecodedFileType>
{
    let offset = HEADER_LENGTH
    let decompressedData = new Uint8Array();
    const fileContent = await file.bytes()
    console.log(`Total compressed data size: ${fileContent.length} bytes`)
    const md5Hash = MD5(CryptoJS.lib.WordArray.create(fileContent.slice(HEADER_LENGTH)))
    console.log(`Original MD5 hash of compressed data from offset ${HEADER_LENGTH}: ${md5Hash.toString()}`)
    while (offset < fileContent.length)
    {
        // Decompress the data at the current offset
        const zLibBlock = tryDecompressZlibBlock(fileContent, offset)
        if (!zLibBlock.decompressed) continue;
        decompressedData = new Uint8Array([...decompressedData, ...zLibBlock.decompressed])
        offset += zLibBlock.compressedSize + 8  // 8 bytes for the 2 int32s
    }
    console.log(`Total decompressed data size: ${decompressedData.length} bytes`)
    return { fileContent, decompressedData }
}

export function encodeFile(content: Uint8Array, decompressedData: Uint8Array) {
    try {
        console.log("Rebuilding the file with the new compressed data...")

        let newZlibData = new Uint8Array();
        const chunkSize = 1024**2; // 1 MB
        let offset = 0

        while (offset < decompressedData.length) {
            // divide the data into chunks - probably not relevant until completesave gets huge
            const chunk = decompressedData.slice(offset, offset + chunkSize)
            offset += chunkSize

            // compress chunk
            const newBlockUncompressedSizeBytes = ToUint8Array(chunk.length);
            const newCompressedData = pako.deflate(chunk, {level: -1, windowBits: WBITS_VALUE});
            
            const adler32 = ADLER32.buf(chunk);
            
            const adler32Bytes = ToUint8Array(adler32, false);
            
            const newBlockCompressedSize = newCompressedData.length + 6
            const newBlockCompressedSizeBytes = ToUint8Array(newBlockCompressedSize);

            // Append the new block to the new data
            newZlibData = new Uint8Array([...newZlibData, ...newBlockUncompressedSizeBytes, ...newBlockCompressedSizeBytes, ...ZLIB_HEADER, ...newCompressedData, ...adler32Bytes]);
        }

        // rebuild header components
        const originalFiletype = content.slice(0,4);
        const zeroBytes = new Uint8Array([0x0, 0x0, 0x0, 0x0]) // b'\x00\x00\x00\x00'
        const threeByte = new Uint8Array([0x03]) // b'\x03'
        const newTotalCompressedSizeBytes = ToUint8Array(newZlibData.length);
        const newTotalUncompressedSizeBytes = ToUint8Array(decompressedData.length);

        const newMd5 = MD5(CryptoJS.lib.WordArray.create(newZlibData)).toString()
        console.log(`New MD5 hash of compressed data: ${newMd5}`)
        const newMd5Bytes = new TextEncoder().encode(newMd5);

        const finalData = new Uint8Array([...originalFiletype, ...newTotalCompressedSizeBytes, ...zeroBytes, ...newTotalUncompressedSizeBytes, ...zeroBytes, ...newMd5Bytes, ...threeByte, ...newZlibData]);

        const f = new File([new Blob([finalData])], 'OutputSave');
        console.log(`New compressed data with original header saved to OutputSave. ${finalData.length} bytes`)
        return f;
    }
    catch(e)
    {
        console.log(`Error during encoding: ${e}`);
        return false;
    }
}

function ToInt32(uint8Arr: Uint8Array, littleEndian = true) {
    return new DataView(uint8Arr.buffer).getUint32(0, littleEndian);
}

function ToUint8Array(int32: number, littleEndian = true) {
    let dv = new DataView(new Uint8Array(4).buffer, 0)
    dv.setInt32(0, int32, littleEndian);
    return new Uint8Array(dv.buffer);
}

function areBytewiseEqual(a: Uint8Array, b: Uint8Array) {
  return indexedDB.cmp(a, b) === 0;
}