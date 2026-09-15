import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  RefreshCw, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  MapPin, 
  ShieldCheck, 
  Loader2, 
  Trash2, 
  PlusCircle, 
  Database,
  ChevronLeft,
  ChevronRight,
  X,
  Search,
  Hash,
  FileSpreadsheet,
  Info,
  ExternalLink,
  Globe,
  SlidersHorizontal,
  Star
} from 'lucide-react';
import { 
  googleBusinessApi, 
  BusinessLocation, 
  AccountStatus
} from '../services/googleBusinessApi';
import { scraperApi, ScrapedBusiness } from '../services/scraperApi';
import { exportScrapedBusinessesCsv } from '../utils';

export const GoogleBusinessView: React.FC = () => {
  const [locations, setLocations] = useState<BusinessLocation[]>([]);
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Pagination State for Locations table
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;

  // Add Record Modal control
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // Add Record Form state
  const [newBiz, setNewBiz] = useState({
    business_name: '',
    area: '',
    city: '',
    address: '',
    source: 'Manual Entry'
  });

  // Business Search State
  const [searchCount, setSearchCount] = useState<string>('');
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [searchLocation, setSearchLocation] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<ScrapedBusiness[]>([]);
  const [lastSearchExecuted, setLastSearchExecuted] = useState<boolean>(false);
  const [selectedBusiness, setSelectedBusiness] = useState<ScrapedBusiness | null>(null);
  
  // Selection state for results table export
  const [selectedResultIds, setSelectedResultIds] = useState<string[]>([]);

  // Statistics State
  const [totalSearches, setTotalSearches] = useState<number>(() => {
    const saved = localStorage.getItem('gb_total_searches');
    return saved ? parseInt(saved, 10) || 0 : 0;
  });
  const [businessesFound, setBusinessesFound] = useState<number>(0);
  const [csvExports, setCsvExports] = useState<number>(() => {
    const saved = localStorage.getItem('gb_csv_exports');
    return saved ? parseInt(saved, 10) || 0 : 0;
  });

  const fetchInitialData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statusRes, locsRes] = await Promise.all([
        googleBusinessApi.getStatus(),
        googleBusinessApi.getLocations()
      ]);
      setStatus(statusRes);
      setLocations(locsRes.locations);
    } catch (err: any) {
      console.error("Failed to load business records:", err);
      setError(err.message || 'Unable to connect to Google Business backend database.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const refreshCounts = async () => {
    try {
      const [statusRes, locsRes] = await Promise.all([
        googleBusinessApi.getStatus(),
        googleBusinessApi.getLocations()
      ]);
      setStatus(statusRes);
      setLocations(locsRes.locations);
    } catch (err) {
      console.error("Failed to refresh status:", err);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const result = await googleBusinessApi.syncBusinesses();
      setLocations(result.locations);
      setSuccessMsg(result.message || `Successfully synced ${result.synced_count} business locations from Google API.`);
      await refreshCounts();
    } catch (err: any) {
      console.error("Sync failed:", err);
      setError(err.message || "Failed to synchronize businesses with Google API.");
    } finally {
      setSyncing(false);
    }
  };

  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBiz.business_name.trim()) {
      setError("Business Name is required.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await googleBusinessApi.addLocation({
        business_name: newBiz.business_name.trim(),
        area: newBiz.area.trim() || '',
        city: newBiz.city.trim() || '',
        address: newBiz.address.trim() || undefined,
        source: newBiz.source || 'Manual Entry'
      });
      setSuccessMsg(`Business record '${newBiz.business_name}' saved successfully.`);
      setShowAddModal(false);
      setNewBiz({ business_name: '', area: '', city: '', address: '', source: 'Manual Entry' });
      await refreshCounts();
    } catch (err: any) {
      console.error("Failed to add location:", err);
      setError(err.message || "Failed to save new business record.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLocation = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete '${name}'?`)) {
      return;
    }

    setDeletingId(id);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await googleBusinessApi.deleteLocation(id);
      setSuccessMsg(res.message);
      await refreshCounts();
    } catch (err: any) {
      console.error("Delete failed:", err);
      setError(err.message || "Failed to delete record.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleExportCsv = async () => {
    setExporting(true);
    setError(null);
    try {
      await googleBusinessApi.triggerCsvDownload();
      const updatedExports = csvExports + 1;
      setCsvExports(updatedExports);
      localStorage.setItem('gb_csv_exports', String(updatedExports));
    } catch (err: any) {
      console.error("Export failed:", err);
      setError(err.message || "Failed to download CSV export file.");
    } finally {
      setExporting(false);
    }
  };

  const handleExportSearchCsv = async () => {
    if (searchResults.length === 0) {
      setError("No search results available to export.");
      return;
    }
    
    setExporting(true);
    setError(null);
    try {
      // Export either selected items or all search results from CURRENT search only
      const targets = selectedResultIds.length > 0 
        ? searchResults.filter(biz => selectedResultIds.includes(biz.id)) 
        : searchResults;
      
      const safeKeyword = searchKeyword.trim().replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const safeLocation = searchLocation.trim().replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const filename = `business_search_${safeKeyword || 'all'}_${safeLocation || 'all'}.csv`;

      exportScrapedBusinessesCsv(targets, filename);
      const updatedExports = csvExports + 1;
      setCsvExports(updatedExports);
      localStorage.setItem('gb_csv_exports', String(updatedExports));
      setSuccessMsg(`Export complete. Exported ${targets.length} current search businesses to CSV.`);
    } catch (err: any) {
      console.error("Search CSV export failed:", err);
      setError(err.message || "Failed to download search results CSV export file.");
    } finally {
      setExporting(false);
    }
  };

  const handleConnectOAuth = async () => {
    try {
      const res = await googleBusinessApi.getAuthUrl();
      if (res.url) {
        window.location.href = res.url;
      } else {
        setError(res.message || "Google OAuth is not configured on the backend.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to initialize Google OAuth connection.");
    }
  };

  // Business Search Submission Handler
  const handleBusinessSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchKeyword.trim()) {
      setError("Please enter a Business Category or Keyword.");
      return;
    }
    if (!searchLocation.trim()) {
      setError("Please enter an Area or Location.");
      return;
    }

    const requestedCount = parseInt(searchCount, 10) || 50;

    setIsSearching(true);
    setError(null);
    setSearchError(null);
    setSuccessMsg(null);
    setSearchResults([]);
    setSelectedResultIds([]);
    setBusinessesFound(0);

    try {
      const res = await scraperApi.searchBusinesses(searchKeyword.trim(), searchLocation.trim(), requestedCount);
      const bizList = res.businesses || [];
      setSearchResults(bizList);
      setLastSearchExecuted(true);
      const foundCount = res.total_returned !== undefined ? res.total_returned : bizList.length;
      setBusinessesFound(foundCount);

      // Increment Total Searches statistic
      const updatedSearches = totalSearches + 1;
      setTotalSearches(updatedSearches);
      localStorage.setItem('gb_total_searches', String(updatedSearches));

      if (foundCount > 0) {
        setSuccessMsg(`Search completed successfully. Found ${foundCount} matching businesses for '${searchKeyword.trim()}' in '${searchLocation.trim()}'.`);
      }
      await refreshCounts();
    } catch (err: any) {
      console.error("Business search error:", err);
      const msg = err.message || "Business search operation failed.";
      setError(msg);
      setSearchError(msg);
      setLastSearchExecuted(true);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Selection toggle helpers
  const allResultsSelected = searchResults.length > 0 && selectedResultIds.length === searchResults.length;
  const toggleSelectAllResults = () => {
    if (allResultsSelected) {
      setSelectedResultIds([]);
    } else {
      setSelectedResultIds(searchResults.map(b => b.id));
    }
  };

  const toggleSelectOneResult = (id: string) => {
    setSelectedResultIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const totalBusinesses = status ? status.total_locations : locations.length;
  const totalItems = locations.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedLocations = locations.slice(startIndex, startIndex + pageSize);

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8">
      {/* 1. Header Banner */}
      <div className="bg-white border border-[#DDE5DE] rounded-[16px] p-4 sm:p-6 md:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6 shadow-sm">
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2 text-[#6B8F71] font-heading font-semibold text-xs uppercase tracking-wider">
            <Building2 className="w-4 h-4 shrink-0" />
            Workspace
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-heading font-bold text-[#1D1E18] tracking-tight leading-tight">
            Google Business Profiles
          </h1>
          <p className="text-[#68736B] text-xs sm:text-sm max-w-xl">
            Synchronize, search and manage Google Business Profile locations and export collected data to Excel.
          </p>
        </div>

        {/* PROMINENT TOTAL BUSINESSES BADGE */}
        <div className="flex items-center gap-3 sm:gap-4 bg-[#F6F8F5] p-3.5 sm:p-5 rounded-[16px] border border-[#DDE5DE] w-full sm:w-auto shrink-0">
          <div className="p-2.5 sm:p-3 bg-[#EAF4EE] rounded-[10px] text-[#6B8F71] border border-[#AAD2BA] shrink-0">
            <Database className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <div className="text-[11px] font-heading font-bold text-[#68736B] uppercase tracking-wider">
              TOTAL BUSINESSES
            </div>
            <div className="text-2xl sm:text-3xl font-heading font-bold text-[#1D1E18] tracking-tight mt-0.5">
              {loading ? (
                <span className="text-[#68736B] animate-pulse">--</span>
              ) : (
                totalBusinesses
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. COMPACT OAUTH STATUS BADGE */}
      {status && (
        <div className={`p-4 rounded-[12px] border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all ${
          status.is_connected 
            ? 'bg-[#EAF4EE] border-[#AAD2BA] text-[#1D1E18]' 
            : 'bg-white border-[#DDE5DE] text-[#1D1E18]'
        }`}>
          <div className="flex items-center gap-3">
            {status.is_connected ? (
              <ShieldCheck className="w-5 h-5 text-[#2F7D4A] shrink-0" />
            ) : (
              <div className="w-3 h-3 rounded-full bg-[#68736B] shrink-0" />
            )}
            <div>
              <div className="font-heading font-bold text-xs uppercase tracking-wider text-[#68736B]">
                Google OAuth
              </div>
              <div className="text-sm font-heading font-semibold text-[#1D1E18] mt-0.5">
                {status.is_connected ? 'Connected' : 'Disconnected'}
              </div>
              <p className="text-xs text-[#68736B] mt-0.5">
                {status.is_connected 
                  ? status.email ? `Connected to ${status.email}` : 'Google OAuth credentials active.'
                  : 'Google OAuth credentials are not configured.'}
              </p>
            </div>
          </div>

          {!status.is_connected && status.auth_url_available && (
            <button
              onClick={handleConnectOAuth}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-heading font-semibold bg-[#6B8F71] hover:bg-[#597A5F] text-white rounded-[10px] transition-colors w-full sm:w-auto shrink-0 shadow-sm"
            >
              Connect Google OAuth
            </button>
          )}
        </div>
      )}

      {/* NOTIFICATIONS / FEEDBACK ALERTS */}
      {error && (
        <div className="p-4 bg-red-50 border border-[#C94A4A]/30 rounded-[12px] text-[#C94A4A] text-sm flex items-center gap-3 animate-fadeIn">
          <AlertTriangle className="w-5 h-5 text-[#C94A4A] shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-[#EAF4EE] border border-[#AAD2BA] rounded-[12px] text-[#2F7D4A] text-sm flex items-center gap-3 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-[#2F7D4A] shrink-0" />
          <span className="font-medium">{successMsg}</span>
        </div>
      )}

      {/* ================================================== */}
      {/* 3. BUSINESS SEARCH SECTION (CORE SEARCH EXPERIENCE) */}
      {/* ================================================== */}
      <div className="bg-white rounded-[16px] p-4 sm:p-6 md:p-8 space-y-6 border border-[#DDE5DE] shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#DDE5DE] pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-[#6B8F71] font-heading font-semibold text-xs uppercase tracking-wider">
              <SlidersHorizontal className="w-4 h-4" />
              Core Search Experience
            </div>
            <h2 className="text-xl sm:text-2xl font-heading font-bold text-[#1D1E18] tracking-tight flex items-center gap-2">
              <Search className="w-5 h-5 sm:w-6 sm:h-6 text-[#6B8F71]" />
              Business Search
            </h2>
            <p className="text-[#68736B] text-xs sm:text-sm">
              Discover nearby businesses based on category/keyword and area/location.
            </p>
          </div>
        </div>

        {/* Search Form — fully responsive: single column on mobile, 2-col on sm, 12-col grid on md+ */}
        <form onSubmit={handleBusinessSearch} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3 items-end">
            {/* 1. Total Count */}
            <div className="sm:col-span-1 md:col-span-2 space-y-1.5">
              <label className="block text-xs font-heading font-semibold text-[#1D1E18]">
                Total Count
              </label>
              <div className="relative">
                <Hash className="w-4 h-4 text-[#68736B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  min="1"
                  max="200"
                  value={searchCount}
                  onChange={(e) => setSearchCount(e.target.value)}
                  placeholder="e.g. 50"
                  className="w-full h-11 bg-white border border-[#DDE5DE] rounded-[10px] pl-10 pr-3 py-2 text-sm text-[#1D1E18] placeholder-[#68736B]/60 focus:outline-none focus:border-[#6B8F71] focus:ring-1 focus:ring-[#6B8F71] transition-all"
                />
              </div>
            </div>

            {/* 2. Business Category / Keyword */}
            <div className="sm:col-span-1 md:col-span-4 space-y-1.5">
              <label className="block text-xs font-heading font-semibold text-[#1D1E18]">
                Business Category / Keyword *
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-[#68736B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  placeholder="e.g. Restaurant, Bakery, Hospital"
                  className="w-full h-11 bg-white border border-[#DDE5DE] rounded-[10px] pl-10 pr-3 py-2 text-sm text-[#1D1E18] placeholder-[#68736B]/60 focus:outline-none focus:border-[#6B8F71] focus:ring-1 focus:ring-[#6B8F71] transition-all"
                />
              </div>
            </div>

            {/* 3. Area / Location */}
            <div className="sm:col-span-1 md:col-span-4 space-y-1.5">
              <label className="block text-xs font-heading font-semibold text-[#1D1E18]">
                Area / Location *
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-[#68736B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={searchLocation}
                  onChange={(e) => setSearchLocation(e.target.value)}
                  placeholder="e.g. Panruti, Chennai, Adyar"
                  className="w-full h-11 bg-white border border-[#DDE5DE] rounded-[10px] pl-10 pr-3 py-2 text-sm text-[#1D1E18] placeholder-[#68736B]/60 focus:outline-none focus:border-[#6B8F71] focus:ring-1 focus:ring-[#6B8F71] transition-all"
                />
              </div>
            </div>

            {/* 4. Search Businesses Button */}
            <div className="sm:col-span-2 md:col-span-2">
              <button
                type="submit"
                disabled={isSearching}
                className={`w-full h-11 inline-flex items-center justify-center gap-2 px-4 rounded-[10px] text-xs font-heading font-bold text-white transition-all shadow-sm ${
                  isSearching
                    ? 'bg-[#6B8F71]/60 cursor-not-allowed'
                    : 'bg-[#6B8F71] hover:bg-[#597A5F] active:bg-[#4E6B52]'
                }`}
              >
                {isSearching ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Searching...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 text-white" />
                    <span>Search</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Statistics Cards (Total Searches | Businesses Found | CSV Exports) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 pt-2">
          <div className="bg-[#F6F8F5] rounded-[14px] sm:rounded-[16px] p-3.5 sm:p-4 border border-[#DDE5DE] flex items-center gap-3.5 sm:gap-4">
            <div className="p-3 bg-white rounded-[10px] text-[#6B8F71] border border-[#DDE5DE] shadow-sm shrink-0">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-heading font-bold uppercase tracking-wider text-[#68736B]">Total Searches</div>
              <div className="text-2xl font-heading font-bold text-[#1D1E18] mt-0.5">{totalSearches}</div>
            </div>
          </div>

          <div className="bg-[#F6F8F5] rounded-[14px] sm:rounded-[16px] p-3.5 sm:p-4 border border-[#DDE5DE] flex items-center gap-3.5 sm:gap-4">
            <div className="p-3 bg-white rounded-[10px] text-[#2F7D4A] border border-[#DDE5DE] shadow-sm shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-heading font-bold uppercase tracking-wider text-[#68736B]">Businesses Found</div>
              <div className="text-2xl font-heading font-bold text-[#1D1E18] mt-0.5">{businessesFound}</div>
            </div>
          </div>

          <div className="bg-[#F6F8F5] rounded-[14px] sm:rounded-[16px] p-3.5 sm:p-4 border border-[#DDE5DE] flex items-center gap-3.5 sm:gap-4">
            <div className="p-3 bg-white rounded-[10px] text-[#6B8F71] border border-[#DDE5DE] shadow-sm shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-heading font-bold uppercase tracking-wider text-[#68736B]">CSV Exports</div>
              <div className="text-2xl font-heading font-bold text-[#1D1E18] mt-0.5">{csvExports}</div>
            </div>
          </div>
        </div>

        {/* Search Results Display Section */}
        {isSearching ? (
          <div className="p-8 sm:p-10 text-center text-[#68736B] space-y-3 bg-[#F6F8F5] rounded-[16px] border border-[#DDE5DE]">
            <Loader2 className="w-8 h-8 animate-spin text-[#6B8F71] mx-auto" />
            <p className="text-sm font-heading font-semibold text-[#1D1E18]">Searching nearby businesses...</p>
            <p className="text-xs text-[#68736B]">Querying live Google Maps results for "{searchKeyword}" in "{searchLocation}"</p>
          </div>
        ) : searchError ? (
          <div className="p-6 sm:p-8 text-center space-y-2 bg-red-50 rounded-[16px] border border-[#C94A4A]/30">
            <AlertTriangle className="w-6 h-6 text-[#C94A4A] mx-auto mb-1" />
            <p className="text-sm font-heading font-semibold text-[#C94A4A]">Search Operation Failed</p>
            <p className="text-xs text-[#68736B] max-w-md mx-auto">{searchError}</p>
          </div>
        ) : searchResults.length > 0 ? (
          <div className="space-y-4 pt-4 border-t border-[#DDE5DE]">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <h3 className="text-base font-heading font-bold text-[#1D1E18]">Search Results</h3>
                <span className="px-3 py-1 text-xs font-semibold bg-[#EAF4EE] text-[#2F7D4A] border border-[#AAD2BA] rounded-full">
                  {searchResults.length} businesses found
                </span>
                {selectedResultIds.length > 0 && (
                  <span className="text-xs text-[#68736B] font-medium">
                    ({selectedResultIds.length} selected)
                  </span>
                )}
              </div>
              <button
                onClick={handleExportSearchCsv}
                disabled={exporting}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-[10px] text-xs font-heading font-semibold bg-[#6B8F71] hover:bg-[#597A5F] active:bg-[#4E6B52] text-white transition-colors shadow-sm"
              >
                {exporting ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <FileSpreadsheet className="w-4 h-4 text-white" />
                )}
                <span>
                  {selectedResultIds.length > 0 
                    ? `Export Selected (${selectedResultIds.length}) CSV` 
                    : 'Export Search CSV'}
                </span>
              </button>
            </div>

            {/* Results Table — professionally styled with fixed column widths and truncation */}
            <div className="table-responsive rounded-[12px] border border-[#DDE5DE] bg-white shadow-sm overflow-x-auto">
              <table className="w-full table-fixed min-w-[980px] text-left text-xs text-[#1D1E18]">
                <colgroup>
                  <col className="w-[50px]" />
                  <col className="w-[200px]" />
                  <col className="w-[120px]" />
                  <col className="w-[120px]" />
                  <col className="w-[160px]" />
                  <col className="w-[90px]" />
                  <col className="w-[80px]" />
                  <col className="w-[130px]" />
                  <col className="w-[90px]" />
                </colgroup>
                <thead className="sticky top-0 bg-[#F6F8F5] uppercase tracking-wider text-[#68736B] border-b border-[#DDE5DE] font-heading font-bold z-10">
                  <tr>
                    <th className="px-3 py-3.5 text-center whitespace-nowrap">
                      <input 
                        type="checkbox" 
                        checked={allResultsSelected}
                        onChange={toggleSelectAllResults}
                        className="w-4 h-4 rounded text-[#6B8F71] focus:ring-[#6B8F71] border-[#DDE5DE] cursor-pointer"
                        title="Select All"
                      />
                    </th>
                    <th className="px-4 py-3.5 whitespace-nowrap overflow-hidden text-ellipsis">BUSINESS NAME</th>
                    <th className="px-4 py-3.5 whitespace-nowrap overflow-hidden text-ellipsis">AREA</th>
                    <th className="px-4 py-3.5 whitespace-nowrap overflow-hidden text-ellipsis">CITY</th>
                    <th className="px-4 py-3.5 whitespace-nowrap overflow-hidden text-ellipsis">CATEGORY</th>
                    <th className="px-4 py-3.5 whitespace-nowrap overflow-hidden text-ellipsis">RATING</th>
                    <th className="px-4 py-3.5 whitespace-nowrap overflow-hidden text-ellipsis">REVIEWS</th>
                    <th className="px-4 py-3.5 whitespace-nowrap overflow-hidden text-ellipsis">PHONE</th>
                    <th className="px-4 py-3.5 text-right whitespace-nowrap">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DDE5DE]">
                  {searchResults.map((biz) => {
                    const isSelected = selectedResultIds.includes(biz.id);
                    return (
                      <tr 
                        key={biz.id} 
                        className={`hover:bg-[#F6F8F5]/80 transition-colors ${isSelected ? 'bg-[#EAF4EE]/50' : ''}`}
                      >
                        <td className="px-3 py-3.5 text-center whitespace-nowrap">
                          <input 
                            type="checkbox" 
                            checked={isSelected}
                            onChange={() => toggleSelectOneResult(biz.id)}
                            className="w-4 h-4 rounded text-[#6B8F71] focus:ring-[#6B8F71] border-[#DDE5DE] cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3.5 font-bold text-[#1D1E18] truncate whitespace-nowrap" title={biz.business_name}>
                          {biz.business_name || 'Not available'}
                        </td>
                        <td className="px-4 py-3.5 text-[#1D1E18] truncate whitespace-nowrap" title={biz.area || 'Not available'}>
                          {biz.area || 'Not available'}
                        </td>
                        <td className="px-4 py-3.5 text-[#1D1E18] truncate whitespace-nowrap" title={biz.city || 'Not available'}>
                          {biz.city || 'Not available'}
                        </td>
                        <td className="px-4 py-3.5 truncate whitespace-nowrap" title={biz.primary_category || 'Not available'}>
                          <span className="inline-block max-w-full truncate text-[#68736B] bg-[#F6F8F5] px-2 py-0.5 rounded-[6px] border border-[#DDE5DE] text-[11px]">
                            {biz.primary_category || 'Not available'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-[#B7791F] font-semibold whitespace-nowrap">
                          {biz.rating ? (
                            <span className="inline-flex items-center gap-1">
                              <Star className="w-3.5 h-3.5 fill-[#B7791F] text-[#B7791F] shrink-0" />
                              <span>{biz.rating}</span>
                            </span>
                          ) : (
                            <span className="text-[#68736B]">Not available</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-[#68736B] whitespace-nowrap">
                          {biz.review_count != null && biz.review_count !== '' ? `${biz.review_count}` : 'Not available'}
                        </td>
                        <td className="px-4 py-3.5 text-[#1D1E18] font-mono text-[11px] truncate whitespace-nowrap" title={biz.phone || 'Not available'}>
                          {biz.phone || 'Not available'}
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <button
                            onClick={() => setSelectedBusiness(biz)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-white hover:bg-[#F6F8F5] text-[#1D1E18] border border-[#DDE5DE] transition-colors shadow-2xs text-xs font-medium"
                          >
                            <Info className="w-3.5 h-3.5 text-[#6B8F71] shrink-0" />
                            <span>Details</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : lastSearchExecuted ? (
          <div className="p-8 text-center text-[#68736B] space-y-2 bg-[#F6F8F5] rounded-[16px] border border-[#DDE5DE]">
            <AlertTriangle className="w-6 h-6 text-[#B7791F] mx-auto mb-1" />
            <p className="text-sm font-heading font-semibold text-[#1D1E18]">No businesses found</p>
            <p className="text-xs text-[#68736B]">
              No business results were found matching "{searchKeyword}" in "{searchLocation}".
            </p>
          </div>
        ) : null}
      </div>

      {/* 4. LOCATIONS ACTION CONTROLS AREA */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 bg-white p-3.5 sm:p-4 rounded-[12px] border border-[#DDE5DE] shadow-sm">
        <div className="flex flex-wrap items-center justify-between sm:justify-start gap-2 sm:gap-3">
          <div className="text-sm font-heading font-semibold text-[#1D1E18]">
            Saved Locations ({locations.length})
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-xs font-heading font-semibold bg-white hover:bg-[#F6F8F5] text-[#1D1E18] border border-[#DDE5DE] transition-colors shadow-2xs"
          >
            <PlusCircle className="w-3.5 h-3.5 text-[#6B8F71]" />
            Add Location
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          <button
            onClick={handleSync}
            disabled={syncing || loading}
            className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-[10px] text-xs font-heading font-semibold transition-all shadow-sm ${
              syncing || loading 
                ? 'bg-[#68736B]/40 text-white cursor-not-allowed' 
                : 'bg-[#6B8F71] hover:bg-[#597A5F] active:bg-[#4E6B52] text-white'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Businesses'}
          </button>

          <button
            onClick={handleExportCsv}
            disabled={exporting || loading || locations.length === 0}
            className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-[10px] text-xs font-heading font-semibold border transition-all ${
              exporting || loading || locations.length === 0
                ? 'bg-[#F6F8F5] border-[#DDE5DE] text-[#68736B]/50 cursor-not-allowed'
                : 'bg-white hover:bg-[#F6F8F5] text-[#1D1E18] border-[#DDE5DE] shadow-2xs'
            }`}
          >
            {exporting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#6B8F71]" />
            ) : (
              <Download className="w-3.5 h-3.5 text-[#6B8F71]" />
            )}
            {exporting ? 'Exporting...' : 'Export Saved CSV'}
          </button>
        </div>
      </div>

      {/* 5. EXISTING LOCATIONS DATA TABLE */}
      <div className="bg-white rounded-[16px] overflow-hidden border border-[#DDE5DE] shadow-sm p-4 sm:p-6 space-y-4">
        {loading ? (
          <div className="p-8 sm:p-12 text-center text-[#68736B] space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-[#6B8F71] mx-auto" />
            <p className="text-sm font-heading font-medium text-[#1D1E18]">Loading Google Business Profile locations...</p>
          </div>
        ) : locations.length === 0 ? (
          <div className="p-8 sm:p-12 text-center space-y-2">
            <Building2 className="w-12 h-12 text-[#68736B]/40 mx-auto stroke-1" />
            <h4 className="text-base font-heading font-semibold text-[#1D1E18]">No Google Business Profile locations found</h4>
            <p className="text-[#68736B] text-sm">
              Click <strong className="text-[#6B8F71]">Sync Businesses</strong> to retrieve locations from Google API.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="table-responsive rounded-[12px] border border-[#DDE5DE]">
              <table className="w-full min-w-[420px] text-left text-xs sm:text-sm text-[#1D1E18]">
                <thead className="bg-[#F6F8F5] text-xs uppercase tracking-wider text-[#68736B] border-b border-[#DDE5DE] font-heading font-bold">
                  <tr>
                    <th scope="col" className="px-4 sm:px-6 py-3.5 font-heading font-bold text-[#1D1E18]">BUSINESS NAME</th>
                    <th scope="col" className="px-4 sm:px-6 py-3.5 font-heading font-bold text-[#1D1E18]">AREA</th>
                    <th scope="col" className="px-4 sm:px-6 py-3.5 font-heading font-bold text-[#1D1E18]">CITY</th>
                    <th scope="col" className="px-4 sm:px-6 py-3.5 font-heading font-bold text-[#1D1E18] text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DDE5DE] bg-white">
                  {paginatedLocations.map((loc) => (
                    <tr 
                      key={loc.id}
                      className="hover:bg-[#F6F8F5]/60 transition-colors"
                    >
                      <td className="px-4 sm:px-6 py-3.5 sm:py-4 font-bold text-[#1D1E18] break-words">
                        {loc.business_name}
                      </td>
                      <td className="px-4 sm:px-6 py-3.5 sm:py-4 text-[#1D1E18]">
                        {loc.area || ''}
                      </td>
                      <td className="px-4 sm:px-6 py-3.5 sm:py-4 text-[#1D1E18]">
                        {loc.city || ''}
                      </td>
                      <td className="px-4 sm:px-6 py-3.5 sm:py-4 text-right">
                        <button
                          onClick={() => handleDeleteLocation(loc.id, loc.business_name)}
                          disabled={deletingId === loc.id}
                          className="p-1.5 text-[#68736B] hover:text-[#C94A4A] hover:bg-red-50 rounded-[8px] transition-colors"
                          title="Delete location record"
                        >
                          {deletingId === loc.id ? (
                            <Loader2 className="w-4 h-4 animate-spin text-[#C94A4A]" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* PAGINATION CONTROLS */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2 py-2 text-xs text-[#68736B]">
                <div className="text-center sm:text-left">
                  Showing {startIndex + 1} to {Math.min(startIndex + pageSize, totalItems)} of {totalItems} results
                </div>
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className={`p-1.5 rounded-[8px] border transition-colors ${
                      currentPage === 1
                        ? 'border-[#DDE5DE] text-[#68736B]/40 cursor-not-allowed'
                        : 'border-[#DDE5DE] bg-white text-[#1D1E18] hover:bg-[#F6F8F5]'
                    }`}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-1 rounded-[8px] text-xs font-heading font-semibold transition-colors ${
                        currentPage === page
                          ? 'bg-[#6B8F71] text-white shadow-sm'
                          : 'bg-white text-[#1D1E18] hover:bg-[#F6F8F5] border border-[#DDE5DE]'
                      }`}
                    >
                      {page}
                    </button>
                  ))}

                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className={`p-1.5 rounded-[8px] border transition-colors ${
                      currentPage === totalPages
                        ? 'border-[#DDE5DE] text-[#68736B]/40 cursor-not-allowed'
                        : 'border-[#DDE5DE] bg-white text-[#1D1E18] hover:bg-[#F6F8F5]'
                    }`}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ADD LOCATION MODAL (20px radius) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-[#1D1E18]/40 backdrop-blur-xs flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="modal-safe bg-white border border-[#DDE5DE] rounded-[20px] w-full max-w-md p-4 sm:p-6 space-y-4 shadow-2xl animate-fadeIn my-4 sm:my-auto">
            <div className="flex items-center justify-between border-b border-[#DDE5DE] pb-3">
              <h3 className="text-base font-heading font-bold text-[#1D1E18] flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-[#6B8F71]" />
                Add Business Profile Location
              </h3>
              <button 
                onClick={() => setShowAddModal(false)} 
                className="text-[#68736B] hover:text-[#1D1E18] p-1 rounded-[6px]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddLocation} className="space-y-3">
              <div>
                <label className="block text-xs font-heading font-semibold text-[#1D1E18] mb-1">Business Name *</label>
                <input
                  type="text"
                  required
                  value={newBiz.business_name}
                  onChange={(e) => setNewBiz({ ...newBiz, business_name: e.target.value })}
                  placeholder="e.g. KFC Velachery"
                  className="w-full h-11 bg-white border border-[#DDE5DE] rounded-[10px] px-3 text-sm text-[#1D1E18] placeholder-[#68736B]/60 focus:outline-none focus:border-[#6B8F71] focus:ring-1 focus:ring-[#6B8F71]"
                />
              </div>

              <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-heading font-semibold text-[#1D1E18] mb-1">Area</label>
                  <input
                    type="text"
                    value={newBiz.area}
                    onChange={(e) => setNewBiz({ ...newBiz, area: e.target.value })}
                    placeholder="e.g. Velachery"
                    className="w-full h-11 bg-white border border-[#DDE5DE] rounded-[10px] px-3 text-sm text-[#1D1E18] placeholder-[#68736B]/60 focus:outline-none focus:border-[#6B8F71] focus:ring-1 focus:ring-[#6B8F71]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-heading font-semibold text-[#1D1E18] mb-1">City</label>
                  <input
                    type="text"
                    value={newBiz.city}
                    onChange={(e) => setNewBiz({ ...newBiz, city: e.target.value })}
                    placeholder="e.g. Chennai"
                    className="w-full h-11 bg-white border border-[#DDE5DE] rounded-[10px] px-3 text-sm text-[#1D1E18] placeholder-[#68736B]/60 focus:outline-none focus:border-[#6B8F71] focus:ring-1 focus:ring-[#6B8F71]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-heading font-semibold text-[#1D1E18] mb-1">Address</label>
                <input
                  type="text"
                  value={newBiz.address}
                  onChange={(e) => setNewBiz({ ...newBiz, address: e.target.value })}
                  placeholder="e.g. 100 Feet Rd, Velachery"
                  className="w-full h-11 bg-white border border-[#DDE5DE] rounded-[10px] px-3 text-sm text-[#1D1E18] placeholder-[#68736B]/60 focus:outline-none focus:border-[#6B8F71] focus:ring-1 focus:ring-[#6B8F71]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-heading font-semibold text-[#68736B] hover:text-[#1D1E18]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-heading font-semibold bg-[#6B8F71] hover:bg-[#597A5F] text-white rounded-[10px] transition-colors shadow-sm"
                >
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FULL 58-FIELD BUSINESS DETAILS MODAL (20px radius) */}
      {selectedBusiness && (
        <div className="fixed inset-0 z-50 bg-[#1D1E18]/50 backdrop-blur-xs flex items-start justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="modal-safe bg-white border border-[#DDE5DE] rounded-[20px] w-full max-w-4xl p-4 sm:p-6 md:p-8 space-y-5 sm:space-y-6 shadow-2xl my-4 sm:my-8">
            <div className="flex items-start justify-between border-b border-[#DDE5DE] pb-4 gap-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-heading font-semibold text-[#6B8F71] uppercase tracking-wider mb-1">
                  <span>{selectedBusiness.source_type || 'Google Business'}</span>
                  {selectedBusiness.enrichment_status && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] bg-[#EAF4EE] text-[#2F7D4A] border border-[#AAD2BA]">
                      {selectedBusiness.enrichment_status}
                    </span>
                  )}
                </div>
                <h2 className="text-lg sm:text-xl md:text-2xl font-heading font-bold text-[#1D1E18] tracking-tight break-words">
                  {selectedBusiness.business_name}
                </h2>
                {selectedBusiness.alternate_name && (
                  <p className="text-xs text-[#68736B] mt-0.5">Alt: {selectedBusiness.alternate_name}</p>
                )}
              </div>
              <button
                onClick={() => setSelectedBusiness(null)}
                className="p-2 text-[#68736B] hover:text-[#1D1E18] rounded-[8px] bg-[#F6F8F5] hover:bg-[#DDE5DE]/50 transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Core Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-[#F6F8F5] p-3.5 sm:p-4 rounded-[12px] border border-[#DDE5DE]">
                <div className="text-[10px] font-heading font-bold text-[#68736B] uppercase tracking-wider mb-1">Category</div>
                <div className="text-sm font-semibold text-[#1D1E18]">{selectedBusiness.primary_category || 'N/A'}</div>
              </div>
              <div className="bg-[#F6F8F5] p-3.5 sm:p-4 rounded-[12px] border border-[#DDE5DE]">
                <div className="text-[10px] font-heading font-bold text-[#68736B] uppercase tracking-wider mb-1">Rating & Reviews</div>
                <div className="text-sm font-semibold text-[#B7791F] flex items-center gap-1.5">
                  {selectedBusiness.rating ? (
                    <>
                      <Star className="w-4 h-4 fill-[#B7791F] text-[#B7791F]" />
                      <span>{selectedBusiness.rating}</span>
                    </>
                  ) : 'N/A'}
                  {selectedBusiness.review_count && (
                    <span className="text-xs text-[#68736B] font-normal">({selectedBusiness.review_count} reviews)</span>
                  )}
                </div>
              </div>
              <div className="bg-[#F6F8F5] p-3.5 sm:p-4 rounded-[12px] border border-[#DDE5DE]">
                <div className="text-[10px] font-heading font-bold text-[#68736B] uppercase tracking-wider mb-1">Primary Phone</div>
                <div className="text-sm font-semibold text-[#1D1E18] font-mono">{selectedBusiness.phone || 'N/A'}</div>
              </div>
              <div className="bg-[#F6F8F5] p-3.5 sm:p-4 rounded-[12px] border border-[#DDE5DE]">
                <div className="text-[10px] font-heading font-bold text-[#68736B] uppercase tracking-wider mb-1">Landline Phone</div>
                <div className="text-sm font-semibold text-[#6B8F71] font-mono">{selectedBusiness.phone_landline || 'N/A'}</div>
              </div>
            </div>

            {/* About & Description */}
            {(selectedBusiness.about_us || selectedBusiness.description) && (
              <div className="bg-[#F6F8F5] p-3.5 sm:p-4 rounded-[12px] border border-[#DDE5DE] space-y-1.5">
                <div className="text-xs font-heading font-bold text-[#6B8F71] uppercase tracking-wider flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5" />
                  About / Description
                </div>
                <p className="text-xs sm:text-sm text-[#1D1E18] leading-relaxed whitespace-pre-line">
                  {selectedBusiness.about_us || selectedBusiness.description}
                </p>
              </div>
            )}

            {/* Location & Address Breakdown */}
            <div className="space-y-3">
              <h4 className="text-xs font-heading font-bold text-[#68736B] uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#6B8F71]" />
                Address & Geographic Coordinates
              </h4>
              <div className="bg-[#F6F8F5] p-3.5 sm:p-4 rounded-[12px] border border-[#DDE5DE] space-y-3">
                <div>
                  <div className="text-[10px] font-heading font-bold text-[#68736B] uppercase tracking-wider mb-0.5">Full Address</div>
                  <div className="text-sm font-medium text-[#1D1E18] break-words">{selectedBusiness.address || 'N/A'}</div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs pt-2 border-t border-[#DDE5DE]">
                  <div>
                    <span className="text-[#68736B] block text-[10px] uppercase font-bold">Area / Locality</span>
                    <span className="text-[#1D1E18] font-semibold">{selectedBusiness.area || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[#68736B] block text-[10px] uppercase font-bold">City</span>
                    <span className="text-[#1D1E18] font-semibold">{selectedBusiness.city || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[#68736B] block text-[10px] uppercase font-bold">State</span>
                    <span className="text-[#1D1E18] font-semibold">{selectedBusiness.state || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[#68736B] block text-[10px] uppercase font-bold">Postal Code</span>
                    <span className="text-[#1D1E18] font-semibold">{selectedBusiness.postal_code || 'N/A'}</span>
                  </div>
                </div>

                {(selectedBusiness.latitude || selectedBusiness.longitude) && (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs pt-2 border-t border-[#DDE5DE] font-mono text-[#68736B]">
                    <span>Latitude: {selectedBusiness.latitude || 'N/A'}</span>
                    <span>Longitude: {selectedBusiness.longitude || 'N/A'}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Links & Website */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              {selectedBusiness.website && (
                <a
                  href={selectedBusiness.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] text-xs font-heading font-semibold bg-[#6B8F71] hover:bg-[#597A5F] text-white transition-colors shadow-sm"
                >
                  <Globe className="w-3.5 h-3.5" />
                  Visit Website
                </a>
              )}
              {selectedBusiness.google_maps_url && (
                <a
                  href={selectedBusiness.google_maps_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] text-xs font-heading font-semibold bg-white hover:bg-[#F6F8F5] text-[#1D1E18] border border-[#DDE5DE] transition-colors shadow-2xs"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-[#6B8F71]" />
                  Open in Google Maps
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GoogleBusinessView;
