import React, { useState, useMemo } from 'react';
import {
  Building2,
  Package,
  Layers,
  Truck,
  Calendar,
  Clock,
  TrendingUp,
  TrendingDown,
  Filter,
  Bot,
  ChevronDown,
  Check,
  Copy,
  Download,
  AlertTriangle,
  ShieldCheck,
  Briefcase,
  Users,
  Target,
  ArrowUpRight,
} from 'lucide-react';
import { FMCGRecord, FilterState } from '../types/fmcg';
import { formatINR, formatUnits, formatNumberFull, formatINRFull } from '../utils/currencyFormatter';
import { exportDatasetToCSV } from '../utils/fileParser';

type DimensionType = 'Brand' | 'Category' | 'Plant' | 'Distributor' | 'Month' | 'Quarter';
type SummaryLevel = 'executive' | 'manager';

interface ExecutiveOverviewProps {
  data: FMCGRecord[];
  filters: FilterState;
  onFilterChange: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  onAskAI: (prompt: string) => void;
}

const DIMENSION_CONFIG: {
  id: DimensionType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  filterKey: keyof FilterState;
  description: string;
  managerRole: string;
}[] = [
  {
    id: 'Brand',
    label: 'SKU / Brand',
    icon: Package,
    filterKey: 'brand',
    description: 'Brand portfolio off-take, price realization, and channel distribution footprint',
    managerRole: 'Brand Commercial Manager & National Category Marketing Head',
  },
  {
    id: 'Category',
    label: 'Product Line',
    icon: Layers,
    filterKey: 'category',
    description: 'Product line volume share, portfolio mix, and cross-channel off-take velocity',
    managerRole: 'Category Business Head & Merchandise Planning Director',
  },
  {
    id: 'Plant',
    label: 'Plant',
    icon: Building2,
    filterKey: 'plant',
    description: 'Manufacturing hub throughput, product allocation, and dispatch logistics',
    managerRole: 'Plant General Manager & Head of Manufacturing Operations',
  },
  {
    id: 'Distributor',
    label: 'Distributor',
    icon: Truck,
    filterKey: 'distributor',
    description: 'Channel off-take, partner re-order velocity, and regional revenue realization',
    managerRole: 'Regional Commercial Director & Head of Channel Distribution',
  },
  {
    id: 'Month',
    label: 'Month',
    icon: Calendar,
    filterKey: 'month',
    description: 'Accounting month commercial execution, seasonal surges, and off-take dynamics',
    managerRole: 'FP&A Commercial Controller & Monthly Demand-Supply Coordinator',
  },
  {
    id: 'Quarter',
    label: 'Quarter',
    icon: Clock,
    filterKey: 'quarter',
    description: 'Fiscal quarter target realization, quarterly momentum, and annual pace',
    managerRole: 'VP Commercial Operations & Quarterly Business Review Lead',
  },
];

export const ExecutiveOverview: React.FC<ExecutiveOverviewProps> = ({
  data,
  filters,
  onFilterChange,
  onAskAI,
}) => {
  const [selectedDimension, setSelectedDimension] = useState<DimensionType>('Brand');
  const [summaryLevel, setSummaryLevel] = useState<SummaryLevel>('executive');
  const [managerDetailTab, setManagerDetailTab] = useState<'plants' | 'distributors' | 'categories' | 'months'>('distributors');
  const [isCopied, setIsCopied] = useState(false);

  // Compute available entities for selected dimension
  const availableEntities = useMemo(() => {
    const set = new Set<string>();
    data.forEach((r) => {
      const val = r[selectedDimension as keyof FMCGRecord];
      if (val !== undefined && val !== null) {
        set.add(String(val));
      }
    });
    return Array.from(set).sort();
  }, [data, selectedDimension]);

  // Default selected entity when dimension changes
  const [selectedEntity, setSelectedEntity] = useState<string>(() => {
    return availableEntities[0] || '';
  });

  // Keep selectedEntity synced if availableEntities changes or doesn't include current
  React.useEffect(() => {
    if (!availableEntities.includes(selectedEntity) && availableEntities.length > 0) {
      setSelectedEntity(availableEntities[0]);
    }
  }, [availableEntities, selectedEntity]);

  // Aggregate total portfolio numbers
  const portfolioSummary = useMemo(() => {
    let sales = 0;
    let units = 0;
    let txns = 0;
    data.forEach((r) => {
      sales += r.Sales_INR;
      units += r.Units_Sold;
      txns += r.Transaction_Rows;
    });
    const avgRealization = units > 0 ? sales / units : 0;
    return { sales, units, txns, avgRealization };
  }, [data]);

  // Aggregate selected entity metrics
  const entityAnalysis = useMemo(() => {
    if (!selectedEntity) return null;

    const matchingRows = data.filter((r) => String(r[selectedDimension as keyof FMCGRecord]) === selectedEntity);
    let sales = 0;
    let units = 0;
    let txns = 0;

    let minRealization = Infinity;
    let maxRealization = -Infinity;

    const subCategoryMap = new Map<string, { name: string; sales: number; units: number; rows: number }>();
    const plantMap = new Map<string, { name: string; sales: number; units: number; rows: number }>();
    const distMap = new Map<string, { name: string; sales: number; units: number; rows: number }>();
    const monthMap = new Map<number, { month: string; index: number; sales: number; units: number; rows: number }>();

    matchingRows.forEach((r) => {
      sales += r.Sales_INR;
      units += r.Units_Sold;
      txns += r.Transaction_Rows;

      const unitPrice = r.Units_Sold > 0 ? r.Sales_INR / r.Units_Sold : 0;
      if (unitPrice > 0) {
        if (unitPrice < minRealization) minRealization = unitPrice;
        if (unitPrice > maxRealization) maxRealization = unitPrice;
      }

      // Category breakdown
      const c = subCategoryMap.get(r.Category) || { name: r.Category, sales: 0, units: 0, rows: 0 };
      c.sales += r.Sales_INR;
      c.units += r.Units_Sold;
      c.rows += 1;
      subCategoryMap.set(r.Category, c);

      // Plant breakdown
      const p = plantMap.get(r.Plant) || { name: r.Plant, sales: 0, units: 0, rows: 0 };
      p.sales += r.Sales_INR;
      p.units += r.Units_Sold;
      p.rows += 1;
      plantMap.set(r.Plant, p);

      // Distributor breakdown
      const d = distMap.get(r.Distributor) || { name: r.Distributor, sales: 0, units: 0, rows: 0 };
      d.sales += r.Sales_INR;
      d.units += r.Units_Sold;
      d.rows += 1;
      distMap.set(r.Distributor, d);

      // Month trajectory
      const mIdx = r.Month_Index || 1;
      const m = monthMap.get(mIdx) || { month: r.Month, index: mIdx, sales: 0, units: 0, rows: 0 };
      m.sales += r.Sales_INR;
      m.units += r.Units_Sold;
      m.rows += 1;
      monthMap.set(mIdx, m);
    });

    const avgRealization = units > 0 ? sales / units : 0;
    const avgOrderValue = txns > 0 ? sales / txns : 0;
    const unitsPerTxn = txns > 0 ? units / txns : 0;
    const salesShare = portfolioSummary.sales > 0 ? (sales / portfolioSummary.sales) * 100 : 0;
    const unitsShare = portfolioSummary.units > 0 ? (units / portfolioSummary.units) * 100 : 0;
    const realizationVariance = portfolioSummary.avgRealization > 0
      ? ((avgRealization - portfolioSummary.avgRealization) / portfolioSummary.avgRealization) * 100
      : 0;

    // Top breakdowns
    const plantList = Array.from(plantMap.values()).sort((a, b) => b.sales - a.sales);
    const distList = Array.from(distMap.values()).sort((a, b) => b.sales - a.sales);
    const categoryList = Array.from(subCategoryMap.values()).sort((a, b) => b.sales - a.sales);
    const monthlyTrajectory = Array.from(monthMap.values()).sort((a, b) => a.index - b.index);

    // Concentration analysis
    const topDistShare = units > 0 && distList.length > 0 ? (distList[0].units / units) * 100 : 0;
    const topPlantShare = units > 0 && plantList.length > 0 ? (plantList[0].units / units) * 100 : 0;

    // Peak month
    const peakMonth = monthlyTrajectory.length > 0
      ? [...monthlyTrajectory].sort((a, b) => b.sales - a.sales)[0]
      : null;

    // Health Rating
    let healthRating = 'Core Commercial Engine';
    let healthColor = 'text-[#004c4c] bg-[#004c4c]/10 border-[#004c4c]/30';
    if (salesShare >= 15) {
      healthRating = 'Primary Enterprise Pillar';
      healthColor = 'text-[#004c4c] bg-[#004c4c]/15 border-[#004c4c]/40 font-bold';
    } else if (realizationVariance >= 12) {
      healthRating = 'High-Margin Outperformer';
      healthColor = 'text-[#004c4c] bg-[#004c4c]/10 border-[#004c4c]/30';
    } else if (realizationVariance <= -10) {
      healthRating = 'Margin Realization Watchlist';
      healthColor = 'text-[#8c1e1c] bg-[#ffedd5]/30 border-[#ffedd5]';
    } else if (salesShare < 3) {
      healthRating = 'Niche Category Contributor';
      healthColor = 'text-[#1c4b4b] bg-[#F2F6F4] border-[#b9dcdb]';
    }

    return {
      sales,
      units,
      txns,
      avgRealization,
      avgOrderValue,
      unitsPerTxn,
      salesShare,
      unitsShare,
      realizationVariance,
      minRealization: minRealization === Infinity ? avgRealization : minRealization,
      maxRealization: maxRealization === -Infinity ? avgRealization : maxRealization,
      topDistShare,
      topPlantShare,
      plantList,
      distList,
      categoryList,
      monthlyTrajectory,
      peakMonth,
      healthRating,
      healthColor,
      matchingRows,
      rowCount: matchingRows.length,
    };
  }, [data, selectedDimension, selectedEntity, portfolioSummary]);

  const activeDimConfig = DIMENSION_CONFIG.find((d) => d.id === selectedDimension) || DIMENSION_CONFIG[0];

  const handleApplyFilter = () => {
    if (!selectedEntity) return;
    onFilterChange(activeDimConfig.filterKey, selectedEntity);
  };

  const handleAskAIEntity = () => {
    if (!selectedEntity || !entityAnalysis) return;
    const isExec = summaryLevel === 'executive';
    const prompt = isExec
      ? `Provide an Executive C-Suite Brief with fact-based reasons for ${activeDimConfig.label} "${selectedEntity}". Data Evidence: Net revenue ${formatINR(
          entityAnalysis.sales
        )} (${entityAnalysis.salesShare.toFixed(1)}% of total company portfolio), Volume ${formatUnits(
          entityAnalysis.units
        )} units, Realization ₹${entityAnalysis.avgRealization.toFixed(2)}/unit (${
          entityAnalysis.realizationVariance >= 0 ? '+' : ''
        }${entityAnalysis.realizationVariance.toFixed(1)}% vs portfolio baseline). What are the exact empirical root causes and prioritized strategic commercial actions?`
      : `Provide a Detailed Operational Diagnostic with fact-based reasons for the ${activeDimConfig.managerRole} of ${activeDimConfig.label} "${selectedEntity}". Empirical Data: Total transactions ${entityAnalysis.txns.toLocaleString()}, Top channel concentration ${entityAnalysis.topDistShare.toFixed(1)}%, Top manufacturing plant reliance ${entityAnalysis.topPlantShare.toFixed(1)}%, Realization discount bounds ₹${entityAnalysis.minRealization.toFixed(1)} to ₹${entityAnalysis.maxRealization.toFixed(1)}. Detail specific trade promotion, plant capacity scheduling, and warehouse inventory directives backed by these facts.`;
    onAskAI(prompt);
  };

  const handleCopyMemo = () => {
    if (!entityAnalysis) return;
    const memo = `FMCG PULSE COMMERCIAL MEMO
Dimension: ${activeDimConfig.label} | Entity: ${selectedEntity}
Level: ${summaryLevel === 'executive' ? 'Executive Leadership Summary' : `Manager Diagnostic (${activeDimConfig.managerRole})`}
--------------------------------------------------
Net Revenue: ${formatINR(entityAnalysis.sales)} (${entityAnalysis.salesShare.toFixed(1)}% of Company Portfolio)
Volume Dispatched: ${formatUnits(entityAnalysis.units)} units (${entityAnalysis.unitsShare.toFixed(1)}% share)
Price Realization: ₹${entityAnalysis.avgRealization.toFixed(2)}/unit (${entityAnalysis.realizationVariance >= 0 ? '+' : ''}${entityAnalysis.realizationVariance.toFixed(1)}% vs Benchmark)
Order Throughput: ${entityAnalysis.txns.toLocaleString()} transactions (Avg Ticket: ${formatINR(Math.round(entityAnalysis.avgOrderValue))})
Status: ${entityAnalysis.healthRating}
Top Channel Dependency: ${entityAnalysis.distList[0]?.name || 'N/A'} (${entityAnalysis.topDistShare.toFixed(1)}%)
Primary Manufacturing Plant: ${entityAnalysis.plantList[0]?.name || 'N/A'} (${entityAnalysis.topPlantShare.toFixed(1)}%)`;

    navigator.clipboard.writeText(memo);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  const handleExportManagerData = () => {
    if (!entityAnalysis) return;
    exportDatasetToCSV(entityAnalysis.matchingRows, `FMCG_${selectedDimension}_${selectedEntity.replace(/\s+/g, '_')}_Manager_Ledger.csv`);
  };

  const maxMonthSales = useMemo(() => {
    if (!entityAnalysis?.monthlyTrajectory?.length) return 1;
    return Math.max(...entityAnalysis.monthlyTrajectory.map((m) => m.sales), 1);
  }, [entityAnalysis]);

  return (
    <div className="bg-white rounded-lg border border-[#b9dcdb] p-4 sm:p-5 flex flex-col gap-4 shadow-2xs">
      {/* Dimension Tabs & Dual Level Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-[#b9dcdb]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-bold text-[#002d2d] tracking-tight">
              Single-Entity Intelligence & Deep Dive
            </h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#004c4c] text-[#ffedd5]">
              Commercial Lens
            </span>
          </div>
          <p className="text-[12px] text-[#1c4b4b] mt-0.5">
            Inspect commercial off-take, supply chain allocation, and realization across any SKU, Plant, Distributor, Product Line, Month, or Quarter
          </p>
        </div>

        {/* Dual Level Mode Toggle: (a) Executive vs (b) Manager Detail */}
        <div className="flex items-center gap-2 self-start lg:self-auto">
          <span className="text-[11px] font-semibold text-[#1c4b4b] hidden sm:inline">Summary Level:</span>
          <div className="inline-flex rounded-md bg-[#F2F6F4] p-1 border border-[#b9dcdb] text-[12px]">
            <button
              onClick={() => setSummaryLevel('executive')}
              className={`px-3 py-1 rounded font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                summaryLevel === 'executive'
                  ? 'bg-[#004c4c] text-white font-bold shadow-xs'
                  : 'text-[#1c4b4b] hover:text-[#002d2d]'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>(a) Executive Overview</span>
            </button>
            <button
              onClick={() => setSummaryLevel('manager')}
              className={`px-3 py-1 rounded font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                summaryLevel === 'manager'
                  ? 'bg-[#004c4c] text-white font-bold shadow-xs'
                  : 'text-[#1c4b4b] hover:text-[#002d2d]'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>(b) Concerned Manager Detail</span>
            </button>
          </div>
        </div>
      </div>

      {/* Dimension Selector Ribbon */}
      <div className="flex items-center justify-between flex-wrap gap-2 pt-0.5">
        <div className="inline-flex rounded-md bg-[#F2F6F4] p-0.5 border border-[#b9dcdb] text-[11px] flex-wrap">
          {DIMENSION_CONFIG.map((dim) => {
            const Icon = dim.icon;
            const isSelected = selectedDimension === dim.id;
            return (
              <button
                key={dim.id}
                onClick={() => {
                  setSelectedDimension(dim.id);
                }}
                className={`h-7 px-2.5 rounded font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-white text-[#004c4c] font-bold shadow-xs border border-[#b9dcdb]'
                    : 'text-[#1c4b4b] hover:text-[#002d2d]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{dim.label}</span>
              </button>
            );
          })}
        </div>

        <span className="text-[11px] text-[#1c4b4b] italic hidden md:inline">
          {activeDimConfig.description}
        </span>
      </div>

      {/* Entity Selection & Global Action Bar */}
      <div className="bg-[#F8FAF9] rounded-lg border border-[#b9dcdb] p-3 flex flex-wrap items-center justify-between gap-3">
        {/* Dropdown Selector */}
        <div className="flex items-center gap-2.5 flex-1 min-w-[280px]">
          <span className="text-[12px] font-semibold text-[#1c4b4b] shrink-0">
            Select {activeDimConfig.label}:
          </span>
          <div className="relative flex-1 max-w-sm">
            <select
              value={selectedEntity}
              onChange={(e) => setSelectedEntity(e.target.value)}
              className="w-full h-8.5 appearance-none bg-white hover:bg-[#F2F6F4] border border-[#b9dcdb] text-[12px] rounded-md pl-2.5 pr-8 py-1 text-[#002d2d] font-bold focus:outline-none focus:ring-1 focus:ring-[#004c4c] focus:border-[#004c4c] cursor-pointer"
            >
              {availableEntities.map((entity) => (
                <option key={entity} value={entity}>
                  {entity}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[#1c4b4b] absolute right-2.5 top-2.5 pointer-events-none" />
          </div>
          <span className="text-[11px] text-[#1c4b4b] tabular-nums hidden sm:inline">
            ({availableEntities.length} available)
          </span>
        </div>

        {/* Action Shortcuts */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleCopyMemo}
            className="glass-btn h-8 px-3 text-[12px] gap-1.5"
            title="Copy brief memo to clipboard"
          >
            {isCopied ? <Check className="w-3.5 h-3.5 text-[#004c4c]" /> : <Copy className="w-3.5 h-3.5 text-[#1c4b4b]" />}
            <span>{isCopied ? 'Copied' : 'Copy Memo'}</span>
          </button>

          <button
            onClick={handleApplyFilter}
            className="glass-btn-teal h-8 px-3 text-[12px] gap-1.5"
            title={`Apply "${selectedEntity}" to entire dashboard filter slicers`}
          >
            <Filter className="w-3.5 h-3.5 text-[#004c4c]" />
            <span>Filter Dashboard</span>
          </button>

          <button
            onClick={handleAskAIEntity}
            className="glass-btn-primary h-8 px-3 text-[12px] gap-1.5"
            title="Ask AI Commercial Analyst for an in-depth briefing"
          >
            <Bot className="w-3.5 h-3.5 text-[#ffedd5]" />
            <span>AI {summaryLevel === 'executive' ? 'Executive Memo' : 'Manager Audit'}</span>
          </button>
        </div>
      </div>

      {/* Main Content Area: (a) Executive Overview vs (b) Manager Detail */}
      {entityAnalysis ? (
        summaryLevel === 'executive' ? (
          /* ======================================================== */
          /* (a) EXECUTIVE OVERVIEW (C-SUITE & BOARD VIEW)             */
          /* ======================================================== */
          <div className="flex flex-col gap-4">
            {/* Executive Status Banner */}
            <div className="bg-[#FFFFFF] border border-[#b9dcdb] rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-md bg-[#004c4c]/10 border border-[#004c4c]/20 flex items-center justify-center text-[#004c4c] shrink-0 font-bold text-[14px]">
                  {selectedEntity.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-bold text-[#002d2d]">{selectedEntity}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${entityAnalysis.healthColor}`}>
                      {entityAnalysis.healthRating}
                    </span>
                  </div>
                  <span className="text-[11px] text-[#1c4b4b]">
                    {activeDimConfig.label} Portfolio Performance • Accounting for {entityAnalysis.salesShare.toFixed(1)}% of total company gross turnover
                  </span>
                </div>
              </div>

              {/* Peak Month & Benchmark Metric */}
              <div className="flex items-center gap-4 text-[12px] border-t sm:border-t-0 pt-2 sm:pt-0 border-[#b9dcdb]">
                {entityAnalysis.peakMonth && (
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-semibold text-[#1c4b4b] block">Peak Velocity Month</span>
                    <strong className="text-[#002d2d] font-bold">{entityAnalysis.peakMonth.month}</strong>
                    <span className="text-[11px] text-[#004c4c] ml-1 font-semibold">({formatINR(entityAnalysis.peakMonth.sales)})</span>
                  </div>
                )}
                <div className="h-6 w-px bg-[#b9dcdb] hidden sm:block" />
                <div className="text-right">
                  <span className="text-[10px] uppercase font-semibold text-[#1c4b4b] block">Realization Index</span>
                  <span
                    className={`font-bold inline-flex items-center gap-0.5 ${
                      entityAnalysis.realizationVariance >= 0 ? 'text-[#004c4c]' : 'text-[#8c1e1c]'
                    }`}
                  >
                    {entityAnalysis.realizationVariance >= 0 ? '+' : ''}
                    {entityAnalysis.realizationVariance.toFixed(1)}%
                    <span className="text-[#1c4b4b] font-normal text-[10px]">vs avg</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Row 1: 4 Key Executive KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* 1. Net Revenue Contribution */}
              <div className="bg-[#FFFFFF] rounded-lg border border-[#b9dcdb] p-3.5">
                <div className="flex items-center justify-between text-[11px] text-[#1c4b4b]">
                  <span className="font-semibold">Net Revenue Contribution</span>
                  <span className="text-[10px] bg-[#F2F6F4] px-1.5 py-0.5 rounded border border-[#b9dcdb]">Turnover</span>
                </div>
                <div
                  className="text-[24px] sm:text-[26px] font-bold text-[#002d2d] mt-1 tabular-nums cursor-default"
                  title={formatINRFull(entityAnalysis.sales)}
                >
                  {formatINR(entityAnalysis.sales)}
                </div>
                <div className="text-[11px] text-[#004c4c] font-bold mt-1 tabular-nums">
                  {entityAnalysis.salesShare.toFixed(1)}% of company portfolio
                </div>
              </div>

              {/* 2. Total Dispatched Volume */}
              <div className="bg-[#FFFFFF] rounded-lg border border-[#b9dcdb] p-3.5">
                <div className="flex items-center justify-between text-[11px] text-[#1c4b4b]">
                  <span className="font-semibold">Volume Dispatched</span>
                  <span className="text-[10px] bg-[#F2F6F4] px-1.5 py-0.5 rounded border border-[#b9dcdb]">Off-take</span>
                </div>
                <div
                  className="text-[24px] sm:text-[26px] font-bold text-[#002d2d] mt-1 tabular-nums cursor-default"
                  title={`${formatNumberFull(entityAnalysis.units)} items`}
                >
                  {formatUnits(entityAnalysis.units)}
                </div>
                <div className="text-[11px] text-[#1c4b4b] mt-1 tabular-nums">
                  {entityAnalysis.unitsShare.toFixed(1)}% of total company volume
                </div>
              </div>

              {/* 3. Average Price Realization */}
              <div className="bg-[#FFFFFF] rounded-lg border border-[#b9dcdb] p-3.5">
                <div className="flex items-center justify-between text-[11px] text-[#1c4b4b]">
                  <span className="font-semibold">Realization / Unit</span>
                  <span className="text-[10px] bg-[#F2F6F4] px-1.5 py-0.5 rounded border border-[#b9dcdb]">Pricing</span>
                </div>
                <div className="text-[24px] sm:text-[26px] font-bold text-[#002d2d] mt-1 tabular-nums">
                  ₹{entityAnalysis.avgRealization.toFixed(2)}
                </div>
                <div className="mt-1 flex items-center gap-1 text-[11px] tabular-nums">
                  <span
                    className={`inline-flex items-center gap-0.5 font-bold ${
                      entityAnalysis.realizationVariance >= 0 ? 'text-[#004c4c]' : 'text-[#8c1e1c]'
                    }`}
                  >
                    {entityAnalysis.realizationVariance >= 0 ? (
                      <TrendingUp className="w-3 h-3 stroke-[2.5]" />
                    ) : (
                      <TrendingDown className="w-3 h-3 stroke-[2.5]" />
                    )}
                    {entityAnalysis.realizationVariance >= 0 ? '+' : ''}
                    {entityAnalysis.realizationVariance.toFixed(1)}%
                  </span>
                  <span className="text-[#1c4b4b]">vs benchmark (₹{portfolioSummary.avgRealization.toFixed(2)})</span>
                </div>
              </div>

              {/* 4. Order Throughput & Value */}
              <div className="bg-[#FFFFFF] rounded-lg border border-[#b9dcdb] p-3.5">
                <div className="flex items-center justify-between text-[11px] text-[#1c4b4b]">
                  <span className="font-semibold">Order Throughput</span>
                  <span className="text-[10px] bg-[#F2F6F4] px-1.5 py-0.5 rounded border border-[#b9dcdb]">Velocity</span>
                </div>
                <div className="text-[24px] sm:text-[26px] font-bold text-[#002d2d] mt-1 tabular-nums">
                  {entityAnalysis.txns.toLocaleString()}
                </div>
                <div className="text-[11px] text-[#1c4b4b] mt-1 tabular-nums">
                  Avg order ticket: <strong className="text-[#002d2d] font-semibold">{formatINR(Math.round(entityAnalysis.avgOrderValue))}</strong>
                </div>
              </div>
            </div>

            {/* Strategic Executive Takeaway & Monthly Pace */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
              {/* Left 7 Columns: Executive Strategic Brief */}
              <div className="lg:col-span-7 bg-[#FFFFFF] rounded-lg border border-[#b9dcdb] p-3.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-[#b9dcdb]/80 text-[12px]">
                    <span className="font-bold text-[#002d2d] flex items-center gap-1.5">
                      <Target className="w-4 h-4 text-[#004c4c]" />
                      Executive Leadership Brief & Strategic Priorities
                    </span>
                    <span className="text-[10px] text-[#004c4c] font-bold bg-[#F2F6F4] px-2 py-0.5 rounded border border-[#b9dcdb]">
                      Board Memo
                    </span>
                  </div>

                  <div className="mt-3 space-y-2.5 text-[12px] text-[#002d2d]">
                    <div className="flex items-start gap-2 bg-[#F8FAF9] p-2.5 rounded-md border border-[#b9dcdb]/60">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#004c4c] mt-1.5 shrink-0" />
                      <div>
                        <strong className="font-bold text-[#002d2d]">Portfolio Scale & Share:</strong>{' '}
                        <span className="text-[#1c4b4b]">
                          Delivers <strong className="text-[#002d2d]">{formatINR(entityAnalysis.sales)}</strong> across{' '}
                          <strong className="text-[#002d2d]">{formatUnits(entityAnalysis.units)}</strong> units, representing{' '}
                          <strong className="text-[#004c4c] font-bold">{entityAnalysis.salesShare.toFixed(1)}%</strong> of national gross revenue.
                        </span>
                      </div>
                    </div>

                    <div className="flex items-start gap-2 bg-[#F8FAF9] p-2.5 rounded-md border border-[#b9dcdb]/60">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#8c1e1c] mt-1.5 shrink-0" />
                      <div>
                        <strong className="font-bold text-[#002d2d]">Pricing Power & Margin Integrity:</strong>{' '}
                        <span className="text-[#1c4b4b]">
                          Realization averages <strong className="text-[#002d2d]">₹{entityAnalysis.avgRealization.toFixed(2)}/unit</strong> ({' '}
                          <span className={entityAnalysis.realizationVariance >= 0 ? 'text-[#004c4c] font-bold' : 'text-[#8c1e1c] font-bold'}>
                            {entityAnalysis.realizationVariance >= 0 ? '+' : ''}{entityAnalysis.realizationVariance.toFixed(1)}% vs corporate average
                          </span>). Realization spread indicates trade discounts range from ₹{entityAnalysis.minRealization.toFixed(1)} to ₹{entityAnalysis.maxRealization.toFixed(1)}.
                        </span>
                      </div>
                    </div>

                    <div className="flex items-start gap-2 bg-[#F8FAF9] p-2.5 rounded-md border border-[#b9dcdb]/60">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#1c4b4b] mt-1.5 shrink-0" />
                      <div>
                        <strong className="font-bold text-[#002d2d]">Executive Directive:</strong>{' '}
                        <span className="text-[#1c4b4b]">
                          {entityAnalysis.topDistShare > 30 ? (
                            <span>Mitigate channel concentration with <strong className="text-[#002d2d]">{entityAnalysis.distList[0]?.name}</strong> ({entityAnalysis.topDistShare.toFixed(1)}% share) while expanding secondary retail replenishment across other regional channels.</span>
                          ) : (
                            <span>Maintain healthy distribution breadth across top stockists and align manufacturing throughput at primary plant hubs.</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-[#b9dcdb]/70 flex items-center justify-between text-[11px] text-[#1c4b4b]">
                  <span>FMCG Commercial Intelligence Engine</span>
                  <button
                    onClick={handleCopyMemo}
                    className="text-[#004c4c] hover:underline cursor-pointer font-bold"
                  >
                    Copy Memo
                  </button>
                </div>
              </div>

              {/* Right 5 Columns: 12-Month Off-take Pace */}
              <div className="lg:col-span-5 bg-[#FFFFFF] rounded-lg border border-[#b9dcdb] p-3.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-[#b9dcdb]/80 text-[12px]">
                    <span className="font-bold text-[#002d2d]">
                      12-Month Off-take Pace Trajectory
                    </span>
                    <span className="text-[#1c4b4b] text-[11px] tabular-nums">
                      Peak: {entityAnalysis.peakMonth?.month || 'N/A'}
                    </span>
                  </div>

                  {/* Monthly Sparkline Bars */}
                  <div className="mt-3 flex items-end justify-between gap-1 h-24 pt-2">
                    {entityAnalysis.monthlyTrajectory.map((m, idx) => {
                      const heightPercent = maxMonthSales > 0 ? (m.sales / maxMonthSales) * 100 : 0;
                      const isPeak = entityAnalysis.peakMonth?.month === m.month;
                      return (
                        <div
                          key={idx}
                          className="flex-1 flex flex-col items-center h-full justify-end group relative"
                        >
                          {/* Tooltip on Hover */}
                          <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-[#002d2d] text-white text-[10px] rounded px-1.5 py-0.5 whitespace-nowrap z-20 pointer-events-none tabular-nums shadow-sm">
                            {m.month.slice(0, 3)}: {formatINR(m.sales)} ({formatUnits(m.units)}u)
                          </div>
                          {/* Bar */}
                          <div
                            className={`w-full rounded-t-xs transition-colors ${
                              isPeak ? 'bg-[#ffedd5] border-t border-[#8c1e1c]' : 'bg-[#004c4c] group-hover:bg-[#1c4b4b]'
                            }`}
                            style={{ height: `${Math.max(6, heightPercent)}%` }}
                          />
                          {/* Label */}
                          <span className={`text-[9px] mt-1 tabular-nums ${isPeak ? 'font-bold text-[#002d2d]' : 'text-[#1c4b4b]'}`}>
                            {m.month.slice(0, 1)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between text-[10px] text-[#1c4b4b] pt-1 border-t border-[#b9dcdb]/60">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#ffedd5] border border-[#8c1e1c]" /> Peak month
                    <span className="w-2 h-2 rounded-full bg-[#004c4c] ml-2" /> Standard pace
                  </span>
                  <span>Hover column for details</span>
                </div>
              </div>
            </div>

            {/* Sourcing & Distribution Pillar Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Top Plants Allocation */}
              <div className="bg-[#FFFFFF] rounded-lg border border-[#b9dcdb] p-3.5">
                <div className="flex items-center justify-between pb-2 border-b border-[#b9dcdb]/80 text-[12px]">
                  <span className="font-bold text-[#002d2d] flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-[#004c4c]" />
                    Top Manufacturing Hub Sourcing
                  </span>
                  <span className="text-[11px] text-[#1c4b4b] tabular-nums">
                    {entityAnalysis.plantList.length} Plants Sourcing
                  </span>
                </div>
                <div className="mt-2.5 space-y-2">
                  {entityAnalysis.plantList.slice(0, 3).map((p, idx) => {
                    const share = entityAnalysis.sales > 0 ? (p.sales / entityAnalysis.sales) * 100 : 0;
                    return (
                      <div key={idx} className="flex items-center justify-between text-[12px] bg-[#F8FAF9] p-2 rounded border border-[#b9dcdb]/60">
                        <div>
                          <span className="text-[#002d2d] font-semibold block">{p.name}</span>
                          <span className="text-[10px] text-[#1c4b4b]">{formatUnits(p.units)} units dispatched</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[#004c4c] font-bold tabular-nums block">{formatINR(p.sales)}</span>
                          <span className="text-[10px] text-[#1c4b4b] tabular-nums">{share.toFixed(1)}% of entity</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Top Distributors Allocation */}
              <div className="bg-[#FFFFFF] rounded-lg border border-[#b9dcdb] p-3.5">
                <div className="flex items-center justify-between pb-2 border-b border-[#b9dcdb]/80 text-[12px]">
                  <span className="font-bold text-[#002d2d] flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-[#004c4c]" />
                    Key Distributor Distribution Channels
                  </span>
                  <span className="text-[11px] text-[#1c4b4b] tabular-nums">
                    {entityAnalysis.distList.length} Channel Partners
                  </span>
                </div>
                <div className="mt-2.5 space-y-2">
                  {entityAnalysis.distList.slice(0, 3).map((d, idx) => {
                    const share = entityAnalysis.sales > 0 ? (d.sales / entityAnalysis.sales) * 100 : 0;
                    return (
                      <div key={idx} className="flex items-center justify-between text-[12px] bg-[#F8FAF9] p-2 rounded border border-[#b9dcdb]/60">
                        <div>
                          <span className="text-[#002d2d] font-semibold block truncate max-w-[200px]" title={d.name}>{d.name}</span>
                          <span className="text-[10px] text-[#1c4b4b]">{formatUnits(d.units)} units absorbed</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[#004c4c] font-bold tabular-nums block">{formatINR(d.sales)}</span>
                          <span className="text-[10px] text-[#1c4b4b] tabular-nums">{share.toFixed(1)}% of entity</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ======================================================== */
          /* (b) CONCERNED MANAGER DETAILED DIAGNOSTIC                */
          /* ======================================================== */
          <div className="flex flex-col gap-4">
            {/* Concerned Manager Persona Context Header */}
            <div className="bg-[#F8FAF9] border border-[#b9dcdb] rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-md bg-[#002d2d] text-[#ffedd5] flex items-center justify-center shrink-0 font-bold text-[13px]">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-bold text-[#002d2d]">
                      {activeDimConfig.managerRole}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white text-[#004c4c] border border-[#b9dcdb]">
                      Operational Desk
                    </span>
                  </div>
                  <span className="text-[11px] text-[#1c4b4b]">
                    Managing <strong className="text-[#002d2d]">{selectedEntity}</strong> across {entityAnalysis.rowCount} recorded dispatches • {entityAnalysis.txns.toLocaleString()} order lines
                  </span>
                </div>
              </div>

              {/* Manager Quick Export */}
              <button
                onClick={handleExportManagerData}
                className="h-8 px-3 rounded-md bg-white hover:bg-[#F2F6F4] text-[#002d2d] border border-[#b9dcdb] text-[12px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                title="Export complete operational ledger for this entity as CSV"
              >
                <Download className="w-3.5 h-3.5 text-[#004c4c]" />
                <span>Export Manager Ledger (CSV)</span>
              </button>
            </div>

            {/* Manager Operational Diagnostic KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Metric 1: Channel Concentration Index */}
              <div className="bg-[#FFFFFF] rounded-lg border border-[#b9dcdb] p-3.5">
                <div className="flex items-center justify-between text-[11px] text-[#1c4b4b]">
                  <span className="font-semibold">Channel Concentration</span>
                  <span className="text-[10px] bg-[#F2F6F4] px-1.5 py-0.5 rounded border border-[#b9dcdb]">Dependency</span>
                </div>
                <div className="text-[22px] font-bold text-[#002d2d] mt-1 tabular-nums">
                  {entityAnalysis.topDistShare.toFixed(1)}%
                </div>
                <div className="text-[11px] mt-1">
                  {entityAnalysis.topDistShare > 35 ? (
                    <span className="text-[#8c1e1c] font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-[#8c1e1c]" /> High concentration risk
                    </span>
                  ) : (
                    <span className="text-[#004c4c] font-bold flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-[#004c4c]" /> Balanced channel diversity
                    </span>
                  )}
                </div>
              </div>

              {/* Metric 2: Sourcing Nodes */}
              <div className="bg-[#FFFFFF] rounded-lg border border-[#b9dcdb] p-3.5">
                <div className="flex items-center justify-between text-[11px] text-[#1c4b4b]">
                  <span className="font-semibold">Active Plants Sourcing</span>
                  <span className="text-[10px] bg-[#F2F6F4] px-1.5 py-0.5 rounded border border-[#b9dcdb]">Fulfillment</span>
                </div>
                <div className="text-[22px] font-bold text-[#002d2d] mt-1 tabular-nums">
                  {entityAnalysis.plantList.length} Plants
                </div>
                <div className="text-[11px] text-[#1c4b4b] mt-1 tabular-nums">
                  Primary plant: <strong className="text-[#002d2d] font-semibold">{entityAnalysis.plantList[0]?.name?.split(' ')[0] || 'N/A'}</strong> ({entityAnalysis.topPlantShare.toFixed(0)}%)
                </div>
              </div>

              {/* Metric 3: Realization Spread */}
              <div className="bg-[#FFFFFF] rounded-lg border border-[#b9dcdb] p-3.5">
                <div className="flex items-center justify-between text-[11px] text-[#1c4b4b]">
                  <span className="font-semibold">Realization Spread</span>
                  <span className="text-[10px] bg-[#F2F6F4] px-1.5 py-0.5 rounded border border-[#b9dcdb]">Price Bounds</span>
                </div>
                <div className="text-[22px] font-bold text-[#002d2d] mt-1 tabular-nums">
                  ₹{entityAnalysis.minRealization.toFixed(0)} - ₹{entityAnalysis.maxRealization.toFixed(0)}
                </div>
                <div className="text-[11px] text-[#1c4b4b] mt-1 tabular-nums">
                  Spread delta: ₹{(entityAnalysis.maxRealization - entityAnalysis.minRealization).toFixed(1)}/u discount variance
                </div>
              </div>

              {/* Metric 4: Batch Dispatch Density */}
              <div className="bg-[#FFFFFF] rounded-lg border border-[#b9dcdb] p-3.5">
                <div className="flex items-center justify-between text-[11px] text-[#1c4b4b]">
                  <span className="font-semibold">Order Density</span>
                  <span className="text-[10px] bg-[#F2F6F4] px-1.5 py-0.5 rounded border border-[#b9dcdb]">Logistics</span>
                </div>
                <div className="text-[22px] font-bold text-[#002d2d] mt-1 tabular-nums">
                  {Math.round(entityAnalysis.unitsPerTxn)} u/row
                </div>
                <div className="text-[11px] text-[#1c4b4b] mt-1 tabular-nums">
                  Avg order basket: <strong className="text-[#002d2d] font-semibold">{formatINR(Math.round(entityAnalysis.avgOrderValue))}</strong>
                </div>
              </div>
            </div>

            {/* Manager's Action Checklist & Operational Directives */}
            <div className="bg-[#FFFFFF] rounded-lg border border-[#b9dcdb] p-3.5">
              <div className="flex items-center justify-between pb-2 border-b border-[#b9dcdb]/80 text-[12px]">
                <span className="font-bold text-[#002d2d] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#004c4c]" />
                  Operational Directives for {activeDimConfig.managerRole}
                </span>
                <span className="text-[11px] text-[#1c4b4b]">
                  Action Matrix
                </span>
              </div>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-[12px]">
                {/* 1. Supply Chain & Capacity Balancing */}
                <div className="bg-[#F8FAF9] rounded-md p-3 border border-[#b9dcdb]/70 flex flex-col justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-[#004c4c] uppercase tracking-wider block mb-1">
                      1. Supply & Plant Load Balancing
                    </span>
                    <p className="text-[#1c4b4b] text-[11px] leading-relaxed">
                      Primary plant <strong className="text-[#002d2d]">{entityAnalysis.plantList[0]?.name}</strong> accounts for{' '}
                      <strong className="text-[#002d2d]">{entityAnalysis.topPlantShare.toFixed(1)}%</strong> of production. Maintain backup throughput at secondary hub{' '}
                      <strong className="text-[#002d2d]">{entityAnalysis.plantList[1]?.name || 'Sanand Plant 2'}</strong> to prevent regional stock-outs during peak off-take.
                    </p>
                  </div>
                  <div className="mt-2.5 pt-2 border-t border-[#b9dcdb]/60 flex items-center gap-1 text-[10px] text-[#004c4c] font-bold">
                    <Check className="w-3 h-3" /> Production quota balanced
                  </div>
                </div>

                {/* 2. Trade Schemes & Channel Pricing */}
                <div className="bg-[#F8FAF9] rounded-md p-3 border border-[#b9dcdb]/70 flex flex-col justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-[#004c4c] uppercase tracking-wider block mb-1">
                      2. Trade Schemes & Realization Audit
                    </span>
                    <p className="text-[#1c4b4b] text-[11px] leading-relaxed">
                      Realization variance is currently{' '}
                      <strong className={entityAnalysis.realizationVariance >= 0 ? 'text-[#004c4c]' : 'text-[#8c1e1c]'}>
                        {entityAnalysis.realizationVariance >= 0 ? '+' : ''}{entityAnalysis.realizationVariance.toFixed(1)}%
                      </strong>{' '}
                      vs company baseline. Audit distributor trade schemes to eliminate unapproved territory discounting below ₹{entityAnalysis.minRealization.toFixed(0)}.
                    </p>
                  </div>
                  <div className="mt-2.5 pt-2 border-t border-[#b9dcdb]/60 flex items-center gap-1 text-[10px] text-[#004c4c] font-bold">
                    <ArrowUpRight className="w-3 h-3" /> Audit quarterly scheme leakage
                  </div>
                </div>

                {/* 3. Distributor Order Replenishment */}
                <div className="bg-[#F8FAF9] rounded-md p-3 border border-[#b9dcdb]/70 flex flex-col justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-[#004c4c] uppercase tracking-wider block mb-1">
                      3. Channel Replenishment Cadence
                    </span>
                    <p className="text-[#1c4b4b] text-[11px] leading-relaxed">
                      Top stockist <strong className="text-[#002d2d]">{entityAnalysis.distList[0]?.name}</strong> absorbs{' '}
                      <strong className="text-[#002d2d]">{formatUnits(entityAnalysis.distList[0]?.units || 0)}</strong> units. Coordinate bi-weekly dispatch schedules to reduce warehouse holding lead times.
                    </p>
                  </div>
                  <div className="mt-2.5 pt-2 border-t border-[#b9dcdb]/60 flex items-center gap-1 text-[10px] text-[#1c4b4b] font-medium">
                    <Clock className="w-3 h-3" /> Bi-weekly dispatch cadence
                  </div>
                </div>
              </div>
            </div>

            {/* Manager's Detailed Cross-Tabulation Matrix */}
            <div className="bg-[#FFFFFF] rounded-lg border border-[#b9dcdb] p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#b9dcdb]/80">
                <span className="font-bold text-[#002d2d] text-[13px]">
                  Granular Operational Cross-Tabulation for {selectedEntity}
                </span>

                {/* Sub-Tabs for Manager Matrix */}
                <div className="inline-flex rounded-md bg-[#F2F6F4] p-0.5 border border-[#b9dcdb] text-[11px]">
                  <button
                    onClick={() => setManagerDetailTab('distributors')}
                    className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                      managerDetailTab === 'distributors'
                        ? 'bg-white text-[#004c4c] font-bold shadow-xs border border-[#b9dcdb]'
                        : 'text-[#1c4b4b] hover:text-[#002d2d]'
                    }`}
                  >
                    Distributor Channels ({entityAnalysis.distList.length})
                  </button>
                  <button
                    onClick={() => setManagerDetailTab('plants')}
                    className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                      managerDetailTab === 'plants'
                        ? 'bg-white text-[#004c4c] font-bold shadow-xs border border-[#b9dcdb]'
                        : 'text-[#1c4b4b] hover:text-[#002d2d]'
                    }`}
                  >
                    Manufacturing Plants ({entityAnalysis.plantList.length})
                  </button>
                  <button
                    onClick={() => setManagerDetailTab('categories')}
                    className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                      managerDetailTab === 'categories'
                        ? 'bg-white text-[#004c4c] font-bold shadow-xs border border-[#b9dcdb]'
                        : 'text-[#1c4b4b] hover:text-[#002d2d]'
                    }`}
                  >
                    Product Lines ({entityAnalysis.categoryList.length})
                  </button>
                  <button
                    onClick={() => setManagerDetailTab('months')}
                    className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                      managerDetailTab === 'months'
                        ? 'bg-white text-[#004c4c] font-bold shadow-xs border border-[#b9dcdb]'
                        : 'text-[#1c4b4b] hover:text-[#002d2d]'
                    }`}
                  >
                    Monthly Schedule (12)
                  </button>
                </div>
              </div>

              {/* Data Table */}
              <div className="mt-2.5 overflow-x-auto">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="border-b border-[#b9dcdb] text-[#1c4b4b] font-bold bg-[#F2F6F4]">
                      <th className="py-2 px-3">Operational Segment</th>
                      <th className="py-2 px-3 text-right">Transactions</th>
                      <th className="py-2 px-3 text-right">Volume (Units)</th>
                      <th className="py-2 px-3 text-right">Gross Sales (INR)</th>
                      <th className="py-2 px-3 text-right">Avg Realization</th>
                      <th className="py-2 px-3 text-right">Share of Entity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#b9dcdb]/60">
                    {(managerDetailTab === 'distributors'
                      ? entityAnalysis.distList
                      : managerDetailTab === 'plants'
                      ? entityAnalysis.plantList
                      : managerDetailTab === 'categories'
                      ? entityAnalysis.categoryList
                      : entityAnalysis.monthlyTrajectory.map((m) => ({ name: m.month, ...m }))
                    ).map((row, idx) => {
                      const share = entityAnalysis.sales > 0 ? (row.sales / entityAnalysis.sales) * 100 : 0;
                      const rz = row.units > 0 ? row.sales / row.units : 0;
                      return (
                        <tr key={idx} className="hover:bg-[#F2F6F4] transition-colors">
                          <td className="py-2 px-3 font-semibold text-[#002d2d]">{row.name}</td>
                          <td className="py-2 px-3 text-right text-[#1c4b4b] tabular-nums">
                            {(row.rows || 1).toLocaleString()}
                          </td>
                          <td className="py-2 px-3 text-right text-[#002d2d] font-medium tabular-nums">
                            {formatUnits(row.units)}
                          </td>
                          <td className="py-2 px-3 text-right text-[#004c4c] font-bold tabular-nums">
                            {formatINR(row.sales)}
                          </td>
                          <td className="py-2 px-3 text-right text-[#002d2d] tabular-nums font-semibold">
                            ₹{rz.toFixed(2)}/u
                          </td>
                          <td className="py-2 px-3 text-right text-[#1c4b4b] tabular-nums font-medium">
                            {share.toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-2.5 pt-2 border-t border-[#b9dcdb]/70 flex items-center justify-between text-[11px] text-[#1c4b4b]">
                <span>Showing detailed segment metrics for manager oversight</span>
                <button
                  onClick={handleExportManagerData}
                  className="text-[#004c4c] hover:underline cursor-pointer font-bold flex items-center gap-1"
                >
                  <Download className="w-3 h-3" /> Download this operational view as CSV
                </button>
              </div>
            </div>
          </div>
        )
      ) : (
        <div className="p-8 text-center text-[#1c4b4b] text-[12px]">
          No data available for selected entity.
        </div>
      )}
    </div>
  );
};
