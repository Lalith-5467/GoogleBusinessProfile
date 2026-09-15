import React, { useState, useEffect, useRef } from 'react';
import { 
  Globe, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  MapPin, 
  Loader2, 
  Trash2, 
  Database, 
  Layers, 
  Sparkles, 
  History,
  ChevronLeft,
  ChevronRight,
  Phone,
  Info,
  X,
  ExternalLink,
  FileText,
  Star,
  Tag,
  Building2
} from 'lucide-react';
import { 
  scraperApi, 
  ScrapedBusiness, 
  BulkScrapeResponse 
} from '../services/scraperApi';
import { exportScrapedBusinessesCsv } from '../utils';

export const WebsiteScraperView: React.FC = () => {
  // Database History State
  const [historyBusinesses, setHistoryBusinesses] = useState<ScrapedBusiness[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Isolated Current Operation Scrape State
  const [currentOperationResults, setCurrentOperationResults] = useState<ScrapedBusiness[]>([]);
  const [activeOperationMode, setActiveOperationMode] = useState<'NONE' | 'SINGLE' | 'BULK' | 'HISTORY'>('NONE');

  const [loading, setLoading] = useState<boolean>(true);
  const [scrapingSingle, setScrapingSingle] = useState<boolean>(false);
  const [scrapingBulk, setScrapingBulk] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [selectedBusiness, setSelectedBusiness] = useState<ScrapedBusiness | null>(null);

  // Single Scrape Form state
  const [singleUrl, setSingleUrl] = useState<string>('');
  const lastScrapedUrlRef = useRef<string>('');

  // Bulk Scrape Form state
  const [bulkUrls, setBulkUrls] = useState<string>('');
  const [bulkMetrics, setBulkMetrics] = useState<BulkScrapeResponse | null>(null);

  const [statusStep, setStatusStep] = useState<string>('');

  // Table Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;

  const fetchScrapedData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await scraperApi.getBusinesses();
      setHistoryBusinesses(res.businesses);
      setTotalCount(res.total_count);
    } catch (err: any) {
      console.error("Failed to load scraped businesses:", err);
      setError(err.message || 'Unable to access backend service.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScrapedData();
  }, []);

  const refreshCount = async () => {
    try {
      const [countRes, bizRes] = await Promise.all([
        scraperApi.getCount(),
        scraperApi.getBusinesses()
      ]);
      setTotalCount(countRes.total_count);
      setHistoryBusinesses(bizRes.businesses);
    } catch (err) {
      console.error("Failed to refresh count:", err);
    }
  };

  // Helper to validate URL format
  const isValidUrl = (str: string): boolean => {
    const trimmed = str.trim();
    if (!trimmed) return false;
    if (
      trimmed.startsWith('http://') || 
      trimmed.startsWith('https://') || 
      trimmed.startsWith('www.')
    ) {
      return true;
    }
    return /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/.*)?$/.test(trimmed);
  };

  // AUTOMATIC URL SCRAPING TRIGGER WITH DEBOUNCE
  useEffect(() => {
    const trimmedUrl = singleUrl.trim();
    if (!trimmedUrl || !isValidUrl(trimmedUrl)) {
      return;
    }

    if (trimmedUrl === lastScrapedUrlRef.current || scrapingSingle) {
      return;
    }

    const timer = setTimeout(() => {
      triggerAutoScrape(trimmedUrl);
    }, 600);

    return () => clearTimeout(timer);
  }, [singleUrl]);

  const triggerAutoScrape = async (targetUrl: string) => {
    lastScrapedUrlRef.current = targetUrl;
    setScrapingSingle(true);
    setError(null);
    setSuccessMsg(null);
    setStatusStep('Analyzing URL...');
    
    try {
      setStatusStep('Opening page & resolving details...');
      await new Promise(resolve => setTimeout(resolve, 300));
      
      let finalUrl = targetUrl.trim();
      if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
        finalUrl = 'https://' + finalUrl;
      }

      const res = await scraperApi.scrapeCompany(finalUrl);
      
      setStatusStep('Saving results...');
      setTotalCount(res.total_count);

      const extractedList: ScrapedBusiness[] = res.businesses && res.businesses.length > 0 
        ? res.businesses 
        : (res.business ? [res.business] : []);

      if (extractedList.length === 0) {
        setError("No business results could be identified from this page.");
        setCurrentOperationResults([]);
        setActiveOperationMode('NONE');
        return;
      }

      setCurrentOperationResults(extractedList);
      setActiveOperationMode('SINGLE');
      setCurrentPage(1);

      const count = extractedList.length;
      if (count > 1) {
        setSuccessMsg(`Scrape completed successfully. ${count} businesses collected.`);
      } else {
        setSuccessMsg(`Scrape completed successfully. 1 business collected.`);
      }

      await refreshCount();
    } catch (err: any) {
      console.error("Auto scrape failed:", err);
      setError(err.message || "Failed to scrape website.");
    } finally {
      setScrapingSingle(false);
      setStatusStep('');
    }
  };

  const handleSingleScrapeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = singleUrl.trim();
    if (trimmed && isValidUrl(trimmed)) {
      triggerAutoScrape(trimmed);
    } else {
      setError("Please enter a valid URL.");
    }
  };

  const handleBulkScrape = async (e: React.FormEvent) => {
    e.preventDefault();
    const urls = bulkUrls
      .split('\n')
      .map(u => u.trim())
      .filter(u => u.length > 0);

    if (urls.length === 0) {
      setError("Please enter at least one URL.");
      return;
    }

    setScrapingBulk(true);
    setError(null);
    setSuccessMsg(null);
    setBulkMetrics(null);
    setCurrentOperationResults([]);

    try {
      const res = await scraperApi.scrapeBulk(urls);
      setBulkMetrics(res);

      if (res.results.length === 0) {
        setError(`Bulk scraping finished: ${res.failed} URLs failed, 0 businesses extracted.`);
        setCurrentOperationResults([]);
        setActiveOperationMode('NONE');
      } else {
        setCurrentOperationResults(res.results);
        setActiveOperationMode('BULK');
        setCurrentPage(1);
        setSuccessMsg(`Bulk scrape complete: ${res.successfully_scraped} succeeded, ${res.total_businesses} businesses extracted.`);
      }

      await refreshCount();
    } catch (err: any) {
      console.error("Bulk scrape failed:", err);
      setError(err.message || "Bulk scraping operation encountered an error.");
    } finally {
      setScrapingBulk(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete '${name}'?`)) {
      return;
    }

    setDeletingId(id);
    setError(null);
    setSuccessMsg(null);

    try {
      await scraperApi.deleteBusiness(id);
      setSuccessMsg(`Business record '${name}' was deleted.`);
      
      setCurrentOperationResults(prev => prev.filter(b => b.id !== id));
      await refreshCount();
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
      if (activeOperationMode === 'HISTORY') {
        await scraperApi.triggerCsvDownload();
        setSuccessMsg(`Complete history export downloaded successfully (${totalCount} businesses).`);
      } else {
        if (currentOperationResults.length === 0) {
          setError("No current scraped results available to export.");
          return;
        }
        exportScrapedBusinessesCsv(currentOperationResults, 'scraped_businesses_current.csv');
        setSuccessMsg(`Current scrape export downloaded successfully (${currentOperationResults.length} businesses).`);
      }
    } catch (err: any) {
      console.error("Export failed:", err);
      setError(err.message || "Failed to export CSV.");
    } finally {
      setExporting(false);
    }
  };

  const toggleHistoryMode = () => {
    if (activeOperationMode === 'HISTORY') {
      setActiveOperationMode(currentOperationResults.length > 0 ? 'SINGLE' : 'NONE');
    } else {
      setActiveOperationMode('HISTORY');
    }
    setCurrentPage(1);
  };

  const displayedBusinesses = activeOperationMode === 'HISTORY'
    ? historyBusinesses
    : currentOperationResults;

  // Pagination calculations
  const totalItems = displayedBusinesses.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedBusinesses = displayedBusinesses.slice(startIndex, startIndex + pageSize);

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8">
      {/* Header Card */}
      <div className="bg-white border border-[#DDE5DE] rounded-[16px] p-4 sm:p-6 md:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6 shadow-sm">
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2 text-[#6B8F71] font-heading font-semibold text-xs uppercase tracking-wider">
            <Globe className="w-4 h-4 shrink-0" />
            Website Scraper Module
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-heading font-bold text-[#1D1E18] tracking-tight leading-tight">
            Website &amp; Google Business Scraper
          </h1>
          <p className="text-[#68736B] text-xs sm:text-sm max-w-xl">
            Extract, enrich, and store comprehensive business metadata, ratings, reviews, addresses, and contact info from public URLs &amp; Google Maps.
          </p>
        </div>

        {/* PROMINENT TOTAL BUSINESSES CARD */}
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
                totalCount
              )}
            </div>
            <div className="text-[11px] text-[#68736B] font-medium mt-0.5">
              Stored in MySQL
            </div>
          </div>
        </div>
      </div>

      {/* SCRAPER CARDS GRID: 2 COLUMNS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Single URL Scraper Card */}
        <div className="bg-white p-4 sm:p-6 rounded-[16px] border border-[#DDE5DE] shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-heading font-bold text-[#1D1E18] flex items-center gap-2 mb-1">
              <Globe className="w-5 h-5 text-[#6B8F71]" />
              Business URL / Maps Link
            </h3>
            <p className="text-xs text-[#68736B]">
              Paste a website URL, Google Maps search, or Place URL.
            </p>
          </div>

          <form onSubmit={handleSingleScrapeSubmit} className="space-y-3">
            <div className="relative">
              <input
                type="url"
                required
                value={singleUrl}
                onChange={(e) => setSingleUrl(e.target.value)}
                placeholder="https://www.supersaravanastores.com"
                className="w-full h-11 bg-white border border-[#DDE5DE] rounded-[10px] pl-4 pr-10 text-xs text-[#1D1E18] focus:outline-none focus:border-[#6B8F71] focus:ring-1 focus:ring-[#6B8F71] font-mono placeholder:text-[#68736B]/60"
              />
              {scrapingSingle && (
                <div className="absolute right-3 top-2.5">
                  <Loader2 className="w-5 h-5 animate-spin text-[#6B8F71]" />
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 text-xs text-[#68736B]">
              <span className="truncate max-w-full sm:max-w-[220px]">
                {scrapingSingle ? (
                  <span className="text-[#6B8F71] font-semibold flex items-center gap-1.5 truncate">
                    <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                    {statusStep || 'Analyzing URL...'}
                  </span>
                ) : (
                  <span className="truncate text-[#68736B]">Auto-scrapes on enter</span>
                )}
              </span>
              <button
                type="submit"
                disabled={scrapingSingle}
                className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 rounded-[10px] text-xs font-heading font-semibold bg-[#6B8F71] hover:bg-[#597A5F] active:bg-[#4E6B52] text-white transition-all shadow-sm shrink-0"
              >
                {scrapingSingle ? 'Analyzing...' : 'Scrape'}
              </button>
            </div>
          </form>
        </div>

        {/* Bulk Business Scraper Card */}
        <div className="bg-white p-4 sm:p-6 rounded-[16px] border border-[#DDE5DE] shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-heading font-bold text-[#1D1E18] flex items-center gap-2 mb-1">
              <Layers className="w-5 h-5 text-[#6B8F71]" />
              Bulk Business Scraper
            </h3>
            <p className="text-xs text-[#68736B]">
              Paste multiple URLs, one per line.
            </p>
          </div>

          <form onSubmit={handleBulkScrape} className="space-y-3">
            <div>
              <textarea
                rows={3}
                value={bulkUrls}
                onChange={(e) => setBulkUrls(e.target.value)}
                placeholder="Paste multiple URLs, one per line."
                className="w-full bg-white border border-[#DDE5DE] rounded-[10px] p-3 text-xs text-[#1D1E18] focus:outline-none focus:border-[#6B8F71] focus:ring-1 focus:ring-[#6B8F71] font-mono placeholder:text-[#68736B]/60"
              />
            </div>
            <button
              type="submit"
              disabled={scrapingBulk}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[10px] text-xs font-heading font-semibold bg-[#6B8F71] hover:bg-[#597A5F] active:bg-[#4E6B52] text-white transition-all shadow-sm"
            >
              {scrapingBulk ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-white" />
              )}
              {scrapingBulk ? 'Scraping Bulk URLs...' : 'Start Bulk Scrape'}
            </button>
          </form>
        </div>
      </div>

      {/* BULK SCRAPING METRICS SUMMARY */}
      {bulkMetrics && (
        <div className="bg-white p-4 sm:p-5 rounded-[16px] border border-[#DDE5DE] space-y-3 shadow-sm animate-fadeIn">
          <div className="text-xs font-heading font-bold text-[#68736B] uppercase tracking-wider">
            Bulk Scraping Metrics
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4 text-center">
            <div className="bg-[#F6F8F5] p-3 rounded-[10px] border border-[#DDE5DE]">
              <div className="text-xs text-[#68736B]">Total URLs</div>
              <div className="text-lg font-heading font-bold text-[#1D1E18] mt-0.5">{bulkMetrics.total_urls}</div>
            </div>

            <div className="bg-[#EAF4EE] p-3 rounded-[10px] border border-[#AAD2BA]">
              <div className="text-xs text-[#2F7D4A] font-medium">Successful</div>
              <div className="text-lg font-heading font-bold text-[#2F7D4A] mt-0.5">{bulkMetrics.successfully_scraped}</div>
            </div>

            <div className="bg-red-50 p-3 rounded-[10px] border border-[#C94A4A]/30">
              <div className="text-xs text-[#C94A4A] font-medium">Failed</div>
              <div className="text-lg font-heading font-bold text-[#C94A4A] mt-0.5">{bulkMetrics.failed}</div>
            </div>

            <div className="bg-[#F6F8F5] p-3 rounded-[10px] border border-[#DDE5DE]">
              <div className="text-xs text-[#6B8F71] font-medium">Businesses Collected</div>
              <div className="text-lg font-heading font-bold text-[#6B8F71] mt-0.5">{bulkMetrics.total_businesses}</div>
            </div>
          </div>
        </div>
      )}

      {/* NOTIFICATIONS / FEEDBACK ALERTS */}
      {error && (
        <div className="p-4 bg-red-50 border border-[#C94A4A]/30 rounded-[12px] text-[#C94A4A] text-sm flex items-start gap-3 animate-fadeIn">
          <AlertTriangle className="w-5 h-5 text-[#C94A4A] shrink-0 mt-0.5" />
          <span className="font-medium break-words min-w-0">{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-[#EAF4EE] border border-[#AAD2BA] rounded-[12px] text-[#2F7D4A] text-sm flex items-start gap-3 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-[#2F7D4A] shrink-0 mt-0.5" />
          <span className="font-medium break-words min-w-0">{successMsg}</span>
        </div>
      )}

      {/* SCRAPING RESULTS CARD */}
      <div className="bg-white rounded-[16px] border border-[#DDE5DE] shadow-sm overflow-hidden space-y-4 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 border-b border-[#DDE5DE] pb-4">
          <div>
            <h3 className="text-lg font-heading font-bold text-[#1D1E18] flex items-center gap-2">
              Scraping Results
            </h3>
            <p className="text-xs text-[#68736B] mt-0.5">
              Complete business records extracted, enriched, and stored in MySQL.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <div className="text-xs font-semibold text-[#1D1E18] bg-[#F6F8F5] px-3 py-1.5 rounded-[8px] border border-[#DDE5DE] shrink-0">
              Businesses: <span className="text-[#6B8F71] font-bold">{displayedBusinesses.length}</span>
            </div>

            {totalCount > 0 && (
              <button
                onClick={toggleHistoryMode}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-[8px] bg-white hover:bg-[#F6F8F5] text-[#1D1E18] border border-[#DDE5DE] transition-all font-medium shrink-0"
              >
                <History className="w-3.5 h-3.5 text-[#6B8F71] shrink-0" />
                <span className="hidden sm:inline">{activeOperationMode === 'HISTORY'
                  ? 'View Current Results'
                  : `View All History (${totalCount})`}</span>
                <span className="inline sm:hidden">{activeOperationMode === 'HISTORY' ? 'Current' : `History (${totalCount})`}</span>
              </button>
            )}

            <button
              onClick={handleExportCsv}
              disabled={exporting || loading || (activeOperationMode === 'HISTORY' ? totalCount === 0 : currentOperationResults.length === 0)}
              className={`inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-[10px] text-xs font-heading font-semibold border transition-all shrink-0 ${
                exporting || loading || (activeOperationMode === 'HISTORY' ? totalCount === 0 : currentOperationResults.length === 0)
                  ? 'bg-[#F6F8F5] border-[#DDE5DE] text-[#68736B]/40 cursor-not-allowed'
                  : 'bg-[#6B8F71] hover:bg-[#597A5F] active:bg-[#4E6B52] text-white border-transparent shadow-sm'
              }`}
            >
              {exporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">{exporting
                ? 'Exporting...'
                : activeOperationMode === 'HISTORY'
                  ? 'Export History CSV'
                  : 'Export CSV'}</span>
              <span className="inline sm:hidden">CSV</span>
            </button>
          </div>
        </div>

        {/* RESULTS TABLE */}
        {loading ? (
          <div className="p-8 sm:p-12 text-center text-[#68736B] space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-[#6B8F71] mx-auto" />
            <p className="text-sm font-heading font-medium text-[#1D1E18]">Loading business results from MySQL...</p>
          </div>
        ) : displayedBusinesses.length === 0 ? (
          <div className="p-8 sm:p-12 text-center space-y-2">
            <h4 className="text-base font-heading font-semibold text-[#1D1E18]">
              No business results yet.
            </h4>
            <p className="text-[#68736B] text-sm">
              Paste a URL or multiple URLs above to start collecting businesses.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="table-responsive rounded-[12px] border border-[#DDE5DE]">
              <table className="w-full min-w-[560px] text-left text-xs sm:text-sm text-[#1D1E18]">
                <thead className="bg-[#F6F8F5] text-xs uppercase tracking-wider text-[#68736B] border-b border-[#DDE5DE] font-heading font-bold">
                  <tr>
                    <th scope="col" className="px-4 sm:px-5 py-3.5 font-bold text-[#1D1E18]">BUSINESS NAME</th>
                    <th scope="col" className="px-4 sm:px-5 py-3.5 font-bold text-[#1D1E18]">CATEGORY</th>
                    <th scope="col" className="px-4 sm:px-5 py-3.5 font-bold text-[#1D1E18]">RATING / REVIEWS</th>
                    <th scope="col" className="px-4 sm:px-5 py-3.5 font-bold text-[#1D1E18]">AREA & CITY</th>
                    <th scope="col" className="px-4 sm:px-5 py-3.5 font-bold text-[#1D1E18]">PHONE NUMBER</th>
                    <th scope="col" className="px-4 sm:px-5 py-3.5 font-bold text-[#1D1E18] text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DDE5DE] bg-white">
                  {paginatedBusinesses.map((biz) => {
                    const hasLandline = biz.phone_landline && biz.phone_landline.trim().length > 0;
                    const hasMobile = biz.phone_mobile && biz.phone_mobile.trim().length > 0;
                    const fallbackPhone = biz.phone && biz.phone.trim().length > 0 ? biz.phone : null;

                    return (
                      <tr 
                        key={biz.id}
                        className="hover:bg-[#F6F8F5]/60 transition-colors"
                      >
                        <td className="px-4 sm:px-5 py-3.5 sm:py-4">
                          <div className="font-bold text-[#1D1E18] flex flex-wrap items-center gap-2">
                            <span className="break-words min-w-0">{biz.business_name}</span>
                            {biz.enrichment_status === 'MATCHED' && (
                              <span className="px-2 py-0.5 text-[10px] font-bold bg-[#EAF4EE] text-[#2F7D4A] border border-[#AAD2BA] rounded">
                                Enriched
                              </span>
                            )}
                          </div>
                          {biz.alternate_name && (
                            <div className="text-xs text-[#68736B] font-normal truncate max-w-xs mt-0.5">
                              {biz.alternate_name}
                            </div>
                          )}
                        </td>
                        <td className="px-4 sm:px-5 py-3.5 sm:py-4 text-xs font-medium">
                          {biz.primary_category ? (
                            <span className="inline-flex items-center gap-1 bg-[#F6F8F5] px-2 py-1 rounded-[6px] border border-[#DDE5DE] text-[#68736B]">
                              <Tag className="w-3 h-3 text-[#6B8F71]" />
                              {biz.primary_category}
                            </span>
                          ) : (
                            <span className="text-[#68736B] italic">N/A</span>
                          )}
                        </td>
                        <td className="px-4 sm:px-5 py-3.5 sm:py-4 text-xs">
                          {biz.rating ? (
                            <div className="flex items-center gap-1.5">
                              <span className="inline-flex items-center gap-1 font-bold text-[#B7791F]">
                                <Star className="w-3.5 h-3.5 fill-[#B7791F] text-[#B7791F]" />
                                {biz.rating}
                              </span>
                              {biz.review_count && (
                                <span className="text-[#68736B] text-[11px]">
                                   ({biz.review_count})
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[#68736B] italic">No ratings</span>
                          )}
                        </td>
                        <td className="px-4 sm:px-5 py-3.5 sm:py-4 text-xs text-[#1D1E18]">
                          <div className="space-y-0.5">
                            {biz.area && <div className="font-medium text-[#1D1E18]">{biz.area}</div>}
                            {biz.city && <div className="text-[#68736B]">{biz.city}{biz.state ? `, ${biz.state}` : ''}</div>}
                            {!biz.area && !biz.city && <span className="text-[#68736B] italic">N/A</span>}
                          </div>
                        </td>
                        <td className="px-4 sm:px-5 py-3.5 sm:py-4 text-xs font-mono">
                          {(() => {
                            if (hasLandline && hasMobile && biz.phone_landline !== biz.phone_mobile) {
                              return (
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1 text-[#6B8F71] font-medium">
                                    <span className="text-[9px] uppercase tracking-wider text-[#68736B] font-sans font-bold">Land:</span>
                                    <span>{biz.phone_landline}</span>
                                  </div>
                                  <div className="flex items-center gap-1 text-[#1D1E18] font-medium">
                                    <Phone className="w-3 h-3 text-[#68736B] shrink-0" />
                                    <span>{biz.phone_mobile}</span>
                                  </div>
                                </div>
                              );
                            } else if (hasLandline) {
                              return (
                                <div className="flex items-center gap-1 text-[#6B8F71] font-medium">
                                  <span className="text-[9px] uppercase tracking-wider text-[#68736B] font-sans font-bold">Land:</span>
                                  <span>{biz.phone_landline}</span>
                                </div>
                              );
                            } else if (fallbackPhone) {
                              return (
                                <div className="flex items-center gap-1 text-[#1D1E18] font-medium">
                                  <Phone className="w-3.5 h-3.5 text-[#6B8F71] shrink-0" />
                                  <span>{fallbackPhone}</span>
                                </div>
                              );
                            } else {
                              return <span className="text-[#68736B] italic">Not available</span>;
                            }
                          })()}
                        </td>
                        <td className="px-4 sm:px-5 py-3.5 sm:py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setSelectedBusiness(biz)}
                              className="p-1.5 text-[#6B8F71] hover:text-[#597A5F] hover:bg-[#EAF4EE] rounded-[8px] transition-colors font-medium text-xs flex items-center gap-1"
                              title="View complete business details"
                            >
                              <Info className="w-4 h-4" />
                              <span className="hidden sm:inline">Details</span>
                            </button>
                            <button
                              onClick={() => handleDelete(biz.id, biz.business_name)}
                              disabled={deletingId === biz.id}
                              className="p-1.5 text-[#68736B] hover:text-[#C94A4A] hover:bg-red-50 rounded-[8px] transition-colors"
                              title="Delete record"
                            >
                              {deletingId === biz.id ? (
                                <Loader2 className="w-4 h-4 animate-spin text-[#C94A4A]" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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

      {/* COMPREHENSIVE BUSINESS DETAILS MODAL (20px radius) */}
      {selectedBusiness && (
        <div className="fixed inset-0 z-50 bg-[#1D1E18]/50 backdrop-blur-xs flex items-start justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="modal-safe bg-white border border-[#DDE5DE] rounded-[20px] w-full max-w-3xl p-4 sm:p-6 md:p-8 space-y-5 sm:space-y-6 shadow-2xl animate-fadeIn my-4 sm:my-8">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-[#DDE5DE] pb-4 gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base sm:text-lg md:text-xl font-heading font-bold text-[#1D1E18] tracking-tight break-words">
                    {selectedBusiness.business_name}
                  </h2>
                  {selectedBusiness.enrichment_status === 'MATCHED' && (
                    <span className="px-2 py-0.5 text-xs font-bold bg-[#EAF4EE] text-[#2F7D4A] border border-[#AAD2BA] rounded-md">
                      Google Maps Enriched
                    </span>
                  )}
                </div>
                {selectedBusiness.alternate_name && (
                  <p className="text-xs text-[#68736B] mt-1">
                    Alternate Name: <span className="text-[#1D1E18] font-medium">{selectedBusiness.alternate_name}</span>
                  </p>
                )}
              </div>
              <button 
                onClick={() => setSelectedBusiness(null)} 
                className="text-[#68736B] hover:text-[#1D1E18] p-2 rounded-[8px] bg-[#F6F8F5] hover:bg-[#DDE5DE]/50 transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Grid Sections */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 text-sm">
              
              {/* Section 1: Overview & Rating */}
              <div className="bg-[#F6F8F5] p-3.5 sm:p-4 rounded-[12px] border border-[#DDE5DE] space-y-3">
                <h3 className="text-xs font-heading font-bold text-[#6B8F71] uppercase tracking-wider flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#6B8F71]" />
                  Business Overview
                </h3>

                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-[#68736B]">Category:</span>{' '}
                    <span className="text-[#1D1E18] font-semibold">{selectedBusiness.primary_category || 'N/A'}</span>
                  </div>

                  <div>
                    <span className="text-[#68736B]">Rating & Reviews:</span>{' '}
                    {selectedBusiness.rating ? (
                      <span className="text-[#B7791F] font-bold">
                        ★ {selectedBusiness.rating} {selectedBusiness.review_count ? `(${selectedBusiness.review_count} reviews)` : ''}
                      </span>
                    ) : (
                      <span className="text-[#68736B]">Not available</span>
                    )}
                  </div>

                  {selectedBusiness.open_now && (
                    <div>
                      <span className="text-[#68736B]">Open Status:</span>{' '}
                      <span className="text-[#2F7D4A] font-medium">{selectedBusiness.open_now}</span>
                    </div>
                  )}

                  {selectedBusiness.price_level && (
                    <div>
                      <span className="text-[#68736B]">Price Level:</span>{' '}
                      <span className="text-[#1D1E18] font-medium">{selectedBusiness.price_level}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Section 2: Contact Numbers */}
              <div className="bg-[#F6F8F5] p-3.5 sm:p-4 rounded-[12px] border border-[#DDE5DE] space-y-3">
                <h3 className="text-xs font-heading font-bold text-[#6B8F71] uppercase tracking-wider flex items-center gap-2">
                  <Phone className="w-4 h-4 text-[#6B8F71]" />
                  Contact Details
                </h3>

                <div className="space-y-2 text-xs font-mono">
                  <div>
                    <span className="text-[#68736B] font-sans">Primary Phone:</span>{' '}
                    <span className="text-[#1D1E18] font-bold">{selectedBusiness.phone || 'N/A'}</span>
                  </div>

                  {selectedBusiness.phone_landline && (
                    <div>
                      <span className="text-[#68736B] font-sans">Landline:</span>{' '}
                      <span className="text-[#6B8F71] font-bold">{selectedBusiness.phone_landline}</span>
                    </div>
                  )}

                  {selectedBusiness.phone_mobile && (
                    <div>
                      <span className="text-[#68736B] font-sans">Mobile:</span>{' '}
                      <span className="text-[#1D1E18]">{selectedBusiness.phone_mobile}</span>
                    </div>
                  )}

                  {selectedBusiness.email && (
                    <div className="font-sans">
                      <span className="text-[#68736B]">Email:</span>{' '}
                      <a href={`mailto:${selectedBusiness.email}`} className="text-[#6B8F71] hover:underline break-all">{selectedBusiness.email}</a>
                    </div>
                  )}
                </div>
              </div>

              {/* Section 3: Address & Location Details */}
              <div className="bg-[#F6F8F5] p-3.5 sm:p-4 rounded-[12px] border border-[#DDE5DE] space-y-3 md:col-span-2">
                <h3 className="text-xs font-heading font-bold text-[#6B8F71] uppercase tracking-wider flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#6B8F71]" />
                  Location & Address
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs">
                  <div>
                    <span className="text-[#68736B] block mb-1">Full Address:</span>
                    <p className="text-[#1D1E18] leading-relaxed font-medium bg-white p-2.5 rounded-[8px] border border-[#DDE5DE]">
                      {selectedBusiness.address || 'N/A'}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <div><span className="text-[#68736B]">Area / Locality:</span> <span className="text-[#1D1E18] font-semibold">{selectedBusiness.area || 'N/A'}</span></div>
                    <div><span className="text-[#68736B]">City:</span> <span className="text-[#1D1E18] font-semibold">{selectedBusiness.city || 'N/A'}</span></div>
                    <div><span className="text-[#68736B]">State / Region:</span> <span className="text-[#1D1E18]">{selectedBusiness.state || 'N/A'}</span></div>
                    <div><span className="text-[#68736B]">Postal Code / PIN:</span> <span className="text-[#1D1E18]">{selectedBusiness.postal_code || 'N/A'}</span></div>
                    {(selectedBusiness.latitude || selectedBusiness.longitude) && (
                      <div className="font-mono text-[11px] text-[#68736B] pt-1">
                        Coordinates: {selectedBusiness.latitude}, {selectedBusiness.longitude}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Section 4: About Us / Description */}
              <div className="bg-[#F6F8F5] p-3.5 sm:p-4 rounded-[12px] border border-[#DDE5DE] space-y-2 md:col-span-2">
                <h3 className="text-xs font-heading font-bold text-[#6B8F71] uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#6B8F71]" />
                  About Us / Description
                </h3>
                <div className="text-[#1D1E18] text-xs leading-relaxed whitespace-pre-line max-h-36 overflow-y-auto bg-white p-3 rounded-[8px] border border-[#DDE5DE]">
                  {selectedBusiness.about_us || selectedBusiness.description || 'Not available'}
                </div>
              </div>

              {/* Section 5: Web Links & Tracking */}
              <div className="bg-[#F6F8F5] p-3.5 sm:p-4 rounded-[12px] border border-[#DDE5DE] space-y-2 md:col-span-2 text-xs">
                <h3 className="text-xs font-heading font-bold text-[#6B8F71] uppercase tracking-wider flex items-center gap-2 mb-2">
                  <ExternalLink className="w-4 h-4 text-[#6B8F71]" />
                  Links & Source Metadata
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedBusiness.website && (
                    <div>
                      <span className="text-[#68736B] block text-[11px]">Website URL:</span>
                      <a href={selectedBusiness.website} target="_blank" rel="noreferrer" className="text-[#6B8F71] hover:underline font-mono break-all inline-flex items-start gap-1 mt-0.5">
                        <span className="break-all">{selectedBusiness.website}</span>
                        <ExternalLink className="w-3 h-3 shrink-0 mt-0.5" />
                      </a>
                    </div>
                  )}

                  {selectedBusiness.google_maps_url && (
                    <div>
                      <span className="text-[#68736B] block text-[11px]">Google Maps Place URL:</span>
                      <a href={selectedBusiness.google_maps_url} target="_blank" rel="noreferrer" className="text-[#6B8F71] hover:underline font-mono break-all inline-flex items-center gap-1 mt-0.5">
                        View on Google Maps
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    </div>
                  )}

                  <div>
                    <span className="text-[#68736B]">Source Type:</span>{' '}
                    <span className="text-[#1D1E18] font-semibold">{selectedBusiness.source_type}</span>
                  </div>

                  <div>
                    <span className="text-[#68736B]">Data Source:</span>{' '}
                    <span className="text-[#1D1E18] font-semibold">{selectedBusiness.data_source || 'Web Scraper'}</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="flex justify-end pt-3 border-t border-[#DDE5DE]">
              <button
                onClick={() => setSelectedBusiness(null)}
                className="px-5 py-2 text-xs font-heading font-semibold bg-[#6B8F71] hover:bg-[#597A5F] text-white rounded-[10px] transition-colors shadow-sm"
              >
                Close Details
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default WebsiteScraperView;
