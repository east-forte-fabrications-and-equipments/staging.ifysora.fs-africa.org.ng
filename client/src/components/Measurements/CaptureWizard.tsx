import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { 
  Camera, 
  Upload, 
  X, 
  Check, 
  AlertTriangle,
  User,
  UserCheck,
  Loader2,
  Image as ImageIcon
} from 'lucide-react';
import toast from 'react-hot-toast';
import PortraitCapture from '../Portraits/PortraitCapture';

interface Portrait {
  id: string;
  imageUrl: string;
  thumbnailUrl: string;
  clientName?: string;
  clientEmail?: string;
  isActive: boolean;
  isVerified: boolean;
  faceDetected: boolean;
}

export default function CaptureWizard() {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [sideImage, setSideImage] = useState<string | null>(null);
  const [height, setHeight] = useState<number>(170);
  const [useDepthSensor, setUseDepthSensor] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  
  // Portrait state
  const [portraits, setPortraits] = useState<Portrait[]>([]);
  const [selectedPortrait, setSelectedPortrait] = useState<Portrait | null>(null);
  const [showPortraitCapture, setShowPortraitCapture] = useState(false);
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  
  const frontInputRef = useRef<HTMLInputElement>(null);
  const sideInputRef = useRef<HTMLInputElement>(null);

  // Load portraits on mount
  useEffect(() => {
    fetchPortraits();
  }, []);

  const fetchPortraits = async () => {
    try {
      const response = await fetch('/api/portraits', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });
      
      const data = await response.json();
      if (response.ok) {
        setPortraits(data.portraits || []);
        // Select active portrait
        const active = data.portraits?.find((p: Portrait) => p.isActive);
        if (active) {
          setSelectedPortrait(active);
          setClientName(active.clientName || '');
          setClientEmail(active.clientEmail || '');
        }
      }
    } catch (error) {
      console.error('Failed to fetch portraits:', error);
    }
  };

  const handlePortraitCapture = async (data: any) => {
    try {
      const response = await fetch('/api/portraits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify(data),
      });
      
      const result = await response.json();
      if (response.ok) {
        toast.success('Portrait saved successfully');
        await fetchPortraits();
        setShowPortraitCapture(false);
        setSelectedPortrait(result.portrait);
      } else {
        toast.error(result.error || 'Failed to save portrait');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to save portrait');
    }
  };

  const handleImageUpload = (type: 'front' | 'side', file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (type === 'front') {
        setFrontImage(e.target?.result as string);
      } else {
        setSideImage(e.target?.result as string);
      }
      toast.success(`${type === 'front' ? 'Front' : 'Side'} image uploaded`);
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
          portraitId: selectedPortrait?.id,
          clientName: clientName || selectedPortrait?.clientName,
          clientEmail: clientEmail || selectedPortrait?.clientEmail,
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
              <h2 className="text-2xl font-bold text-slate-900">Client Identification</h2>
              <p className="text-sm text-slate-500">Associate measurements with a specific client</p>
            </div>

            {/* Portrait Selection */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-700">Client Portrait</h3>
                <button
                  onClick={() => setShowPortraitCapture(true)}
                  className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  + New Portrait
                </button>
              </div>

              {showPortraitCapture && (
                <PortraitCapture
                  onCapture={handlePortraitCapture}
                  onCancel={() => setShowPortraitCapture(false)}
                  isLoading={false}
                />
              )}

              {portraits.length > 0 && !showPortraitCapture && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {portraits.map((portrait) => (
                    <button
                      key={portrait.id}
                      onClick={() => {
                        setSelectedPortrait(portrait);
                        setClientName(portrait.clientName || '');
                        setClientEmail(portrait.clientEmail || '');
                      }}
                      className={`relative rounded-xl overflow-hidden border-2 transition ${
                        selectedPortrait?.id === portrait.id
                          ? 'border-indigo-600 ring-2 ring-indigo-200'
                          : 'border-slate-200 hover:border-indigo-300'
                      }`}
                    >
                      <img
                        src={portrait.thumbnailUrl || portrait.imageUrl}
                        alt={portrait.clientName || 'Portrait'}
                        className="w-full aspect-square object-cover"
                      />
                      {portrait.isActive && (
                        <div className="absolute top-1 right-1 bg-indigo-600 text-white text-[8px] px-1.5 py-0.5 rounded-full">
                          Active
                        </div>
                      )}
                      {portrait.isVerified && (
                        <div className="absolute bottom-1 left-1 bg-green-500 text-white text-[8px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                          <UserCheck className="h-2.5 w-2.5" />
                          Verified
                        </div>
                      )}
                      {portrait.clientName && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 truncate">
                          {portrait.clientName}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {portraits.length === 0 && !showPortraitCapture && (
                <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                  <User className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">No client portraits</p>
                  <button
                    onClick={() => setShowPortraitCapture(true)}
                    className="mt-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    Add client portrait
                  </button>
                </div>
              )}
            </div>

            {/* Client Info */}
            <div className="border-t border-slate-200 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Client Name
                  </label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Client Email (optional)
                  </label>
                  <input
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="john@example.com"
                    className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setStep(2)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-xl transition"
              >
                Next →
              </button>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-slate-900">Upload Body Images</h2>
              <p className="text-sm text-slate-500">
                {selectedPortrait ? `For ${selectedPortrait.clientName || 'Client'}` : 'Upload front and side views'}
              </p>
            </div>

            {/* Images */}
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
                    <p className="text-xs text-slate-500">Full body, arms slightly away</p>
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
                    <p className="text-xs text-slate-500">Full body, arms relaxed</p>
                  </div>
                )}
              </div>
            </div>

            {/* Height & Settings */}
            <div className="space-y-4 border-t border-slate-200 pt-4">
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
                  className="w-full max-w-xs px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
                  Use depth sensor for enhanced accuracy
                </label>
              </div>
            </div>

            {/* Client Summary */}
            {selectedPortrait && (
              <div className="bg-slate-50 rounded-xl p-4 flex items-center gap-3">
                <img
                  src={selectedPortrait.thumbnailUrl || selectedPortrait.imageUrl}
                  alt="Client"
                  className="w-10 h-10 rounded-full object-cover"
                />
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {selectedPortrait.clientName || 'Client'}
                  </p>
                  {selectedPortrait.clientEmail && (
                    <p className="text-xs text-slate-500">{selectedPortrait.clientEmail}</p>
                  )}
                </div>
                <span className="ml-auto text-xs text-green-600 font-medium flex items-center gap-1">
                  <UserCheck className="h-3 w-3" />
                  Verified
                </span>
              </div>
            )}

            <div className="flex gap-4">
              <button
                onClick={() => setStep(1)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 px-4 rounded-xl transition"
              >
                ← Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || !frontImage || !sideImage}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyzing...
                  </span>
                ) : (
                  'Analyze Measurements'
                )}
              </button>
            </div>
          </div>
        );

      case 3:
        // Results display (existing code)
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="inline-flex p-3 bg-green-100 rounded-full mb-4">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">Analysis Complete!</h2>
              <p className="text-sm text-slate-500">
                {selectedPortrait?.clientName 
                  ? `Measurements for ${selectedPortrait.clientName}`
                  : 'Your measurements are ready'}
              </p>
            </div>

            {/* Results summary */}
            {result && (
              <div className="bg-slate-50 rounded-xl p-6 space-y-4">
                <div className="flex items-start gap-4">
                  {selectedPortrait && (
                    <img
                      src={selectedPortrait.thumbnailUrl || selectedPortrait.imageUrl}
                      alt="Client"
                      className="w-16 h-16 rounded-xl object-cover"
                    />
                  )}
                  <div className="flex-1">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="text-sm">
                        <span className="font-medium text-slate-500">Session ID</span>
                        <p className="font-mono text-xs">{result.sessionId}</p>
                      </div>
                      <div className="text-sm">
                        <span className="font-medium text-slate-500">Body Shape</span>
                        <p className="font-bold text-indigo-600">{result.bodyShape || 'N/A'}</p>
                      </div>
                      {result.client?.name && (
                        <div className="text-sm">
                          <span className="font-medium text-slate-500">Client</span>
                          <p className="font-medium">{result.client.name}</p>
                        </div>
                      )}
                      <div className="text-sm">
                        <span className="font-medium text-slate-500">Height</span>
                        <p className="font-medium">{result.userHeightCm} cm</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Measurements preview */}
                <div className="max-h-48 overflow-y-auto border-t border-slate-200 pt-4">
                  <h4 className="text-sm font-bold text-slate-700 mb-2">Measurements</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(result.measurements || {})
                      .slice(0, 10)
                      .map(([key, value]) => (
                        <div key={key} className="flex justify-between text-xs py-1 border-b border-slate-100">
                          <span className="text-slate-600">{key}</span>
                          <span className="font-medium">{Number(value).toFixed(1)} cm</span>
                        </div>
                      ))}
            
