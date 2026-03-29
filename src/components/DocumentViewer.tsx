import React, { useState, useRef } from 'react';
import { Download, Wand2, PenTool, Loader2, FileText, CheckCircle2 } from 'lucide-react';
import SignaturePad from './SignaturePad';

interface DocumentViewerProps {
  file: any;
  onNewFile: () => void;
}

export default function DocumentViewer({ file, onNewFile }: DocumentViewerProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [signedFileUrl, setSignedFileUrl] = useState<string | null>(null);
  
  const [clickPos, setClickPos] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const authHeaders = () => {
    const token = localStorage.getItem('googleAccessToken');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const handleAnalyze = async (task: string) => {
    setIsAnalyzing(true);
    setAiResult(null);
    try {
      const response = await fetch('/api/ai/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ fileId: file.id, task }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'AI request failed');
      }
      
      if (task === 'extract_fields') {
        try {
          // Try to parse if it's JSON
          const jsonStr = data.result.replace(/```json/g, '').replace(/```/g, '');
          setAiResult(JSON.parse(jsonStr));
        } catch (e) {
          setAiResult(data.result);
        }
      } else {
        setAiResult(data.result);
      }
    } catch (err: any) {
      console.error('Analysis failed:', err);
      setAiResult(err?.message || 'Failed to analyze document.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!signatureData) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Calculate relative position (0-1) to scale properly on backend
    const relX = x / rect.width;
    const relY = y / rect.height;
    
    setClickPos({ x: relX, y: relY });
  };

  const handleApplySignature = async () => {
    if (!clickPos || !signatureData) return;
    
    setIsSigning(true);
    try {
      const response = await fetch('/api/pdf/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          fileId: file.id,
          signatureBase64: signatureData,
          x: clickPos.x,
          y: clickPos.y,
          pageIndex: 0,
          scale: 0.3,
        }),
      });
      
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to sign document');
      }
      setSignedFileUrl(data.url);
    } catch (err: any) {
      console.error('Signing failed:', err);
      alert(err?.message || 'Failed to sign document.');
    } finally {
      setIsSigning(false);
      setClickPos(null);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-8rem)]">
      {/* Sidebar */}
      <div className="w-full lg:w-80 flex flex-col gap-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200 overflow-y-auto">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
            <FileText className="w-5 h-5" />
          </div>
          <div className="overflow-hidden">
            <h3 className="font-semibold text-slate-900 truncate" title={file.originalName}>
              {file.originalName}
            </h3>
            <p className="text-xs text-slate-500">
              {(file.size / 1024 / 1024).toFixed(2)} MB • {file.mimetype.split('/')[1].toUpperCase()}
            </p>
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <h4 className="text-sm font-medium text-slate-900 uppercase tracking-wider">AI Actions</h4>
          <button
            onClick={() => handleAnalyze('summarize')}
            disabled={isAnalyzing}
            className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg transition-colors border border-slate-200 disabled:opacity-50"
          >
            <span className="flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-purple-500" />
              Summarize
            </span>
            {isAnalyzing && <Loader2 className="w-4 h-4 animate-spin" />}
          </button>
          
          <button
            onClick={() => handleAnalyze('extract_fields')}
            disabled={isAnalyzing}
            className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg transition-colors border border-slate-200 disabled:opacity-50"
          >
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Extract Fields
            </span>
            {isAnalyzing && <Loader2 className="w-4 h-4 animate-spin" />}
          </button>
        </div>

        <div className="space-y-3 pt-4 border-t border-slate-100">
          <h4 className="text-sm font-medium text-slate-900 uppercase tracking-wider">Fill & Sign</h4>
          
          {!signatureData ? (
            <button
              onClick={() => setShowSignaturePad(true)}
              className="w-full flex items-center justify-center gap-2 p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm"
            >
              <PenTool className="w-4 h-4" />
              Create Signature
            </button>
          ) : (
            <div className="space-y-3">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <p className="text-xs text-slate-500 mb-2">Your Signature</p>
                <img src={signatureData} alt="Signature" className="h-12 object-contain bg-white border border-slate-200 rounded p-1" />
                <button 
                  onClick={() => setSignatureData(null)}
                  className="text-xs text-red-500 hover:text-red-600 mt-2"
                >
                  Clear
                </button>
              </div>
              
              <p className="text-xs text-slate-500 italic">
                Click anywhere on the document preview to place your signature.
              </p>
            </div>
          )}
        </div>

        {aiResult && (
          <div className="mt-4 p-4 bg-purple-50 border border-purple-100 rounded-lg overflow-y-auto max-h-64">
            <h4 className="text-sm font-semibold text-purple-900 mb-2">AI Analysis</h4>
            {typeof aiResult === 'string' ? (
              <p className="text-sm text-purple-800 whitespace-pre-wrap">{aiResult}</p>
            ) : (
              <ul className="space-y-2">
                {Array.isArray(aiResult) && aiResult.map((field: any, i: number) => (
                  <li key={i} className="text-sm bg-white p-2 rounded shadow-sm border border-purple-100">
                    <span className="font-medium text-slate-900">{field.label}</span>
                    <span className="text-xs text-slate-500 ml-2 bg-slate-100 px-1 py-0.5 rounded">{field.type}</span>
                    <p className="text-xs text-slate-600 mt-1">{field.description}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="mt-auto pt-4 border-t border-slate-100">
          <button
            onClick={onNewFile}
            className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            Upload different file
          </button>
        </div>
      </div>

      {/* Main Viewer */}
      <div className="flex-1 bg-slate-100 rounded-xl border border-slate-200 overflow-hidden flex flex-col relative">
        {signedFileUrl ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Document Signed Successfully!</h2>
            <p className="text-slate-500 mb-8 max-w-md">
              Your signature has been securely applied to the document. You can now download the finalized version.
            </p>
            <div className="flex gap-4">
              <a
                href={signedFileUrl}
                download
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium"
              >
                <Download className="w-5 h-5" />
                Download PDF
              </a>
              <button
                onClick={() => {
                  setSignedFileUrl(null);
                  setSignatureData(null);
                }}
                className="px-6 py-3 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
              >
                Sign Again
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-auto p-4 flex justify-center bg-slate-200/50" ref={containerRef}>
            <div className="relative bg-white shadow-md max-w-full inline-block">
              {/* For MVP, we use an iframe for PDF, but for signature placement we need an image or canvas.
                  Since we can't easily convert PDF to image on the fly without heavy libs, 
                  we'll overlay a transparent div over the iframe to catch clicks if signing is active. */}
              
              {file.mimetype.includes('pdf') ? (
                <div className="relative w-[600px] h-[800px] bg-white">
                  <iframe
                    src={`${file.url}#toolbar=0&navpanes=0&scrollbar=0`}
                    className="w-full h-full border-0 pointer-events-none"
                    title="Document Preview"
                  />
                  {signatureData && (
                    <div 
                      className="absolute inset-0 cursor-crosshair z-10"
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        const y = e.clientY - rect.top;
                        setClickPos({ x: x / rect.width, y: y / rect.height });
                      }}
                    >
                      {clickPos && (
                        <div 
                          className="absolute border-2 border-blue-500 bg-blue-50/50 shadow-sm"
                          style={{
                            left: `${clickPos.x * 100}%`,
                            top: `${clickPos.y * 100}%`,
                            width: '150px',
                            height: '50px',
                            transform: 'translate(0, -100%)' // Align bottom-left to click
                          }}
                        >
                          <img src={signatureData} className="w-full h-full object-contain" alt="Signature preview" />
                          <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 flex gap-2">
                            <button 
                              onClick={(e) => { e.stopPropagation(); setClickPos(null); }}
                              className="px-2 py-1 bg-white text-red-600 text-xs rounded shadow hover:bg-red-50"
                            >
                              Cancel
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleApplySignature(); }}
                              disabled={isSigning}
                              className="px-2 py-1 bg-blue-600 text-white text-xs rounded shadow hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                            >
                              {isSigning ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                              Apply
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative inline-block">
                  <img 
                    src={file.url} 
                    alt="Document" 
                    className="max-w-full h-auto"
                    onClick={handleImageClick}
                  />
                  {/* Image signature placement logic similar to PDF */}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showSignaturePad && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <SignaturePad 
            onSave={(data) => {
              setSignatureData(data);
              setShowSignaturePad(false);
            }}
            onCancel={() => setShowSignaturePad(false)}
          />
        </div>
      )}
    </div>
  );
}
