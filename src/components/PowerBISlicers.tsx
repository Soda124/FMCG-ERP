import React from 'react';
import { Filter, X, Search, ChevronDown, SlidersHorizontal, Package, Factory, Truck } from 'lucide-react';
import { FilterState } from '../types/fmcg';

interface SlicerOptions {
  quarters: string[];
  months: { name: string; index: number; quarter: string }[];
  categories: string[];
  brands: string[];
  skus: string[];
  plants: string[];
  distributors: string[];
}

interface PowerBISlicersProps {
  filters: FilterState;
  options: SlicerOptions;
  onFilterChange: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  onResetFilters: () => void;
  filteredCount: number;
  totalCount: number;
}

export const PowerBISlicers: React.FC<PowerBISlicersProps> = ({
  filters,
  options,
  onFilterChange,
  onResetFilters,
  filteredCount,
  totalCount,
}) => {
  const activeFilterList = [
    { key: 'quarter', label: `Quarter: ${filters.quarter}`, active: filters.quarter !== 'All' },
    { key: 'month', label: `Month: ${filters.month}`, active: filters.month !== 'All' },
    { key: 'category', label: `Line: ${filters.category}`, active: filters.category !== 'All' },
    { key: 'brand', label: `Brand: ${filters.brand}`, active: filters.brand !== 'All' },
    { key: 'sku', label: `SKU: ${filters.sku}`, active: filters.sku !== 'All' },
    { key: 'plant', label: `Plant: ${filters.plant}`, active: filters.plant !== 'All' },
    { key: 'distributor', label: `Distributor: ${filters.distributor}`, active: filters.distributor !== 'All' },
    { key: 'search', label: `Search: "${filters.search}"`, active: filters.search !== '' },
  ].filter((f) => f.active) as { key: keyof FilterState; label: string }[];

  const isSpecificScoped = filters.category !== 'All' || filters.sku !== 'All';

  return (
    <div className="bg-white/70 backdrop-blur-md border-b border-[#34a1a5]/25 px-4 sm:px-6 py-2.5">
      <div className="max-w-[1600px] mx-auto flex flex-col gap-2">
        {/* Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left: Quarter Toggle Button Group (MacBook Glass Style) */}
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-bold text-[#002d2d] flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#004c4c]" />
              <span>Quarter:</span>
            </span>
            <div className="p-1 rounded-xl bg-white/75 backdrop-blur-md border border-[#34a1a5]/25 flex items-center shadow-inner">
              {['All', ...options.quarters].map((q) => {
                const isSelected = filters.quarter === q;
                return (
                  <button
                    key={q}
                    onClick={() => {
                      onFilterChange('quarter', q);
                      if (q !== 'All' && filters.month !== 'All') {
                        const monthMeta = options.months.find((m) => m.name === filters.month);
                        if (monthMeta && monthMeta.quarter !== q) {
                          onFilterChange('month', 'All');
                        }
                      }
                    }}
                    className={`h-7 px-3 text-[12px] font-bold rounded-lg transition-all duration-200 cursor-pointer ${
                      isSelected
                        ? 'glass-btn-primary shadow-sm'
                        : 'text-[#004c4c] hover:bg-white/80'
                    }`}
                  >
                    {q}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Dropdowns and Search */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Month Dropdown */}
            <div className="relative">
              <select
                value={filters.month}
                onChange={(e) => onFilterChange('month', e.target.value)}
                className={`h-8.5 appearance-none bg-white/80 backdrop-blur-md border text-[12px] rounded-xl pl-3 pr-8 py-1 focus:outline-none focus:ring-2 focus:ring-[#34a1a5]/30 font-bold cursor-pointer transition-all shadow-2xs ${
                  filters.month !== 'All'
                    ? 'border-[#004c4c] bg-[#ffedd5]/60 text-[#004c4c] ring-1 ring-[#004c4c]'
                    : 'border-[#34a1a5]/30 text-[#002d2d] hover:border-[#34a1a5]/60'
                }`}
                aria-label="Filter by Month"
              >
                <option value="All">All Months</option>
                {options.months
                  .filter((m) => filters.quarter === 'All' || m.quarter === filters.quarter)
                  .map((m) => (
                    <option key={m.name} value={m.name}>
                      {m.name} ({m.quarter})
                    </option>
                  ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#004c4c] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Category Dropdown */}
            <div className="relative">
              <select
                value={filters.category}
                onChange={(e) => {
                  const newCat = e.target.value;
                  onFilterChange('category', newCat);
                }}
                className={`h-8.5 appearance-none bg-white/80 backdrop-blur-md border text-[12px] rounded-xl pl-3 pr-8 py-1 focus:outline-none focus:ring-2 focus:ring-[#34a1a5]/30 font-bold cursor-pointer transition-all shadow-2xs ${
                  filters.category !== 'All'
                    ? 'border-[#004c4c] bg-[#ffedd5]/60 text-[#004c4c] ring-1 ring-[#004c4c]'
                    : 'border-[#34a1a5]/30 text-[#002d2d] hover:border-[#34a1a5]/60'
                }`}
                aria-label="Filter by Product Line"
              >
                <option value="All">All Product Lines (4)</option>
                {options.categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#004c4c] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Brand Dropdown (Dependent on Category) */}
            <div className="relative">
              <select
                value={filters.brand}
                onChange={(e) => onFilterChange('brand', e.target.value)}
                className={`h-8.5 appearance-none bg-white/80 backdrop-blur-md border text-[12px] rounded-xl pl-3 pr-8 py-1 focus:outline-none focus:ring-2 focus:ring-[#34a1a5]/30 font-bold cursor-pointer transition-all shadow-2xs ${
                  filters.brand !== 'All'
                    ? 'border-[#004c4c] bg-[#ffedd5]/60 text-[#004c4c] ring-1 ring-[#004c4c]'
                    : 'border-[#34a1a5]/30 text-[#002d2d] hover:border-[#34a1a5]/60'
                }`}
                aria-label="Filter by Brand"
              >
                <option value="All">All Brands ({options.brands.length})</option>
                {options.brands.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#004c4c] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* SKU Dropdown (Dynamically Scoped by Category & Brand) */}
            <div className="relative">
              <select
                value={filters.sku}
                onChange={(e) => onFilterChange('sku', e.target.value)}
                className={`h-8.5 max-w-[190px] appearance-none bg-white/80 backdrop-blur-md border text-[12px] rounded-xl pl-3 pr-8 py-1 focus:outline-none focus:ring-2 focus:ring-[#34a1a5]/30 font-bold cursor-pointer transition-all shadow-2xs truncate ${
                  filters.sku !== 'All'
                    ? 'border-[#004c4c] bg-[#ffedd5]/60 text-[#004c4c] ring-1 ring-[#004c4c]'
                    : 'border-[#34a1a5]/30 text-[#002d2d] hover:border-[#34a1a5]/60'
                }`}
                aria-label="Filter by Specific SKU"
              >
                <option value="All">
                  {filters.category !== 'All'
                    ? `All SKUs in ${filters.category} (${options.skus.length})`
                    : `All SKUs (${options.skus.length})`}
                </option>
                {options.skus.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#004c4c] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Plant Dropdown (Dynamically updated to only plants producing selected SKU / Category) */}
            <div className="relative">
              <select
                value={filters.plant}
                onChange={(e) => onFilterChange('plant', e.target.value)}
                className={`h-8.5 appearance-none bg-white/80 backdrop-blur-md border text-[12px] rounded-xl pl-3 pr-8 py-1 focus:outline-none focus:ring-2 focus:ring-[#34a1a5]/30 font-bold cursor-pointer transition-all shadow-2xs ${
                  filters.plant !== 'All'
                    ? 'border-[#004c4c] bg-[#ffedd5]/60 text-[#004c4c] ring-1 ring-[#004c4c]'
                    : isSpecificScoped
                    ? 'border-[#004c4c]/40 text-[#004c4c] bg-[#34a1a5]/10'
                    : 'border-[#34a1a5]/30 text-[#002d2d] hover:border-[#34a1a5]/60'
                }`}
                aria-label="Filter by Plant"
              >
                <option value="All">
                  {isSpecificScoped
                    ? `All Connected Plants (${options.plants.length})`
                    : 'All 8 Plants'}
                </option>
                {options.plants.map((p) => (
                  <option key={p} value={p}>
                    🏭 {p}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#004c4c] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Distributor Dropdown (Dynamically updated to only distributors handling selected SKU / Category) */}
            <div className="relative">
              <select
                value={filters.distributor}
                onChange={(e) => onFilterChange('distributor', e.target.value)}
                className={`h-8.5 appearance-none bg-white/80 backdrop-blur-md border text-[12px] rounded-xl pl-3 pr-8 py-1 focus:outline-none focus:ring-2 focus:ring-[#34a1a5]/30 font-bold cursor-pointer transition-all shadow-2xs ${
                  filters.distributor !== 'All'
                    ? 'border-[#004c4c] bg-[#ffedd5]/60 text-[#004c4c] ring-1 ring-[#004c4c]'
                    : isSpecificScoped
                    ? 'border-[#004c4c]/40 text-[#004c4c] bg-[#34a1a5]/10'
                    : 'border-[#34a1a5]/30 text-[#002d2d] hover:border-[#34a1a5]/60'
                }`}
                aria-label="Filter by Distributor"
              >
                <option value="All">
                  {isSpecificScoped
                    ? `All Connected Distributors (${options.distributors.length})`
                    : 'All 13 Distributors'}
                </option>
                {options.distributors.map((d) => (
                  <option key={d} value={d}>
                    📦 {d}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#004c4c] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search SKU or channel..."
                value={filters.search}
                onChange={(e) => onFilterChange('search', e.target.value)}
                className="h-8.5 w-36 sm:w-48 bg-white/85 backdrop-blur-md border border-[#34a1a5]/30 focus:border-[#004c4c] text-[#002d2d] placeholder-[#1c4b4b]/60 text-[12px] rounded-xl pl-8 pr-3 py-1 focus:outline-none focus:ring-2 focus:ring-[#34a1a5]/30 font-medium transition-all shadow-2xs"
              />
              <Search className="w-3.5 h-3.5 text-[#004c4c] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Active Filter Chips Bar */}
        {activeFilterList.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-[#34a1a5]/20 text-[12px]">
            <span className="text-[#1c4b4b] text-[11px] font-bold mr-1">
              Active Filters ({filteredCount.toLocaleString()} matching records):
            </span>
            {activeFilterList.map((f) => (
              <span
                key={f.key}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-[#ffedd5] text-[#004c4c] border border-[#f59e0b]/40 rounded-lg text-[11px] font-bold shadow-2xs"
              >
                <span>{f.label}</span>
                <button
                  onClick={() => onFilterChange(f.key, f.key === 'search' ? '' : 'All')}
                  className="text-[#004c4c] hover:text-[#8c1e1c] cursor-pointer ml-0.5"
                  title="Remove filter"
                >
                  <X className="w-3 h-3 stroke-[2.5]" />
                </button>
              </span>
            ))}
            <button
              onClick={onResetFilters}
              className="text-[11px] text-[#004c4c] hover:underline cursor-pointer ml-2 font-bold"
            >
              Clear all
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
