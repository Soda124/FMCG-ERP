import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { FMCGRecord, FilterState } from '../types/fmcg';
import { MONTHS_METADATA, DISTRIBUTORS } from '../data/defaultFMCGData';
import { formatINR, formatUnits, formatNumberFull } from '../utils/currencyFormatter';
import {
  TrendingUp,
  Sliders,
  DollarSign,
  Package,
  Search,
  RotateCcw,
  Pin,
  Check,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Sparkles,
  Info,
  Calendar,
  Layers,
  ChevronRight,
  Filter,
} from 'lucide-react';

interface DistributorRankBumpChartProps {
  allData: FMCGRecord[];
  filteredData: FMCGRecord[];
  filters: FilterState;
  onFilterDistributor?: (distributor: string) => void;
}

// Curated accessible high-contrast palette for pinned trajectories
const PALETTE = [
  '#004c4c', // Deep Teal (Brand Primary)
  '#0284c7', // Ocean Blue
  '#0d9488', // Emerald Teal
  '#f97316', // Warm Orange
  '#8b5cf6', // Violet
  '#10b981', // Crisp Emerald
  '#ec4899', // Magenta Rose
  '#d97706', // Golden Amber
  '#3b82f6', // Cobalt Blue
  '#14b8a6', // Cyan
  '#e11d48', // Crimson Red
  '#6366f1', // Indigo
  '#84cc16', // Lime Green
  '#a855f7', // Purple
  '#f43f5e', // Strawberry
  '#0891b2', // Deep Cyan
];

interface DistributorRankPoint {
  monthIndex: number;
  monthName: string;
  monthShort: string;
  quarter: string;
  rank: number;
  value: number;
  formattedValue: string;
  priorRank?: number;
}

interface DistributorTrajectory {
  name: string;
  points: DistributorRankPoint[];
  totalValue: number;
  startRank: number;
  endRank: number;
  bestRank: number;
  rankChange: number; // startRank - endRank (> 0 is improvement)
  color: string;
}

export const DistributorRankBumpChart: React.FC<DistributorRankBumpChartProps> = ({
  allData,
  filteredData,
  filters,
  onFilterDistributor,
}) => {
  // Metric toggle: Gross Revenue (INR) or Dispatched Volume (Units)
  const [metric, setMetric] = useState<'sales' | 'units'>('sales');

  // Month range slider: startMonth and endMonth indices (1 = April, 12 = March)
  const [startMonth, setStartMonth] = useState<number>(1);
  const [endMonth, setEndMonth] = useState<number>(12);

  // Search filter for distributor sidebar
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Hovered distributor & node info for tooltip
  const [hoveredDistributor, setHoveredDistributor] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<{
    distributor: string;
    monthIndex: number;
    monthName: string;
    rank: number;
    value: number;
    x: number;
    y: number;
  } | null>(null);

  // Set of pinned distributors
  const [pinnedDistributors, setPinnedDistributors] = useState<Set<string>>(() => {
    // Start with Top 3 pinned by default so the chart is immediately engaging
    return new Set<string>();
  });
  const hasInitializedPins = useRef<boolean>(false);

  // Container refs for responsive sizing
  const containerRef = useRef<HTMLDivElement>(null);
  const svgWrapperRef = useRef<HTMLDivElement>(null);
  const [chartDimensions, setChartDimensions] = useState<{ width: number; height: number }>({
    width: 900,
    height: 520,
  });

  // Dual handle drag states
  const sliderTrackRef = useRef<HTMLDivElement>(null);
  const [isDraggingHandle, setIsDraggingHandle] = useState<'start' | 'end' | 'range' | null>(null);
  const dragStartX = useRef<number>(0);
  const dragStartValues = useRef<{ start: number; end: number }>({ start: 1, end: 12 });

  // Measure SVG container
  useEffect(() => {
    const updateSize = () => {
      if (svgWrapperRef.current) {
        const { clientWidth } = svgWrapperRef.current;
        const width = Math.max(clientWidth, 620);
        // Adaptive height based on number of distributors
        setChartDimensions((prev) => ({
          ...prev,
          width,
        }));
      }
    };

    updateSize();
    const ro = new ResizeObserver(updateSize);
    if (svgWrapperRef.current) {
      ro.observe(svgWrapperRef.current);
    }
    return () => ro.disconnect();
  }, []);

  // 1. Determine scoped dataset based on non-temporal global filters
  // When an SKU / Brand / Category / Plant is selected in the global filter:
  // we strictly preserve those filters but allow all months across the financial year
  const scopedData = useMemo(() => {
    const hasCategory = filters.category !== 'All';
    const hasBrand = filters.brand !== 'All';
    const hasSKU = filters.sku !== 'All';
    const hasPlant = filters.plant !== 'All';
    const hasSearch = Boolean(filters.search);

    if (!hasCategory && !hasBrand && !hasSKU && !hasPlant && !hasSearch) {
      return allData;
    }

    return allData.filter((row) => {
      if (hasCategory && row.Category !== filters.category) return false;
      if (hasBrand && row.Brand !== filters.brand) return false;
      if (hasSKU && row.SKU !== filters.sku) return false;
      if (hasPlant && row.Plant !== filters.plant) return false;
      if (hasSearch) {
        const q = filters.search.toLowerCase();
        const matches =
          row.Brand.toLowerCase().includes(q) ||
          (row.SKU && row.SKU.toLowerCase().includes(q)) ||
          row.Category.toLowerCase().includes(q) ||
          row.Distributor.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [allData, filters.category, filters.brand, filters.sku, filters.plant, filters.search]);

  // Active months within slider window
  const activeMonths = useMemo(() => {
    return MONTHS_METADATA.filter((m) => m.index >= startMonth && m.index <= endMonth);
  }, [startMonth, endMonth]);

  // 2. Master Entity Scope: Always include all 13 master distributors
  const masterDistributorNames = useMemo(() => {
    const distSet = new Set<string>(DISTRIBUTORS);
    allData.forEach((row) => {
      if (row.Distributor) distSet.add(row.Distributor);
    });
    return Array.from(distSet).sort();
  }, [allData]);

  const totalDistributors = masterDistributorNames.length; // Exactly 13

  // Deterministic color assignment map for all 13 distributors
  const colorMap = useMemo(() => {
    const map = new Map<string, string>();
    masterDistributorNames.forEach((name, idx) => {
      map.set(name, PALETTE[idx % PALETTE.length]);
    });
    return map;
  }, [masterDistributorNames]);

  // 3. Compute rankings strictly across the active window (startMonth to endMonth) for all 13 distributors
  const trajectories: DistributorTrajectory[] = useMemo(() => {
    if (masterDistributorNames.length === 0 || activeMonths.length === 0) {
      return [];
    }

    // Build monthly aggregation: Map<monthIndex, Map<distributor, value>>
    const monthlyAgg = new Map<number, Map<string, number>>();
    activeMonths.forEach((m) => {
      monthlyAgg.set(m.index, new Map<string, number>());
      // Initialize all 13 master distributors with 0
      masterDistributorNames.forEach((dist) => {
        monthlyAgg.get(m.index)!.set(dist, 0);
      });
    });

    scopedData.forEach((row) => {
      if (row.Month_Index >= startMonth && row.Month_Index <= endMonth) {
        const monthMap = monthlyAgg.get(row.Month_Index);
        if (monthMap && monthMap.has(row.Distributor)) {
          const val = metric === 'sales' ? row.Sales_INR : row.Units_Sold;
          monthMap.set(row.Distributor, (monthMap.get(row.Distributor) || 0) + val);
        }
      }
    });

    // For each month, sort distributors descending by value to assign ranks (1 to 13)
    // Distributors with positive revenue get sequential ranks 1..k
    // Distributors with zero revenue / no transactions in that month get Rank 13 with value 0
    const monthlyRanks = new Map<number, Map<string, { rank: number; value: number }>>();

    activeMonths.forEach((m) => {
      const monthMap = monthlyAgg.get(m.index)!;
      const positiveSales: { dist: string; val: number }[] = [];
      const zeroSales: string[] = [];

      masterDistributorNames.forEach((dist) => {
        const val = monthMap.get(dist) || 0;
        if (val > 0) {
          positiveSales.push({ dist, val });
        } else {
          zeroSales.push(dist);
        }
      });

      // Sort positive revenue distributors descending
      positiveSales.sort((a, b) => {
        if (b.val !== a.val) return b.val - a.val;
        return a.dist.localeCompare(b.dist);
      });

      const ranks = new Map<string, { rank: number; value: number }>();
      positiveSales.forEach(({ dist, val }, idx) => {
        ranks.set(dist, { rank: idx + 1, value: val });
      });

      // Assign Rank 13 (bottom rank) to all distributors with zero revenue in this month
      zeroSales.forEach((dist) => {
        ranks.set(dist, { rank: totalDistributors, value: 0 });
      });

      monthlyRanks.set(m.index, ranks);
    });

    // Assemble trajectory for all 13 distributors
    const result: DistributorTrajectory[] = masterDistributorNames.map((distName) => {
      const points: DistributorRankPoint[] = [];
      let totalValue = 0;
      let bestRank = totalDistributors;

      activeMonths.forEach((m, mIdx) => {
        const monthRankData = monthlyRanks.get(m.index)!.get(distName) || {
          rank: totalDistributors,
          value: 0,
        };
        const priorMonthRank =
          mIdx > 0
            ? monthlyRanks.get(activeMonths[mIdx - 1].index)!.get(distName)?.rank
            : undefined;

        totalValue += monthRankData.value;
        if (monthRankData.rank < bestRank) {
          bestRank = monthRankData.rank;
        }

        points.push({
          monthIndex: m.index,
          monthName: m.name,
          monthShort: m.name.slice(0, 3),
          quarter: m.quarter,
          rank: monthRankData.rank,
          value: monthRankData.value,
          formattedValue:
            metric === 'sales'
              ? formatINR(monthRankData.value)
              : `${formatUnits(monthRankData.value)} u`,
          priorRank: priorMonthRank,
        });
      });

      const startRank = points[0]?.rank ?? totalDistributors;
      const endRank = points[points.length - 1]?.rank ?? totalDistributors;
      const rankChange = startRank - endRank; // positive = moved up in rank

      return {
        name: distName,
        points,
        totalValue,
        startRank,
        endRank,
        bestRank,
        rankChange,
        color: colorMap.get(distName) || '#004c4c',
      };
    });

    // Sort trajectories by endRank (Rank 1 at top), then by totalValue descending for ties at Rank 13, then alphabetically
    return result.sort((a, b) => {
      if (a.endRank !== b.endRank) return a.endRank - b.endRank;
      if (b.totalValue !== a.totalValue) return b.totalValue - a.totalValue;
      return a.name.localeCompare(b.name);
    });
  }, [masterDistributorNames, activeMonths, scopedData, startMonth, endMonth, metric, colorMap, totalDistributors]);

  // Default initialize pinned items to Top 3 if nothing is pinned yet
  useEffect(() => {
    if (!hasInitializedPins.current && trajectories.length > 0) {
      const initialPins = new Set<string>();
      // Pin top 3 ending rank distributors
      trajectories.slice(0, 3).forEach((t) => initialPins.add(t.name));
      // If a distributor was selected in the global filter, pin that too
      if (filters.distributor !== 'All' && masterDistributorNames.includes(filters.distributor)) {
        initialPins.add(filters.distributor);
      }
      setPinnedDistributors(initialPins);
      hasInitializedPins.current = true;
    }
  }, [trajectories, filters.distributor, masterDistributorNames]);

  // If global filter changes to a specific distributor, auto-pin and highlight
  useEffect(() => {
    if (filters.distributor !== 'All') {
      setPinnedDistributors((prev) => {
        const next = new Set(prev);
        next.add(filters.distributor);
        return next;
      });
      setHoveredDistributor(filters.distributor);
    }
  }, [filters.distributor]);

  // Toggle pinned distributor
  const handleTogglePin = (distName: string) => {
    setPinnedDistributors((prev) => {
      const next = new Set(prev);
      if (next.has(distName)) {
        next.delete(distName);
      } else {
        next.add(distName);
      }
      return next;
    });
  };

  // Quick preset pins
  const handlePinTop = (count: number) => {
    const next = new Set<string>();
    trajectories.slice(0, count).forEach((t) => next.add(t.name));
    setPinnedDistributors(next);
  };

  const handleClearPins = () => {
    setPinnedDistributors(new Set<string>());
  };

  // Slider Quick Presets
  const setRangePreset = (start: number, end: number) => {
    setStartMonth(start);
    setEndMonth(end);
  };

  // Slider Drag Interactions
  const handleSliderMouseDown = (
    type: 'start' | 'end' | 'range',
    e: React.MouseEvent | React.TouchEvent
  ) => {
    e.preventDefault();
    setIsDraggingHandle(type);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    dragStartX.current = clientX;
    dragStartValues.current = { start: startMonth, end: endMonth };
  };

  useEffect(() => {
    if (!isDraggingHandle) return;

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      if (!sliderTrackRef.current) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const rect = sliderTrackRef.current.getBoundingClientRect();
      const trackWidth = rect.width;
      if (trackWidth <= 0) return;

      const deltaX = clientX - dragStartX.current;
      const deltaMonths = Math.round((deltaX / trackWidth) * 11);

      if (isDraggingHandle === 'start') {
        const clickRatio = Math.max(0, Math.min(1, (clientX - rect.left) / trackWidth));
        const newMonth = Math.max(1, Math.min(endMonth - 1, Math.round(1 + clickRatio * 11)));
        setStartMonth(newMonth);
      } else if (isDraggingHandle === 'end') {
        const clickRatio = Math.max(0, Math.min(1, (clientX - rect.left) / trackWidth));
        const newMonth = Math.max(startMonth + 1, Math.min(12, Math.round(1 + clickRatio * 11)));
        setEndMonth(newMonth);
      } else if (isDraggingHandle === 'range') {
        const origSpan = dragStartValues.current.end - dragStartValues.current.start;
        let newStart = dragStartValues.current.start + deltaMonths;
        let newEnd = newStart + origSpan;

        if (newStart < 1) {
          newStart = 1;
          newEnd = newStart + origSpan;
        }
        if (newEnd > 12) {
          newEnd = 12;
          newStart = newEnd - origSpan;
        }
        setStartMonth(newStart);
        setEndMonth(newEnd);
      }
    };

    const handlePointerUp = () => {
      setIsDraggingHandle(null);
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('touchmove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchend', handlePointerUp);

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchend', handlePointerUp);
    };
  }, [isDraggingHandle, startMonth, endMonth]);

  // Click on timeline track to adjust closest handle
  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!sliderTrackRef.current) return;
    const rect = sliderTrackRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const clickedMonth = Math.max(1, Math.min(12, Math.round(1 + ratio * 11)));

    const distToStart = Math.abs(clickedMonth - startMonth);
    const distToEnd = Math.abs(clickedMonth - endMonth);

    if (distToStart < distToEnd) {
      if (clickedMonth < endMonth) {
        setStartMonth(clickedMonth);
      } else {
        setStartMonth(Math.max(1, endMonth - 1));
      }
    } else {
      if (clickedMonth > startMonth) {
        setEndMonth(clickedMonth);
      } else {
        setEndMonth(Math.min(12, startMonth + 1));
      }
    }
  };

  // SVG Chart Geometry & Calculations
  const numDistributors = Math.max(trajectories.length, 1);
  const numMonths = Math.max(activeMonths.length, 1);

  // Height scales with distributor count for comfortable vertical spacing (13 ranks)
  const chartHeight = useMemo(() => {
    return Math.max(420, Math.min(560, numDistributors * 32 + 90));
  }, [numDistributors]);

  const margins = useMemo(() => {
    return {
      top: 35,
      right: 48,
      bottom: 35,
      left: 55,
    };
  }, []);

  const innerWidth = Math.max(100, chartDimensions.width - margins.left - margins.right);
  const innerHeight = Math.max(100, chartHeight - margins.top - margins.bottom);

  // X coordinate mapper for month index in active window
  const getX = useCallback(
    (monthIndex: number) => {
      if (numMonths <= 1) return margins.left + innerWidth / 2;
      const fraction = (monthIndex - startMonth) / (endMonth - startMonth);
      return margins.left + fraction * innerWidth;
    },
    [startMonth, endMonth, innerWidth, margins.left, numMonths]
  );

  // Y coordinate mapper for rank (1 at top, numDistributors at bottom)
  const getY = useCallback(
    (rank: number) => {
      if (numDistributors <= 1) return margins.top + innerHeight / 2;
      const fraction = (rank - 1) / (numDistributors - 1);
      return margins.top + fraction * innerHeight;
    },
    [numDistributors, innerHeight, margins.top]
  );

  // Cubic Bezier curve path generator
  const generateBumpPath = useCallback(
    (points: DistributorRankPoint[]) => {
      if (points.length === 0) return '';
      if (points.length === 1) {
        const x = getX(points[0].monthIndex);
        const y = getY(points[0].rank);
        return `M ${x - 10} ${y} L ${x + 10} ${y}`;
      }

      let d = `M ${getX(points[0].monthIndex)} ${getY(points[0].rank)}`;
      for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        const x1 = getX(p1.monthIndex);
        const y1 = getY(p1.rank);
        const x2 = getX(p2.monthIndex);
        const y2 = getY(p2.rank);

        // Control points for smooth horizontal S-curve
        const cx = (x1 + x2) / 2;
        d += ` C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`;
      }
      return d;
    },
    [getX, getY]
  );

  // Filter sidebar list by search query
  const filteredTrajectories = useMemo(() => {
    if (!searchQuery.trim()) return trajectories;
    const q = searchQuery.toLowerCase();
    return trajectories.filter((t) => t.name.toLowerCase().includes(q));
  }, [trajectories, searchQuery]);

  // Is any trajectory actively hovered?
  const isAnyHovered = Boolean(hoveredDistributor);


  return (
    <div
      ref={containerRef}
      className="glass-panel rounded-2xl p-4 sm:p-5 flex flex-col gap-4 shadow-sm relative overflow-hidden"
    >
      {/* 1. Header Toolbar: Title, Metric Toggle & Pin Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[#34a1a5]/20">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#004c4c] to-[#34a1a5] flex items-center justify-center text-white shadow-xs">
            <TrendingUp className="w-4 h-4" />
          </div>
          <h2 className="text-[16px] font-extrabold text-[#002d2d] tracking-tight leading-tight">
            Distributor Rank Progression (Bump Chart)
          </h2>
        </div>

        {/* Controls: Metric Toggle & Quick Actions */}
        <div className="flex flex-wrap items-center gap-2.5 self-stretch sm:self-auto justify-end">
          {/* Revenue vs Volume Metric Toggle */}
          <div className="p-0.5 rounded-xl bg-white/80 border border-[#34a1a5]/25 flex items-center shadow-2xs">
            <button
              onClick={() => setMetric('sales')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11.5px] font-bold transition-all cursor-pointer ${
                metric === 'sales'
                  ? 'glass-btn-primary shadow-xs'
                  : 'text-[#004c4c] hover:bg-[#34a1a5]/10'
              }`}
              title="Rank distributors by Gross Revenue (INR)"
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Revenue (INR)</span>
            </button>
            <button
              onClick={() => setMetric('units')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11.5px] font-bold transition-all cursor-pointer ${
                metric === 'units'
                  ? 'glass-btn-primary shadow-xs'
                  : 'text-[#004c4c] hover:bg-[#34a1a5]/10'
              }`}
              title="Rank distributors by Dispatched Volume (Units)"
            >
              <Package className="w-3.5 h-3.5" />
              <span>Volume (Units)</span>
            </button>
          </div>

          {/* Quick Pin Controls */}
          <div className="hidden sm:flex items-center gap-1 bg-white/70 px-1 py-0.5 rounded-xl border border-[#34a1a5]/20 text-[11px]">
            <span className="text-[#1c4b4b] px-1.5 font-medium">Pin:</span>
            <button
              onClick={() => handlePinTop(3)}
              className="px-2 py-0.5 rounded-md hover:bg-[#ffedd5] text-[#004c4c] font-bold transition-colors cursor-pointer"
              title="Pin Top 3 distributors"
            >
              Top 3
            </button>
            <button
              onClick={() => handlePinTop(5)}
              className="px-2 py-0.5 rounded-md hover:bg-[#ffedd5] text-[#004c4c] font-bold transition-colors cursor-pointer"
              title="Pin Top 5 distributors"
            >
              Top 5
            </button>
            {pinnedDistributors.size > 0 && (
              <button
                onClick={handleClearPins}
                className="px-2 py-0.5 rounded-md hover:bg-rose-50 text-rose-600 font-bold transition-colors cursor-pointer"
                title="Clear all pinned lines"
              >
                Clear ({pinnedDistributors.size})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Interactive Month Range Slider / Timeline Brush */}
      <div className="bg-white/80 backdrop-blur-md rounded-xl p-3 border border-[#34a1a5]/20 flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11.5px]">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-[#004c4c]" />
            <span className="font-bold text-[#002d2d]">Accounting Timeline Range:</span>
            <span className="font-extrabold text-[#004c4c] bg-[#ffedd5] px-2.5 py-0.5 rounded-md border border-[#f59e0b]/30 tabular-nums">
              {MONTHS_METADATA[startMonth - 1]?.name} ({MONTHS_METADATA[startMonth - 1]?.quarter})
              {' → '}
              {MONTHS_METADATA[endMonth - 1]?.name} ({MONTHS_METADATA[endMonth - 1]?.quarter})
            </span>
            <span className="text-[#1c4b4b] text-[11px] hidden sm:inline">
              ({endMonth - startMonth + 1} months active)
            </span>
          </div>

          {(startMonth !== 1 || endMonth !== 12) && (
            <button
              onClick={() => setRangePreset(1, 12)}
              className="px-2.5 py-0.5 rounded-md text-[11px] font-bold text-[#004c4c] bg-white hover:bg-[#ffedd5] border border-[#34a1a5]/25 transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
              title="Reset slider to full fiscal year (Apr–Mar)"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Full FY (Apr–Mar)</span>
            </button>
          )}
        </div>

        {/* Dual-Handle Range Slider Track */}
        <div className="relative pt-2 pb-1 select-none">
          {/* Timeline background notches & month marks */}
          <div
            ref={sliderTrackRef}
            onClick={handleTrackClick}
            className="h-3.5 bg-slate-100/90 rounded-full relative border border-slate-200 cursor-pointer shadow-inner"
          >
            {/* Active Range Highlight */}
            <div
              onMouseDown={(e) => handleSliderMouseDown('range', e)}
              onTouchStart={(e) => handleSliderMouseDown('range', e)}
              className="absolute top-0 bottom-0 bg-gradient-to-r from-[#004c4c] via-[#34a1a5] to-[#004c4c] rounded-full opacity-90 cursor-grab active:cursor-grabbing hover:brightness-105 transition-all shadow-xs"
              style={{
                left: `${((startMonth - 1) / 11) * 100}%`,
                width: `${((endMonth - startMonth) / 11) * 100}%`,
              }}
            />

            {/* Quarter background demarcation bars */}
            {[
              { q: 'Q1', start: 0, end: 2 },
              { q: 'Q2', start: 3, end: 5 },
              { q: 'Q3', start: 6, end: 8 },
              { q: 'Q4', start: 9, end: 11 },
            ].map((qInfo, qIdx) => (
              <div
                key={qInfo.q}
                className="absolute top-0 bottom-0 pointer-events-none border-r border-slate-300/60"
                style={{ left: `${(qInfo.end / 11) * 100}%` }}
              />
            ))}

            {/* Left Handle (Start Month) */}
            <div
              onMouseDown={(e) => handleSliderMouseDown('start', e)}
              onTouchStart={(e) => handleSliderMouseDown('start', e)}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-white border-2 border-[#004c4c] shadow-md hover:scale-110 active:scale-95 cursor-ew-resize flex items-center justify-center transition-transform z-10"
              style={{ left: `${((startMonth - 1) / 11) * 100}%` }}
              title={`Drag to set start month (Current: ${MONTHS_METADATA[startMonth - 1]?.name})`}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-[#004c4c]" />
            </div>

            {/* Right Handle (End Month) */}
            <div
              onMouseDown={(e) => handleSliderMouseDown('end', e)}
              onTouchStart={(e) => handleSliderMouseDown('end', e)}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-white border-2 border-[#004c4c] shadow-md hover:scale-110 active:scale-95 cursor-ew-resize flex items-center justify-center transition-transform z-10"
              style={{ left: `${((endMonth - 1) / 11) * 100}%` }}
              title={`Drag to set end month (Current: ${MONTHS_METADATA[endMonth - 1]?.name})`}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-[#004c4c]" />
            </div>
          </div>

          {/* Month labels under track */}
          <div className="flex justify-between mt-1 px-1 pointer-events-none">
            {MONTHS_METADATA.map((m) => {
              const inRange = m.index >= startMonth && m.index <= endMonth;
              return (
                <div
                  key={m.name}
                  className={`text-[10px] text-center font-bold transition-colors ${
                    inRange ? 'text-[#004c4c]' : 'text-slate-400'
                  }`}
                  style={{ width: '8.33%' }}
                >
                  <span>{m.name.slice(0, 3)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. Main Chart & Sidebar Layout */}
      <div className="flex flex-col lg:flex-row gap-4 items-stretch">
        {/* Left Sidebar: Distributor Ranks, Toggles & Search */}
        <div className="w-full lg:w-80 shrink-0 bg-white/75 backdrop-blur-md rounded-xl border border-[#34a1a5]/20 flex flex-col p-3 shadow-2xs">
          {/* Sidebar Header */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#34a1a5]/15">
            <div className="flex items-center gap-1.5">
              <span className="text-[12.5px] font-extrabold text-[#002d2d]">Distributors</span>
              <span className="text-[10.5px] font-bold text-[#004c4c] bg-[#34a1a5]/15 px-1.5 py-0.2 rounded-md">
                {masterDistributorNames.length}
              </span>
            </div>
            <span className="text-[10px] text-[#1c4b4b]">
              Ranked by {MONTHS_METADATA[endMonth - 1]?.name.slice(0, 3)}
            </span>
          </div>

          {/* Distributor Search */}
          <div className="relative mb-2">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search distributor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-[11.5px] rounded-lg bg-white/90 border border-[#34a1a5]/25 focus:outline-none focus:ring-1 focus:ring-[#004c4c] text-[#002d2d]"
            />
          </div>

          {/* Distributor Scrollable List (All 13 Distributors) */}
          <div
            className="flex flex-col gap-1 overflow-y-auto max-h-[500px] pr-1"
            style={{ scrollbarWidth: 'thin' }}
          >
            {filteredTrajectories.map((t) => {
              const isPinned = pinnedDistributors.has(t.name);
              const isHovered = hoveredDistributor === t.name;

              return (
                <div
                  key={t.name}
                  onMouseEnter={() => setHoveredDistributor(t.name)}
                  onMouseLeave={() => setHoveredDistributor(null)}
                  className={`flex items-center justify-between gap-1.5 px-2 py-1.5 rounded-lg text-[11.5px] transition-all cursor-pointer ${
                    isHovered
                      ? 'bg-[#ffedd5] shadow-xs ring-1 ring-[#004c4c]/30'
                      : isPinned
                      ? 'bg-slate-50/90 border border-slate-200/80 shadow-2xs'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  {/* Left: Checkbox, Color Dot, Rank & Name */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    {/* Pin Checkbox */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTogglePin(t.name);
                      }}
                      className="p-0.5 rounded hover:bg-black/5 text-[#004c4c] transition-colors cursor-pointer shrink-0"
                      title={isPinned ? 'Unpin this distributor line' : 'Pin this distributor line'}
                    >
                      <div
                        className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-all ${
                          isPinned
                            ? 'bg-[#004c4c] border-[#004c4c] text-white'
                            : 'border-slate-300 bg-white hover:border-[#004c4c]'
                        }`}
                      >
                        {isPinned && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                      </div>
                    </button>

                    {/* Color Swatch */}
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 transition-transform"
                      style={{
                        backgroundColor: isPinned || isHovered ? t.color : '#94a3b8',
                        opacity: isPinned || isHovered ? 1 : 0.4,
                      }}
                    />

                    {/* Ending Rank Badge */}
                    <span
                      className={`font-mono text-[10.5px] font-bold px-1 rounded tabular-nums shrink-0 ${
                        t.endRank <= 3
                          ? 'bg-[#004c4c] text-white'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      #{t.endRank}
                    </span>

                    {/* Distributor Name */}
                    <span
                      className={`truncate font-medium ${
                        isHovered || isPinned ? 'text-[#002d2d] font-bold' : 'text-slate-700'
                      }`}
                      title={t.name}
                    >
                      {t.name}
                    </span>
                  </div>

                  {/* Right: Net Rank Shift Badge & Total Value */}
                  <div className="flex items-center gap-1.5 shrink-0 pl-1">
                    {/* Rank delta */}
                    {t.rankChange > 0 ? (
                      <span
                        className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded flex items-center gap-0.5 tabular-nums"
                        title={`Gained ${t.rankChange} positions from #${t.startRank} to #${t.endRank}`}
                      >
                        <ArrowUpRight className="w-3 h-3 stroke-[2.5]" />
                        +{t.rankChange}
                      </span>
                    ) : t.rankChange < 0 ? (
                      <span
                        className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1 py-0.2 rounded flex items-center gap-0.5 tabular-nums"
                        title={`Lost ${Math.abs(t.rankChange)} positions from #${t.startRank} to #${t.endRank}`}
                      >
                        <ArrowDownRight className="w-3 h-3 stroke-[2.5]" />
                        {t.rankChange}
                      </span>
                    ) : (
                      <span
                        className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1 py-0.2 rounded flex items-center gap-0.5 tabular-nums"
                        title={`Steady at rank #${t.endRank}`}
                      >
                        <Minus className="w-2.5 h-2.5" />
                        0
                      </span>
                    )}

                    {/* Total formatted metric value in window */}
                    <span className="text-[10px] font-semibold text-slate-600 tabular-nums">
                      {metric === 'sales' ? formatINR(t.totalValue) : `${formatUnits(t.totalValue)}u`}
                    </span>
                  </div>
                </div>
              );
            })}

            {filteredTrajectories.length === 0 && (
              <div className="py-6 text-center text-slate-400 text-[11px]">
                No distributors match "{searchQuery}"
              </div>
            )}
          </div>
        </div>

        {/* Right Area: Interactive SVG Bump Chart Viewport */}
        <div
          ref={svgWrapperRef}
          className="flex-1 bg-white/80 backdrop-blur-md rounded-xl border border-[#34a1a5]/20 p-2 sm:p-3 relative overflow-hidden flex flex-col justify-center min-w-0"
        >
          {/* Hint Overlay */}
          <div className="flex items-center justify-between px-2 pb-1 text-[11px] text-[#1c4b4b]">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[#002d2d]">Rank 1 (Top Performer)</span>
              <span>↓ Sequential Ranks</span>
              <span>Rank {numDistributors} (Lowest)</span>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-slate-500 text-[10.5px]">
              <span>💡 Hover any line to highlight • Check to pin multiple</span>
            </div>
          </div>

          {/* SVG Viewport */}
          <div className="relative w-full overflow-x-auto" style={{ height: `${chartHeight}px` }}>
            <svg
              width="100%"
              height="100%"
              viewBox={`0 0 ${chartDimensions.width} ${chartHeight}`}
              className="w-full h-full block select-none"
              style={{ minWidth: '600px' }}
            >
              {/* Background Grid: Month Columns and Rank Horizontal Guidelines */}
              <g className="grid-lines" opacity={0.6}>
                {/* Vertical month guide lines */}
                {activeMonths.map((m) => {
                  const x = getX(m.index);
                  return (
                    <g key={`col-${m.index}`}>
                      <line
                        x1={x}
                        y1={margins.top - 8}
                        x2={x}
                        y2={chartHeight - margins.bottom + 8}
                        stroke="#e2e8f0"
                        strokeWidth={1}
                        strokeDasharray="3 3"
                      />
                      {/* Month Column Label Header */}
                      <text
                        x={x}
                        y={margins.top - 14}
                        textAnchor="middle"
                        className="text-[11.5px] font-extrabold fill-[#004c4c]"
                      >
                        {m.name.slice(0, 3)}
                      </text>
                      {/* Quarter sub-label */}
                      <text
                        x={x}
                        y={margins.top - 2}
                        textAnchor="middle"
                        className="text-[9px] font-bold fill-slate-400"
                      >
                        {m.quarter}
                      </text>
                    </g>
                  );
                })}

                {/* Horizontal rank guidelines for all 13 ranks */}
                {Array.from({ length: numDistributors }, (_, i) => i + 1).map((rank) => {
                  const y = getY(rank);
                  const isTopRank = rank <= 3;
                  const isBottomRank = rank === numDistributors;
                  return (
                    <g key={`rank-guide-${rank}`}>
                      <line
                        x1={margins.left - 10}
                        y1={y}
                        x2={chartDimensions.width - margins.right + 10}
                        y2={y}
                        stroke={isTopRank ? '#cbd5e1' : isBottomRank ? '#94a3b8' : '#f1f5f9'}
                        strokeWidth={isTopRank || isBottomRank ? 1 : 0.8}
                        strokeDasharray={isBottomRank ? '4 2' : undefined}
                      />
                      {/* Left Y-axis rank number label */}
                      <text
                        x={margins.left - 16}
                        y={y + 3.5}
                        textAnchor="end"
                        className={`text-[10.5px] font-mono font-bold ${
                          isTopRank ? 'fill-[#004c4c]' : isBottomRank ? 'fill-slate-600 font-extrabold' : 'fill-slate-400'
                        }`}
                      >
                        #{rank}
                      </text>
                      {/* Right Y-axis rank number label */}
                      <text
                        x={chartDimensions.width - margins.right + 16}
                        y={y + 3.5}
                        textAnchor="start"
                        className={`text-[10px] font-mono font-bold ${
                          isTopRank ? 'fill-[#004c4c]' : isBottomRank ? 'fill-slate-600 font-extrabold' : 'fill-slate-400'
                        }`}
                      >
                        #{rank}
                      </text>
                    </g>
                  );
                })}
              </g>

              {/* 1. Ghost / Unpinned Trajectory Lines (Background) */}
              <g className="ghost-lines">
                {trajectories.map((t) => {
                  const isPinned = pinnedDistributors.has(t.name);
                  const isHovered = hoveredDistributor === t.name;
                  if (isPinned || isHovered) return null; // rendered separately in front

                  const pathData = generateBumpPath(t.points);

                  // If another line is hovered, mute non-pinned lines even further
                  const opacity = isAnyHovered ? 0.03 : 0.12;

                  return (
                    <path
                      key={`ghost-${t.name}`}
                      d={pathData}
                      fill="none"
                      stroke="#64748b"
                      strokeWidth={1.6}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity={opacity}
                      className="transition-opacity duration-200 cursor-pointer"
                      onMouseEnter={() => setHoveredDistributor(t.name)}
                      onMouseLeave={() => setHoveredDistributor(null)}
                    />
                  );
                })}
              </g>

              {/* 2. Pinned Trajectory Lines (Middle Layer) */}
              <g className="pinned-lines">
                {trajectories.map((t) => {
                  const isPinned = pinnedDistributors.has(t.name);
                  const isHovered = hoveredDistributor === t.name;
                  if (!isPinned || isHovered) return null;

                  const pathData = generateBumpPath(t.points);
                  const opacity = isAnyHovered ? 0.8 : 0.95;

                  return (
                    <g key={`pinned-${t.name}`} className="transition-opacity duration-200">
                      {/* Outer subtle glow/outline for contrast */}
                      <path
                        d={pathData}
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth={5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity={0.8}
                      />
                      {/* Main colored path */}
                      <path
                        d={pathData}
                        fill="none"
                        stroke={t.color}
                        strokeWidth={3.2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity={opacity}
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredDistributor(t.name)}
                        onMouseLeave={() => setHoveredDistributor(null)}
                      />

                      {/* Vertex Nodes with Rank Badges */}
                      {t.points.map((p) => {
                        const x = getX(p.monthIndex);
                        const y = getY(p.rank);
                        return (
                          <g
                            key={`pinned-node-${t.name}-${p.monthIndex}`}
                            className="cursor-pointer"
                            onMouseEnter={() => {
                              setHoveredDistributor(t.name);
                              setHoveredNode({
                                distributor: t.name,
                                monthIndex: p.monthIndex,
                                monthName: p.monthName,
                                rank: p.rank,
                                value: p.value,
                                x,
                                y,
                              });
                            }}
                            onMouseLeave={() => {
                              setHoveredNode(null);
                            }}
                          >
                            <circle
                              cx={x}
                              cy={y}
                              r={8}
                              fill="#ffffff"
                              stroke={t.color}
                              strokeWidth={2.2}
                            />
                            <text
                              x={x}
                              y={y + 3.2}
                              textAnchor="middle"
                              className="text-[9px] font-mono font-bold fill-slate-800"
                              pointerEvents="none"
                            >
                              {p.rank}
                            </text>
                          </g>
                        );
                      })}
                    </g>
                  );
                })}
              </g>

              {/* 3. Hovered Trajectory Line (Foreground Top Layer) */}
              <g className="hovered-line">
                {trajectories.map((t) => {
                  if (hoveredDistributor !== t.name) return null;

                  const pathData = generateBumpPath(t.points);

                  return (
                    <g key={`hovered-${t.name}`}>
                      {/* White border backdrop to elevate line */}
                      <path
                        d={pathData}
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth={6.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {/* Main bold stroke */}
                      <path
                        d={pathData}
                        fill="none"
                        stroke={t.color}
                        strokeWidth={4.2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      {/* Prominent numbered badges at every monthly vertex */}
                      {t.points.map((p) => {
                        const x = getX(p.monthIndex);
                        const y = getY(p.rank);
                        const isThisNodeHovered =
                          hoveredNode?.distributor === t.name &&
                          hoveredNode?.monthIndex === p.monthIndex;

                        return (
                          <g
                            key={`hovered-node-${t.name}-${p.monthIndex}`}
                            className="cursor-pointer"
                            onMouseEnter={() => {
                              setHoveredNode({
                                distributor: t.name,
                                monthIndex: p.monthIndex,
                                monthName: p.monthName,
                                rank: p.rank,
                                value: p.value,
                                x,
                                y,
                              });
                            }}
                          >
                            {/* Outer highlight halo */}
                            <circle
                              cx={x}
                              cy={y}
                              r={isThisNodeHovered ? 12 : 9.5}
                              fill={t.color}
                              opacity={0.25}
                            />
                            {/* Node body */}
                            <circle
                              cx={x}
                              cy={y}
                              r={isThisNodeHovered ? 9.5 : 8}
                              fill="#ffffff"
                              stroke={t.color}
                              strokeWidth={2.6}
                            />
                            {/* Rank text */}
                            <text
                              x={x}
                              y={y + 3.2}
                              textAnchor="middle"
                              className="text-[9.5px] font-mono font-extrabold fill-[#002d2d]"
                              pointerEvents="none"
                            >
                              {p.rank}
                            </text>
                          </g>
                        );
                      })}
                    </g>
                  );
                })}
              </g>
            </svg>

            {/* 4. Interactive Floating Tooltip */}
            {hoveredNode && (
              <div
                className="absolute z-30 pointer-events-none transition-all duration-75"
                style={{
                  left: `${Math.max(10, Math.min(chartDimensions.width - 230, hoveredNode.x - 110))}px`,
                  top: `${Math.max(10, hoveredNode.y - 105)}px`,
                }}
              >
                <div className="bg-[#002d2d]/95 backdrop-blur-md text-white p-3 rounded-xl shadow-xl border border-[#34a1a5]/40 min-w-[210px]">
                  <div className="flex items-center justify-between gap-2 border-b border-white/15 pb-1.5 mb-1.5">
                    <span className="font-extrabold text-[12.5px] text-[#ffedd5] truncate max-w-[140px]">
                      {hoveredNode.distributor}
                    </span>
                    <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-mono font-bold">
                      {hoveredNode.monthName}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1 text-[11.5px]">
                    <div className="flex items-center justify-between">
                      <span className="text-white/75">Position:</span>
                      <span className="font-mono font-extrabold text-amber-300">
                        Rank #{hoveredNode.rank} of {numDistributors}
                        {hoveredNode.value === 0 && ' (Tie / Last)'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-white/75">
                        {metric === 'sales' ? 'Revenue:' : 'Volume:'}
                      </span>
                      <span className="font-bold text-white tabular-nums">
                        {hoveredNode.value === 0
                          ? metric === 'sales'
                            ? '₹0'
                            : '0 units'
                          : metric === 'sales'
                          ? formatINR(hoveredNode.value)
                          : `${formatUnits(hoveredNode.value)} units`}
                      </span>
                    </div>

                    {/* Net change in active window */}
                    {(() => {
                      const distTrajectory = trajectories.find(
                        (t) => t.name === hoveredNode.distributor
                      );
                      if (!distTrajectory) return null;
                      const delta = distTrajectory.startRank - distTrajectory.endRank;
                      return (
                        <div className="flex items-center justify-between pt-1 border-t border-white/10 text-[10.5px]">
                          <span className="text-white/60">Window Delta:</span>
                          <span
                            className={`font-bold ${
                              delta > 0
                                ? 'text-emerald-400'
                                : delta < 0
                                ? 'text-rose-400'
                                : 'text-slate-300'
                            }`}
                          >
                            {delta > 0 ? `+${delta} spots` : delta < 0 ? `${delta} spots` : 'No change'}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Chart Footer Legend Note */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 px-1 text-[11px] text-[#1c4b4b] border-t border-[#34a1a5]/15 mt-1">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-0.5 bg-slate-400 inline-block opacity-40" />
                <span className="text-slate-500">Unselected (Ghost 0.12)</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-1 bg-[#004c4c] inline-block rounded-full" />
                <span className="font-bold text-[#002d2d]">Pinned / Active ({pinnedDistributors.size})</span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-500">
                X-Axis: Accounting months ({startMonth} to {endMonth}) • Y-Axis: Ranks (1 to {numDistributors})
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
