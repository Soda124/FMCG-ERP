import React, { useState, useMemo, useRef } from 'react';
import { FMCGRecord } from '../types/fmcg';
import { MONTHS_METADATA } from '../data/defaultFMCGData';
import { formatINR, formatUnits } from '../utils/currencyFormatter';
import { INDIA_DISTRIBUTORS } from '../data/indiaLogisticsData';
import { TrendingUp, Award, Filter, MapPin, Sliders, Info, Check } from 'lucide-react';

interface DistributorBumpChartProps {
  data: FMCGRecord[];
  activeDistributorFilter?: string;
  onDistributorClick?: (distributor: string) => void;
  scopeLabel?: string;
  compact?: boolean;
}

// Distinct, high-contrast, domain-friendly color palette for 26 distributors
const DISTRIBUTOR_COLORS = [
  '#004c4c', // Deep Pine Teal
  '#ff6b68', // Coral Rose
  '#34a1a5', // Ocean Cyan
  '#d97706', // Warm Amber
  '#4f46e5', // Royal Indigo
  '#059669', // Emerald
  '#db2777', // Magenta Pink
  '#7c3aed', // Purple
  '#0284c7', // Sky Blue
  '#ea580c', // Orange Flame
  '#16a34a', // Leaf Green
  '#9333ea', // Violet
  '#0d9488', // Teal Dark
  '#e11d48', // Crimson
  '#2563eb', // Blue
  '#ca8a04', // Golden Mustard
  '#64748b', // Slate
  '#475569', // Steel
  '#0f766e', // Deep Teal
  '#be185d', // Rose
  '#1d4ed8', // Dark Blue
  '#b45309', // Rust Amber
  '#047857', // Forest
  '#6d28d9', // Deep Purple
  '#0369a1', // Cerulean
  '#c026d3', // Fuchsia
];

interface MonthlyRankData {
  monthName: string;
  monthIndex: number;
  rank: number;
  value: number; // salesINR or units
  salesINR: number;
  units: number;
  prevRank: number | null;
  rankChange: number; // positive = gained ranks (improved), negative = lost ranks
}

interface DistributorTrajectory {
  name: string;
  city: string;
  state: string;
  color: string;
  totalMetric: number;
  totalSales: number;
  totalUnits: number;
  months: MonthlyRankData[]; // 12 months
  finalRank: number;
  bestRank: number;
  avgRank: number;
}

interface HoveredNodeData {
  distributorName: string;
  monthName: string;
  monthIndex: number;
  rank: number;
  maxRank: number;
  value: number;
  salesINR: number;
  units: number;
  rankChange: number;
  pixelX: number;
  pixelY: number;
}

export const DistributorBumpChart: React.FC<DistributorBumpChartProps> = ({
  data,
  activeDistributorFilter = 'All',
  onDistributorClick,
  scopeLabel,
  compact = false,
}) => {
  const [metric, setMetric] = useState<'sales' | 'units'>('sales');
  const [hoveredDistributor, setHoveredDistributor] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<HoveredNodeData | null>(null);
  const [limit, setLimit] = useState<'8' | '12' | 'all'>('12');

  const containerRef = useRef<HTMLDivElement | null>(null);

  // Month definitions ordered chronologically by Indian Financial Year (Apr to Mar)
  const months = useMemo(() => {
    return [...MONTHS_METADATA].sort((a, b) => a.index - b.index);
  }, []);

  // Compute trajectories and monthly ranking (1 to N)
  const { trajectories, totalDistributorsInScope } = useMemo(() => {
    if (!data.length) {
      return { trajectories: [], totalDistributorsInScope: 0 };
    }

    // 1. Identify all distributors present in the current dataset slice
    const distMap = new Map<
      string,
      {
        totalSales: number;
        totalUnits: number;
        monthlyValues: Map<number, { sales: number; units: number }>;
      }
    >();

    data.forEach((row) => {
      let entry = distMap.get(row.Distributor);
      if (!entry) {
        entry = {
          totalSales: 0,
          totalUnits: 0,
          monthlyValues: new Map(),
        };
        distMap.set(row.Distributor, entry);
      }
      entry.totalSales += row.Sales_INR;
      entry.totalUnits += row.Units_Sold;

      const m = entry.monthlyValues.get(row.Month_Index) || { sales: 0, units: 0 };
      m.sales += row.Sales_INR;
      m.units += row.Units_Sold;
      entry.monthlyValues.set(row.Month_Index, m);
    });

    const distNames = Array.from(distMap.keys());
    const totalDistributorsInScope = distNames.length;

    // 2. Filter / rank top distributors if limit is active and many distributors exist
    let selectedDistNames = distNames;
    if (distNames.length > 12 && limit !== 'all') {
      const sortedByTotal = [...distNames].sort((a, b) => {
        const itemA = distMap.get(a)!;
        const itemB = distMap.get(b)!;
        const valA = metric === 'sales' ? itemA.totalSales : itemA.totalUnits;
        const valB = metric === 'sales' ? itemB.totalSales : itemB.totalUnits;
        return valB - valA;
      });
      selectedDistNames = sortedByTotal.slice(0, Number(limit));
    }

    // 3. For each month (1 to 12), rank the selected distributors
    // Map of monthIndex -> sorted list of { name, value, rank }
    const monthlyRankings = new Map<number, Map<string, { rank: number; value: number; sales: number; units: number }>>();

    months.forEach((m) => {
      const monthDistValues: { name: string; value: number; sales: number; units: number }[] = [];

      selectedDistNames.forEach((dName) => {
        const item = distMap.get(dName);
        const mVal = item?.monthlyValues.get(m.index) || { sales: 0, units: 0 };
        const compareVal = metric === 'sales' ? mVal.sales : mVal.units;
        monthDistValues.push({
          name: dName,
          value: compareVal,
          sales: mVal.sales,
          units: mVal.units,
        });
      });

      // Sort descending by value: Highest volume/sales gets Rank 1!
      monthDistValues.sort((a, b) => b.value - a.value);

      const rankMap = new Map<string, { rank: number; value: number; sales: number; units: number }>();
      monthDistValues.forEach((item, idx) => {
        rankMap.set(item.name, {
          rank: idx + 1, // 1 to N
          value: item.value,
          sales: item.sales,
          units: item.units,
        });
      });

      monthlyRankings.set(m.index, rankMap);
    });

    // 4. Build complete trajectories for each distributor
    const trajectories: DistributorTrajectory[] = selectedDistNames.map((name, distIdx) => {
      const info = INDIA_DISTRIBUTORS.find((d) => d.name === name);
      const distData = distMap.get(name)!;
      const color = DISTRIBUTOR_COLORS[distIdx % DISTRIBUTOR_COLORS.length];

      const monthlyData: MonthlyRankData[] = [];
      let prevRank: number | null = null;
      let rankSum = 0;
      let bestRank = 999;

      months.forEach((m) => {
        const monthRanking = monthlyRankings.get(m.index)?.get(name);
        const currentRank = monthRanking ? monthRanking.rank : selectedDistNames.length;
        const currentVal = monthRanking ? monthRanking.value : 0;
        const currentSales = monthRanking ? monthRanking.sales : 0;
        const currentUnits = monthRanking ? monthRanking.units : 0;

        // Rank change: e.g. prev was 3, current is 1 => +2 places gained (improved!)
        const rankChange = prevRank !== null ? prevRank - currentRank : 0;

        monthlyData.push({
          monthName: m.name,
          monthIndex: m.index,
          rank: currentRank,
          value: currentVal,
          salesINR: currentSales,
          units: currentUnits,
          prevRank,
          rankChange,
        });

        rankSum += currentRank;
        if (currentRank < bestRank) bestRank = currentRank;
        prevRank = currentRank;
      });

      const finalRank = monthlyData[monthlyData.length - 1]?.rank || selectedDistNames.length;
      const avgRank = monthlyData.length > 0 ? Number((rankSum / monthlyData.length).toFixed(1)) : 0;

      return {
        name,
        city: info?.city || 'Regional Hub',
        state: info?.state || 'India',
        color,
        totalMetric: metric === 'sales' ? distData.totalSales : distData.totalUnits,
        totalSales: distData.totalSales,
        totalUnits: distData.totalUnits,
        months: monthlyData,
        finalRank,
        bestRank: bestRank === 999 ? 1 : bestRank,
        avgRank,
      };
    });

    // Sort trajectories by their final month rank so legend / labels look clean
    trajectories.sort((a, b) => a.finalRank - b.finalRank);

    return { trajectories, totalDistributorsInScope };
  }, [data, metric, limit, months]);

  // Layout math for SVG Bump Chart
  const N = trajectories.length;
  const numMonths = months.length;

  const viewBoxWidth = compact ? 780 : 960;
  const viewBoxHeight = compact ? Math.max(340, Math.min(520, N * 34 + 90)) : Math.max(400, Math.min(620, N * 38 + 100));

  const paddingLeft = compact ? 42 : 54;
  const paddingRight = compact ? 140 : 180; // room for distributor names on the right
  const paddingTop = compact ? 36 : 46;
  const paddingBottom = compact ? 40 : 48;

  const chartWidth = viewBoxWidth - paddingLeft - paddingRight;
  const chartHeight = viewBoxHeight - paddingTop - paddingBottom;

  // X coordinate for each month (0 to 11)
  const getX = (monthIndex0: number) => {
    return paddingLeft + (monthIndex0 / (numMonths - 1)) * chartWidth;
  };

  // Y coordinate for each rank (1 to N). Rank 1 is AT TOP!
  const getY = (rank: number) => {
    if (N <= 1) return paddingTop + chartHeight / 2;
    return paddingTop + ((rank - 1) / (N - 1)) * chartHeight;
  };

  // Build smooth cubic Bezier path for a trajectory
  const generateBezierPath = (monthsData: MonthlyRankData[]) => {
    if (monthsData.length === 0) return '';

    let d = '';
    for (let i = 0; i < monthsData.length; i++) {
      const x = getX(i);
      const y = getY(monthsData[i].rank);

      if (i === 0) {
        d += `M ${x} ${y}`;
      } else {
        const prevX = getX(i - 1);
        const prevY = getY(monthsData[i - 1].rank);

        // Control points for smooth horizontal S-curve
        const dx = x - prevX;
        const cx1 = prevX + dx * 0.45;
        const cy1 = prevY;
        const cx2 = x - dx * 0.45;
        const cy2 = y;

        d += ` C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x} ${y}`;
      }
    }
    return d;
  };

  const handleNodeMouseEnter = (
    e: React.MouseEvent<SVGGElement>,
    dist: DistributorTrajectory,
    m: MonthlyRankData
  ) => {
    setHoveredDistributor(dist.name);

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const clientX = e.clientX;
      const clientY = e.clientY;

      setHoveredNode({
        distributorName: dist.name,
        monthName: m.monthName,
        monthIndex: m.monthIndex,
        rank: m.rank,
        maxRank: N,
        value: m.value,
        salesINR: m.salesINR,
        units: m.units,
        rankChange: m.rankChange,
        pixelX: clientX - rect.left,
        pixelY: clientY - rect.top,
      });
    }
  };

  return (
    <div
      ref={containerRef}
      className={`glass-panel rounded-2xl p-4 sm:p-5 flex flex-col h-full shadow-sm relative ${
        compact ? 'min-h-[360px]' : 'min-h-[460px]'
      }`}
    >
      {/* Component Header & Analytical Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#34a1a5]/20">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#004c4c] to-[#34a1a5] flex items-center justify-center text-white shrink-0 shadow-sm">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[15px] font-extrabold text-[#002d2d] tracking-tight">
                Distributor Rank Progression (Bump Chart)
              </h3>
              {scopeLabel && (
                <span className="text-[11px] font-bold text-[#004c4c] bg-[#ffedd5] px-2 py-0.5 rounded-full border border-[#f59e0b]/30">
                  {scopeLabel}
                </span>
              )}
            </div>
            <p className="text-[11.5px] text-[#1c4b4b] font-medium">
              Tracking relative ranking dynamics (1 to {N}) across financial year (Apr–Mar)
            </p>
          </div>
        </div>

        {/* Controls: Metric Toggle & Limit Switch */}
        <div className="flex items-center gap-2">
          {/* Revenue vs Volume Toggle */}
          <div className="p-0.5 rounded-xl bg-white/80 backdrop-blur-md border border-[#34a1a5]/25 flex items-center shadow-inner">
            <button
              onClick={() => setMetric('sales')}
              className={`h-6.5 px-2.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                metric === 'sales' ? 'glass-btn-primary shadow-xs' : 'text-[#004c4c] hover:bg-white/80'
              }`}
            >
              Revenue (INR)
            </button>
            <button
              onClick={() => setMetric('units')}
              className={`h-6.5 px-2.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                metric === 'units' ? 'glass-btn-primary shadow-xs' : 'text-[#004c4c] hover:bg-white/80'
              }`}
            >
              Volume (Units)
            </button>
          </div>

          {/* Scope Limit Toggle when > 10 distributors */}
          {totalDistributorsInScope > 10 && (
            <div className="p-0.5 rounded-xl bg-white/80 backdrop-blur-md border border-[#34a1a5]/25 flex items-center shadow-inner">
              {(['8', '12', 'all'] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLimit(l)}
                  className={`h-6.5 px-2 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                    limit === l ? 'glass-btn-teal shadow-xs' : 'text-[#1c4b4b] hover:bg-white/80'
                  }`}
                  title={l === 'all' ? 'Show all distributors' : `Show top ${l} distributors by total volume/sales`}
                >
                  {l === 'all' ? 'All' : `Top ${l}`}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Trajectory Canvas or Empty State */}
      <div className="flex-1 w-full relative mt-2 flex items-center justify-center overflow-x-auto">
        {trajectories.length > 0 ? (
          <svg
            viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
            className="w-full h-auto select-none"
            style={{ minWidth: compact ? '680px' : '820px' }}
            onMouseLeave={() => {
              setHoveredDistributor(null);
              setHoveredNode(null);
            }}
          >
            {/* SVG Definitions */}
            <defs>
              <filter id="bumpShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#004c4c" floodOpacity="0.3" />
              </filter>
            </defs>

            {/* Background Horizontal Rank Guidelines */}
            {Array.from({ length: N }).map((_, rankIdx) => {
              const r = rankIdx + 1;
              const y = getY(r);
              return (
                <g key={`rank-guide-${r}`} opacity={0.6}>
                  <line
                    x1={paddingLeft}
                    y1={y}
                    x2={viewBoxWidth - paddingRight}
                    y2={y}
                    stroke="#34a1a5"
                    strokeWidth="1"
                    strokeDasharray="3 4"
                    strokeOpacity="0.25"
                  />
                  {/* Left-side Rank Badge Label */}
                  <text
                    x={paddingLeft - 10}
                    y={y + 4}
                    textAnchor="end"
                    fill={r <= 3 ? '#004c4c' : '#1c4b4b'}
                    fontSize={compact ? '10' : '11'}
                    fontWeight={r <= 3 ? '800' : '600'}
                  >
                    #{r}
                  </text>
                </g>
              );
            })}

            {/* Vertical Month Guidelines & Labels */}
            {months.map((m, mIdx) => {
              const x = getX(mIdx);
              return (
                <g key={`month-guide-${m.name}`}>
                  <line
                    x1={x}
                    y1={paddingTop - 10}
                    x2={x}
                    y2={viewBoxHeight - paddingBottom + 6}
                    stroke="#004c4c"
                    strokeWidth="1"
                    strokeOpacity="0.08"
                  />
                  {/* Bottom Month Label */}
                  <text
                    x={x}
                    y={viewBoxHeight - paddingBottom + 22}
                    textAnchor="middle"
                    fill="#1c4b4b"
                    fontSize={compact ? '10.5' : '11.5'}
                    fontWeight="700"
                  >
                    {m.name.slice(0, 3)}
                  </text>
                  {/* Top Quarter Marker on change */}
                  {(mIdx === 0 || mIdx === 3 || mIdx === 6 || mIdx === 9) && (
                    <text
                      x={x}
                      y={paddingTop - 18}
                      textAnchor="middle"
                      fill="#004c4c"
                      fontSize="9.5"
                      fontWeight="800"
                      opacity="0.75"
                    >
                      {m.quarter}
                    </text>
                  )}
                </g>
              );
            })}

            {/* RENDER BEZIER CURVES FOR ALL DISTRIBUTORS */}
            <g id="bump-paths-layer">
              {trajectories.map((dist) => {
                const isHovered = hoveredDistributor === dist.name;
                const isDimmed = hoveredDistributor !== null && !isHovered;
                const isFilterSelected = activeDistributorFilter !== 'All' && activeDistributorFilter === dist.name;

                const pathD = generateBezierPath(dist.months);

                return (
                  <g
                    key={`path-group-${dist.name}`}
                    opacity={isHovered || isFilterSelected ? 1 : isDimmed ? 0.15 : 0.85}
                    className="transition-opacity duration-200 cursor-pointer"
                    onMouseEnter={() => setHoveredDistributor(dist.name)}
                    onClick={() => onDistributorClick?.(dist.name)}
                  >
                    {/* Wider invisible hover target line */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke="transparent"
                      strokeWidth="20"
                      strokeLinecap="round"
                    />

                    {/* Outer Glow Halo on Hover */}
                    {isHovered && (
                      <path
                        d={pathD}
                        fill="none"
                        stroke={dist.color}
                        strokeWidth="8"
                        strokeOpacity="0.25"
                        strokeLinecap="round"
                      />
                    )}

                    {/* Main Curved Trajectory Line */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke={dist.color}
                      strokeWidth={isHovered ? 4.5 : isFilterSelected ? 4 : 2.8}
                      strokeLinecap="round"
                      filter={isHovered ? 'url(#bumpShadow)' : undefined}
                    />
                  </g>
                );
              })}
            </g>

            {/* RENDER NUMBERED BADGES / NODES AT EACH MONTH */}
            <g id="bump-nodes-layer">
              {trajectories.map((dist) => {
                const isHovered = hoveredDistributor === dist.name;
                const isDimmed = hoveredDistributor !== null && !isHovered;
                const isFilterSelected = activeDistributorFilter !== 'All' && activeDistributorFilter === dist.name;

                return (
                  <g
                    key={`nodes-group-${dist.name}`}
                    opacity={isHovered || isFilterSelected ? 1 : isDimmed ? 0.15 : 0.9}
                    className="transition-opacity duration-200"
                  >
                    {dist.months.map((m, mIdx) => {
                      const x = getX(mIdx);
                      const y = getY(m.rank);
                      const isNodeHovered =
                        hoveredNode?.distributorName === dist.name &&
                        hoveredNode?.monthIndex === m.monthIndex;

                      const radius = isNodeHovered ? 13 : isHovered ? 11 : 9.5;

                      return (
                        <g
                          key={`node-${dist.name}-${m.monthName}`}
                          className="cursor-pointer"
                          onMouseEnter={(e) => handleNodeMouseEnter(e, dist, m)}
                          onClick={() => onDistributorClick?.(dist.name)}
                        >
                          {/* Node Background Circle */}
                          <circle
                            cx={x}
                            cy={y}
                            r={radius}
                            fill={isHovered ? dist.color : '#ffffff'}
                            stroke={dist.color}
                            strokeWidth={isHovered ? '2.5' : '2'}
                            className="transition-all duration-150"
                          />

                          {/* Numbered Rank inside badge */}
                          <text
                            x={x}
                            y={y + 3.5}
                            textAnchor="middle"
                            fill={isHovered ? '#ffffff' : dist.color}
                            fontSize={isHovered ? '10' : '8.5'}
                            fontWeight="800"
                            className="pointer-events-none select-none"
                          >
                            {m.rank}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                );
              })}
            </g>

            {/* RIGHT SIDE: FINAL DISTRIBUTOR LABELS ALIGNED TO FINAL RANK */}
            <g id="bump-end-labels">
              {trajectories.map((dist) => {
                const lastMonth = dist.months[dist.months.length - 1];
                const finalRank = lastMonth ? lastMonth.rank : dist.finalRank;
                const finalY = getY(finalRank);
                const isHovered = hoveredDistributor === dist.name;
                const isDimmed = hoveredDistributor !== null && !isHovered;
                const isFilterSelected = activeDistributorFilter !== 'All' && activeDistributorFilter === dist.name;

                const labelX = viewBoxWidth - paddingRight + 12;

                return (
                  <g
                    key={`label-${dist.name}`}
                    opacity={isHovered || isFilterSelected ? 1 : isDimmed ? 0.2 : 0.85}
                    className="cursor-pointer transition-opacity duration-150"
                    onMouseEnter={() => setHoveredDistributor(dist.name)}
                    onClick={() => onDistributorClick?.(dist.name)}
                  >
                    <rect
                      x={labelX - 4}
                      y={finalY - 9}
                      width={paddingRight - 16}
                      height="18"
                      rx="6"
                      fill={isHovered ? dist.color : isFilterSelected ? '#ffedd5' : 'transparent'}
                      opacity={isHovered ? 0.15 : 1}
                    />
                    <circle
                      cx={labelX + 2}
                      cy={finalY}
                      r="4"
                      fill={dist.color}
                    />
                    <text
                      x={labelX + 11}
                      y={finalY + 3.5}
                      fill={isHovered ? '#002d2d' : '#1c4b4b'}
                      fontSize={compact ? '9.5' : '10.5'}
                      fontWeight={isHovered || isFilterSelected ? '800' : '600'}
                    >
                      {dist.name.length > 20 ? `${dist.name.slice(0, 18)}…` : dist.name}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        ) : (
          <div className="py-12 text-center text-[#1c4b4b] text-[12px]">
            No distributor transaction data matches current selection.
          </div>
        )}

        {/* FLOATING HOVER TOOLTIP CARD */}
        {hoveredNode && (
          <div
            className="absolute z-40 pointer-events-none transition-all duration-75 ease-out shadow-2xl rounded-xl p-3 bg-white/95 backdrop-blur-md border border-[#004c4c]/30 text-[#002d2d] min-w-[230px]"
            style={{
              left: `${Math.min(Math.max(hoveredNode.pixelX, 120), (containerRef.current?.clientWidth || 800) - 130)}px`,
              top: `${Math.max(hoveredNode.pixelY - 12, 10)}px`,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <div className="flex items-center justify-between border-b border-[#34a1a5]/20 pb-1.5 mb-1.5">
              <span className="font-extrabold text-[12px] text-[#002d2d]">
                {hoveredNode.distributorName}
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#ffedd5] text-[#004c4c] border border-[#f59e0b]/30">
                {hoveredNode.monthName}
              </span>
            </div>

            <div className="space-y-1 text-[11px] text-[#1c4b4b]">
              <div className="flex justify-between items-center">
                <span>Rank in {hoveredNode.monthName}:</span>
                <span className="font-black text-[#004c4c] tabular-nums text-[12px]">
                  #{hoveredNode.rank} <span className="text-[10px] text-gray-500 font-normal">of {hoveredNode.maxRank}</span>
                </span>
              </div>

              {hoveredNode.rankChange !== 0 && (
                <div className="flex justify-between items-center text-[10.5px]">
                  <span>Momentum:</span>
                  <span
                    className={`font-bold ${
                      hoveredNode.rankChange > 0 ? 'text-[#059669]' : 'text-[#dc2626]'
                    }`}
                  >
                    {hoveredNode.rankChange > 0 ? (
                      `▲ Gained ${hoveredNode.rankChange} ${hoveredNode.rankChange === 1 ? 'rank' : 'ranks'}`
                    ) : (
                      `▼ Dropped ${Math.abs(hoveredNode.rankChange)} ${Math.abs(hoveredNode.rankChange) === 1 ? 'rank' : 'ranks'}`
                    )}
                  </span>
                </div>
              )}

              <div className="flex justify-between border-t border-[#34a1a5]/15 pt-1 mt-1">
                <span>Monthly Revenue:</span>
                <strong className="text-[#002d2d] tabular-nums">{formatINR(hoveredNode.salesINR)}</strong>
              </div>

              <div className="flex justify-between">
                <span>Monthly Volume:</span>
                <strong className="text-[#002d2d] tabular-nums">{formatUnits(hoveredNode.units)} units</strong>
              </div>
            </div>

            <div className="mt-2 pt-1 border-t border-[#34a1a5]/20 text-[10px] text-[#004c4c] font-bold flex items-center justify-between">
              <span>Click to cross-filter</span>
              <span>12-Month Financial Year</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer Meta & Legend Helper */}
      <div className="pt-2.5 mt-auto border-t border-[#34a1a5]/20 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#1c4b4b]">
        <div className="flex items-center gap-2">
          <span className="font-bold text-[#004c4c]">
            Showing {trajectories.length} of {totalDistributorsInScope} distributors
          </span>
          <span>•</span>
          <span>Hover line to inspect trajectory</span>
        </div>
        <div className="flex items-center gap-3 font-semibold text-[#004c4c]">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#004c4c]" />
            <span>Rank 1 is at top</span>
          </span>
          <span className="hidden sm:inline">•</span>
          <span className="hidden sm:inline">Click distributor to filter dashboard</span>
        </div>
      </div>
    </div>
  );
};
