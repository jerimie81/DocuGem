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
const upload = multer({ storage });

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0' });
});

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  res.json({
    id: req.file.filename,
    originalName: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    url: `/api/file/${req.file.filename}`,
  });
});

app.get('/api/file/:id', (req, res) => {
  const filePath = path.join(UPLOADS_DIR, req.params.id);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

app.post('/api/ai/process', async (req, res) => {
  try {
    const { fileId, task } = req.body;
    if (!fileId) return res.status(400).json({ error: 'fileId is required' });

    const filePath = path.join(UPLOADS_DIR, fileId);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const fileBuffer = fs.readFileSync(filePath);
    const mimeType = fileId.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg';
    const base64Data = fileBuffer.toString('base64');

    let prompt = '';
    if (task === 'extract_fields') {
      prompt = 'Analyze this document and extract all form fields, labels, and areas that require user input or signatures. Return the result as a structured JSON array of objects with "label", "type" (text, signature, date), and "description".';
    } else if (task === 'summarize') {
      prompt = 'Provide a concise summary of this document, highlighting the key terms, parties involved, and any obligations or deadlines.';
    } else {
      prompt = 'Analyze this document and describe its structure and purpose.';
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-preview',
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
        responseMimeType: task === 'extract_fields' ? 'application/json' : 'text/plain',
      }
    });

    res.json({ result: response.text });
  } catch (error: any) {
    console.error('AI Processing Error:', error);
    res.status(500).json({ error: error.message || 'Failed to process document' });
  }
});

app.post('/api/pdf/sign', async (req, res) => {
  try {
    const { fileId, signatureBase64, x, y, pageIndex = 0, scale = 0.5 } = req.body;
    
    if (!fileId || !signatureBase64) {
      return res.status(400).json({ error: 'fileId and signatureBase64 are required' });
    }

    const filePath = path.join(UPLOADS_DIR, fileId);
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
    const { width, height } = signatureImage.scale(scale);

    // Apply signature
    // Note: PDF coordinates start from bottom-left, so we might need to invert Y if frontend sends top-left
    page.drawImage(signatureImage, {
      x: x,
      y: page.getHeight() - y - height, // Convert top-left Y to bottom-left Y
      width,
      height,
    });

    const signedPdfBytes = await pdfDoc.save();
    
    // Save as new file
    const signedFileName = `signed-${Date.now()}-${fileId}`;
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
