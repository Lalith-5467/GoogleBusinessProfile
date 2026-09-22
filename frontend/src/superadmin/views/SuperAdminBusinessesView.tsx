import React, { useState, useEffect } from 'react';
import {
  Building2,
  Search,
  Filter,
  Trash2,
  ExternalLink,
  MapPin,
  Phone,
  Globe,
  Tag,
  Star,
  RefreshCw,
  AlertCircle,
  Eye,
  CheckCircle2
} from 'lucide-react';
import { UnifiedBusinessItem } from '../types';
import { superAdminApi } from '../services/superAdminApi';
import { useSuperAdminAuth } from '../context/SuperAdminAuthContext';

export function SuperAdminBusinessesView() {
  const { isOriginalSuperAdmin } = useSuperAdminAuth();
  const [businesses, setBusinesses] = useState<UnifiedBusinessItem[]>([]);
  const [total, setTotal] = useState(0);
  const [googleCount, setGoogleCount] = useState(0);
  const [scrapedCount, setScrapedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Selected for details / delete
  const [selectedBusiness, setSelectedBusiness] = useState<UnifiedBusinessItem | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchBusinesses = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await superAdminApi.listUnifiedBusinesses({
        search: search || undefined,
        source: sourceFilter || undefined,
        city: cityFilter || undefined,
        category: categoryFilter || undefined,
      });
      setBusinesses(data.businesses);
      setTotal(data.total);
      setGoogleCount(data.google_count);
      setScrapedCount(data.scraped_count);
    } catch (err: any) {
      setError(err.message || 'Failed to load business records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBusinesses();
  }, [sourceFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchBusinesses();
  };

  const handleDeleteSubmit = async () => {
    if (!selectedBusiness) return;
    setDeleteLoading(true);
    setError(null);
    try {
      if (selectedBusiness.source_type === 'GOOGLE_LOCATION') {
        await superAdminApi.deleteGoogleLocation(selectedBusiness.id);
      } else {
        await superAdminApi.deleteScrapedBusiness(selectedBusiness.id);
      }
      setShowDeleteModal(false);
      fetchBusinesses();
    } catch (err: any) {
      setError(err.message || 'Failed to delete business record.');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Metric Summary */}
      <div className="bg-white border border-[#DDE5DE] rounded-[16px] p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-lg sm:text-xl font-bold font-heading text-[#1D1E18] flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#6B8F71]" />
              Unified Business Data Management
            </h1>
            <p className="text-xs text-[#68736B] mt-0.5">
              Consolidated view of all Google Business locations and Playwright scraped records in MySQL
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-[#EEF4F0] border border-[#AAD2BA] text-xs font-semibold text-[#2F7D4A]">
              Google: {googleCount}
            </span>
            <span className="px-3 py-1 rounded-full bg-[#F6F8F5] border border-[#DDE5DE] text-xs font-semibold text-[#1D1E18]">
              Scraped: {scrapedCount}
            </span>
            <span className="px-3 py-1 rounded-full bg-white border border-[#DDE5DE] text-xs font-bold text-[#1D1E18]">
              Total: {total}
            </span>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-[#C94A4A]/20 rounded-lg text-xs text-[#C94A4A] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Filter Toolbar */}
        <div className="flex flex-col md:flex-row gap-3 pt-2 border-t border-[#F6F8F5]">
          <form onSubmit={handleSearchSubmit} className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#68736B]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by business name, address, or city..."
              className="w-full pl-9 pr-20 py-2 text-xs rounded-[10px] border border-[#DDE5DE] bg-[#F6F8F5] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6B8F71]"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 text-[11px] font-semibold bg-white border border-[#DDE5DE] rounded-md hover:bg-[#EEF4F0] text-[#1D1E18]"
            >
              Search
            </button>
          </form>

          <div className="flex items-center gap-2">
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-[10px] border border-[#DDE5DE] bg-[#F6F8F5] text-[#1D1E18] focus:bg-white focus:outline-none"
            >
              <option value="">All Sources</option>
              <option value="google">Google Locations</option>
              <option value="scraped">Web Scraped</option>
            </select>

            <button
              onClick={fetchBusinesses}
              className="p-2 rounded-[10px] border border-[#DDE5DE] bg-[#F6F8F5] hover:bg-white text-[#68736B]"
              title="Refresh businesses"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Business Records Table */}
      <div className="bg-white border border-[#DDE5DE] rounded-[16px] shadow-sm overflow-hidden">
        <div className="table-responsive">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F6F8F5] border-b border-[#DDE5DE] text-[#68736B] font-heading font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Business</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Source</th>
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4">Rating</th>
                <th className="py-3 px-4">Phone / Contact</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DDE5DE]/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#68736B]">
                    <div className="w-6 h-6 border-2 border-[#6B8F71] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading businesses...
                  </td>
                </tr>
              ) : businesses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#68736B]">
                    No business records found matching the query.
                  </td>
                </tr>
              ) : (
                businesses.map((b) => (
                  <tr key={`${b.source_type}-${b.id}`} className="hover:bg-[#F6F8F5]/60 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-[#1D1E18]">{b.business_name}</div>
                      {b.website && (
                        <a
                          href={b.website.startsWith('http') ? b.website : `https://${b.website}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-[#6B8F71] hover:underline inline-flex items-center gap-1 font-mono truncate max-w-[200px]"
                        >
                          <Globe className="w-3 h-3 shrink-0" />
                          <span className="truncate">{b.website}</span>
                        </a>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#F6F8F5] text-[#1D1E18] border border-[#DDE5DE]">
                        <Tag className="w-2.5 h-2.5 text-[#68736B]" />
                        {b.primary_category || 'General'}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase ${
                          b.source_type === 'GOOGLE_LOCATION'
                            ? 'bg-[#EAF4EE] text-[#2F7D4A] border border-[#AAD2BA]'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {b.source_type === 'GOOGLE_LOCATION' ? 'Google API' : 'Web Scrape'}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1 text-[#1D1E18]">
                        <MapPin className="w-3 h-3 text-[#68736B] shrink-0" />
                        <span className="truncate max-w-[160px]">{b.city || b.address || 'N/A'}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      {b.rating ? (
                        <div className="flex items-center gap-1">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          <span className="font-semibold text-[#1D1E18]">{b.rating}</span>
                          {b.review_count && (
                            <span className="text-[10px] text-[#68736B]">({b.review_count})</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] text-[#68736B]">N/A</span>
                      )}
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] text-[#68736B]">
                      {b.phone || '—'}
                    </td>

                    <td className="py-3 px-4 text-right space-x-1">
                      <button
                        onClick={() => {
                          setSelectedBusiness(b);
                          setShowDetailModal(true);
                        }}
                        className="p-1.5 text-[#68736B] hover:text-[#1D1E18] hover:bg-white rounded border border-transparent hover:border-[#DDE5DE]"
                        title="View Full Details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => {
                          setSelectedBusiness(b);
                          setShowDeleteModal(true);
                        }}
                        className="p-1.5 text-[#C94A4A] hover:bg-red-50 rounded"
                        title="Delete Record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- Modal: Business Details --- */}
      {showDetailModal && selectedBusiness && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-[#DDE5DE] rounded-[20px] shadow-xl w-full max-w-lg p-6 modal-safe animate-toast-in">
            <div className="flex items-center justify-between pb-3 border-b border-[#DDE5DE] mb-4">
              <h2 className="text-base font-bold font-heading text-[#1D1E18]">
                {selectedBusiness.business_name}
              </h2>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase ${
                  selectedBusiness.source_type === 'GOOGLE_LOCATION'
                    ? 'bg-[#EAF4EE] text-[#2F7D4A]'
                    : 'bg-amber-50 text-amber-800'
                }`}
              >
                {selectedBusiness.source_type.replace('_', ' ')}
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="font-semibold text-[#68736B] block mb-0.5">Primary Category:</span>
                <span className="text-[#1D1E18]">{selectedBusiness.primary_category || 'N/A'}</span>
              </div>

              <div>
                <span className="font-semibold text-[#68736B] block mb-0.5">Full Address:</span>
                <span className="text-[#1D1E18]">{selectedBusiness.address || 'N/A'}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="font-semibold text-[#68736B] block mb-0.5">City / State:</span>
                  <span className="text-[#1D1E18]">{selectedBusiness.city || 'N/A'}{selectedBusiness.state ? `, ${selectedBusiness.state}` : ''}</span>
                </div>
                <div>
                  <span className="font-semibold text-[#68736B] block mb-0.5">Phone Number:</span>
                  <span className="text-[#1D1E18] font-mono">{selectedBusiness.phone || 'N/A'}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="font-semibold text-[#68736B] block mb-0.5">Rating & Reviews:</span>
                  <span className="text-[#1D1E18]">{selectedBusiness.rating ? `${selectedBusiness.rating} / 5 (${selectedBusiness.review_count || 0} reviews)` : 'N/A'}</span>
                </div>
                <div>
                  <span className="font-semibold text-[#68736B] block mb-0.5">Status:</span>
                  <span className="text-[#2F7D4A] font-semibold">{selectedBusiness.status}</span>
                </div>
              </div>

              {selectedBusiness.website && (
                <div>
                  <span className="font-semibold text-[#68736B] block mb-0.5">Website:</span>
                  <a
                    href={selectedBusiness.website.startsWith('http') ? selectedBusiness.website : `https://${selectedBusiness.website}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#6B8F71] hover:underline break-all"
                  >
                    {selectedBusiness.website}
                  </a>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4 border-t border-[#DDE5DE] mt-5">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 rounded-[10px] bg-[#6B8F71] text-white text-xs font-semibold hover:bg-[#597A5F]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Modal: Confirm Delete Business --- */}
      {showDeleteModal && selectedBusiness && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-[#DDE5DE] rounded-[20px] shadow-xl w-full max-w-sm p-6 modal-safe animate-toast-in">
            <div className="w-10 h-10 rounded-full bg-red-100 text-[#C94A4A] flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold font-heading text-center text-[#1D1E18] mb-1">
              Delete Business Record?
            </h2>
            <p className="text-xs text-[#68736B] text-center mb-5">
              Are you sure you want to delete <span className="font-bold text-[#1D1E18]">{selectedBusiness.business_name}</span> from MySQL? This action will be logged in the audit trail.
            </p>

            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-2 px-3 rounded-[10px] border border-[#DDE5DE] text-xs font-semibold text-[#68736B] hover:bg-[#F6F8F5]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSubmit}
                disabled={deleteLoading}
                className="flex-1 py-2 px-3 rounded-[10px] bg-[#C94A4A] hover:bg-red-700 text-white text-xs font-semibold shadow-sm disabled:opacity-50"
              >
                {deleteLoading ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
