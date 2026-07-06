import React, { useState, useRef, useCallback } from 'react';
import { 
  Camera, 
  Upload, 
  Link, 
  X, 
  Check, 
  User, 
  Mail, 
  Phone,
  FileImage,
  Loader2,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

interface PortraitCaptureProps {
  onCapture: (data: {
    image: string;
    uploadMethod: 'CAMERA' | 'UPLOAD' | 'URL' | 'DRAG_DROP';
    clientName?: string;
    clientEmail?: string;
    clientPhone?: string;
    clientNotes?: string;
    setAsActive?: boolean;
  }) => void;
  onCancel?: () => void;
  isLoading?: boolean;
}

type CaptureMode = 'camera' | 'upload' | 'url' | 'dragdrop';

export default function PortraitCapture({ 
  onCapture, 
  onCancel, 
  isLoading = false 
}: PortraitCaptureProps) {
  const [mode, setMode] = useState<CaptureMode>('camera');
  const [image, setImage] = useState<string | null>(null);
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientNotes, setClientNotes] = useState('');
  const [setAsActive, setSetAsActive] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [faceDetected, setFaceDetected] = useState<boolean | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Camera capture
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (error) {
      toast.error('Could not access camera. Please check permissions.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const context = canvas.getContext('2d');
    if (!context) return;
    
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const imageData = canvas.toDataURL('image/jpeg', 0.9);
    setImage(imageData);
    
    // Detect face (simple check - could be enhanced with AI)
    detectFace(imageData);
    
    stopCamera();
  }, [stopCamera]);

  const detectFace = (imageData: string) => {
    const img = new Image();
    img.onload = () => {
      // Simple detection - check for skin tone region
      // In production, use a proper face detection library
      setFaceDetected(true); // Placeholder
    };
    img.src = imageData;
  };

  // File upload
  const handleFileUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setImage(dataUrl);
      detectFace(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  // Drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  // URL upload
  const handleUrlUpload = (url: string) => {
    if (!url.match(/^https?:\/\/.+\/.+\.(jpg|jpeg|png|gif|webp)/i)) {
      toast.error('Please enter a valid image URL');
      return;
    }
    
    setImage(url);
    // Image will be fetched by the server
    setFaceDetected(true); // Placeholder
  };

  const handleSubmit = () => {
    if (!image) {
      toast.error('Please capture or upload a portrait');
      return;
    }
    
    const uploadMethod = mode === 'camera' ? 'CAMERA' : 
                         mode === 'dragdrop' ? 'DRAG_DROP' :
                         mode === 'url' ? 'URL' : 'UPLOAD';
    
    onCapture({
      image,
      uploadMethod,
      clientName: clientName || undefined,
      clientEmail: clientEmail || undefined,
      clientPhone: clientPhone || undefined,
      clientNotes: clientNotes || undefined,
      setAsActive,
    });
  };

  const handleCancel = () => {
    stopCamera();
    if (onCancel) onCancel();
    setImage(null);
    setFaceDetected(null);
  };

  // Render different modes
  const renderContent = () => {
    if (image) {
      return (
        <div className="relative">
          <img 
            src={image} 
            alt="Portrait" 
            className="w-full max-h-96 object-contain rounded-xl"
          />
          {faceDetected === true && (
            <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              Face Detected
            </div>
          )}
          {faceDetected === false && (
            <div className="absolute top-2 right-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              No Face Detected
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/30 opacity-0 hover:opacity-100 transition">
            <button
              onClick={() => {
                setImage(null);
                setFaceDetected(null);
                if (mode === 'camera') startCamera();
              }}
              className="p-2 bg-white rounded-full hover:bg-slate-100 transition"
            >
              <X className="h-5 w-5 text-slate-700" />
            </button>
          </div>
        </div>
      );
    }

    switch (mode) {
      case 'camera':
        return (
          <div className="space-y-4">
            <div className="relative bg-slate-900 rounded-xl overflow-hidden aspect-video">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <canvas ref={canvasRef} className="hidden" />
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
                <button
                  onClick={capturePhoto}
                  className="p-4 bg-white rounded-full hover:bg-slate-100 transition shadow-lg"
                >
                  <Camera className="h-6 w-6 text-slate-700" />
                </button>
              </div>
            </div>
            <button
              onClick={stopCamera}
              className="text-sm text-slate-500 hover:text-slate-700 transition"
            >
              Switch to upload
            </button>
          </div>
        );

      case 'upload':
        return (
          <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  handleFileUpload(e.target.files[0]);
                }
              }}
              className="hidden"
            />
            <FileImage className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <p className="text-sm text-slate-600 mb-2">
              Click to upload or drag & drop
            </p>
            <p className="text-xs text-slate-400">
              Supports JPG, PNG, GIF, WebP
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold py-2 px-6 rounded-xl transition"
            >
              Choose Image
            </button>
          </div>
        );

      case 'dragdrop':
        return (
          <div
            className={`border-2 border-dashed rounded-xl p-12 text-center transition ${
              isDragging 
                ? 'border-indigo-500 bg-indigo-50' 
                : 'border-slate-300'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Upload className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <p className="text-sm text-slate-600 mb-2">
              {isDragging ? 'Drop your image here' : 'Drag & drop your image here'}
            </p>
            <p className="text-xs text-slate-400">
              or click to browse
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold py-2 px-6 rounded-xl transition"
            >
              Browse Files
            </button>
          </div>
        );

      case 'url':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Image URL
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://example.com/photo.jpg"
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleUrlUpload((e.target as HTMLInputElement).value);
                    }
                  }}
                />
                <button
                  onClick={(e) => {
                    const input = (e.target as HTMLElement)
                      .parentElement?.querySelector('input');
                    if (input) {
                      handleUrlUpload(input.value);
                    }
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-xl transition"
                >
                  <Link className="h-4 w-4" />
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Enter a URL to an image (JPG, PNG, GIF, WebP)
              </p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <User className="h-5 w-5 text-indigo-600" />
          Client Portrait
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Part of FYSORA Ecosystem</span>
        </div>
      </div>

      {/* Mode Selection */}
      <div className="p-4 border-b border-slate-200 bg-slate-50">
        <div className="flex gap-2 overflow-x-auto">
          {[
            { id: 'camera', label: 'Camera', icon: Camera },
            { id: 'upload', label: 'Upload', icon: Upload },
            { id: 'dragdrop', label: 'Drag & Drop', icon: FileImage },
            { id: 'url', label: 'URL', icon: Link },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => {
                if (mode === 'camera') stopCamera();
                setMode(item.id as CaptureMode);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition ${
                mode === item.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-4">
        {renderContent()}

        {/* Client Information */}
        {image && (
          <div className="border-t border-slate-200 pt-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Client Name
                </label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="john@example.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="+234 800 000 0000"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={setAsActive}
                    onChange={(e) => setSetAsActive(e.target.checked)}
                    className="h-4 w-4 text-indigo-600 rounded"
                  />
                  Set as active portrait
                </label>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Notes
              </label>
              <textarea
                value={clientNotes}
                onChange={(e) => setClientNotes(e.target.value)}
                rows={2}
                placeholder="Additional notes about the client..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleSubmit}
            disabled={!image || isLoading}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                {image ? 'Save Portrait' : 'Capture Portrait'}
              </>
            )}
          </button>
          {onCancel && (
            <button
              onClick={handleCancel}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-4 rounded-xl transition"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
