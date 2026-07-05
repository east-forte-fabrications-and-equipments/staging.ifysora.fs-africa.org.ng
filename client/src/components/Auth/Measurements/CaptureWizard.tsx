import React, { useState, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Camera, Upload, X, Check, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CaptureWizard() {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [sideImage, setSideImage] = useState<string | null>(null);
  const [height, setHeight] = useState<number>(170);
  const [useDepthSensor, setUseDepthSensor] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  
  const frontInputRef = useRef<HTMLInputElement>(null);
  const sideInputRef = useRef<HTMLInputElement>(null);
  
  const handleImageUpload = (type: 'front' | 'side', file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (type === 'front') {
        setFrontImage(e.target?.result as string);
      } else {
        setSideImage(e.target?.result as string);
      }
      toast.success(`${type === 'front' ? 'Front' : 'Side'} image uploaded successfully`);
    };
    reader.readAsDataURL(file);
  };
  
  const handleSubmit = async () => {
    if (!frontImage || !sideImage) {
      toast.error('Please upload both front and side images');
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch('/api/measurements/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify({
          frontImage,
          sideImage,
          userHeightCm: height,
          useDepthSensor,
        }),
      });
      
      const data = await response.json();
      if (data.success) {
        setResult(data.measurement);
        setStep(3);
        toast.success('Measurement analysis complete!');
      } else {
        toast.error(data.error || 'Analysis failed');
      }
    } catch (error: any) {
      toast.error(error.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };
  
  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-slate-900">Step 1: Upload Images</h2>
              <p className="text-sm text-slate-500">Upload front and side views for accurate measurements</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-indigo-500 transition">
                <input
                  type="file"
                  ref={frontInputRef}
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      handleImageUpload('front', e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />
                {frontImage ? (
                  <div className="relative">
                    <img src={frontImage} alt="Front view" className="max-h-64 mx-auto rounded-lg" />
                    <button
                      onClick={() => setFrontImage(null)}
                      className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div onClick={() => frontInputRef.current?.click()} className="cursor-pointer">
                    <Camera className="h-12 w-12 text-slate-400 mx-auto mb-3" />
                    <p className="text-sm font-medium text-slate-700">Upload Front View</p>
                    <p className="text-xs text-slate-500">Full body, arms slightly away from body</p>
                  </div>
                )}
              </div>
              
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-indigo-500 transition">
                <input
                  type="file"
                  ref={sideInputRef}
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      handleImageUpload('side', e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />
                {sideImage ? (
                  <div className="relative">
                    <img src={sideImage} alt="Side view" className="max-h-64 mx-auto rounded-lg" />
                    <button
                      onClick={() => setSideImage(null)}
                      className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div onClick={() => sideInputRef.current?.click()} className="cursor-pointer">
                    <Camera className="h-12 w-12 text-slate-400 mx-auto mb-3" />
                    <p className="text-sm font-medium text-slate-700">Upload Side View</p>
                    <p className="text-xs text-slate-500">Full body, arms relaxed at sides</p>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex gap-4">
              <button
                onClick={() => setStep(2)}
                disabled={!frontImage || !sideImage}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next Step →
              </button>
            </div>
          </div>
        );
        
      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-slate-900">Step 2: Configure Analysis</h2>
              <p className="text-sm text-slate-500">Provide additional details for accurate measurements</p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Height (cm)
                </label>
                <input
                  type="number"
                  min={50}
                  max={300}
                  value={height}
                  onChange={(e) => setHeight(Number(e.target.value))}
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="depthSensor"
                  checked={useDepthSensor}
                  onChange={(e) => setUseDepthSensor(e.target.checked)}
                  className="h-4 w-4 text-indigo-600 rounded"
                />
                <label htmlFor="depthSensor" className="text-sm text-slate-700">
                  Use depth sensor for enhanced accuracy (if available)
                </label>
              </div>
            </div>
            
            <div className="flex gap-4">
              <button
                onClick={() => setStep(1)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 px-4 rounded-xl transition"
              >
                ← Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl transition disabled:opacity-50"
              >
                {loading ? 'Analyzing...' : 'Analyze Measurements'}
              </button>
            </div>
          </div>
        );
        
      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="inline-flex p-3 bg-green-100 rounded-full mb-4">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">Analysis Complete!</h2>
              <p className="text-sm text-slate-500">Your 3D anthropometric measurements are ready</p>
            </div>
            
            {result && (
              <div className="bg-slate-50 rounded-xl p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-sm">
                    <span className="font-medium text-slate-500">Session ID</span>
                    <p className="font-mono text-xs">{result.sessionId}</p>
                  </div>
                  <div className="text-sm">
                    <span className="font-medium text-slate-500">Body Shape</span>
                    <p className="font-bold text-indigo-600">{result.bodyShape || 'N/A'}</p>
                  </div>
                </div>
                
                <div className="max-h-96 overflow-y-auto border-t border-slate-200 pt-4">
                  <h4 className="text-sm font-bold text-slate-700 mb-2">Measurements</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(result.measurements || {}).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-xs py-1 border-b border-slate-100">
                        <span className="text-slate-600">{key}</span>
                        <span className="font-medium">{Number(value).toFixed(1)} cm</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex gap-4">
              <button
                onClick={() => {
                  setStep(1);
                  setFrontImage(null);
                  setSideImage(null);
                  setResult(null);
                }}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 px-4 rounded-xl transition"
              >
                New Scan
              </button>
              <button
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl transition"
                onClick={() => window.location.href = '/measure/history'}
              >
                View History
              </button>
            </div>
          </div>
        );
    }
  };
  
  return (
    <div className="max-w-4xl mx-auto my-12 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
      <div className="p-8">
        {/* Progress bar */}
        <div className="flex justify-between items-center mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex-1 flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                step >= s ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-400'
              }`}>
                {s}
              </div>
              {s < 3 && (
                <div className={`flex-1 h-1 mx-2 ${step > s ? 'bg-indigo-600' : 'bg-slate-200'}`} />
              )}
            </div>
          ))}
        </div>
        
        {renderStep()}
      </div>
    </div>
  );
}
