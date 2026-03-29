import express from 'express';
import { createServer as createViteServer } from 'vite';
import multer from 'multer';
import { PDFDocument } from 'pdf-lib';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const MAX_FILE_SIZE_MB = 10;
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
];

// Middleware
app.use(express.json({ limit: '50mb' }));

// Setup uploads directory
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(null, true);
    }
    cb(new Error('Unsupported file type. Allowed: PDF, PNG, JPG.'));
  },
  limits: {
    fileSize: MAX_FILE_SIZE_MB * 1024 * 1024,
  },
});

// Initialize Gemini (API key optional when using Google login bearer tokens)
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn('GEMINI_API_KEY is not set. Will expect an Authorization: Bearer <token> header from Google login.');
}
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
const DEFAULT_MODEL = 'models/gemini-3.1-flash-preview';

function getCandidateText(response: any) {
  if (!response) return null;
  if (typeof response.text === 'string' && response.text.trim()) return response.text;
  const candidate = response.candidates?.[0];
  const partText = candidate?.content?.parts?.map((p: any) => p.text).filter(Boolean).join('\n');
  return partText || null;
}

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0' });
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  let pageSize;
  if (req.file.mimetype === 'application/pdf') {
    try {
      const pdfDoc = await PDFDocument.load(fs.readFileSync(req.file.path));
      const firstPage = pdfDoc.getPage(0);
      pageSize = { width: firstPage.getWidth(), height: firstPage.getHeight() };
    } catch (err) {
      console.warn('Failed to read PDF dimensions:', err);
    }
  }

  res.json({
    id: req.file.filename,
    originalName: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    url: `/api/file/${req.file.filename}`,
    pageSize,
  });
});

app.get('/api/file/:id', (req, res) => {
  const safeId = path.basename(req.params.id);
  const filePath = path.join(UPLOADS_DIR, safeId);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath, { headers: { 'Cache-Control': 'no-store' } });
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

app.post('/api/ai/process', async (req, res) => {
  try {
    const { fileId, task } = req.body;
    if (!fileId) return res.status(400).json({ error: 'fileId is required' });

    const authHeader = req.headers['authorization'];
    const hasBearer = typeof authHeader === 'string' && authHeader.startsWith('Bearer ');
    if (!ai && !hasBearer) {
      return res.status(503).json({ error: 'AI not configured. Provide GEMINI_API_KEY or send Authorization: Bearer <token> from Google login.' });
    }

    const filePath = path.join(UPLOADS_DIR, path.basename(fileId));
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const fileBuffer = fs.readFileSync(filePath);
    const ext = path.extname(fileId).toLowerCase();
    const mimeType = ext === '.pdf' ? 'application/pdf' : ext === '.png' ? 'image/png' : 'image/jpeg';
    const base64Data = fileBuffer.toString('base64');

    let prompt = '';
    if (task === 'extract_fields') {
      prompt = 'Analyze this document and extract all form fields, labels, and areas that require user input or signatures. Return the result as a structured JSON array of objects with "label", "type" (text, signature, date), and "description".';
    } else if (task === 'summarize') {
      prompt = 'Provide a concise summary of this document, highlighting the key terms, parties involved, and any obligations or deadlines.';
    } else {
      prompt = 'Analyze this document and describe its structure and purpose.';
    }

    const responseMimeType = task === 'extract_fields' ? 'application/json' : 'text/plain';

    if (ai && !hasBearer) {
      const response = await ai.models.generateContent({
        model: DEFAULT_MODEL,
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType,
              },
            },
            { text: prompt },
          ],
        },
        config: {
          responseMimeType,
        }
      });

      const text = getCandidateText(response);
      if (!text) {
        return res.status(502).json({ error: 'AI returned no content' });
      }

      return res.json({ result: text });
    }

    // Fallback: use bearer token from Google login
    const url = `https://generativelanguage.googleapis.com/v1/${DEFAULT_MODEL}:generateContent`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader as string,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inlineData: {
                  data: base64Data,
                  mimeType,
                }
              }
            ]
          },
          {
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          responseMimeType,
        }
      }),
    });

    const json = await resp.json();
    if (!resp.ok) {
      const message = json?.error?.message || 'AI request failed';
      return res.status(resp.status).json({ error: message });
    }

    const text = json?.candidates?.[0]?.content?.parts
      ?.map((p: any) => p?.text)
      .filter(Boolean)
      .join('\n');

    if (!text) {
      return res.status(502).json({ error: 'AI returned no content' });
    }

    res.json({ result: text });
  } catch (error: any) {
    console.error('AI Processing Error:', error);
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message || 'Failed to process document' });
  }
});

app.post('/api/pdf/sign', async (req, res) => {
  try {
    const { fileId, signatureBase64, x, y, pageIndex = 0, scale = 0.5 } = req.body;
    
    if (!fileId || !signatureBase64) {
      return res.status(400).json({ error: 'fileId and signatureBase64 are required' });
    }

    const safeId = path.basename(fileId);
    const filePath = path.join(UPLOADS_DIR, safeId);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const pdfBytes = fs.readFileSync(filePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    
    // Process signature image
    const base64Data = signatureBase64.replace(/^data:image\/(png|jpeg);base64,/, "");
    const imageBytes = Buffer.from(base64Data, 'base64');
    
    let signatureImage;
    if (signatureBase64.includes('image/png')) {
      signatureImage = await pdfDoc.embedPng(imageBytes);
    } else {
      signatureImage = await pdfDoc.embedJpg(imageBytes);
    }

    const pages = pdfDoc.getPages();
    if (pageIndex >= pages.length) {
      return res.status(400).json({ error: 'Invalid page index' });
    }
    
    const page = pages[pageIndex];
    const pageWidth = page.getWidth();
    const pageHeight = page.getHeight();

    // Allow normalized coords (0-1) or absolute; normalized is default
    const isNormalized = x <= 1 && y <= 1;
    const targetX = isNormalized ? x * pageWidth : x;
    const targetY = isNormalized ? y * pageHeight : y;

    const { width, height } = signatureImage.scale(scale);

    // Apply signature (PDF origin is bottom-left)
    page.drawImage(signatureImage, {
      x: targetX,
      y: pageHeight - targetY - height,
      width,
      height,
    });

    const signedPdfBytes = await pdfDoc.save();
    
    // Save as new file
    const signedFileName = `signed-${Date.now()}-${safeId}`;
    const signedFilePath = path.join(UPLOADS_DIR, signedFileName);
    fs.writeFileSync(signedFilePath, signedPdfBytes);

    res.json({
      success: true,
      fileId: signedFileName,
      url: `/api/file/${signedFileName}`
    });
  } catch (error: any) {
    console.error('PDF Signing Error:', error);
    res.status(500).json({ error: error.message || 'Failed to sign PDF' });
  }
});

// Error handler (must be after routes)
app.use((err: any, _req: any, res: any, _next: any) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: `File too large. Max ${MAX_FILE_SIZE_MB}MB allowed.` });
    }
    return res.status(400).json({ error: err.message || 'Upload failed' });
  }

  if (typeof err?.message === 'string' && err.message.includes('Unsupported file type')) {
    return res.status(400).json({ error: err.message });
  }

  console.error('Unhandled error:', err);
  return res.status(500).json({ error: err?.message || 'Server error' });
});

// Vite middleware for development
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
