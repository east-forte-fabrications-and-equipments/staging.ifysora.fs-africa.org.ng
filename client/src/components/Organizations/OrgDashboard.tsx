import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { 
  Building2, 
  Users, 
  UserPlus, 
  Settings,
  BarChart3,
  Mail,
  Phone,
  MapPin,
  Edit,
  Trash2,
  Loader2,
  CheckCircle,
  XCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Organization {
  id: string;
  name: string;
  description: string;
  type: string;
  contactEmail: string;
  contactPhone: string;
  address: any;
  members: any[];
  createdAt: string;
}

export default function OrgDashboard() {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [showMembers, setShowMembers] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'TAILOR',
    registrationNumber: '',
    contactEmail: '',
    contactPhone: '',
    address: {
      street: '',
      city: '',
      state: '',
      country: '',
      postalCode: '',
    },
  });

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    try {
      const response = await fetch('/api/organizations', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });
      
      const data = await response.json();
      if (response.ok) {
        setOrganizations(data.organizations || []);
      } else {
        toast.error(data.error || 'Failed to load organizations');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to load organizations');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch('/api/organizations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify(formData),
      });
      
      const data = await response.json();
      if (response.ok) {
        toast.success('Organization created successfully!');
        setShowCreateModal(false);
        setFormData({
          name: '',
          description: '',
          type: 'TAILOR',
          registrationNumber: '',
          contactEmail: '',
          contactPhone: '',
          address: {
            street: '',
            city: '',
            state: '',
            country: '',
            postalCode: '',
          },
        });
        await fetchOrganizations();
      } else {
        toast.error(data.error || 'Failed to create organization');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create organization');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-indigo-600 animate-spin mx-auto" />
          <p className="mt-4 text-sm text-slate-500">Loading organizations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto my-12">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Organizations</h2>
          <p className="text-sm text-slate-500">Manage your professional organizations</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-xl transition"
        >
          <UserPlus className="h-4 w-4" />
          New Organization
        </button>
      </div>

      {organizations.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-12 text-center">
          <div className="inline-flex p-4 bg-slate-50 rounded-full mb-4">
            <Building2 className="h-8 w-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">No Organizations Yet</h3>
          <p className="text-sm text-slate-500 mt-1">Create your first organization to get started</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-xl transition"
          >
            Create Organization
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {organizations.map((org) => (
            <div key={org.id} className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden hover:shadow-2xl transition">
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-50 rounded-xl">
                        <Building2 className="h-5 w-5 text-indigo-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">{org.name}</h3>
                        <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full">
                          {org.type}
                        </span>
                      </div>
                    </div>
                    
                    {org.description && (
                      <p className="mt-2 text-sm text-slate-500">{org.description}</p>
                    )}
                    
                    <div className="mt-4 space-y-1">
                      {org.contactEmail && (
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Mail className="h-3.5 w-3.5 text-slate-400" />
                          <span>{org.contactEmail}</span>
                        </div>
                      )}
                      {org.contactPhone && (
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Phone className="h-3.5 w-3.5 text-slate-400" />
                          <span>{org.contactPhone}</span>
                        </div>
                      )}
                      {org.address?.city && (
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <MapPin className="h-3.5 w-3.5 text-slate-400" />
                          <span>{org.address.city}, {org.address.state}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="mt-6 flex items-center gap-3">
                  <button
                    onClick={() => {
                      setSelectedOrg(org);
                      setShowMembers(true);
                    }}
                    className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition"
                  >
                    <Users className="h-4 w-4" />
                    {org.members?.length || 0} Members
                  </button>
                  <div className="w-px h-6 bg-slate-200"></div>
                  <button
                    className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-700 transition"
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Organization Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-900">Create Organization</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 hover:bg-slate-100 rounded-xl transition"
              >
                <XCircle className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            
            <form onSubmit={handleCreateOrg} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Organization Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Enter organization name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Type *
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="TAILOR">Tailor</option>
                  <option value="DESIGNER">Designer</option>
                  <option value="BOUTIQUE">Boutique</option>
                  <option value="BRAND">Brand</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                  placeholder="Describe your organization"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Registration Number
                </label>
                <input
                  type="text"
                  value={formData.registrationNumber}
                  onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Enter registration number"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Contact Email
                  </label>
                  <input
                    type="email"
                    value={formData.contactEmail}
                    onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="contact@org.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Contact Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.contactPhone}
                    onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="+234 800 000 0000"
                  />
                </div>
              </div>
              
              <div className="border-t border-slate-200 pt-4">
                <h4 className="text-sm font-bold text-slate-700 mb-3">Address</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Street
                    </label>
                    <input
                      type="text"
                      value={formData.address.street}
                      onChange={(e) => setFormData({
                        ...formData,
                        address: { ...formData.address, street: e.target.value }
                      })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Street address"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      City
                    </label>
                    <input
                      type="text"
                      value={formData.address.city}
                      onChange={(e) => setFormData({
                        ...formData,
                        address: { ...formData.address, city: e.target.value }
                      })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="City"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      State
                    </label>
                    <input
                      type="text"
                      value={formData.address.state}
                      onChange={(e) => setFormData({
                        ...formData,
                        address: { ...formData.address, state: e.target.value }
                      })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="State"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Country
                    </label>
                    <input
                      type="text"
                      value={formData.address.country}
                      onChange={(e) => setFormData({
                        ...formData,
                        address: { ...formData.address, country: e.target.value }
                      })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Country"
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl transition"
                >
                  Create Organization
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 px-4 rounded-xl transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
    }
