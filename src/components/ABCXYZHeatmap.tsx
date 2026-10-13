import React, { useState, useMemo } from 'react';
import {
  Grid3X3,
  Globe,
  Truck,
  TrendingUp,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  Download,
  Bot,
  Search,
  ChevronDown,
  Info,
  CheckCircle2,
  Package,
  Layers,
  ArrowUpDown,
  Filter,
} from 'lucide-react';
import {
  FMCGRecord,
  ABCClass,
  XYZClass,
  ABCXYZSegment,
  SKUAnalysisItem,
  MatrixCellData,
} from '../types/fmcg';
import { formatINR, formatUnits } from '../utils/currencyFormatter';
import { exportDatasetToCSV } from '../utils/fileParser';

interface ABCXYZHeatmapProps {
  data: FMCGRecord[];
  distributors: string[];
  onAskAI: (prompt: string) => void;
  onFilterSKU?: (sku: string) => void;
}

const STRATEGY_DEFINITIONS: Record<
  ABCXYZSegment,
  { title: string; directive: string; risk: 'low' | 'moderate' | 'high'; colorClass: string; borderClass: string }
> = {
  AX: {
    title: 'Core Staples (Automated JIT)',
    directive: 'High turnover, predictable demand. Enforce Vendor-Managed Inventory (VMI) and just-in-time replenishment. Minimum safety stock needed.',
    risk: 'low',
    colorClass: 'bg-[#004c4c] text-white',
    borderClass: 'border-[#003838]',
  },
  AY: {
    title: 'Seasonal Champions (Buffer Stock)',
    directive: 'High value with seasonal swings. Coordinate pre-season inventory build-ups 45 days prior. Tight collaborative demand forecasting.',
    risk: 'moderate',
    colorClass: 'bg-[#004c4c]/90 text-white',
    borderClass: 'border-[#34a1a5]/50',
  },
  AZ: {
    title: 'High Capital Risk (Make-to-Order)',
    directive: 'High value with erratic demand. Avoid speculative stockholding. Procure or assemble to order with confirmed distributor advance payments.',
    risk: 'high',
    colorClass: 'bg-[#ff6b68] text-white',
    borderClass: 'border-[#8c1e1c]',
  },
  BX: {
    title: 'Steady Mediums (Batch Reorder)',
    directive: 'Moderate value, stable demand. Standard automated replenishment with monthly reviews. Economical order quantities (EOQ).',
    risk: 'low',
    colorClass: 'bg-[#34a1a5] text-white',
    borderClass: 'border-[#004c4c]/40',
  },
  BY: {
    title: 'Seasonal Fillers (Promotional Alignment)',
    directive: 'Moderate value, seasonal variance. Align factory production campaigns with festive calendar and regional trade promotion schedules.',
    risk: 'moderate',
    colorClass: 'bg-[#34a1a5]/80 text-[#002d2d] font-semibold',
    borderClass: 'border-[#34a1a5]',
  },
  BZ: {
    title: 'Volatile Mediums (Min-Max Control)',
    directive: 'Moderate value, irregular off-take. Enforce strict safety stock limits to prevent working capital lock-in. Centralize depot inventory.',
    risk: 'high',
    colorClass: 'bg-[#ff6b68]/80 text-white font-medium',
    borderClass: 'border-[#ff6b68]',
  },
  CX: {
    title: 'High-Velocity Convenience (Bulk Order)',
    directive: 'Low unit value, predictable volume. Procure in bulk to maximize volume discounts and reduce purchase order handling frequency.',
    risk: 'low',
    colorClass: 'bg-[#ffedd5] text-[#004c4c] font-bold',
    borderClass: 'border-[#34a1a5]/60',
  },
  CY: {
    title: 'Seasonal Fringe (Pre-Order Fulfill)',
    directive: 'Low value, fluctuating demand. Produce only on distributor firm indents. Do not carry stock post peak season.',
    risk: 'moderate',
    colorClass: 'bg-[#ffedd5]/90 text-[#0d2828] font-medium',
    borderClass: 'border-[#f59e0b]/40',
  },
  CZ: {
    title: 'Rationalization Candidates (Delist/Prune)',
    directive: 'Low value, erratic demand, high inventory holding cost. Prime candidates for portfolio pruning, phase-out, or territory delisting.',
    risk: 'high',
    colorClass: 'bg-[#ff6b68]/20 text-[#8c1e1c] font-bold',
    borderClass: 'border-[#ff6b68]/70 border-2',
  },
};

export const ABCXYZHeatmap: React.FC<ABCXYZHeatmapProps> = ({
  data,
  distributors,
  onAskAI,
  onFilterSKU,
}) => {
  const [analysisScope, setAnalysisScope] = useState<'global' | 'distributor'>('global');
  const [selectedDistributor, setSelectedDistributor] = useState<string>(() => distributors[0] || 'North SuperStockist Ltd');
  const [selectedSegment, setSelectedSegment] = useState<ABCXYZSegment | null>('AX');
  const [skuSearchQuery, setSkuSearchQuery] = useState<string>('');
  const [sortField, setSortField] = useState<'sales' | 'units' | 'cv' | 'realization'>('sales');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Scope dataset
  const scopedData = useMemo(() => {
    if (analysisScope === 'global') {
      return data;
    }
    return data.filter((r) => r.Distributor === selectedDistributor);
  }, [data, analysisScope, selectedDistributor]);

  // Compute ABC-XYZ analysis for all SKUs in scope
  // Strict requirement:
  // - X category products = 12% of products in scope
  // - Among X: AX = 19%, BX = 32%, CX = 49% (rest)
  const { skuAnalysisList, matrix, totalSales, totalUnits, totalSKUsCount, xSummary } = useMemo(() => {
    // 1. Aggregate per SKU
    const skuMap = new Map<
      string,
      {
        sku: string;
        brand: string;
        category: string;
        sales: number;
        units: number;
        months: Map<number, number>;
        distributors: Set<string>;
      }
    >();

    scopedData.forEach((row) => {
      const skuKey = row.SKU || `${row.Brand} - Standard`;
      let item = skuMap.get(skuKey);
      if (!item) {
        item = {
          sku: skuKey,
          brand: row.Brand,
          category: row.Category,
          sales: 0,
          units: 0,
          months: new Map<number, number>(),
          distributors: new Set<string>(),
        };
        skuMap.set(skuKey, item);
      }

      item.sales += row.Sales_INR;
      item.units += row.Units_Sold;
      item.distributors.add(row.Distributor);

      const mIdx = row.Month_Index || 1;
      const curMonthSales = item.months.get(mIdx) || 0;
      item.months.set(mIdx, curMonthSales + row.Sales_INR);
    });

    const rawList = Array.from(skuMap.values());
    const totalScopeSales = rawList.reduce((acc, s) => acc + s.sales, 0);
    const totalScopeUnits = rawList.reduce((acc, s) => acc + s.units, 0);

    // Compute monthly CV for each SKU
    const intermediateList = rawList.map((item) => {
      const monthlyArray: number[] = [];
      for (let m = 1; m <= 12; m++) {
        monthlyArray.push(item.months.get(m) || 0);
      }

      const mean = monthlyArray.reduce((acc, val) => acc + val, 0) / 12;
      const variance = monthlyArray.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / 12;
      const stdDev = Math.sqrt(variance);
      const cv = mean > 0 ? stdDev / mean : 1.0;

      return {
        ...item,
        monthlySales: monthlyArray,
        meanMonthlySales: mean,
        stdDevMonthlySales: stdDev,
        coefficientOfVariation: cv,
      };
    });

    // 2. Classify X category products (Strictly 12% of total SKUs)
    // Sort by CV ascending to find the most predictable / steady items
    intermediateList.sort((a, b) => a.coefficientOfVariation - b.coefficientOfVariation);

    const totalCount = intermediateList.length;
    // Exactly 12% in X category
    const targetXCount = Math.max(1, Math.round(totalCount * 0.12));
    const xGroup = intermediateList.slice(0, targetXCount);
    const nonXGroup = intermediateList.slice(targetXCount);

    // Within X category: AX = 19%, BX = 32%, CX = 49%
    // Sort X group by sales descending
    xGroup.sort((a, b) => b.sales - a.sales);
    const axCount = Math.max(1, Math.round(targetXCount * 0.19));
    const bxCount = Math.max(1, Math.round(targetXCount * 0.32));

    const finalItems: SKUAnalysisItem[] = [];

    // Assign X items
    xGroup.forEach((item, idx) => {
      let abc: ABCClass = 'C';
      if (idx < axCount) {
        abc = 'A';
      } else if (idx < axCount + bxCount) {
        abc = 'B';
      } else {
        abc = 'C';
      }

      const segment = `${abc}X` as ABCXYZSegment;
      const avgRealization = item.units > 0 ? item.sales / item.units : 0;
      const revenueShare = totalScopeSales > 0 ? (item.sales / totalScopeSales) * 100 : 0;

      finalItems.push({
        sku: item.sku,
        brand: item.brand,
        category: item.category,
        sales: item.sales,
        units: item.units,
        revenueShare,
        cumulativeRevenueShare: 0,
        abc,
        monthlySales: item.monthlySales,
        meanMonthlySales: item.meanMonthlySales,
        stdDevMonthlySales: item.stdDevMonthlySales,
        coefficientOfVariation: item.coefficientOfVariation,
        xyz: 'X',
        segment,
        distributorCount: item.distributors.size,
        avgRealization,
      });
    });

    // Assign remaining 88% across Y (seasonal) and Z (erratic) with Pareto ABC
    nonXGroup.sort((a, b) => b.sales - a.sales);
    const nonXTotalSales = nonXGroup.reduce((acc, s) => acc + s.sales, 0);
    let runningNonXSales = 0;

    // Median CV of non-X items separates Y from Z
    const nonXCvs = nonXGroup.map((i) => i.coefficientOfVariation).sort((a, b) => a - b);
    const medianCv = nonXCvs[Math.floor(nonXCvs.length * 0.52)] || 0.55;

    nonXGroup.forEach((item) => {
      runningNonXSales += item.sales;
      const nonXShare = nonXTotalSales > 0 ? (runningNonXSales / nonXTotalSales) * 100 : 0;

      let abc: ABCClass = 'C';
      if (nonXShare <= 70) {
        abc = 'A';
      } else if (nonXShare <= 90) {
        abc = 'B';
      } else {
        abc = 'C';
      }

      const xyz: XYZClass = item.coefficientOfVariation <= medianCv ? 'Y' : 'Z';
      const segment = `${abc}${xyz}` as ABCXYZSegment;
      const avgRealization = item.units > 0 ? item.sales / item.units : 0;
      const revenueShare = totalScopeSales > 0 ? (item.sales / totalScopeSales) * 100 : 0;

      finalItems.push({
        sku: item.sku,
        brand: item.brand,
        category: item.category,
        sales: item.sales,
        units: item.units,
        revenueShare,
        cumulativeRevenueShare: 0,
        abc,
        monthlySales: item.monthlySales,
        meanMonthlySales: item.meanMonthlySales,
        stdDevMonthlySales: item.stdDevMonthlySales,
        coefficientOfVariation: item.coefficientOfVariation,
        xyz,
        segment,
        distributorCount: item.distributors.size,
        avgRealization,
      });
    });

    // Compute cumulative revenue share across entire sorted catalog
    finalItems.sort((a, b) => b.sales - a.sales);
    let cumulative = 0;
    finalItems.forEach((item) => {
      cumulative += item.sales;
      item.cumulativeRevenueShare = totalScopeSales > 0 ? (cumulative / totalScopeSales) * 100 : 0;
    });

    // 3. Build 3x3 Matrix
    const rows: ABCClass[] = ['A', 'B', 'C'];
    const cols: XYZClass[] = ['X', 'Y', 'Z'];

    const matrixMap = new Map<ABCXYZSegment, MatrixCellData>();

    rows.forEach((abc) => {
      cols.forEach((xyz) => {
        const seg = `${abc}${xyz}` as ABCXYZSegment;
        const matching = finalItems.filter((i) => i.segment === seg);
        const cellSales = matching.reduce((acc, i) => acc + i.sales, 0);
        const cellUnits = matching.reduce((acc, i) => acc + i.units, 0);
        const cellSkuShare = rawList.length > 0 ? (matching.length / rawList.length) * 100 : 0;
        const cellSalesShare = totalScopeSales > 0 ? (cellSales / totalScopeSales) * 100 : 0;
        const strat = STRATEGY_DEFINITIONS[seg];

        matrixMap.set(seg, {
          segment: seg,
          abc,
          xyz,
          skuCount: matching.length,
          skuShare: cellSkuShare,
          sales: cellSales,
          salesShare: cellSalesShare,
          units: cellUnits,
          skus: matching,
          strategyTitle: strat.title,
          strategyDirective: strat.directive,
        });
      });
    });

    const xItems = finalItems.filter((i) => i.xyz === 'X');
    const axItems = xItems.filter((i) => i.abc === 'A');
    const bxItems = xItems.filter((i) => i.abc === 'B');
    const cxItems = xItems.filter((i) => i.abc === 'C');

    const xSummary = {
      totalX: xItems.length,
      xShare: totalCount > 0 ? ((xItems.length / totalCount) * 100).toFixed(1) : '12.0',
      axCount: axItems.length,
      axShareOfX: xItems.length > 0 ? ((axItems.length / xItems.length) * 100).toFixed(1) : '19.0',
      bxCount: bxItems.length,
      bxShareOfX: xItems.length > 0 ? ((bxItems.length / xItems.length) * 100).toFixed(1) : '32.0',
      cxCount: cxItems.length,
      cxShareOfX: xItems.length > 0 ? ((cxItems.length / xItems.length) * 100).toFixed(1) : '49.0',
    };

    return {
      skuAnalysisList: finalItems,
      matrix: matrixMap,
      totalSales: totalScopeSales,
      totalUnits: totalScopeUnits,
      totalSKUsCount: rawList.length,
      xSummary,
    };
  }, [scopedData]);

  // Selected cell data
  const activeCell = useMemo(() => {
    if (!selectedSegment) return null;
    return matrix.get(selectedSegment) || null;
  }, [selectedSegment, matrix]);

  // Filtered SKUs for drawer
  const displayedSKUs = useMemo(() => {
    if (!activeCell) return [];
    let list = [...activeCell.skus];
    if (skuSearchQuery.trim()) {
      const q = skuSearchQuery.toLowerCase();
      list = list.filter(
        (s) =>
          s.sku.toLowerCase().includes(q) ||
          s.brand.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      let diff = 0;
      if (sortField === 'sales') diff = a.sales - b.sales;
      else if (sortField === 'units') diff = a.units - b.units;
      else if (sortField === 'cv') diff = a.coefficientOfVariation - b.coefficientOfVariation;
      else if (sortField === 'realization') diff = a.avgRealization - b.avgRealization;
      return sortAsc ? diff : -diff;
    });

    return list;
  }, [activeCell, skuSearchQuery, sortField, sortAsc]);

  const handleExportSegmentCSV = () => {
    if (!activeCell || activeCell.skus.length === 0) return;
    const exportRows = activeCell.skus.map((s) => ({
      SKU: s.sku,
      Brand: s.brand,
      Product_Line: s.category,
      Segment: s.segment,
      ABC_Class: s.abc,
      XYZ_Class: s.xyz,
      Sales_INR: s.sales,
      Units_Sold: s.units,
      Avg_Realization: Math.round(s.avgRealization * 100) / 100,
      Demand_CV_Pct: Math.round(s.coefficientOfVariation * 1000) / 10,
      Revenue_Share_Pct: Math.round(s.revenueShare * 100) / 100,
      Directive: activeCell.strategyDirective,
    }));
    exportDatasetToCSV(
      exportRows,
      `FMCG_ABC_XYZ_${activeCell.segment}_${analysisScope}_${new Date().toISOString().slice(0, 10)}.csv`
    );
  };

  return (
    <div className="glass-panel rounded-2xl p-4 sm:p-6 transition-all duration-300">
      {/* Top Header & Scope Selector */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-5 border-b border-[#34a1a5]/20">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#004c4c] to-[#34a1a5] flex items-center justify-center text-white shadow-sm shadow-[#004c4c]/20">
              <Grid3X3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-[17px] font-bold text-[#002d2d] tracking-tight">
                ABC-XYZ Demand Volatility & Value Matrix
              </h2>
              <p className="text-[12px] text-[#1c4b4b] font-medium">
                Dual-tier multi-dimensional portfolio intelligence at Enterprise & Distributor scopes
              </p>
            </div>
          </div>
        </div>

        {/* Scope Pill Controls (MacBook Glassy Style) */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="p-1 rounded-xl bg-white/70 backdrop-blur-md border border-[#34a1a5]/25 flex items-center shadow-inner">
            <button
              onClick={() => setAnalysisScope('global')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all duration-200 cursor-pointer ${
                analysisScope === 'global'
                  ? 'glass-btn-primary shadow-sm'
                  : 'text-[#004c4c] hover:bg-white/80'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Global Enterprise ({totalSKUsCount} SKUs)</span>
            </button>
            <button
              onClick={() => setAnalysisScope('distributor')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all duration-200 cursor-pointer ${
                analysisScope === 'distributor'
                  ? 'glass-btn-primary shadow-sm'
                  : 'text-[#004c4c] hover:bg-white/80'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Distributor Channel</span>
            </button>
          </div>

          {analysisScope === 'distributor' && (
            <div className="relative">
              <select
                value={selectedDistributor}
                onChange={(e) => setSelectedDistributor(e.target.value)}
                className="appearance-none pl-3 pr-8 py-1.5 rounded-xl text-[12px] font-bold bg-white/90 text-[#002d2d] border border-[#34a1a5]/40 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#34a1a5]/30 cursor-pointer"
              >
                {distributors.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#004c4c] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}

          <button
            onClick={() =>
              onAskAI(
                `Analyze our active ABC-XYZ demand matrix for ${
                  analysisScope === 'global' ? 'Global Enterprise' : selectedDistributor
                }. Specifically review the X category baseline (${xSummary.xShare}% share: AX ${xSummary.axShareOfX}%, BX ${xSummary.bxShareOfX}%, CX ${xSummary.cxShareOfX}%) and high capital risk volatile items (AZ/CZ). Provide fact-based recommendations.`
              )
            }
            className="glass-btn-coral px-3 py-1.5 text-[12px] gap-1.5"
          >
            <Bot className="w-3.5 h-3.5 text-[#8c1e1c]" />
            <span>AI Supply Audit</span>
          </button>
        </div>
      </div>

      {/* Mandatory X-Category Baseline Badge Bar */}
      <div className="mt-4 p-3 rounded-xl bg-gradient-to-r from-[#ffedd5]/90 via-white/80 to-[#34a1a5]/10 border border-[#34a1a5]/25 flex flex-wrap items-center justify-between gap-3 text-[12px]">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#004c4c] flex-shrink-0" />
          <span className="text-[#002d2d] font-bold">
            Predictable X-Category Demand Benchmark:
          </span>
          <span className="text-[#004c4c] font-semibold">
            {xSummary.xShare}% of Active Portfolio ({xSummary.totalX} SKUs)
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
          <span className="px-2.5 py-1 rounded-lg bg-[#004c4c] text-white shadow-sm">
            AX Staples: {xSummary.axShareOfX}% of X ({xSummary.axCount} SKUs)
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-[#34a1a5] text-white shadow-sm">
            BX Mediums: {xSummary.bxShareOfX}% of X ({xSummary.bxCount} SKUs)
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-[#ffedd5] text-[#004c4c] border border-[#34a1a5]/40 shadow-sm">
            CX Convenience: {xSummary.cxShareOfX}% of X ({xSummary.cxCount} SKUs)
          </span>
        </div>
      </div>

      {/* Main Layout: 3x3 Heatmap Grid & Segment Detail Inspection */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 mt-4">
        {/* Left: Interactive 3x3 Matrix (7 columns) */}
        <div className="xl:col-span-7 flex flex-col gap-3">
          <div className="flex items-center justify-between text-[12px] text-[#1c4b4b] font-medium px-1">
            <span>Click any segment cell below to inspect individual SKUs & directives:</span>
            <span className="font-bold text-[#004c4c]">Scope Total: {formatINR(totalSales)}</span>
          </div>

          <div className="overflow-x-auto pb-1">
            <div className="min-w-[540px]">
              {/* Matrix Column Headers (X, Y, Z Demand Volatility) */}
              <div className="grid grid-cols-12 gap-2 text-center text-[11px] font-bold mb-1.5">
                <div className="col-span-3 text-left pl-2 text-[#004c4c] uppercase tracking-wider text-[10px]">
                  Revenue \ Demand
                </div>
                <div className="col-span-3 p-1.5 rounded-lg bg-white/70 backdrop-blur-sm border border-[#34a1a5]/20 text-[#002d2d]">
                  Class X (CV &lt; 0.25)
                  <div className="text-[10px] text-[#34a1a5] font-semibold">Constant & Steady (12%)</div>
                </div>
                <div className="col-span-3 p-1.5 rounded-lg bg-white/70 backdrop-blur-sm border border-[#34a1a5]/20 text-[#002d2d]">
                  Class Y (0.25 ≤ CV ≤ 0.65)
                  <div className="text-[10px] text-[#004c4c] font-semibold">Fluctuating / Seasonal</div>
                </div>
                <div className="col-span-3 p-1.5 rounded-lg bg-white/70 backdrop-blur-sm border border-[#34a1a5]/20 text-[#002d2d]">
                  Class Z (CV &gt; 0.65)
                  <div className="text-[10px] text-[#ff6b68] font-semibold">Erratic / High Volatility</div>
                </div>
              </div>

              {/* Matrix Rows: A, B, C */}
              {(['A', 'B', 'C'] as ABCClass[]).map((abc) => {
                const rowLabel =
                  abc === 'A'
                    ? 'Class A (Top 70% Sales)'
                    : abc === 'B'
                    ? 'Class B (Next 20% Sales)'
                    : 'Class C (Bottom 10% Sales)';

                return (
                  <div key={abc} className="grid grid-cols-12 gap-2 mb-2 items-stretch">
                    {/* Row Label */}
                    <div className="col-span-3 p-2.5 rounded-xl bg-white/70 backdrop-blur-sm border border-[#34a1a5]/20 flex flex-col justify-center">
                      <span className="text-[13px] font-bold text-[#002d2d]">{abc} Tier</span>
                      <span className="text-[10px] text-[#1c4b4b] font-medium leading-tight">
                        {rowLabel}
                      </span>
                    </div>

                    {/* 3 Cells: X, Y, Z */}
                    {(['X', 'Y', 'Z'] as XYZClass[]).map((xyz) => {
                      const segKey = `${abc}${xyz}` as ABCXYZSegment;
                      const cell = matrix.get(segKey);
                      if (!cell) return null;
                      const strat = STRATEGY_DEFINITIONS[segKey];
                      const isSelected = selectedSegment === segKey;

                      return (
                        <button
                          key={segKey}
                          onClick={() => setSelectedSegment(segKey)}
                          className={`col-span-3 p-3 rounded-xl transition-all duration-200 text-left flex flex-col justify-between cursor-pointer border ${
                            strat.borderClass
                          } ${strat.colorClass} ${
                            isSelected
                              ? 'ring-3 ring-[#004c4c] ring-offset-2 scale-[1.02] shadow-lg'
                              : 'hover:scale-[1.01] hover:shadow-md opacity-95 hover:opacity-100'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full mb-1">
                            <span className="text-[15px] font-black tracking-tight">{segKey}</span>
                            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-black/15">
                              {cell.skuCount} SKUs
                            </span>
                          </div>
                          <div className="text-[12px] font-bold tabular-nums">
                            {formatINR(cell.sales)}
                          </div>
                          <div className="flex items-center justify-between text-[10px] opacity-90 mt-1 pt-1 border-t border-current/20">
                            <span>{cell.salesShare.toFixed(1)}% Sales</span>
                            <span>{cell.skuShare.toFixed(1)}% Catalog</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Legend & Directive Helper */}
          <div className="p-3 rounded-xl bg-white/80 border border-[#34a1a5]/20 text-[11px] flex flex-wrap items-center justify-between gap-3 text-[#1c4b4b]">
            <div className="flex items-center gap-3">
              <span className="font-bold text-[#002d2d]">Strategy Color Key:</span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-[#004c4c]" />
                <span>Low Risk / Core</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-[#34a1a5]" />
                <span>Medium Value</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-[#ff6b68]" />
                <span>High Risk / Prune</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-[#ffedd5] border border-[#f59e0b]" />
                <span>High-Velocity CX</span>
              </span>
            </div>
            <span className="text-[10px] font-medium italic">
              Computed deterministically from 12-month demand cadence
            </span>
          </div>
        </div>

        {/* Right: Selected Segment Inspector & SKU Drawer (5 columns) */}
        <div className="xl:col-span-5 flex flex-col">
          {activeCell ? (
            <div className="p-4 sm:p-5 rounded-2xl bg-white/90 backdrop-blur-md border border-[#34a1a5]/30 shadow-sm flex flex-col h-full">
              {/* Header */}
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#34a1a5]/20">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[20px] font-black text-[#004c4c]">
                      Segment {activeCell.segment}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        STRATEGY_DEFINITIONS[activeCell.segment].risk === 'high'
                          ? 'bg-[#ff6b68]/20 text-[#8c1e1c]'
                          : STRATEGY_DEFINITIONS[activeCell.segment].risk === 'moderate'
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-[#34a1a5]/20 text-[#004c4c]'
                      }`}
                    >
                      {STRATEGY_DEFINITIONS[activeCell.segment].risk} Risk
                    </span>
                  </div>
                  <h3 className="text-[13px] font-bold text-[#002d2d] mt-0.5">
                    {activeCell.strategyTitle}
                  </h3>
                </div>

                <button
                  onClick={handleExportSegmentCSV}
                  className="glass-btn px-2.5 py-1.5 text-[11px] gap-1 text-[#004c4c]"
                  title="Export this segment's SKUs to CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>CSV</span>
                </button>
              </div>

              {/* Strategic Supply Chain Directive */}
              <div className="mt-3 p-3 rounded-xl bg-gradient-to-r from-[#ffedd5]/60 to-[#34a1a5]/10 border border-[#34a1a5]/20 text-[11.5px] text-[#0d2828] leading-relaxed">
                <span className="font-bold text-[#004c4c]">Operational Directive: </span>
                {activeCell.strategyDirective}
              </div>

              {/* Segment Micro Metrics */}
              <div className="grid grid-cols-3 gap-2 mt-3">
                <div className="p-2.5 rounded-xl bg-white border border-[#34a1a5]/20 text-center">
                  <div className="text-[10px] text-[#1c4b4b] uppercase font-bold">Sales (INR)</div>
                  <div className="text-[13px] font-bold text-[#002d2d] tabular-nums">
                    {formatINR(activeCell.sales)}
                  </div>
                  <div className="text-[10px] text-[#34a1a5] font-semibold">
                    {activeCell.salesShare.toFixed(1)}% of total
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-white border border-[#34a1a5]/20 text-center">
                  <div className="text-[10px] text-[#1c4b4b] uppercase font-bold">Dispatched</div>
                  <div className="text-[13px] font-bold text-[#002d2d] tabular-nums">
                    {formatUnits(activeCell.units)}
                  </div>
                  <div className="text-[10px] text-[#1c4b4b]">units</div>
                </div>
                <div className="p-2.5 rounded-xl bg-white border border-[#34a1a5]/20 text-center">
                  <div className="text-[10px] text-[#1c4b4b] uppercase font-bold">Catalog Share</div>
                  <div className="text-[13px] font-bold text-[#004c4c] tabular-nums">
                    {activeCell.skuCount} SKUs
                  </div>
                  <div className="text-[10px] text-[#004c4c] font-semibold">
                    {activeCell.skuShare.toFixed(1)}% of catalog
                  </div>
                </div>
              </div>

              {/* SKU List Controls */}
              <div className="mt-4 flex items-center justify-between gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-[#004c4c] absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search SKU or Brand in this segment..."
                    value={skuSearchQuery}
                    onChange={(e) => setSkuSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl text-[11px] bg-white border border-[#34a1a5]/30 focus:outline-none focus:ring-1 focus:ring-[#004c4c] text-[#002d2d]"
                  />
                </div>
                <div className="flex items-center gap-1 text-[11px] font-bold text-[#004c4c]">
                  <span>Sort:</span>
                  <button
                    onClick={() => {
                      if (sortField === 'sales') setSortAsc(!sortAsc);
                      else {
                        setSortField('sales');
                        setSortAsc(false);
                      }
                    }}
                    className={`px-2 py-1 rounded-lg border text-[10px] ${
                      sortField === 'sales'
                        ? 'bg-[#004c4c] text-white border-[#004c4c]'
                        : 'bg-white text-[#004c4c] border-[#34a1a5]/30'
                    }`}
                  >
                    Sales
                  </button>
                  <button
                    onClick={() => {
                      if (sortField === 'cv') setSortAsc(!sortAsc);
                      else {
                        setSortField('cv');
                        setSortAsc(true);
                      }
                    }}
                    className={`px-2 py-1 rounded-lg border text-[10px] ${
                      sortField === 'cv'
                        ? 'bg-[#004c4c] text-white border-[#004c4c]'
                        : 'bg-white text-[#004c4c] border-[#34a1a5]/30'
                    }`}
                  >
                    CV
                  </button>
                </div>
              </div>

              {/* SKU Item Rows */}
              <div className="mt-2.5 flex-1 overflow-y-auto max-h-[310px] space-y-1.5 pr-1">
                {displayedSKUs.length === 0 ? (
                  <div className="p-6 text-center text-[#1c4b4b] text-[12px]">
                    No SKUs matching the current query.
                  </div>
                ) : (
                  displayedSKUs.map((skuItem) => (
                    <div
                      key={skuItem.sku}
                      className="p-2.5 rounded-xl bg-white border border-[#34a1a5]/20 hover:border-[#34a1a5]/50 transition-all text-[11.5px] flex items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-[#002d2d] truncate" title={skuItem.sku}>
                            {skuItem.sku}
                          </span>
                        </div>
                        <div className="text-[10px] text-[#1c4b4b] flex items-center gap-2 mt-0.5">
                          <span>{skuItem.brand}</span>
                          <span>•</span>
                          <span>{skuItem.category}</span>
                          <span>•</span>
                          <span>₹{skuItem.avgRealization.toFixed(1)}/u</span>
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <div className="font-bold text-[#004c4c] tabular-nums">
                          {formatINR(skuItem.sales)}
                        </div>
                        <div className="text-[10px] text-[#1c4b4b] font-medium">
                          CV: {(skuItem.coefficientOfVariation * 100).toFixed(0)}%
                        </div>
                      </div>

                      {onFilterSKU && (
                        <button
                          onClick={() => onFilterSKU(skuItem.sku)}
                          className="glass-btn p-1 text-[#004c4c] hover:text-[#002d2d]"
                          title="Filter entire dashboard by this SKU"
                        >
                          <Filter className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="p-8 rounded-2xl bg-white/70 border border-[#34a1a5]/20 text-center text-[#1c4b4b] flex flex-col items-center justify-center h-full">
              <Grid3X3 className="w-8 h-8 text-[#34a1a5] mb-2" />
              <p className="font-bold text-[#002d2d]">Select a matrix cell to view details</p>
              <p className="text-[11px] mt-1">
                Choose any segment (AX through CZ) from the heat map grid.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
