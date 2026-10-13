import React, { useState, useMemo } from 'react';
import { FMCGRecord, FilterState, KPISummary } from './types/fmcg';
import { defaultFMCGData, MONTHS_METADATA } from './data/defaultFMCGData';
import { parseFMCGFile } from './utils/fileParser';
import { Header } from './components/Header';
import { PowerBISlicers } from './components/PowerBISlicers';
import { KPICards } from './components/KPICards';
import { VisualTopBrands } from './components/VisualTopBrands';
import { VisualSalesTrend } from './components/VisualSalesTrend';
import { VisualDataTable } from './components/VisualDataTable';
import { VisualSupplyChainMatrix } from './components/VisualSupplyChainMatrix';
import { IndiaSupplyChainMap } from './components/IndiaSupplyChainMap';
import { AIChatSidebar } from './components/AIChatSidebar';
import { ExecutiveOverview } from './components/ExecutiveOverview';
import { ABCXYZHeatmap } from './components/ABCXYZHeatmap';
import { DistributorRankBumpChart } from './components/DistributorRankBumpChart';
import {
  AlertCircle,
  CheckCircle2,
  LayoutDashboard,
  Grid3X3,
  TrendingUp,
  MapPin,
  TableProperties,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Layers,
  Network,
} from 'lucide-react';
import { formatINR, formatUnits, formatNumberFull } from './utils/currencyFormatter';

type ActiveSubPage = 'executive' | 'abcxyz' | 'sales' | 'supplychain' | 'ledger';

const INITIAL_FILTERS: FilterState = {
  quarter: 'All',
  month: 'All',
  category: 'All',
  brand: 'All',
  sku: 'All',
  plant: 'All',
  distributor: 'All',
  search: '',
};

export default function App() {
  const [data, setData] = useState<FMCGRecord[]>(defaultFMCGData);
  const [fileName, setFileName] = useState<string>('Default FMCG Sample Dataset');
  const [isCustomFile, setIsCustomFile] = useState<boolean>(false);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Active Sub-Page Navigation
  const [activeSubPage, setActiveSubPage] = useState<ActiveSubPage>('executive');
  const [isSlicersCollapsed, setIsSlicersCollapsed] = useState<boolean>(false);
  const [supplyChainViewMode, setSupplyChainViewMode] = useState<'both' | 'map' | 'matrix'>('both');

  // Filters State
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);

  // AI Chat Sidebar State
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [pendingAIPrompt, setPendingAIPrompt] = useState<string | null>(null);

  const handleAskAIFromRecord = (prompt: string) => {
    setPendingAIPrompt(prompt);
    setIsChatOpen(true);
  };

  // Period Comparison Mode State ('month' or 'quarter')
  const [comparisonMode, setComparisonMode] = useState<'month' | 'quarter'>('month');

  // Effective comparison mode based on active filters
  const effectiveComparisonMode = useMemo(() => {
    if (filters.month !== 'All') return 'month';
    if (filters.quarter !== 'All') return 'quarter';
    return comparisonMode;
  }, [filters.month, filters.quarter, comparisonMode]);

  // Derive unique options for slicers dynamically updated based on active selections
  const slicerOptions = useMemo(() => {
    const quarters = Array.from(new Set(data.map((r) => r.Quarter))).filter(Boolean).sort();
    const categories = Array.from(new Set(data.map((r) => r.Category))).filter(Boolean).sort();

    // Dynamically filter brands by selected category
    const brands = Array.from(
      new Set(
        data
          .filter((r) => filters.category === 'All' || r.Category === filters.category)
          .map((r) => r.Brand)
      )
    ).filter(Boolean).sort();

    // Dynamically filter SKUs by selected category & brand
    const skus = Array.from(
      new Set(
        data
          .filter(
            (r) =>
              (filters.category === 'All' || r.Category === filters.category) &&
              (filters.brand === 'All' || r.Brand === filters.brand)
          )
          .map((r) => r.SKU)
      )
    ).filter(Boolean).sort() as string[];

    // Dynamically filter plants:
    // If specific SKU is selected: only plants manufacturing that SKU!
    // Else if specific Product Line is selected: only plants producing that line (exactly 2 plants per line)!
    // Else if specific Brand is selected: only plants producing that brand!
    // Else: all 8 plants.
    const plants = Array.from(
      new Set(
        data
          .filter((r) => {
            if (filters.sku !== 'All') return r.SKU === filters.sku;
            if (filters.category !== 'All') return r.Category === filters.category;
            if (filters.brand !== 'All') return r.Brand === filters.brand;
            return true;
          })
          .map((r) => r.Plant)
      )
    ).filter(Boolean).sort();

    // Dynamically filter distributors:
    // If specific SKU is selected: only distributors handling that SKU!
    // Else if specific Product Line is selected: only distributors handling that line!
    // Else if specific Brand is selected: only distributors handling that brand!
    // Else if specific Plant is selected: only distributors receiving from that plant!
    // Else: all 13 distributors.
    const distributors = Array.from(
      new Set(
        data
          .filter((r) => {
            if (filters.sku !== 'All') return r.SKU === filters.sku;
            if (filters.category !== 'All') return r.Category === filters.category;
            if (filters.brand !== 'All') return r.Brand === filters.brand;
            if (filters.plant !== 'All') return r.Plant === filters.plant;
            return true;
          })
          .map((r) => r.Distributor)
      )
    ).filter(Boolean).sort();

    return {
      quarters,
      months: MONTHS_METADATA,
      categories,
      brands,
      skus,
      plants,
      distributors,
    };
  }, [data, filters.category, filters.brand, filters.sku, filters.plant]);

  // Apply filters
  const filteredData = useMemo(() => {
    return data.filter((row) => {
      if (filters.quarter !== 'All' && row.Quarter !== filters.quarter) return false;
      if (filters.month !== 'All' && row.Month !== filters.month) return false;
      if (filters.category !== 'All' && row.Category !== filters.category) return false;
      if (filters.brand !== 'All' && row.Brand !== filters.brand) return false;
      if (filters.sku !== 'All' && row.SKU !== filters.sku) return false;
      if (filters.plant !== 'All' && row.Plant !== filters.plant) return false;
      if (filters.distributor !== 'All' && row.Distributor !== filters.distributor) return false;

      if (filters.search) {
        const q = filters.search.toLowerCase();
        const matches =
          row.Brand.toLowerCase().includes(q) ||
          (row.SKU && row.SKU.toLowerCase().includes(q)) ||
          row.Category.toLowerCase().includes(q) ||
          row.Plant.toLowerCase().includes(q) ||
          row.Distributor.toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [data, filters]);

  // Calculate KPIs and Period-over-Period comparisons
  const kpis: KPISummary = useMemo(() => {
    let totalSales = 0;
    let totalUnits = 0;
    let totalTransactions = 0;

    filteredData.forEach((row) => {
      totalSales += row.Sales_INR;
      totalUnits += row.Units_Sold;
      totalTransactions += row.Transaction_Rows;
    });

    const avgRealization = totalUnits > 0 ? totalSales / totalUnits : 0;

    // Calculate period-over-period comparison against total dataset
    let prevRecords: FMCGRecord[] = [];
    let currentPeriodLabel = 'Current Slice';
    let priorPeriodLabel = 'Prior Period';

    const prevQuarterMap: Record<string, string> = {
      Q1: 'Q4',
      Q2: 'Q1',
      Q3: 'Q2',
      Q4: 'Q3',
    };

    if (effectiveComparisonMode === 'month') {
      if (filters.month !== 'All') {
        const curMeta = MONTHS_METADATA.find((m) => m.name.toLowerCase() === filters.month.toLowerCase());
        const curIndex = curMeta?.index ?? 1;
        const prevIndex = curIndex > 1 ? curIndex - 1 : 12;
        const prevMeta = MONTHS_METADATA.find((m) => m.index === prevIndex);
        currentPeriodLabel = filters.month;
        priorPeriodLabel = prevMeta ? `${prevMeta.name} (${prevMeta.quarter})` : 'Prior Month';
        prevRecords = data.filter((r) => r.Month_Index === prevIndex || r.Month === prevMeta?.name);
      } else {
        const prevIndex = 11;
        const prevMeta = MONTHS_METADATA.find((m) => m.index === prevIndex);
        currentPeriodLabel = 'All Months';
        priorPeriodLabel = prevMeta ? `${prevMeta.name} (${prevMeta.quarter})` : 'February (Q4)';
        prevRecords = data.filter((r) => r.Month_Index === prevIndex || r.Month === prevMeta?.name);
      }
    } else {
      if (filters.quarter !== 'All') {
        const prevQ = prevQuarterMap[filters.quarter] || 'Q1';
        currentPeriodLabel = filters.quarter;
        priorPeriodLabel = prevQ;
        prevRecords = data.filter((r) => r.Quarter === prevQ);
      } else {
        currentPeriodLabel = 'All Quarters';
        priorPeriodLabel = 'Q3';
        prevRecords = data.filter((r) => r.Quarter === 'Q3');
      }
    }

    const prevSales = prevRecords.reduce((acc, r) => acc + r.Sales_INR, 0);
    const prevUnits = prevRecords.reduce((acc, r) => acc + r.Units_Sold, 0);
    const prevRealization = prevUnits > 0 ? prevSales / prevUnits : 0;
    const prevTransactions = prevRecords.reduce((acc, r) => acc + r.Transaction_Rows, 0);

    const calcTrend = (current: number, prior: number, formatter: (val: number) => string) => {
      const pctChange = prior > 0 ? ((current - prior) / prior) * 100 : 0;
      return {
        pctChange,
        isPositive: pctChange >= 0,
        priorValue: prior,
        formattedPrior: formatter(prior),
        absoluteDiff: current - prior,
      };
    };

    const comparison = {
      comparisonType: effectiveComparisonMode,
      currentPeriodLabel,
      priorPeriodLabel,
      salesTrend: calcTrend(totalSales, prevSales, formatINR),
      unitsTrend: calcTrend(totalUnits, prevUnits, (v) => `${formatUnits(v)} units`),
      realizationTrend: calcTrend(avgRealization, prevRealization, (v) => `₹${v.toFixed(2)}/u`),
      transactionsTrend: calcTrend(totalTransactions, prevTransactions, (v) => `${formatNumberFull(v)} rows`),
    };

    return {
      totalSales,
      totalUnits,
      avgRealization,
      totalTransactions,
      recordCount: filteredData.length,
      comparison,
    };
  }, [filteredData, data, effectiveComparisonMode, filters.month, filters.quarter]);

  // Filter change handler with cascading dynamic cleanups
  const handleFilterChange = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };

      // When Product Line (category) changes:
      if (key === 'category') {
        if (value !== 'All') {
          // If selected brand is not in this category, reset brand
          const validBrands = new Set(data.filter((r) => r.Category === value).map((r) => r.Brand));
          if (next.brand !== 'All' && !validBrands.has(next.brand)) next.brand = 'All';

          // If selected SKU is not in this category, reset SKU
          const validSkus = new Set(data.filter((r) => r.Category === value).map((r) => r.SKU));
          if (next.sku !== 'All' && !validSkus.has(next.sku)) next.sku = 'All';

          // If selected plant is not in this category, reset plant
          const validPlants = new Set(data.filter((r) => r.Category === value).map((r) => r.Plant));
          if (next.plant !== 'All' && !validPlants.has(next.plant)) next.plant = 'All';

          // If selected distributor does not distribute this category, reset distributor
          const validDists = new Set(data.filter((r) => r.Category === value).map((r) => r.Distributor));
          if (next.distributor !== 'All' && !validDists.has(next.distributor)) next.distributor = 'All';
        }
      }

      // When a specific SKU is selected:
      if (key === 'sku') {
        if (value !== 'All') {
          const sample = data.find((r) => r.SKU === value);
          if (sample) {
            next.category = sample.Category;
            next.brand = sample.Brand;
          }
          // Validate plant
          const validPlants = new Set(data.filter((r) => r.SKU === value).map((r) => r.Plant));
          if (next.plant !== 'All' && !validPlants.has(next.plant)) next.plant = 'All';

          // Validate distributor
          const validDists = new Set(data.filter((r) => r.SKU === value).map((r) => r.Distributor));
          if (next.distributor !== 'All' && !validDists.has(next.distributor)) next.distributor = 'All';
        }
      }

      // When Brand changes:
      if (key === 'brand') {
        if (value !== 'All') {
          const validSkus = new Set(data.filter((r) => r.Brand === value).map((r) => r.SKU));
          if (next.sku !== 'All' && !validSkus.has(next.sku)) next.sku = 'All';

          const validPlants = new Set(data.filter((r) => r.Brand === value).map((r) => r.Plant));
          if (next.plant !== 'All' && !validPlants.has(next.plant)) next.plant = 'All';

          const validDists = new Set(data.filter((r) => r.Brand === value).map((r) => r.Distributor));
          if (next.distributor !== 'All' && !validDists.has(next.distributor)) next.distributor = 'All';
        }
      }

      return next;
    });
  };

  const handleResetFilters = () => {
    setFilters(INITIAL_FILTERS);
  };

  // File upload handler
  const handleFileUpload = async (file: File) => {
    try {
      const result = await parseFMCGFile(file);
      setData(result.records);
      setFileName(result.fileName);
      setIsCustomFile(true);
      setFilters(INITIAL_FILTERS);
      setNotification({
        type: 'success',
        message: `Successfully loaded ${result.rowCount.toLocaleString()} rows from "${result.fileName}". All sub-pages and metrics refreshed.`,
      });
      setTimeout(() => setNotification(null), 5000);
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.message || 'Failed to process uploaded file.',
      });
      setTimeout(() => setNotification(null), 6000);
    }
  };

  const handleResetToDefault = () => {
    setData(defaultFMCGData);
    setFileName('Default FMCG Sample Dataset');
    setIsCustomFile(false);
    setFilters(INITIAL_FILTERS);
    setNotification({
      type: 'success',
      message: 'Reset back to default synthetic FMCG dataset (11,000 records, 640 SKUs across 13 distributors).',
    });
    setTimeout(() => setNotification(null), 4000);
  };

  // Click handlers from charts to toggle filters
  const handleBrandClick = (brand: string) => {
    handleFilterChange('brand', filters.brand === brand ? 'All' : brand);
  };

  const handleMonthClick = (month: string) => {
    handleFilterChange('month', filters.month === month ? 'All' : month);
  };

  const handleCategoryClick = (category: string) => {
    handleFilterChange('category', filters.category === category ? 'All' : category);
  };

  const handlePlantClick = (plant: string) => {
    handleFilterChange('plant', filters.plant === plant ? 'All' : plant);
  };

  const handleDistributorClick = (distributor: string) => {
    handleFilterChange('distributor', filters.distributor === distributor ? 'All' : distributor);
  };

  const SUB_PAGES = [
    {
      id: 'executive' as const,
      label: 'Executive & Manager Overview',
      shortLabel: 'Executive',
      icon: LayoutDashboard,
      badge: 'Dual-Level',
      description: 'C-Suite high-level & Manager diagnostic deep dives for SKU, Plant, Distributor & Periods',
    },
    {
      id: 'abcxyz' as const,
      label: 'ABC-XYZ Demand Matrix',
      shortLabel: 'ABC-XYZ Matrix',
      icon: Grid3X3,
      badge: '12% X-Class',
      description: 'Pareto value vs demand volatility segmentation at Global Enterprise and Distributor levels',
    },
    {
      id: 'sales' as const,
      label: 'Sales Velocity & Top Brands',
      shortLabel: 'Sales Trends',
      icon: TrendingUp,
      badge: '4 Lines',
      description: 'Brand contribution rankings, monthly revenue trajectories, and product line mix',
    },
    {
      id: 'supplychain' as const,
      label: 'Pan-India Logistics & Supply Chain',
      shortLabel: 'India Map & Supply Chain',
      icon: MapPin,
      badge: '8 Plants • 3 CDC • 13 Dist',
      description: 'Interactive map of India featuring 8 Plants, 3 Central Mother Warehouses, 13 Distributors & dispatch matrix',
    },
    {
      id: 'ledger' as const,
      label: 'Commercial Ledger & Raw Records',
      shortLabel: 'Master Ledger',
      icon: TableProperties,
      badge: `${data.length.toLocaleString()} Rows`,
      description: 'Searchable line-item transactional ledger with deep inspection and CSV exports',
    },
  ];

  return (
    <div className="min-h-screen bg-[#FAFBF9] text-[#0d2828] flex flex-col font-sans selection:bg-[#34a1a5]/25 selection:text-[#004c4c]">
      {/* Top Application Header */}
      <Header
        fileName={fileName}
        isCustomFile={isCustomFile}
        totalRecords={data.length}
        filteredRecordsCount={filteredData.length}
        filters={filters}
        onResetFilters={handleResetFilters}
        onFileUpload={handleFileUpload}
        onResetToDefault={handleResetToDefault}
        isChatOpen={isChatOpen}
        onToggleChat={() => setIsChatOpen((v) => !v)}
        activeData={filteredData}
      />

      {/* Sub-Page Navigation Bar (MacBook Glassy Style) */}
      <nav aria-label="Analytical Sub-Pages" className="bg-white/80 backdrop-blur-md border-b border-[#34a1a5]/20 sticky top-14 z-20 shadow-2xs">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
          {/* Sub-Page Tab Switcher */}
          <div className="p-1 rounded-2xl bg-white/70 backdrop-blur-md border border-[#34a1a5]/25 flex items-center flex-wrap gap-1 shadow-inner">
            {SUB_PAGES.map((page) => {
              const Icon = page.icon;
              const isActive = activeSubPage === page.id;
              return (
                <button
                  key={page.id}
                  onClick={() => setActiveSubPage(page.id)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-[12.5px] font-bold transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'glass-btn-primary shadow-sm'
                      : 'text-[#004c4c] hover:bg-white/90 hover:text-[#002d2d]'
                  }`}
                  title={page.description}
                >
                  <Icon className="w-4 h-4" />
                  <span>{page.label}</span>
                </button>
              );
            })}
          </div>

          {/* Slicers Quick Toggle */}
          <button
            onClick={() => setIsSlicersCollapsed(!isSlicersCollapsed)}
            className="glass-btn h-8.5 px-3 text-[11.5px] gap-1.5 text-[#004c4c]"
            title="Toggle Filter Toolbar visibility"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Filters</span>
            {isSlicersCollapsed ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </nav>

      {/* Primary Global Filter Toolbar (Collapsible) */}
      {!isSlicersCollapsed && (
        <PowerBISlicers
          filters={filters}
          options={slicerOptions}
          onFilterChange={handleFilterChange}
          onResetFilters={handleResetFilters}
          filteredCount={filteredData.length}
          totalCount={data.length}
        />
      )}

      {/* Operational Alert Notification */}
      {notification && (
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-3 w-full">
          <div
            className={`p-3 rounded-xl flex items-center justify-between text-[12px] font-bold ${
              notification.type === 'success'
                ? 'bg-[#ffedd5] text-[#004c4c] border border-[#34a1a5]/40 shadow-sm'
                : 'bg-[#ff6b68]/20 text-[#8c1e1c] border border-[#ff6b68]/50 shadow-sm'
            }`}
          >
            <div className="flex items-center gap-2">
              {notification.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-[#004c4c]" />
              ) : (
                <AlertCircle className="w-4 h-4 text-[#8c1e1c]" />
              )}
              <span>{notification.message}</span>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-[#004c4c] hover:underline text-[11px] cursor-pointer font-extrabold"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main Analytical Dashboard Canvas: Routed by Active Sub-Page */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 py-4 flex flex-col gap-4">
        {/* Universal Top Strategic KPI Bar (Kept visible for instant executive grounding) */}
        <section aria-label="KPI Executive Metrics">
          <KPICards
            kpis={kpis}
            comparisonMode={effectiveComparisonMode}
            onToggleComparisonMode={setComparisonMode}
          />
        </section>

        {/* SUB-PAGE 1: Executive Overview & Manager Diagnostic */}
        {activeSubPage === 'executive' && (
          <section aria-label="Executive Entity Deep Dive" className="animate-fadeIn">
            <ExecutiveOverview
              data={data}
              filters={filters}
              onFilterChange={handleFilterChange}
              onAskAI={handleAskAIFromRecord}
            />
          </section>
        )}

        {/* SUB-PAGE 2: ABC-XYZ Demand & Strategy Matrix */}
        {activeSubPage === 'abcxyz' && (
          <section aria-label="ABC-XYZ Demand Matrix" className="animate-fadeIn">
            <ABCXYZHeatmap
              data={filteredData}
              distributors={slicerOptions.distributors}
              onAskAI={handleAskAIFromRecord}
              onFilterSKU={(sku) => handleFilterChange('sku', sku.split(' ')[0])}
            />
          </section>
        )}

        {/* SUB-PAGE 3: Sales Velocity & Brand Intelligence */}
        {activeSubPage === 'sales' && (
          <section className="flex flex-col gap-4 animate-fadeIn" aria-label="Visual Analytics">
            {/* Top Row: Brand Contribution & Revenue/Volume Cadence */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Visual 1: Brand Contribution (5 columns on large screens) */}
              <div className="lg:col-span-5 h-[380px]">
                <VisualTopBrands
                  data={filteredData}
                  activeBrandFilter={filters.brand}
                  onBrandClick={handleBrandClick}
                />
              </div>

              {/* Visual 2: Revenue and Volume Trend (7 columns on large screens) */}
              <div className="lg:col-span-7 h-[380px]">
                <VisualSalesTrend
                  data={filteredData}
                  activeMonthFilter={filters.month}
                  activeCategoryFilter={filters.category}
                  onMonthClick={handleMonthClick}
                  onCategoryClick={handleCategoryClick}
                />
              </div>
            </div>

            {/* Bottom Row: Specialized Distributor Rank Progression (Bump Chart) */}
            <DistributorRankBumpChart
              allData={data}
              filteredData={filteredData}
              filters={filters}
              onFilterDistributor={handleDistributorClick}
            />
          </section>
        )}

        {/* SUB-PAGE 4: Pan-India Supply Chain & Manufacturing Network */}
        {activeSubPage === 'supplychain' && (
          <section aria-label="Pan-India Logistics & Supply Chain Network" className="animate-fadeIn flex flex-col gap-4">
            {/* View Mode Switcher Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-1">
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-bold text-[#002d2d] flex items-center gap-1.5">
                  <Network className="w-3.5 h-3.5 text-[#004c4c]" />
                  <span>Network Display View:</span>
                </span>
                <div className="p-1 rounded-xl bg-white/75 backdrop-blur-md border border-[#34a1a5]/25 flex items-center shadow-inner">
                  <button
                    onClick={() => setSupplyChainViewMode('both')}
                    className={`h-7 px-3 text-[11.5px] font-bold rounded-lg transition-all duration-200 cursor-pointer ${
                      supplyChainViewMode === 'both'
                        ? 'glass-btn-primary shadow-sm'
                        : 'text-[#004c4c] hover:bg-white/80'
                    }`}
                  >
                    Combined Full Network
                  </button>
                  <button
                    onClick={() => setSupplyChainViewMode('map')}
                    className={`h-7 px-3 text-[11.5px] font-bold rounded-lg transition-all duration-200 cursor-pointer ${
                      supplyChainViewMode === 'map'
                        ? 'glass-btn-primary shadow-sm'
                        : 'text-[#004c4c] hover:bg-white/80'
                    }`}
                  >
                    🗺️ Pan-India Map Only
                  </button>
                  <button
                    onClick={() => setSupplyChainViewMode('matrix')}
                    className={`h-7 px-3 text-[11.5px] font-bold rounded-lg transition-all duration-200 cursor-pointer ${
                      supplyChainViewMode === 'matrix'
                        ? 'glass-btn-primary shadow-sm'
                        : 'text-[#004c4c] hover:bg-white/80'
                    }`}
                  >
                    📊 Sourcing Matrix Only
                  </button>
                </div>
              </div>

              <div className="text-[11.5px] text-[#1c4b4b] font-medium hidden sm:block">
                <span>Multi-echelon distribution: </span>
                <strong className="text-[#004c4c]">8 Plants</strong> ➔{' '}
                <strong className="text-[#ff6b68]">3 Mother Warehouses</strong> ➔{' '}
                <strong className="text-[#002d2d]">13 Distributor Houses</strong>
              </div>
            </div>

            {/* Geospatial Interactive Vector Map of India */}
            {(supplyChainViewMode === 'both' || supplyChainViewMode === 'map') && (
              <IndiaSupplyChainMap
                data={data}
                filters={filters}
                onFilterChange={handleFilterChange}
                onResetFilters={handleResetFilters}
              />
            )}

            {/* Plant to Distributor Sourcing Allocation Matrix */}
            {(supplyChainViewMode === 'both' || supplyChainViewMode === 'matrix') && (
              <VisualSupplyChainMatrix
                data={filteredData}
                activePlantFilter={filters.plant}
                activeDistributorFilter={filters.distributor}
                onPlantClick={handlePlantClick}
                onDistributorClick={handleDistributorClick}
              />
            )}
          </section>
        )}

        {/* SUB-PAGE 5: Commercial Ledger & Raw Records */}
        {activeSubPage === 'ledger' && (
          <section aria-label="Commercial Ledger" className="animate-fadeIn">
            <VisualDataTable
              data={filteredData}
              onFilterBrand={handleBrandClick}
              onFilterPlant={handlePlantClick}
              onAskAI={handleAskAIFromRecord}
            />
          </section>
        )}
      </main>

      {/* Integrated AI Commercial Analyst Drawer (Gemini 3.8 Flash) */}
      <AIChatSidebar
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        filters={filters}
        kpis={kpis}
        activeData={filteredData}
        pendingPrompt={pendingAIPrompt}
        onClearPendingPrompt={() => setPendingAIPrompt(null)}
      />

      {/* Bottom Global Status Bar */}
      <footer className="mt-auto border-t border-[#34a1a5]/20 bg-white/70 backdrop-blur-md py-3 text-[11.5px] text-[#1c4b4b]">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 flex flex-wrap items-center justify-between gap-2 font-medium">
          <div className="flex items-center gap-2">
            <span>8 Plants • 3 Central Mother Warehouses • 13 Distributors • 640 SKUs</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="tabular-nums">
              Showing <strong className="text-[#002d2d] font-bold">{filteredData.length.toLocaleString()}</strong> of {data.length.toLocaleString()} records
            </span>
            <span>•</span>
            <span className="text-[#004c4c] font-bold">Model: Gemini 3.8 Flash</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
