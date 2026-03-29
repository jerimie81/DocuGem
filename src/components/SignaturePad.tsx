import React, { useRef, useState, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Check, X, Eraser, Type, PenTool } from 'lucide-react';

interface SignaturePadProps {
  onSave: (signatureDataUrl: string) => void;
  onCancel: () => void;
}

function trimCanvas(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const l = pixels.data.length;
  let i, bound = {
    top: null as number | null,
    left: null as number | null,
    right: null as number | null,
    bottom: null as number | null
  };
  let x, y;

  for (i = 0; i < l; i += 4) {
    if (pixels.data[i + 3] !== 0) {
      x = (i / 4) % canvas.width;
      y = ~~((i / 4) / canvas.width);

      if (bound.top === null) {
        bound.top = y;
      }

      if (bound.left === null) {
        bound.left = x;
      } else if (x < bound.left) {
        bound.left = x;
      }

      if (bound.right === null) {
        bound.right = x;
      } else if (bound.right < x) {
        bound.right = x;
      }

      if (bound.bottom === null) {
        bound.bottom = y;
      } else if (bound.bottom < y) {
        bound.bottom = y;
      }
    }
  }

  if (bound.top === null || bound.left === null || bound.right === null || bound.bottom === null) {
    return canvas;
  }

  // Add a little padding
  const padding = 10;
  const trimHeight = bound.bottom - bound.top + 1 + (padding * 2);
  const trimWidth = bound.right - bound.left + 1 + (padding * 2);
  
  const trimmed = ctx.getImageData(
    Math.max(0, bound.left - padding), 
    Math.max(0, bound.top - padding), 
    Math.min(canvas.width - bound.left + padding, bound.right - bound.left + 1 + padding * 2), 
    Math.min(canvas.height - bound.top + padding, bound.bottom - bound.top + 1 + padding * 2)
  );

  const copy = document.createElement('canvas');
  copy.width = trimWidth;
  copy.height = trimHeight;
  
  // Fill with transparent
  const copyCtx = copy.getContext('2d');
  if (copyCtx) {
    copyCtx.putImageData(trimmed, padding, padding);
  }

  return copy;
}

export default function SignaturePad({ onSave, onCancel }: SignaturePadProps) {
  const sigCanvas = useRef<SignatureCanvas>(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const [mode, setMode] = useState<'draw' | 'type'>('draw');
  const [typedName, setTypedName] = useState('');
  const [fontFamily, setFontFamily] = useState('Caveat');

  const clear = () => {
    if (mode === 'draw') {
      sigCanvas.current?.clear();
      setIsEmpty(true);
    } else {
      setTypedName('');
    }
  };

  const save = () => {
    if (mode === 'draw') {
      if (sigCanvas.current?.isEmpty()) {
        alert('Please provide a signature first.');
        return;
      }
      const dataUrl = sigCanvas.current?.getTrimmedCanvas().toDataURL('image/png');
      if (dataUrl) {
        onSave(dataUrl);
      }
    } else {
      if (!typedName.trim()) {
        alert('Please type your name first.');
        return;
      }
      
      // Create a canvas to draw the text
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 300;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Ensure font is loaded by using document.fonts if available, but for simplicity we rely on the CSS import
        ctx.font = `96px "${fontFamily}", cursive`;
        ctx.fillStyle = 'black';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        
        // Draw the text
        ctx.fillText(typedName, canvas.width / 2, canvas.height / 2);
        
        // Trim the canvas
        const trimmedCanvas = trimCanvas(canvas);
        const dataUrl = trimmedCanvas.toDataURL('image/png');
        onSave(dataUrl);
      }
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Create Signature</h3>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-600">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex bg-slate-100 p-1 rounded-lg mb-4">
        <button
          onClick={() => setMode('draw')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-colors ${
            mode === 'draw' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <PenTool className="w-4 h-4" />
          Draw
        </button>
        <button
          onClick={() => setMode('type')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-colors ${
            mode === 'type' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Type className="w-4 h-4" />
          Type
        </button>
      </div>

      {mode === 'draw' ? (
        <div className="border-2 border-dashed border-slate-300 rounded-lg bg-slate-50 mb-4 overflow-hidden relative">
          <SignatureCanvas
            ref={sigCanvas}
            canvasProps={{
              className: 'w-full h-48 cursor-crosshair',
            }}
            onEnd={() => setIsEmpty(false)}
          />
          {isEmpty && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-400">
              Sign here
            </div>
          )}
        </div>
      ) : (
        <div className="mb-4 space-y-4">
          <input
            type="text"
            placeholder="Type your name..."
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
          />
          
          <div className="flex gap-2">
            <button
              onClick={() => setFontFamily('Caveat')}
              className={`flex-1 py-2 border rounded-lg transition-colors ${fontFamily === 'Caveat' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 hover:bg-slate-50'}`}
              style={{ fontFamily: '"Caveat", cursive', fontSize: '1.25rem' }}
            >
              Caveat
            </button>
            <button
              onClick={() => setFontFamily('Dancing Script')}
              className={`flex-1 py-2 border rounded-lg transition-colors ${fontFamily === 'Dancing Script' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 hover:bg-slate-50'}`}
              style={{ fontFamily: '"Dancing Script", cursive', fontSize: '1.25rem' }}
            >
              Dancing Script
            </button>
          </div>

          <div className="border-2 border-dashed border-slate-300 rounded-lg bg-slate-50 h-32 flex items-center justify-center overflow-hidden">
            {typedName ? (
              <span style={{ fontFamily: `"${fontFamily}", cursive`, fontSize: '3rem', color: '#000' }}>
                {typedName}
              </span>
            ) : (
              <span className="text-slate-400">Preview</span>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <button
          onClick={clear}
          className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <Eraser className="w-4 h-4" />
          Clear
        </button>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={save}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors"
          >
            <Check className="w-4 h-4" />
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
