import { encryptLine, decryptLine } from './crypto';

const key = 'my-secret-key';
const original = 'Hello World! This is a test. 这是一个测试。';

const encrypted = encryptLine(original, key);
console.log('Encrypted:', encrypted);

const decrypted = decryptLine(encrypted, key);
console.log('Decrypted:', decrypted);

if (original === decrypted) {
  console.log('SUCCESS');
} else {
  console.log('FAILURE');
}
