// 배포 주소 → QR 코드 PNG. 사용: npm run qr -- https://<배포주소>/
// 인쇄용으로 크게(1200px), 오류 정정 수준 M, 여백 4칸.
import QRCode from 'qrcode';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const url = process.argv[2];
if (!url || !/^https:\/\//.test(url)) {
  console.error('사용: npm run qr -- https://배포주소/   (https 주소만)');
  process.exit(1);
}
mkdirSync(new URL('../output/', import.meta.url), { recursive: true });
const out = fileURLToPath(new URL('../output/qr.png', import.meta.url));
await QRCode.toFile(out, url, { width: 1200, margin: 4, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } });
console.log(`output/qr.png 저장 → ${url}`);
