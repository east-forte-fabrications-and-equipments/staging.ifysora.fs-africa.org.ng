import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Share2, Cloud, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import ExportActions from './ExportActions';

export default function ResultsDisplay() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [measurement, setMeasurement] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchMeasurement();
  }, [id]);
  
  const fetchMeasurement = async () => {
    try {
      const response = await fetch(`/api/measurements/${id}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });
      const data = await response.json();
      if (data.id) {
        setMeasurement(data);
      } else {
        toast.error('Measurement not found');
        navigate('/measure/history');
      }
    } catch (error) {
      toast.error('Failed to load measurement');
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-sm text-slate-500">Loading measurement data...</p>
        </div>
      </div>
    );
  }
  
  if (!measurement) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Measurement not found</p>
        <button
          onClick={() => navigate('/measure/history')}
          className="mt-4 text-indigo-600 hover:text-indigo-700 font-medium"
        >
          Back to History
        </button>
      </div>
    );
  }
  
  return (
    <div className="max-w-4xl mx-auto my-12 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/measure/history')}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to History
          </button>
          <div className="text-right">
            <p className="text-xs text-slate-500">Session ID</p>
            <p className="text-xs font-mono">{measurement.sessionId}</p>
          </div>
        </div>
      </div>
      
      <div className="p-8 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-50 rounded-xl p-4">
            <p className="text-xs text-slate-500">Body Shape</p>
            <p className="text-lg font-bold text-indigo-600">{measurement.bodyShape || 'N/A'}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-4">
            <p className="text-xs text-slate-500">Height</p>
            <p className="text-lg font-bold">{measurement.userHeightCm} cm</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-4">
            <p className="text-xs text-slate-500">Date</p>
            <p className="text-lg font-bold">
              {new Date(measurement.timestamp).toLocaleDateString()}
            </p>
          </div>
          <div className="bg-slate-50 rounded-xl p-4">
            <p className="text-xs text-slate-500">Confidence</p>
            <p className="text-lg font-bold">
              {Object.values(measurement.confidenceScores || {}).reduce((a: number, b: number) => a + b, 0) / 
               Object.keys(measurement.confidenceScores || {}).length || 0}%
            </p>
          </div>
        </div>
        
        {/* Measurements Table */}
        <div className="max-h-96 overflow-y-auto border border-slate-200 rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left font-bold text-slate-700">Measurement</th>
                <th className="px-4 py-3 text-right font-bold text-slate-700">Value (cm)</th>
                <th className="px-4 py-3 text-right font-bold text-slate-700">Confidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Object.entries(measurement.data || {}).map(([key, value]) => {
                if (key === 'Body shape') return null;
                return (
                  <tr key={key} className="hover:bg-slate-50">
                    <td className="px-4 py-2 text-slate-600">{key}</td>
                    <td className="px-4 py-2 text-right font-medium">
                      {typeof value === 'number' ? value.toFixed(1) : value}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        (measurement.confidenceScores?.[key] || 0) > 80 
                          ? 'bg-green-100 text-green-700' 
                          : (measurement.confidenceScores?.[key] || 0) > 60
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                      }`}>
                        {measurement.confidenceScores?.[key] || 0}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {/* Export Actions */}
        <div className="border-t border-slate-200 pt-6">
          <h3 className="text-sm font-bold text-slate-700 mb-4">Export & Share</h3>
          <ExportActions 
            measurementId={measurement.id}
            onExport={() => fetchMeasurement()}
          />
        </div>
        
        {/* Metadata */}
        <div className="text-xs text-slate-400 border-t border-slate-200 pt-4">
          <p>Generated: {new Date(measurement.timestamp).toLocaleString()}</p>
          <p>AI Model: {measurement.aiModelUsed || 'N/A'}</p>
          {measurement.syncedToFysora && (
            <p className="text-green-600">✓ Synced to FYSORA FASHN</p>
          )}
        </div>
      </div>
    </div>
  );
}
