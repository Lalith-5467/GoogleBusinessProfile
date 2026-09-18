import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  CheckCircle2, 
  AlertTriangle, 
  MapPin, 
  Loader2, 
  PlusCircle, 
  Database,
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
import { useToast } from '../context';

export const GoogleBusinessView: React.FC = () => {
  const [locations, setLocations] = useState<BusinessLocation[]>([]);
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [exporting, setExporting] = useState<boolean>(false);
  const toast = useToast();
  const setError = React.useCallback((msg: string | null) => {
    if (msg) toast.error(msg);
  }, [toast]);
  const setSuccessMsg = React.useCallback((msg: string | null) => {
    if (msg) toast.success(msg);
  }, [toast]);


  // Business Search State
  const [searchCount, setSearchCount] = useState<string>('');
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [searchLocation, setSearchLocation] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<ScrapedBusiness[]>([]);
  const [lastSearchExecuted, setLastSearchExecuted] = useState<boolean>(false);
  const [selectedBusiness, setSelectedBusiness] = useState<ScrapedBusiness | null>(null);
  const [isEnriching, setIsEnriching] = useState<boolean>(false);

  const handleOpenDetails = async (biz: ScrapedBusiness) => {
    setSelectedBusiness(biz);
    if (biz.google_maps_url && (!biz.monday_hours || !biz.services)) {
      setIsEnriching(true);
      try {
        const enriched = await scraperApi.enrichBusiness(biz.id);
        if (enriched) {
          setSelectedBusiness(prev => (prev && prev.id === biz.id ? enriched : prev));
          setSearchResults(prev => prev.map(item => item.id === biz.id ? enriched : item));
          setLocations(prev => prev.map(item => item.id === biz.id ? (enriched as any) : item));
        }
      } catch (err) {
        console.warn('Place enrichment notice:', err);
      } finally {
        setIsEnriching(false);
      }
    }
  };
  
  // Selection state for results table export and saving
  const [selectedResultIds, setSelectedResultIds] = useState<string[]>([]);
  const [savingBatch, setSavingBatch] = useState<boolean>(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const isBusinessSaved = React.useCallback((biz: ScrapedBusiness): boolean => {
    const normName = (biz.business_name || '').trim().toLowerCase();
    const normCity = (biz.city || '').trim().toLowerCase();
    const normArea = (biz.area || '').trim().toLowerCase();

    return locations.some(loc => {
      if (biz.google_place_id && loc.google_location_id && loc.google_location_id.includes(biz.google_place_id)) {
        return true;
      }
      const lName = (loc.business_name || '').trim().toLowerCase();
      const lCity = (loc.city || '').trim().toLowerCase();
      const lArea = (loc.area || '').trim().toLowerCase();
      return lName === normName && (lCity === normCity || !normCity || !lCity) && (lArea === normArea || !normArea || !lArea);
    });
  }, [locations]);

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

    // Check for OAuth redirect params
    const params = new URLSearchParams(window.location.search);
    const authStatus = params.get('auth');
    if (authStatus === 'success') {
      toast.success('Google Business Profile account connected successfully.');
      window.history.replaceState({}, document.title, window.location.pathname);
      fetchInitialData();
    } else if (authStatus === 'error') {
      const errorMsg = params.get('error') || 'Google authentication failed. Please verify credentials.';
      toast.error(decodeURIComponent(errorMsg));
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [toast]);

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



  const handleSaveSelected = async () => {
    const targets = selectedResultIds.length > 0 
      ? searchResults.filter(biz => selectedResultIds.includes(biz.id)) 
      : searchResults;

    if (targets.length === 0) {
      setError("No search results available to save.");
      return;
    }

    setSavingBatch(true);
    setError(null);
    try {
      const items = targets.map(biz => ({
        id: biz.id,
        google_place_id: biz.google_place_id || undefined,
        google_location_id: biz.google_place_id ? `google-${biz.google_place_id}` : undefined,
        business_name: biz.business_name,
        area: biz.area || '',
        city: biz.city || '',
        state: biz.state || undefined,
        postal_code: biz.postal_code || undefined,
        latitude: biz.latitude || undefined,
        longitude: biz.longitude || undefined,
        address: biz.address || '',
        source: biz.data_source || (biz.source_type === 'GOOGLE_PLACES_API' ? 'Google Places API' : 'Business Search'),
        phone: biz.phone || undefined,
        website: biz.website || undefined,
        rating: biz.rating || undefined,
        review_count: biz.review_count || undefined,
        primary_category: biz.primary_category || undefined,
      }));

      const res = await googleBusinessApi.saveBatchLocations(items);
      setSuccessMsg(res.message);
      await refreshCounts();
    } catch (err: any) {
      console.error("Save selected failed:", err);
      setError(err.message || "Failed to save selected businesses to database.");
    } finally {
      setSavingBatch(false);
    }
  };

  const handleSaveSingle = async (biz: ScrapedBusiness) => {
    setSavingId(biz.id);
    setError(null);
    try {
      const res = await googleBusinessApi.saveBatchLocations([{
        id: biz.id,
        google_place_id: biz.google_place_id || undefined,
        google_location_id: biz.google_place_id ? `google-${biz.google_place_id}` : undefined,
        business_name: biz.business_name,
        area: biz.area || '',
        city: biz.city || '',
        state: biz.state || undefined,
        postal_code: biz.postal_code || undefined,
        latitude: biz.latitude || undefined,
        longitude: biz.longitude || undefined,
        address: biz.address || '',
        source: biz.data_source || (biz.source_type === 'GOOGLE_PLACES_API' ? 'Google Places API' : 'Business Search'),
        phone: biz.phone || undefined,
        website: biz.website || undefined,
        rating: biz.rating || undefined,
        review_count: biz.review_count || undefined,
        primary_category: biz.primary_category || undefined,
      }]);
      setSuccessMsg(`Business '${biz.business_name}' saved to database.`);
      await refreshCounts();
    } catch (err: any) {
      console.error("Save single failed:", err);
      setError(err.message || "Failed to save business record.");
    } finally {
      setSavingId(null);
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
      const foundCount = bizList.length;
      setBusinessesFound(foundCount);

      // Increment Total Searches statistic
      const updatedSearches = totalSearches + 1;
      setTotalSearches(updatedSearches);
      localStorage.setItem('gb_total_searches', String(updatedSearches));

      if (foundCount > 0) {
        setSuccessMsg(`Search completed successfully. Found ${foundCount} matching businesses for '${searchKeyword.trim()}' in '${searchLocation.trim()}'.`);
      }
    } catch (err: any) {
      console.error("Business search error:", err);
      const msg = err.message || "Business search operation failed.";
      setError(msg);
      setSearchError(msg);
      setLastSearchExecuted(true);
      setSearchResults([]);
      setBusinessesFound(0);
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

  const totalBusinesses = searchResults.length;

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
              {isSearching ? (
                <span className="text-[#68736B] animate-pulse">--</span>
              ) : (
                totalBusinesses
              )}
            </div>
          </div>
        </div>
      </div>



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
              <div className="text-2xl font-heading font-bold text-[#1D1E18] mt-0.5">
                {isSearching ? (
                  <span className="text-[#68736B] animate-pulse">--</span>
                ) : (
                  businessesFound
                )}
              </div>
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
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={handleSaveSelected}
                  disabled={savingBatch || searchResults.length === 0}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2 rounded-[10px] text-xs font-heading font-semibold bg-[#6B8F71] hover:bg-[#597A5F] active:bg-[#4E6B52] text-white transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {savingBatch ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <PlusCircle className="w-4 h-4 text-white" />
                  )}
                  <span>
                    {selectedResultIds.length > 0 
                      ? `Save Selected (${selectedResultIds.length}) to Locations` 
                      : `Save All (${searchResults.length}) to Locations`}
                  </span>
                </button>

                <button
                  onClick={handleExportSearchCsv}
                  disabled={exporting}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2 rounded-[10px] text-xs font-heading font-semibold bg-white hover:bg-[#F6F8F5] text-[#1D1E18] border border-[#DDE5DE] transition-colors shadow-2xs"
                >
                  {exporting ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#6B8F71]" />
                  ) : (
                    <FileSpreadsheet className="w-4 h-4 text-[#6B8F71]" />
                  )}
                  <span>
                    {selectedResultIds.length > 0 
                      ? `Export Selected (${selectedResultIds.length}) CSV` 
                      : 'Export Search CSV'}
                  </span>
                </button>
              </div>
            </div>

            {/* Results Table — professionally styled with fixed column widths and truncation */}
            <div className="table-responsive rounded-[12px] border border-[#DDE5DE] bg-white shadow-sm overflow-x-auto">
              <table className="w-full table-fixed min-w-[1020px] text-left text-xs text-[#1D1E18]">
                <colgroup>
                  <col className="w-[50px]" />
                  <col className="w-[200px]" />
                  <col className="w-[120px]" />
                  <col className="w-[120px]" />
                  <col className="w-[150px]" />
                  <col className="w-[85px]" />
                  <col className="w-[80px]" />
                  <col className="w-[120px]" />
                  <col className="w-[160px]" />
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
                    const isSaved = isBusinessSaved(biz);
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
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="truncate">{biz.business_name || 'Not available'}</span>
                            {isSaved && (
                              <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#EAF4EE] text-[#2F7D4A] border border-[#AAD2BA]">
                                SAVED
                              </span>
                            )}
                          </div>
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
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {isSaved ? (
                              <span 
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[8px] bg-[#EAF4EE] text-[#2F7D4A] border border-[#AAD2BA] text-xs font-semibold"
                                title="Saved in database"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                                <span>Saved</span>
                              </span>
                            ) : (
                              <button
                                onClick={() => handleSaveSingle(biz)}
                                disabled={savingId === biz.id}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[8px] bg-white hover:bg-[#EAF4EE] hover:text-[#2F7D4A] hover:border-[#AAD2BA] text-[#1D1E18] border border-[#DDE5DE] transition-colors shadow-2xs text-xs font-medium disabled:opacity-50"
                                title="Save to Database"
                              >
                                {savingId === biz.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#6B8F71]" />
                                ) : (
                                  <PlusCircle className="w-3.5 h-3.5 text-[#6B8F71]" />
                                )}
                                <span>Save</span>
                              </button>
                            )}

                            <button
                              onClick={() => handleOpenDetails(biz)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] bg-white hover:bg-[#F6F8F5] text-[#1D1E18] border border-[#DDE5DE] transition-colors shadow-2xs text-xs font-medium"
                            >
                              <Info className="w-3.5 h-3.5 text-[#6B8F71] shrink-0" />
                              <span>Details</span>
                            </button>
                          </div>
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



      {/* FULL 58-FIELD BUSINESS DETAILS MODAL (20px radius) */}
      {selectedBusiness && (
        <div className="fixed inset-0 z-50 bg-[#1D1E18]/50 backdrop-blur-xs flex items-start justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="modal-safe bg-white border border-[#DDE5DE] rounded-[20px] w-full max-w-4xl p-4 sm:p-6 md:p-8 space-y-5 sm:space-y-6 shadow-2xl my-4 sm:my-8">
            <div className="flex items-start justify-between border-b border-[#DDE5DE] pb-4 gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-heading font-semibold text-[#6B8F71] uppercase tracking-wider mb-1">
                  <span>{selectedBusiness.source_type || 'Google Business'}</span>
                  {selectedBusiness.enrichment_status && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] bg-[#EAF4EE] text-[#2F7D4A] border border-[#AAD2BA]">
                      {selectedBusiness.enrichment_status}
                    </span>
                  )}
                  {isEnriching && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] bg-[#EAF4EE] text-[#2F7D4A] border border-[#AAD2BA]">
                      <Loader2 className="w-3 h-3 animate-spin text-[#2F7D4A]" />
                      Updating live details...
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
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
              <div className="bg-[#F6F8F5] p-3.5 sm:p-4 rounded-[12px] border border-[#DDE5DE]">
                <div className="text-[10px] font-heading font-bold text-[#68736B] uppercase tracking-wider mb-1">Category</div>
                <div className="text-sm font-semibold text-[#1D1E18]">{selectedBusiness.primary_category || 'NA'}</div>
              </div>
              <div className="bg-[#F6F8F5] p-3.5 sm:p-4 rounded-[12px] border border-[#DDE5DE]">
                <div className="text-[10px] font-heading font-bold text-[#68736B] uppercase tracking-wider mb-1">Rating & Reviews</div>
                <div className="text-sm font-semibold text-[#B7791F] flex items-center gap-1.5">
                  {selectedBusiness.rating ? (
                    <>
                      <Star className="w-4 h-4 fill-[#B7791F] text-[#B7791F]" />
                      <span>{selectedBusiness.rating}</span>
                    </>
                  ) : <span className="text-[#68736B]">NA</span>}
                  {selectedBusiness.review_count && (
                    <span className="text-xs text-[#68736B] font-normal">({selectedBusiness.review_count} reviews)</span>
                  )}
                </div>
              </div>
              <div className="bg-[#F6F8F5] p-3.5 sm:p-4 rounded-[12px] border border-[#DDE5DE]">
                <div className="text-[10px] font-heading font-bold text-[#68736B] uppercase tracking-wider mb-1">Primary Phone</div>
                <div className="text-sm font-semibold text-[#1D1E18] font-mono">{selectedBusiness.phone || 'NA'}</div>
              </div>
            </div>

            {/* About & Description — always shown */}
            <div className="bg-[#F6F8F5] p-3.5 sm:p-4 rounded-[12px] border border-[#DDE5DE] space-y-1.5">
              <div className="text-xs font-heading font-bold text-[#6B8F71] uppercase tracking-wider flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" />
                About / Description
              </div>
              <p className="text-xs sm:text-sm text-[#1D1E18] leading-relaxed whitespace-pre-line">
                {selectedBusiness.about_us || selectedBusiness.description || 'NA'}
              </p>
            </div>

            {/* Location & Address Breakdown */}
            <div className="space-y-3">
              <h4 className="text-xs font-heading font-bold text-[#68736B] uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#6B8F71]" />
                Address & Geographic Coordinates
              </h4>
              <div className="bg-[#F6F8F5] p-3.5 sm:p-4 rounded-[12px] border border-[#DDE5DE] space-y-3">
                {/* Full Address — single clean line */}
                <div>
                  <div className="text-[10px] font-heading font-bold text-[#68736B] uppercase tracking-wider mb-0.5">Full Address</div>
                  <div className="text-sm font-medium text-[#1D1E18] break-words">
                    {selectedBusiness.address || 'NA'}
                  </div>
                </div>

                {/* Address breakdown grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 text-xs pt-2 border-t border-[#DDE5DE]">
                  <div>
                    <span className="text-[#68736B] block text-[10px] uppercase font-bold">Address Line 1</span>
                    <span className="text-[#1D1E18] font-semibold break-words">{selectedBusiness.address_line_1 || 'NA'}</span>
                  </div>
                  <div>
                    <span className="text-[#68736B] block text-[10px] uppercase font-bold">Address Line 2</span>
                    <span className="text-[#1D1E18] font-semibold break-words">{selectedBusiness.address_line_2 || 'NA'}</span>
                  </div>
                  <div>
                    <span className="text-[#68736B] block text-[10px] uppercase font-bold">Neighborhood</span>
                    <span className="text-[#1D1E18] font-semibold">{selectedBusiness.neighborhood || 'NA'}</span>
                  </div>
                  <div>
                    <span className="text-[#68736B] block text-[10px] uppercase font-bold">Area / Locality</span>
                    <span className="text-[#1D1E18] font-semibold">{selectedBusiness.area || 'NA'}</span>
                  </div>
                  <div>
                    <span className="text-[#68736B] block text-[10px] uppercase font-bold">District</span>
                    <span className="text-[#1D1E18] font-semibold">{selectedBusiness.district || 'NA'}</span>
                  </div>
                  <div>
                    <span className="text-[#68736B] block text-[10px] uppercase font-bold">City</span>
                    <span className="text-[#1D1E18] font-semibold">{selectedBusiness.city || 'NA'}</span>
                  </div>
                  <div>
                    <span className="text-[#68736B] block text-[10px] uppercase font-bold">State</span>
                    <span className="text-[#1D1E18] font-semibold">{selectedBusiness.state || 'NA'}</span>
                  </div>
                  <div>
                    <span className="text-[#68736B] block text-[10px] uppercase font-bold">Postal Code</span>
                    <span className="text-[#1D1E18] font-semibold">{selectedBusiness.postal_code || 'NA'}</span>
                  </div>
                  <div>
                    <span className="text-[#68736B] block text-[10px] uppercase font-bold">Country</span>
                    <span className="text-[#1D1E18] font-semibold">{selectedBusiness.country || 'NA'}</span>
                  </div>
                  <div>
                    <span className="text-[#68736B] block text-[10px] uppercase font-bold">Plus Code</span>
                    <span className="text-[#1D1E18] font-semibold">{selectedBusiness.plus_code || 'NA'}</span>
                  </div>
                  <div>
                    <span className="text-[#68736B] block text-[10px] uppercase font-bold">Latitude</span>
                    <span className="text-[#1D1E18] font-semibold font-mono">{selectedBusiness.latitude || 'NA'}</span>
                  </div>
                  <div>
                    <span className="text-[#68736B] block text-[10px] uppercase font-bold">Longitude</span>
                    <span className="text-[#1D1E18] font-semibold font-mono">{selectedBusiness.longitude || 'NA'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Business Status & Attributes */}
            <div className="space-y-3">
              <h4 className="text-xs font-heading font-bold text-[#68736B] uppercase tracking-wider">Business Status & Attributes</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                <div className="bg-[#F6F8F5] p-3 rounded-[10px] border border-[#DDE5DE]">
                  <div className="text-[10px] font-heading font-bold text-[#68736B] uppercase tracking-wider mb-0.5">Status</div>
                  <div className="text-xs font-semibold text-[#1D1E18]">{selectedBusiness.business_status || 'NA'}</div>
                </div>
                <div className="bg-[#F6F8F5] p-3 rounded-[10px] border border-[#DDE5DE]">
                  <div className="text-[10px] font-heading font-bold text-[#68736B] uppercase tracking-wider mb-0.5">Open Now</div>
                  <div className="text-xs font-semibold text-[#1D1E18]">{selectedBusiness.open_now || 'NA'}</div>
                </div>
                <div className="bg-[#F6F8F5] p-3 rounded-[10px] border border-[#DDE5DE]">
                  <div className="text-[10px] font-heading font-bold text-[#68736B] uppercase tracking-wider mb-0.5">Price Level</div>
                  <div className="text-xs font-semibold text-[#1D1E18]">{selectedBusiness.price_level || 'NA'}</div>
                </div>
                <div className="bg-[#F6F8F5] p-3 rounded-[10px] border border-[#DDE5DE]">
                  <div className="text-[10px] font-heading font-bold text-[#68736B] uppercase tracking-wider mb-0.5">Additional Categories</div>
                  <div className="text-xs font-semibold text-[#1D1E18] break-words">{selectedBusiness.additional_categories || 'NA'}</div>
                </div>
              </div>
            </div>

            {/* Contact Details */}
            <div className="space-y-3">
              <h4 className="text-xs font-heading font-bold text-[#68736B] uppercase tracking-wider">Contact Details</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                <div className="bg-[#F6F8F5] p-3 rounded-[10px] border border-[#DDE5DE]">
                  <div className="text-[10px] font-heading font-bold text-[#68736B] uppercase tracking-wider mb-0.5">Primary Phone</div>
                  <div className="text-xs font-semibold text-[#1D1E18] font-mono">{selectedBusiness.phone || 'NA'}</div>
                </div>
                <div className="bg-[#F6F8F5] p-3 rounded-[10px] border border-[#DDE5DE]">
                  <div className="text-[10px] font-heading font-bold text-[#68736B] uppercase tracking-wider mb-0.5">Secondary Phone</div>
                  <div className="text-xs font-semibold text-[#1D1E18] font-mono">{selectedBusiness.secondary_phone || 'NA'}</div>
                </div>
                <div className="bg-[#F6F8F5] p-3 rounded-[10px] border border-[#DDE5DE]">
                  <div className="text-[10px] font-heading font-bold text-[#68736B] uppercase tracking-wider mb-0.5">Landline Phone</div>
                  <div className="text-xs font-semibold text-[#1D1E18] font-mono">{selectedBusiness.phone_landline || 'NA'}</div>
                </div>
                <div className="bg-[#F6F8F5] p-3 rounded-[10px] border border-[#DDE5DE]">
                  <div className="text-[10px] font-heading font-bold text-[#68736B] uppercase tracking-wider mb-0.5">Mobile Phone</div>
                  <div className="text-xs font-semibold text-[#1D1E18] font-mono">{selectedBusiness.phone_mobile || 'NA'}</div>
                </div>
                <div className="bg-[#F6F8F5] p-3 rounded-[10px] border border-[#DDE5DE]">
                  <div className="text-[10px] font-heading font-bold text-[#68736B] uppercase tracking-wider mb-0.5">Email</div>
                  <div className="text-xs font-semibold text-[#1D1E18] break-all">{selectedBusiness.email || 'NA'}</div>
                </div>
                <div className="bg-[#F6F8F5] p-3 rounded-[10px] border border-[#DDE5DE]">
                  <div className="text-[10px] font-heading font-bold text-[#68736B] uppercase tracking-wider mb-0.5">Website</div>
                  {selectedBusiness.website ? (
                    <a href={selectedBusiness.website} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-[#6B8F71] underline break-all">{selectedBusiness.website}</a>
                  ) : (
                    <div className="text-xs font-semibold text-[#1D1E18]">NA</div>
                  )}
                </div>
                <div className="bg-[#F6F8F5] p-3 rounded-[10px] border border-[#DDE5DE]">
                  <div className="text-[10px] font-heading font-bold text-[#68736B] uppercase tracking-wider mb-0.5">Google Maps URL</div>
                  {selectedBusiness.google_maps_url ? (
                    <a href={selectedBusiness.google_maps_url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-[#6B8F71] underline break-all">View on Maps</a>
                  ) : (
                    <div className="text-xs font-semibold text-[#1D1E18]">NA</div>
                  )}
                </div>
                <div className="bg-[#F6F8F5] p-3 rounded-[10px] border border-[#DDE5DE]">
                  <div className="text-[10px] font-heading font-bold text-[#68736B] uppercase tracking-wider mb-0.5">Google Place ID</div>
                  <div className="text-xs font-semibold text-[#1D1E18] break-all">{selectedBusiness.google_place_id || 'NA'}</div>
                </div>
              </div>
            </div>

            {/* Opening Hours */}
            <div className="space-y-3">
              <h4 className="text-xs font-heading font-bold text-[#68736B] uppercase tracking-wider">Opening Hours</h4>
              <div className="bg-[#F6F8F5] p-3.5 sm:p-4 rounded-[12px] border border-[#DDE5DE]">
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3 text-xs">
                  {[
                    { label: 'Monday', value: selectedBusiness.monday_hours },
                    { label: 'Tuesday', value: selectedBusiness.tuesday_hours },
                    { label: 'Wednesday', value: selectedBusiness.wednesday_hours },
                    { label: 'Thursday', value: selectedBusiness.thursday_hours },
                    { label: 'Friday', value: selectedBusiness.friday_hours },
                    { label: 'Saturday', value: selectedBusiness.saturday_hours },
                    { label: 'Sunday', value: selectedBusiness.sunday_hours },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <span className="text-[#68736B] block text-[10px] uppercase font-bold">{label}</span>
                      <span className="text-[#1D1E18] font-semibold">{value || 'NA'}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-[#DDE5DE] grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[#68736B] block text-[10px] uppercase font-bold">Today's Status</span>
                    <span className="text-[#1D1E18] font-semibold">{selectedBusiness.today_open_status || 'NA'}</span>
                  </div>
                  <div>
                    <span className="text-[#68736B] block text-[10px] uppercase font-bold">Opening Hours (General)</span>
                    <span className="text-[#1D1E18] font-semibold whitespace-pre-line">{selectedBusiness.opening_hours || 'NA'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Services & Amenities */}
            <div className="space-y-3">
              <h4 className="text-xs font-heading font-bold text-[#68736B] uppercase tracking-wider">Services, Amenities & Options</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="bg-[#F6F8F5] p-3.5 rounded-[10px] border border-[#DDE5DE]">
                  <div className="text-[10px] font-heading font-bold text-[#68736B] uppercase tracking-wider mb-1">Services</div>
                  <div className="text-[#1D1E18] whitespace-pre-line">{selectedBusiness.services || 'NA'}</div>
                </div>
                <div className="bg-[#F6F8F5] p-3.5 rounded-[10px] border border-[#DDE5DE]">
                  <div className="text-[10px] font-heading font-bold text-[#68736B] uppercase tracking-wider mb-1">Amenities</div>
                  <div className="text-[#1D1E18] whitespace-pre-line">{selectedBusiness.amenities || 'NA'}</div>
                </div>
                <div className="bg-[#F6F8F5] p-3.5 rounded-[10px] border border-[#DDE5DE]">
                  <div className="text-[10px] font-heading font-bold text-[#68736B] uppercase tracking-wider mb-1">Accessibility</div>
                  <div className="text-[#1D1E18] whitespace-pre-line">{selectedBusiness.accessibility || 'NA'}</div>
                </div>
                <div className="bg-[#F6F8F5] p-3.5 rounded-[10px] border border-[#DDE5DE]">
                  <div className="text-[10px] font-heading font-bold text-[#68736B] uppercase tracking-wider mb-1">Payment Options</div>
                  <div className="text-[#1D1E18] whitespace-pre-line">{selectedBusiness.payment_options || 'NA'}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                <div className="bg-[#F6F8F5] p-3 rounded-[10px] border border-[#DDE5DE]">
                  <div className="text-[10px] font-heading font-bold text-[#68736B] uppercase tracking-wider mb-0.5">Delivery</div>
                  <div className="text-xs font-semibold text-[#1D1E18]">{selectedBusiness.delivery || 'NA'}</div>
                </div>
                <div className="bg-[#F6F8F5] p-3 rounded-[10px] border border-[#DDE5DE]">
                  <div className="text-[10px] font-heading font-bold text-[#68736B] uppercase tracking-wider mb-0.5">Dine In</div>
                  <div className="text-xs font-semibold text-[#1D1E18]">{selectedBusiness.dine_in || 'NA'}</div>
                </div>
                <div className="bg-[#F6F8F5] p-3 rounded-[10px] border border-[#DDE5DE]">
                  <div className="text-[10px] font-heading font-bold text-[#68736B] uppercase tracking-wider mb-0.5">Pickup</div>
                  <div className="text-xs font-semibold text-[#1D1E18]">{selectedBusiness.pickup || 'NA'}</div>
                </div>
                <div className="bg-[#F6F8F5] p-3 rounded-[10px] border border-[#DDE5DE]">
                  <div className="text-[10px] font-heading font-bold text-[#68736B] uppercase tracking-wider mb-0.5">Reservation URL</div>
                  {selectedBusiness.reservation_url ? (
                    <a href={selectedBusiness.reservation_url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-[#6B8F71] underline">Book Now</a>
                  ) : (
                    <div className="text-xs font-semibold text-[#1D1E18]">NA</div>
                  )}
                </div>
                <div className="bg-[#F6F8F5] p-3 rounded-[10px] border border-[#DDE5DE]">
                  <div className="text-[10px] font-heading font-bold text-[#68736B] uppercase tracking-wider mb-0.5">Menu URL</div>
                  {selectedBusiness.menu_url ? (
                    <a href={selectedBusiness.menu_url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-[#6B8F71] underline">View Menu</a>
                  ) : (
                    <div className="text-xs font-semibold text-[#1D1E18]">NA</div>
                  )}
                </div>
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
