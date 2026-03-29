import React, { useState } from 'react';
import { FileSignature, ShieldCheck, Zap, Upload, Wand2 } from 'lucide-react';
import FileUploader from './components/FileUploader';
import DocumentViewer from './components/DocumentViewer';

export default function App() {
  const [currentFile, setCurrentFile] = useState<any>(null);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-sm">
              <FileSignature className="w-5 h-5" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">DocuGem</span>
            <span className="ml-2 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium border border-blue-100">
              v1.0
            </span>
          </div>
          
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <div className="flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">
              <Zap className="w-4 h-4 text-amber-500" />
              AI Analysis
            </div>
            <div className="flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              Secure Sign
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!currentFile ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <div className="text-center max-w-2xl mb-12">
              <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl mb-4">
                Smart Document Processing
              </h1>
              <p className="text-lg text-slate-600">
                Upload your documents to automatically extract fields, summarize content, and securely sign them using DocuGem's advanced AI.
              </p>
            </div>
            
            <FileUploader onUploadSuccess={setCurrentFile} />
            
            <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl w-full">
              <div className="flex flex-col items-center text-center p-6 bg-white rounded-2xl shadow-sm border border-slate-100">
                <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 mb-4">
                  <Upload className="w-6 h-6" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-2">1. Upload</h3>
                <p className="text-sm text-slate-500">Securely upload your PDF or image files to our encrypted cloud storage.</p>
              </div>
              <div className="flex flex-col items-center text-center p-6 bg-white rounded-2xl shadow-sm border border-slate-100">
                <div className="w-12 h-12 bg-purple-50 rounded-full flex items-center justify-center text-purple-600 mb-4">
                  <Wand2 className="w-6 h-6" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-2">2. Analyze</h3>
                <p className="text-sm text-slate-500">Let DocuGem AI automatically detect form fields and summarize the document.</p>
              </div>
              <div className="flex flex-col items-center text-center p-6 bg-white rounded-2xl shadow-sm border border-slate-100">
                <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 mb-4">
                  <FileSignature className="w-6 h-6" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-2">3. Sign & Export</h3>
                <p className="text-sm text-slate-500">Draw your signature, place it perfectly, and download the finalized PDF.</p>
              </div>
            </div>
          </div>
        ) : (
          <DocumentViewer 
            file={currentFile} 
            onNewFile={() => setCurrentFile(null)} 
          />
        )}
      </main>
    </div>
  );
}
