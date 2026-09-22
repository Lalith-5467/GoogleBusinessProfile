import React, { useState, useEffect } from 'react';
import {
  Layers,
  Edit2,
  CheckCircle2,
  Sparkles,
  Zap,
  ShieldCheck,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { SubscriptionPlan } from '../types';
import { superAdminApi } from '../services/superAdminApi';
import { useSuperAdminAuth } from '../context/SuperAdminAuthContext';

export function SuperAdminPlansView() {
  const { isOriginalSuperAdmin } = useSuperAdminAuth();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit Modal
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editPrice, setEditPrice] = useState(0);
  const [editSearchLimit, setEditSearchLimit] = useState(0);
  const [editScrapeLimit, setEditScrapeLimit] = useState(0);
  const [editBulkLimit, setEditBulkLimit] = useState(0);
  const [editExportLimit, setEditExportLimit] = useState(0);
  const [saveLoading, setSaveLoading] = useState(false);

  const fetchPlans = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await superAdminApi.listPlans();
      setPlans(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load subscription plans.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const openEditPlan = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
    setEditDisplayName(plan.display_name);
    setEditPrice(plan.price_monthly);
    setEditSearchLimit(plan.search_limit);
    setEditScrapeLimit(plan.scrape_limit);
    setEditBulkLimit(plan.bulk_scrape_limit);
    setEditExportLimit(plan.export_limit);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan) return;
    setSaveLoading(true);
    setError(null);
    try {
      await superAdminApi.updatePlan(selectedPlan.id, {
        display_name: editDisplayName,
        price_monthly: editPrice,
        search_limit: editSearchLimit,
        scrape_limit: editScrapeLimit,
        bulk_scrape_limit: editBulkLimit,
        export_limit: editExportLimit,
      });
      setSelectedPlan(null);
      fetchPlans();
    } catch (err: any) {
      setError(err.message || 'Failed to update plan.');
    } finally {
      setSaveLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-[#DDE5DE] rounded-[16px] p-5 shadow-sm space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-lg sm:text-xl font-bold font-heading text-[#1D1E18] flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#6B8F71]" />
              Subscription Plans & Usage Limits
            </h1>
            <p className="text-xs text-[#68736B] mt-0.5">
              Configure search quotas, scraping limits, bulk batch constraints, and export allowances
            </p>
          </div>

          <button
            onClick={fetchPlans}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-[10px] bg-[#F6F8F5] border border-[#DDE5DE] text-[#1D1E18]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Plans
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-[#C94A4A]/20 rounded-lg text-xs text-[#C94A4A] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Plan Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          let features: string[] = [];
          try {
            if (plan.features_json) {
              features = JSON.parse(plan.features_json);
            }
          } catch {}

          return (
            <div
              key={plan.id}
              className={`bg-white border rounded-[20px] p-6 shadow-sm flex flex-col justify-between transition-all ${
                plan.name === 'PRO'
                  ? 'border-[#6B8F71] ring-2 ring-[#6B8F71]/20'
                  : 'border-[#DDE5DE] hover:border-[#AAD2BA]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`px-3 py-1 rounded-full text-[11px] font-bold font-mono uppercase tracking-wider ${
                      plan.name === 'PRO'
                        ? 'bg-[#6B8F71] text-white'
                        : plan.name === 'BASIC'
                        ? 'bg-[#EAF4EE] text-[#2F7D4A] border border-[#AAD2BA]'
                        : 'bg-[#F6F8F5] text-[#68736B] border border-[#DDE5DE]'
                    }`}
                  >
                    {plan.name} TIER
                  </span>
                  {plan.name === 'PRO' && <Sparkles className="w-4 h-4 text-[#6B8F71]" />}
                </div>

                <h3 className="text-lg font-bold font-heading text-[#1D1E18]">
                  {plan.display_name}
                </h3>
                <div className="mt-2 mb-4 flex items-baseline gap-1">
                  <span className="text-3xl font-bold font-heading text-[#1D1E18]">
                    ${plan.price_monthly}
                  </span>
                  <span className="text-xs text-[#68736B]">/ month</span>
                </div>

                {/* Quota Limits List */}
                <div className="space-y-2 py-4 border-t border-b border-[#F6F8F5] text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#68736B]">Business Searches:</span>
                    <span className="font-bold font-mono text-[#1D1E18]">{plan.search_limit} / mo</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#68736B]">Website Scrapes:</span>
                    <span className="font-bold font-mono text-[#1D1E18]">{plan.scrape_limit} / mo</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#68736B]">Bulk URLs Batch:</span>
                    <span className="font-bold font-mono text-[#1D1E18]">{plan.bulk_scrape_limit} per batch</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#68736B]">Export Allowance:</span>
                    <span className="font-bold font-mono text-[#1D1E18]">{plan.export_limit} exports / mo</span>
                  </div>
                </div>

                {/* Features List */}
                {features.length > 0 && (
                  <ul className="mt-4 space-y-2 text-xs text-[#68736B]">
                    {features.map((feat, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#2F7D4A] shrink-0" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {isOriginalSuperAdmin && (
                <div className="mt-6 pt-4 border-t border-[#F6F8F5]">
                  <button
                    onClick={() => openEditPlan(plan)}
                    className="w-full py-2 px-3 rounded-[10px] bg-[#F6F8F5] hover:bg-[#EEF4F0] border border-[#DDE5DE] text-xs font-semibold text-[#1D1E18] flex items-center justify-center gap-2 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-[#6B8F71]" />
                    Edit Limits & Pricing
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* --- Modal: Edit Plan --- */}
      {selectedPlan && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-[#DDE5DE] rounded-[20px] shadow-xl w-full max-w-md p-6 modal-safe animate-toast-in">
            <h2 className="text-base font-bold font-heading text-[#1D1E18] mb-1">
              Edit {selectedPlan.name} Plan Settings
            </h2>
            <p className="text-xs text-[#68736B] mb-4">
              Modify tier quotas, monthly rate, and limits.
            </p>

            <form onSubmit={handleSavePlan} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#1D1E18] mb-1">Display Title</label>
                <input
                  type="text"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-[10px] border border-[#DDE5DE] bg-[#F6F8F5] focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1D1E18] mb-1">Monthly Price ($ USD)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editPrice}
                  onChange={(e) => setEditPrice(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-xs rounded-[10px] border border-[#DDE5DE] bg-[#F6F8F5] focus:bg-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1D1E18] mb-1">Search Quota</label>
                  <input
                    type="number"
                    value={editSearchLimit}
                    onChange={(e) => setEditSearchLimit(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-xs rounded-[10px] border border-[#DDE5DE] bg-[#F6F8F5] focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#1D1E18] mb-1">Scrape Quota</label>
                  <input
                    type="number"
                    value={editScrapeLimit}
                    onChange={(e) => setEditScrapeLimit(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-xs rounded-[10px] border border-[#DDE5DE] bg-[#F6F8F5] focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1D1E18] mb-1">Bulk URL Limit</label>
                  <input
                    type="number"
                    value={editBulkLimit}
                    onChange={(e) => setEditBulkLimit(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-xs rounded-[10px] border border-[#DDE5DE] bg-[#F6F8F5] focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#1D1E18] mb-1">Export Limit</label>
                  <input
                    type="number"
                    value={editExportLimit}
                    onChange={(e) => setEditExportLimit(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-xs rounded-[10px] border border-[#DDE5DE] bg-[#F6F8F5] focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#DDE5DE]">
                <button
                  type="button"
                  onClick={() => setSelectedPlan(null)}
                  className="px-4 py-2 rounded-[10px] border border-[#DDE5DE] text-xs font-semibold text-[#68736B] hover:bg-[#F6F8F5]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveLoading}
                  className="px-4 py-2 rounded-[10px] bg-[#6B8F71] hover:bg-[#597A5F] text-white text-xs font-semibold shadow-sm disabled:opacity-50"
                >
                  {saveLoading ? 'Saving...' : 'Save Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
