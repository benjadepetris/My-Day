import { generateKeyPairSync } from 'node:crypto';

const { publicKey, privateKey } = generateKeyPairSync('ec', {
  namedCurve: 'prime256v1',
  publicKeyEncoding: { type: 'spki', format: 'der' },
  privateKeyEncoding: { type: 'pkcs8', format: 'der' }
});
const rawPublicKey = publicKey.subarray(publicKey.length - 65);
const b64url = value => Buffer.from(value).toString('base64url');
console.log('VAPID_PUBLIC_KEY=' + b64url(rawPublicKey));
console.log('VAPID_PRIVATE_KEY=' + privateKey.toString('base64'));
console.log('VAPID_SUBJECT=mailto:TU_CORREO_DE_CONTACTO');
