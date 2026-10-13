import React, { useRef, useState } from 'react';
import {
  Upload,
  RotateCcw,
  Bot,
  FileSpreadsheet,
  Download,
  BarChart2,
  ChevronDown,
} from 'lucide-react';
import { FMCGRecord, FilterState } from '../types/fmcg';
import { exportDatasetToExcel, exportDatasetToCSV } from '../utils/fileParser';

interface HeaderProps {
  fileName: string;
  isCustomFile: boolean;
  totalRecords: number;
  filteredRecordsCount: number;
  filters: FilterState;
  onResetFilters: () => void;
  onFileUpload: (file: File) => void;
  onResetToDefault: () => void;
  isChatOpen: boolean;
  onToggleChat: () => void;
  activeData: FMCGRecord[];
}

export const Header: React.FC<HeaderProps> = ({
  fileName,
  isCustomFile,
  totalRecords,
  filteredRecordsCount,
  filters,
  onResetFilters,
  onFileUpload,
  onResetToDefault,
  isChatOpen,
  onToggleChat,
  activeData,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const hasActiveFilters =
    filters.quarter !== 'All' ||
    filters.month !== 'All' ||
    filters.category !== 'All' ||
    filters.brand !== 'All' ||
    filters.plant !== 'All' ||
    filters.distributor !== 'All' ||
    filters.sku !== 'All' ||
    filters.search !== '';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileUpload(file);
      e.target.value = '';
    }
  };

  return (
    <header className="bg-white/85 backdrop-blur-md border-b border-[#34a1a5]/25 sticky top-0 z-30 shadow-xs">
      {/* Brand Accent Top Border */}
      <div className="h-0.5 bg-gradient-to-r from-[#004c4c] via-[#34a1a5] to-[#ffedd5] w-full" />

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Left Side: Brand Identity */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Brand Mark with Glassy Sheen */}
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#004c4c] to-[#34a1a5] flex items-center justify-center text-white shrink-0 relative shadow-sm shadow-[#004c4c]/20 border border-white/30">
            <BarChart2 className="w-4 h-4 stroke-[2]" />
          </div>

          <div className="flex items-center gap-2.5 min-w-0">
            <h1 className="text-[17px] font-extrabold text-[#002d2d] tracking-tight leading-tight whitespace-nowrap">
              FMCG Commercial Pulse
            </h1>
            {isCustomFile && (
              <button
                onClick={onResetToDefault}
                className="text-[11px] text-[#004c4c] hover:underline cursor-pointer font-bold bg-[#ffedd5] px-2 py-0.5 rounded-md border border-[#34a1a5]/30 shrink-0"
                title="Revert back to standard sample dataset"
              >
                Reset to default
              </button>
            )}
          </div>
        </div>

        {/* Right Side: Action Toolbar (MacBook Glassy Style) */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Upload Dataset */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".xlsx, .xls, .csv"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="glass-btn h-8.5 px-3 text-[12px] gap-1.5"
            title="Upload Excel (.xlsx) or CSV file with FMCG schema"
          >
            <Upload className="w-3.5 h-3.5 text-[#004c4c]" />
            <span className="hidden sm:inline">Upload Dataset</span>
          </button>

          {/* Export Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="glass-btn h-8.5 px-3 text-[12px] gap-1.5"
              title="Download FMCG data or template"
            >
              <Download className="w-3.5 h-3.5 text-[#004c4c]" />
              <span className="hidden sm:inline">Export</span>
              <ChevronDown className="w-3 h-3 text-[#1c4b4b]" />
            </button>
            {showExportMenu && (
              <div
                className="absolute right-0 mt-1.5 w-52 bg-white/95 backdrop-blur-md rounded-xl shadow-lg border border-[#34a1a5]/30 py-1.5 z-50 text-[12px]"
                onMouseLeave={() => setShowExportMenu(false)}
              >
                <button
                  onClick={() => {
                    exportDatasetToExcel(activeData, 'FMCG_Analytics_Export.xlsx');
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-[#ffedd5]/60 text-[#002d2d] flex items-center gap-2.5 transition-colors cursor-pointer font-medium"
                >
                  <FileSpreadsheet className="w-4 h-4 text-[#004c4c]" />
                  <span>Download Excel (.xlsx)</span>
                </button>
                <button
                  onClick={() => {
                    exportDatasetToCSV(activeData, 'FMCG_Analytics_Export.csv');
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-[#ffedd5]/60 text-[#002d2d] flex items-center gap-2.5 transition-colors cursor-pointer font-medium"
                >
                  <Download className="w-4 h-4 text-[#34a1a5]" />
                  <span>Download CSV (.csv)</span>
                </button>
              </div>
            )}
          </div>

          {/* Reset Filters */}
          <button
            onClick={onResetFilters}
            disabled={!hasActiveFilters}
            className={`h-8.5 px-3 rounded-xl text-[12px] font-bold flex items-center gap-1.5 transition-all ${
              hasActiveFilters
                ? 'glass-btn hover:border-[#ff6b68]/50 text-[#002d2d]'
                : 'bg-black/5 text-black/30 border border-black/10 cursor-not-allowed opacity-50'
            }`}
            title="Reset all slicers and search filters"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#1c4b4b]" />
            <span className="hidden md:inline">Reset</span>
          </button>

          {/* AI FMCG Analyst Trigger (MacBook Glass Primary) */}
          <button
            onClick={onToggleChat}
            className={`h-8.5 px-3.5 text-[12px] gap-1.5 ${
              isChatOpen ? 'glass-btn-coral' : 'glass-btn-primary'
            }`}
          >
            <Bot className="w-4 h-4 stroke-[2]" />
            <span>AI Analyst</span>
          </button>
        </div>
      </div>
    </header>
  );
};
