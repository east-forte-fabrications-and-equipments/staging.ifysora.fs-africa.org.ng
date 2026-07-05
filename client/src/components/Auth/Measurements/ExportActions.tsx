import React, { useState } from 'react';
import { 
  Download, 
  Share2, 
  Cloud, 
  FileText, 
  FileSpreadsheet, 
  FileJson,
  Check,
  Loader2,
  Copy,
  ExternalLink
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ExportActionsProps {
  measurementId: string;
  onExport?: () => void;
}

export default function ExportActions({ measurementId, onExport }: ExportActionsProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareData, setShareData] = useState<any>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  
  const handleExport = async (format: 'pdf' | 'csv' | 'json') => {
    setIsExporting(true);
    try {
      const response = await fetch(`/api/exports/${measurementId}?format=${format}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });
      
      const data = await response.json();
      if (data.success) {
        // Trigger download
        window.open(data.downloadUrl, '_blank');
        toast.success(`${format.toUpperCase()} downloaded successfully`);
        if (onExport) onExport();
      } else {
        toast.error(data.error || 'Export failed');
      }
    } catch (error: any) {
      toast.error(error.message || 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };
  
  const handleWhatsAppShare = async () => {
    setIsSharing(true);
    try {
      const response = await fetch(`/api/exports/${measurementId}/whatsapp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify({
          phoneNumber: phoneNumber || undefined,
          message: customMessage || undefined,
        }),
      });
      
      const data = await response.json();
      if (data.success) {
        setShareData(data);
        setShowShareModal(true);
        toast.success('WhatsApp share link generated!');
      } else {
        toast.error(data.error || 'WhatsApp sharing failed');
      }
    } catch (error: any) {
      toast.error(error.message || 'WhatsApp sharing failed');
    } finally {
      setIsSharing(false);
    }
  };
  
  const handleBackup = async (provider: 'google_drive' | 'dropbox' | 'onedrive') => {
    setIsBackingUp(true);
    try {
      // Check if provider is connected
      const providersResponse = await fetch('/api/exports/cloud-providers', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });
      const providersData = await providersResponse.json();
      
      const isConnected = providersData.providers?.some((p: any) => p.type === provider);
      
      if (!isConnected) {
        // Redirect to connect flow
        toast.error(`Please connect ${provider} first`);
        // Open connection modal
        window.open(`/settings/cloud?provider=${provider}`, '_blank');
        return;
      }
      
      const response = await fetch(`/api/exports/${measurementId}/backup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify({
          provider,
        }),
      });
      
      const data = await response.json();
      if (data.success) {
        toast.success(`Backed up to ${provider}`);
        if (data.url) {
          window.open(data.url, '_blank');
        }
      } else {
        toast.error(data.error || 'Backup failed');
      }
    } catch (error: any) {
      toast.error(error.message || 'Backup failed');
    } finally {
      setIsBackingUp(false);
    }
  };
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };
  
  return (
    <div className="space-y-4">
      {/* Export Buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => handleExport('pdf')}
          disabled={isExporting}
          className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-sm font-medium transition disabled:opacity-50"
        >
          {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          PDF
        </button>
        <button
          onClick={() => handleExport('csv')}
          disabled={isExporting}
          className="flex items-center gap-2 px-4 py-2 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded-xl text-sm font-medium transition disabled:opacity-50"
        >
          {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
          CSV
        </button>
        <button
          onClick={() => handleExport('json')}
          disabled={isExporting}
          className="flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-sm font-medium transition disabled:opacity-50"
        >
          {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileJson className="h-4 w-4" />}
          JSON
        </button>
      </div>
      
      {/* WhatsApp Share */}
      <div className="border-t border-slate-200 pt-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowShareModal(true)}
            disabled={isSharing}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium transition disabled:opacity-50"
          >
            {isSharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
            Share on WhatsApp
          </button>
        </div>
      </div>
      
      {/* Cloud Backup */}
      <div className="border-t border-slate-200 pt-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleBackup('google_drive')}
            disabled={isBackingUp}
            className="flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-sm font-medium transition disabled:opacity-50"
          >
            {isBackingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cloud className="h-4 w-4" />}
            Google Drive
          </button>
          <button
            onClick={() => handleBackup('dropbox')}
            disabled={isBackingUp}
            className="flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-sm font-medium transition disabled:opacity-50"
          >
            {isBackingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cloud className="h-4 w-4" />}
            Dropbox
          </button>
          <button
            onClick={() => handleBackup('onedrive')}
            disabled={isBackingUp}
            className="flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-sm font-medium transition disabled:opacity-50"
          >
            {isBackingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cloud className="h-4 w-4" />}
            OneDrive
          </button>
        </div>
      </div>
      
      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Share on WhatsApp</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Phone Number (optional)
                </label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+234 800 000 0000"
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Custom Message (optional)
                </label>
                <textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  rows={3}
                  placeholder="Share your measurement results..."
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                />
              </div>
              
              {shareData && (
                <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Share Link</span>
                    <button
                      onClick={() => copyToClipboard(shareData.shareUrl)}
                      className="p-1 hover:bg-slate-200 rounded"
                    >
                      <Copy className="h-4 w-4 text-slate-400" />
                    </button>
                  </div>
                  <p className="text-xs font-mono truncate">{shareData.shareUrl}</p>
                  <a
                    href={shareData.whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-green-600 hover:text-green-700 font-medium"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open in WhatsApp
                  </a>
                </div>
              )}
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleWhatsAppShare}
                disabled={isSharing}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-xl transition disabled:opacity-50"
              >
                {isSharing ? 'Generating...' : 'Generate Share Link'}
              </button>
              <button
                onClick={() => {
                  setShowShareModal(false);
                  setShareData(null);
                  setPhoneNumber('');
                  setCustomMessage('');
                }}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 px-4 rounded-xl transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
