import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Buffer } from 'node:buffer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = __dirname;

if (!fs.existsSync(fixturesDir)) {
  fs.mkdirSync(fixturesDir, { recursive: true });
}

// 1. Text fixture
fs.writeFileSync(
  path.join(fixturesDir, 'sample.txt'),
  'Hello from The File Peace! This is a test file for automated testing.'
);

// 2. Markdown fixture
fs.writeFileSync(
  path.join(fixturesDir, 'sample.md'),
  '# Sample Document\n\nThis is a sample markdown document used for automated verification.\n\n- Feature 1\n- Feature 2\n'
);

// 3. Minimal 1x1 transparent PNG binary
const minimalPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
fs.writeFileSync(
  path.join(fixturesDir, 'sample.png'),
  Buffer.from(minimalPngBase64, 'base64')
);

// 4. Minimal valid 1-page PDF binary
const minimalPdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT
/F1 12 Tf
100 700 Td
(The File Peace Test) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000206 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
300
%%EOF`;

fs.writeFileSync(path.join(fixturesDir, 'sample.pdf'), minimalPdf);

console.log('Fixtures created successfully in tests/fixtures/');
