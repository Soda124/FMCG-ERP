import React, { useState, useEffect } from 'react';
import {
  X,
  Package,
  Factory,
  IndianRupee,
  Layers,
  Hash,
  ReceiptText,
  Copy,
  Check,
  Filter,
  Bot,
  FileCode,
  TrendingUp,
} from 'lucide-react';
import { FMCGRecord } from '../types/fmcg';
import {
  formatINR,
  formatINRFull,
  formatUnits,
  formatNumberFull,
} from '../utils/currencyFormatter';

interface RecordDetailModalProps {
  record: FMCGRecord | null;
  onClose: () => void;
  onFilterBrand?: (brand: string) => void;
  onFilterPlant?: (plant: string) => void;
  onAskAI?: (prompt: string) => void;
}

export const RecordDetailModal: React.FC<RecordDetailModalProps> = ({
  record,
  onClose,
  onFilterBrand,
  onFilterPlant,
  onAskAI,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'json'>('overview');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (record) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [record, onClose]);

  if (!record) return null;

  const realization =
    record.Units_Sold > 0 ? record.Sales_INR / record.Units_Sold : 0;
  const avgOrderValue =
    record.Transaction_Rows > 0 ? record.Sales_INR / record.Transaction_Rows : 0;
  const avgUnitsPerOrder =
    record.Transaction_Rows > 0 ? record.Units_Sold / record.Transaction_Rows : 0;

  const handleCopyJSON = () => {
    navigator.clipboard.writeText(JSON.stringify(record, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-[#002d2d]/50 backdrop-blur-xs"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-lg shadow-xl border border-[#b9dcdb] w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden text-[#002d2d]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Brand Accent Line */}
        <div className="h-1 bg-[#004c4c] w-full" />

        {/* Modal Top Header */}
        <div className="px-6 py-4 bg-[#F2F6F4] border-b border-[#b9dcdb] flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold text-[#004c4c] bg-[#004c4c]/10 px-2 py-0.5 rounded border border-[#004c4c]/20">
                {record.Category}
              </span>
              <span className="text-[11px] font-medium text-[#1c4b4b] bg-white px-2 py-0.5 rounded border border-[#b9dcdb]">
                {record.Month} • {record.Quarter}
              </span>
              <span className="text-[11px] text-[#1c4b4b] tabular-nums">
                Month index {record.Month_Index} of 12
              </span>
            </div>
            <h2 className="text-[20px] sm:text-[22px] font-bold text-[#002d2d] tracking-tight">
              {record.Brand}
            </h2>
            {record.SKU && (
              <p className="text-[12px] font-semibold text-[#004c4c]">
                SKU: {record.SKU}
              </p>
            )}
            <p className="text-[12px] text-[#1c4b4b] flex items-center gap-2">
              <span>Plant: <strong className="text-[#002d2d] font-semibold">{record.Plant}</strong></span>
              <span>•</span>
              <span>Channel: <strong className="text-[#002d2d] font-semibold">{record.Distributor}</strong></span>
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded text-[#1c4b4b] hover:text-[#002d2d] hover:bg-white transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Toolbar */}
        <div className="px-6 py-2.5 bg-white border-b border-[#b9dcdb] flex flex-wrap items-center justify-between gap-2 text-[12px]">
          {/* Quick Context Filters */}
          <div className="flex items-center flex-wrap gap-1.5">
            {onFilterBrand && (
              <button
                onClick={() => {
                  onFilterBrand(record.Brand);
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-white hover:bg-[#F2F6F4] text-[#002d2d] border border-[#b9dcdb] transition-colors font-medium cursor-pointer"
                title={`Filter dashboard to ${record.Brand}`}
              >
                <Filter className="w-3 h-3 text-[#004c4c]" />
                <span>Filter by Brand</span>
              </button>
            )}

            {onFilterPlant && (
              <button
                onClick={() => {
                  onFilterPlant(record.Plant);
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-white hover:bg-[#F2F6F4] text-[#002d2d] border border-[#b9dcdb] transition-colors font-medium cursor-pointer"
                title={`Filter dashboard to ${record.Plant}`}
              >
                <Factory className="w-3 h-3 text-[#1c4b4b]" />
                <span>Filter by Plant</span>
              </button>
            )}

            {onAskAI && (
              <button
                onClick={() => {
                  onAskAI(`Analyze commercial performance for ${record.Brand} (${record.SKU || ''}) in ${record.Month} at ${record.Plant}. Net sales: ${formatINR(record.Sales_INR)}, units: ${formatUnits(record.Units_Sold)}, realization: ₹${realization.toFixed(1)}/u. State fact-based root causes for this dispatch.`);
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#004c4c] hover:bg-[#002d2d] text-white font-medium transition-colors cursor-pointer"
                title="Send record to AI FMCG Analyst"
              >
                <Bot className="w-3.5 h-3.5 text-[#ffedd5]" />
                <span>Ask AI Analyst</span>
              </button>
            )}
          </div>

          {/* View Tab Switcher & Copy */}
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded bg-[#F2F6F4] p-0.5 border border-[#b9dcdb] text-[11px]">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-2.5 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                  activeTab === 'overview'
                    ? 'bg-white text-[#004c4c] font-bold shadow-xs'
                    : 'text-[#1c4b4b] hover:text-[#002d2d]'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('json')}
                className={`px-2.5 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                  activeTab === 'json'
                    ? 'bg-white text-[#004c4c] font-bold shadow-xs'
                    : 'text-[#1c4b4b] hover:text-[#002d2d]'
                }`}
              >
                Raw JSON
              </button>
            </div>

            <button
              onClick={handleCopyJSON}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white hover:bg-[#F2F6F4] border border-[#b9dcdb] text-[11px] text-[#002d2d] font-medium transition-colors cursor-pointer"
              title="Copy record data as JSON"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-[#004c4c]" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3 text-[#1c4b4b]" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'overview' ? (
            <>
              {/* Row 1: High-Level Commercial Numbers */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="bg-[#F2F6F4] rounded-lg border border-[#b9dcdb] p-4">
                  <div className="flex items-center justify-between text-[11px] text-[#1c4b4b]">
                    <span className="font-semibold uppercase tracking-wider">Gross Sales</span>
                    <IndianRupee className="w-3.5 h-3.5 text-[#004c4c]" />
                  </div>
                  <div
                    className="text-[26px] font-bold text-[#002d2d] mt-1 tabular-nums cursor-default"
                    title={formatINRFull(record.Sales_INR)}
                  >
                    {formatINR(record.Sales_INR)}
                  </div>
                  <div className="text-[11px] text-[#1c4b4b] mt-1 tabular-nums">
                    {formatINRFull(record.Sales_INR)}
                  </div>
                </div>

                <div className="bg-[#F2F6F4] rounded-lg border border-[#b9dcdb] p-4">
                  <div className="flex items-center justify-between text-[11px] text-[#1c4b4b]">
                    <span className="font-semibold uppercase tracking-wider">Volume Dispatched</span>
                    <Package className="w-3.5 h-3.5 text-[#004c4c]" />
                  </div>
                  <div className="text-[26px] font-bold text-[#002d2d] mt-1 tabular-nums">
                    {formatUnits(record.Units_Sold)}
                  </div>
                  <div className="text-[11px] text-[#1c4b4b] mt-1 tabular-nums">
                    {formatNumberFull(record.Units_Sold)} total units
                  </div>
                </div>

                <div className="bg-[#F2F6F4] rounded-lg border border-[#b9dcdb] p-4">
                  <div className="flex items-center justify-between text-[11px] text-[#1c4b4b]">
                    <span className="font-semibold uppercase tracking-wider">Realization</span>
                    <TrendingUp className="w-3.5 h-3.5 text-[#004c4c]" />
                  </div>
                  <div className="text-[26px] font-bold text-[#004c4c] mt-1 tabular-nums">
                    ₹{realization.toFixed(2)}
                  </div>
                  <div className="text-[11px] text-[#1c4b4b] mt-1">
                    Revenue realized per dispatched unit
                  </div>
                </div>
              </div>

              {/* Row 2: Comprehensive Metadata Matrix */}
              <div className="bg-white rounded-lg border border-[#b9dcdb] overflow-hidden">
                <div className="px-4 py-2.5 bg-[#F2F6F4] border-b border-[#b9dcdb] text-[12px] font-bold text-[#002d2d]">
                  Commercial Record Specifications
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[#b9dcdb] text-[12px]">
                  <div className="divide-y divide-[#b9dcdb]/70">
                    <div className="p-3 flex justify-between">
                      <span className="text-[#1c4b4b]">Product Line:</span>
                      <strong className="text-[#002d2d] font-semibold">{record.Category}</strong>
                    </div>
                    <div className="p-3 flex justify-between">
                      <span className="text-[#1c4b4b]">Brand:</span>
                      <strong className="text-[#002d2d] font-semibold">{record.Brand}</strong>
                    </div>
                    {record.SKU && (
                      <div className="p-3 flex justify-between">
                        <span className="text-[#1c4b4b]">SKU Code & Name:</span>
                        <strong className="text-[#004c4c] font-semibold">{record.SKU}</strong>
                      </div>
                    )}
                    <div className="p-3 flex justify-between">
                      <span className="text-[#1c4b4b]">Manufacturing Facility:</span>
                      <strong className="text-[#002d2d] font-semibold">{record.Plant}</strong>
                    </div>
                    <div className="p-3 flex justify-between">
                      <span className="text-[#1c4b4b]">Primary Distributor:</span>
                      <strong className="text-[#002d2d] font-semibold">{record.Distributor}</strong>
                    </div>
                  </div>

                  <div className="divide-y divide-[#b9dcdb]/70">
                    <div className="p-3 flex justify-between">
                      <span className="text-[#1c4b4b]">Accounting Period:</span>
                      <strong className="text-[#002d2d] font-semibold">{record.Month} ({record.Quarter})</strong>
                    </div>
                    <div className="p-3 flex justify-between">
                      <span className="text-[#1c4b4b]">Transaction Lines Logged:</span>
                      <strong className="text-[#002d2d] font-semibold">{record.Transaction_Rows} order lines</strong>
                    </div>
                    <div className="p-3 flex justify-between">
                      <span className="text-[#1c4b4b]">Avg Basket Ticket:</span>
                      <strong className="text-[#002d2d] font-semibold">{formatINR(Math.round(avgOrderValue))}</strong>
                    </div>
                    <div className="p-3 flex justify-between">
                      <span className="text-[#1c4b4b]">Avg Units per Order Line:</span>
                      <strong className="text-[#002d2d] font-semibold">{Math.round(avgUnitsPerOrder)} units</strong>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="relative">
              <pre className="bg-[#002d2d] text-[#ffedd5] p-4 rounded-md text-[11px] font-mono overflow-x-auto leading-relaxed border border-[#8c1e1c]">
                {JSON.stringify(record, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-[#F2F6F4] border-t border-[#b9dcdb] flex items-center justify-between text-[11px] text-[#1c4b4b]">
          <span>FMCG Commercial Analytics Record</span>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-white hover:bg-[#F2F6F4] text-[#002d2d] border border-[#b9dcdb] rounded font-semibold cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
