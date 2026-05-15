import pako from 'pako';
import CryptoJS from 'crypto-js';
import { encode, decode } from '@alttiri/base85';

function wordToByteArray(wordArray: CryptoJS.lib.WordArray): Uint8Array {
  const words = wordArray.words;
  const sigBytes = wordArray.sigBytes;
  const u8 = new Uint8Array(sigBytes);
  for (let i = 0; i < sigBytes; i++) {
    u8[i] = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
  }
  return u8;
}

function byteArrayToWordArray(u8: Uint8Array): CryptoJS.lib.WordArray {
  const words: number[] = [];
  for (let i = 0; i < u8.length; i += 4) {
    words.push(
      (u8[i] << 24) |
      ((u8[i + 1] || 0) << 16) |
      ((u8[i + 2] || 0) << 8) |
      (u8[i + 3] || 0)
    );
  }
  return CryptoJS.lib.WordArray.create(words, u8.length);
}

export function encryptLine(text: string, key: string): string {
  // 1. Deflate
  const deflated = pako.deflate(text);
  
  // 2. Encrypt
  const words = byteArrayToWordArray(deflated);
  const encrypted = CryptoJS.AES.encrypt(words, key);
  
  // The default toString() of encrypted is OpenSSL format (Salted__ + salt + ciphertext) in Base64.
  // We can convert this Base64 to Uint8Array.
  const base64Str = encrypted.toString();
  const binaryString = atob(base64Str);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // 3. Encode to Base85
  return encode(bytes, 'ascii85'); // Or 'z85'
}

export function encryptFileName(fileName: string, key: string): string {
  if (!fileName || !key || fileName === '.vimrc') return fileName;
  
  const keyHash = CryptoJS.SHA256(key);
  const iv = CryptoJS.MD5(key);

  const parts = fileName.split('/');
  return parts.map(part => {
    if (!part || part === '.' || part === '..') return part;

    const lastDot = part.lastIndexOf('.');
    let name = part;
    let ext = '';
    // If it's something like .keep, let's just encrypt the whole thing or keep it as is?
    // Let's just encrypt name without extension
    if (lastDot > 0) {
      name = part.substring(0, lastDot);
      ext = part.substring(lastDot);
    } else if (lastDot === 0) {
      // hidden file, encrypt whole
      name = part;
      ext = '';
    }

    const nameWords = CryptoJS.enc.Utf8.parse(name);
    const encrypted = CryptoJS.AES.encrypt(nameWords, keyHash, { iv: iv, mode: CryptoJS.mode.CBC }).ciphertext.toString(CryptoJS.enc.Hex);
    return encrypted + ext;
  }).join('/');
}

export function decryptFileName(encryptedFileName: string, key: string): string {
  if (!encryptedFileName || !key || encryptedFileName === '.vimrc') return encryptedFileName;

  const keyHash = CryptoJS.SHA256(key);
  const iv = CryptoJS.MD5(key);

  const parts = encryptedFileName.split('/');
  return parts.map(part => {
    if (!part || part === '.' || part === '..') return part;
    
    // Check if it's hex, if not, maybe it wasn't encrypted
    const lastDot = part.lastIndexOf('.');
    let hex = part;
    let ext = '';
    if (lastDot > 0) {
      hex = part.substring(0, lastDot);
      ext = part.substring(lastDot);
    } else if (lastDot === 0) {
      hex = part;
      ext = '';
    }

    if (!/^[0-9a-fA-F]+$/.test(hex)) {
      return part; // Not a hex string, skip decryption
    }

    try {
      const cipherParams = CryptoJS.lib.CipherParams.create({
        ciphertext: CryptoJS.enc.Hex.parse(hex)
      });
      const decrypted = CryptoJS.AES.decrypt(cipherParams, keyHash, { iv: iv, mode: CryptoJS.mode.CBC }).toString(CryptoJS.enc.Utf8);
      return decrypted ? decrypted + ext : part;
    } catch {
      return part;
    }
  }).join('/');
}
export function decryptLine(base85Text: string, key: string): string {
  const bytes = decode(base85Text, 'ascii85');
  
  // 2. Bytes to Base64
  let binaryString = '';
  for (let i = 0; i < bytes.length; i++) {
    binaryString += String.fromCharCode(bytes[i]);
  }
  const base64Str = btoa(binaryString);

  // 3. Decrypt
  const decryptedWords = CryptoJS.AES.decrypt(base64Str, key);
  
  // 4. Inflate
  const deflated = wordToByteArray(decryptedWords);
  const text = pako.inflate(deflated, { to: 'string' });
  
  return text;
}
