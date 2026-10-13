import React, { useState } from 'react';
import {
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from 'recharts';
import { FMCGRecord } from '../types/fmcg';
import { MONTHS_METADATA } from '../data/defaultFMCGData';
import { formatINR, formatUnits } from '../utils/currencyFormatter';
import { TrendingUp, Layers, Calendar } from 'lucide-react';

interface VisualSalesTrendProps {
  data: FMCGRecord[];
  activeMonthFilter: string;
  activeCategoryFilter: string;
  onMonthClick: (month: string) => void;
  onCategoryClick: (category: string) => void;
}

export const VisualSalesTrend: React.FC<VisualSalesTrendProps> = ({
  data,
  activeMonthFilter,
  activeCategoryFilter,
  onMonthClick,
  onCategoryClick,
}) => {
  const [viewMode, setViewMode] = useState<'month' | 'category'>('month');

  // Aggregate by Month (12 months in financial year order)
  const monthMap = new Map<
    string,
    { month: string; index: number; quarter: string; sales: number; units: number }
  >();

  MONTHS_METADATA.forEach((m) => {
    monthMap.set(m.name, {
      month: m.name,
      index: m.index,
      quarter: m.quarter,
      sales: 0,
      units: 0,
    });
  });

  // Aggregate by Category
  const categoryMap = new Map<string, { category: string; sales: number; units: number }>();

  data.forEach((row) => {
    // Month aggregation
    const curMonth = monthMap.get(row.Month);
    if (curMonth) {
      curMonth.sales += row.Sales_INR;
      curMonth.units += row.Units_Sold;
    } else {
      monthMap.set(row.Month, {
        month: row.Month,
        index: row.Month_Index || 1,
        quarter: row.Quarter,
        sales: row.Sales_INR,
        units: row.Units_Sold,
      });
    }

    // Category aggregation
    const curCat = categoryMap.get(row.Category);
    if (curCat) {
      curCat.sales += row.Sales_INR;
      curCat.units += row.Units_Sold;
    } else {
      categoryMap.set(row.Category, {
        category: row.Category,
        sales: row.Sales_INR,
        units: row.Units_Sold,
      });
    }
  });

  const monthChartData = Array.from(monthMap.values()).sort((a, b) => a.index - b.index);
  const categoryChartData = Array.from(categoryMap.values()).sort((a, b) => b.sales - a.sales);

  const totalSales = data.reduce((sum, r) => sum + r.Sales_INR, 0);

  return (
    <div className="glass-panel rounded-2xl p-4 sm:p-5 flex flex-col h-full shadow-sm">
      {/* Visual Header */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#34a1a5]/20">
        <h2 className="text-[16px] font-extrabold text-[#002d2d] tracking-tight">
          {viewMode === 'month' ? 'Revenue & Volume Monthly Cadence' : 'Product Line Mix'}
        </h2>

        {/* View Switcher (MacBook Glassy Style) */}
        <div className="p-0.5 rounded-xl bg-white/75 backdrop-blur-md border border-[#34a1a5]/25 flex items-center shadow-inner">
          <button
            onClick={() => setViewMode('month')}
            className={`h-6.5 px-3 text-[11px] font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'month'
                ? 'glass-btn-primary shadow-xs'
                : 'text-[#004c4c] hover:bg-white/80'
            }`}
          >
            <Calendar className="w-3 h-3" />
            <span>Monthly Trend</span>
          </button>
          <button
            onClick={() => setViewMode('category')}
            className={`h-6.5 px-3 text-[11px] font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'category'
                ? 'glass-btn-primary shadow-xs'
                : 'text-[#004c4c] hover:bg-white/80'
            }`}
          >
            <Layers className="w-3 h-3" />
            <span>Product Lines</span>
          </button>
        </div>
      </div>

      {/* Active Filter Indication */}
      {viewMode === 'month' && activeMonthFilter !== 'All' && (
        <div className="mt-2.5 py-1 px-2.5 bg-[#ffedd5] border border-[#f59e0b]/40 rounded-xl flex items-center justify-between text-[11.5px]">
          <span className="text-[#004c4c] font-bold flex items-center gap-1.5">
            <Calendar className="w-3 h-3 text-[#004c4c]" />
            Filtered Month: <strong>{activeMonthFilter}</strong>
          </span>
          <button
            onClick={() => onMonthClick(activeMonthFilter)}
            className="text-[11px] text-[#8c1e1c] hover:underline cursor-pointer font-bold"
          >
            Clear filter
          </button>
        </div>
      )}

      {viewMode === 'category' && activeCategoryFilter !== 'All' && (
        <div className="mt-2.5 py-1 px-2.5 bg-[#ffedd5] border border-[#f59e0b]/40 rounded-xl flex items-center justify-between text-[11.5px]">
          <span className="text-[#004c4c] font-bold flex items-center gap-1.5">
            <Layers className="w-3 h-3 text-[#004c4c]" />
            Filtered Product Line: <strong>{activeCategoryFilter}</strong>
          </span>
          <button
            onClick={() => onCategoryClick(activeCategoryFilter)}
            className="text-[11px] text-[#8c1e1c] hover:underline cursor-pointer font-bold"
          >
            Clear filter
          </button>
        </div>
      )}

      {/* Chart Canvas */}
      <div className="flex-1 w-full min-h-[220px] mt-2">
        {viewMode === 'month' ? (
          monthChartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-[12px] text-[#1c4b4b]">
              No data available for selected period.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={monthChartData}
                margin={{ top: 12, right: 10, bottom: 20, left: 0 }}
                onClick={(state: any) => {
                  if (state && state.activePayload && state.activePayload.length > 0) {
                    const month = state.activePayload[0].payload.month;
                    onMonthClick(month);
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(52, 161, 165, 0.15)" />
                <XAxis
                  dataKey="month"
                  tick={{ fill: '#1c4b4b', fontSize: 11, fontWeight: 600 }}
                  axisLine={{ stroke: 'rgba(52, 161, 165, 0.3)' }}
                  tickLine={false}
                  tickFormatter={(v) => v.slice(0, 3)}
                />
                <YAxis
                  yAxisId="sales"
                  tick={{ fill: '#004c4c', fontSize: 10, fontWeight: 700 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => formatINR(v)}
                />
                <YAxis
                  yAxisId="units"
                  orientation="right"
                  tick={{ fill: '#ff6b68', fontSize: 10, fontWeight: 700 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => formatUnits(v)}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      const realization = d.units > 0 ? (d.sales / d.units).toFixed(1) : '0';
                      return (
                        <div className="bg-white/95 backdrop-blur-md text-[#002d2d] text-[12px] rounded-xl shadow-lg p-3.5 border border-[#34a1a5]/30 min-w-[210px]">
                          <div className="font-bold text-[#002d2d] flex items-center justify-between pb-1.5 border-b border-[#34a1a5]/20">
                            <span>{d.month}</span>
                            <span className="text-[10px] bg-[#ffedd5] px-2 py-0.5 rounded-full text-[#004c4c] font-bold border border-[#f59e0b]/30">
                              {d.quarter}
                            </span>
                          </div>
                          <div className="mt-2 space-y-1 text-[#1c4b4b]">
                            <div className="flex justify-between">
                              <span className="text-[#004c4c] font-bold">Sales Revenue:</span>
                              <span className="font-bold text-[#002d2d] tabular-nums">{formatINR(d.sales)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[#ff6b68] font-bold">Volume Sold:</span>
                              <span className="font-bold text-[#002d2d] tabular-nums">{formatUnits(d.units)}</span>
                            </div>
                            <div className="flex justify-between border-t border-[#34a1a5]/20 pt-1 mt-1">
                              <span>Realization:</span>
                              <span className="font-bold text-[#004c4c] tabular-nums">₹{realization}/unit</span>
                            </div>
                          </div>
                          <div className="mt-2 text-[10.5px] text-[#004c4c] pt-1 border-t border-[#34a1a5]/20 font-bold">
                            Click to filter dashboard
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  wrapperStyle={{ fontSize: '11px', top: -8, color: '#1c4b4b', fontWeight: 600 }}
                />
                <Bar
                  yAxisId="sales"
                  dataKey="sales"
                  name="Sales (INR)"
                  radius={[5, 5, 0, 0]}
                  cursor="pointer"
                >
                  {monthChartData.map((entry, index) => {
                    const isSelected = activeMonthFilter === entry.month;
                    return (
                      <Cell
                        key={`month-bar-${index}`}
                        fill={isSelected ? '#ff6b68' : '#004c4c'}
                        stroke={isSelected ? '#8c1e1c' : 'none'}
                        opacity={activeMonthFilter !== 'All' && !isSelected ? 0.35 : 1}
                      />
                    );
                  })}
                </Bar>
                <Line
                  yAxisId="units"
                  type="monotone"
                  dataKey="units"
                  name="Units Sold"
                  stroke="#ff6b68"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#ff6b68' }}
                  activeDot={{ r: 5, fill: '#ffedd5', stroke: '#8c1e1c', strokeWidth: 2 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )
        ) : categoryChartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[12px] text-[#1c4b4b]">
            No category data matching current slicer selections.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={270}>
            <BarChart
              data={categoryChartData}
              layout="vertical"
              margin={{ top: 8, right: 20, bottom: 10, left: 16 }}
              onClick={(state: any) => {
                if (state && state.activePayload && state.activePayload.length > 0) {
                  const cat = state.activePayload[0].payload.category;
                  onCategoryClick(cat);
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(52, 161, 165, 0.15)" />
              <XAxis
                type="number"
                tick={{ fill: '#1c4b4b', fontSize: 10, fontWeight: 600 }}
                axisLine={{ stroke: 'rgba(52, 161, 165, 0.3)' }}
                tickLine={false}
                tickFormatter={(v) => formatINR(v)}
              />
              <YAxis
                type="category"
                dataKey="category"
                tick={{ fill: '#002d2d', fontSize: 11, fontWeight: 700 }}
                axisLine={false}
                tickLine={false}
                width={120}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload;
                    const pct = totalSales > 0 ? ((d.sales / totalSales) * 100).toFixed(1) : '0';
                    const realization = d.units > 0 ? (d.sales / d.units).toFixed(1) : '0';
                    return (
                      <div className="bg-white/95 backdrop-blur-md text-[#002d2d] text-[12px] rounded-xl shadow-lg p-3.5 border border-[#34a1a5]/30 min-w-[200px]">
                        <div className="font-bold text-[#002d2d] pb-1.5 border-b border-[#34a1a5]/20">
                          {d.category}
                        </div>
                        <div className="mt-2 space-y-1 text-[#1c4b4b]">
                          <div className="flex justify-between">
                            <span>Turnover:</span>
                            <span className="font-bold text-[#002d2d] tabular-nums">{formatINR(d.sales)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Units:</span>
                            <span className="font-semibold text-[#002d2d] tabular-nums">{formatUnits(d.units)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Realization:</span>
                            <span className="font-bold text-[#004c4c] tabular-nums">₹{realization}/unit</span>
                          </div>
                          <div className="flex justify-between border-t border-[#34a1a5]/20 pt-1 mt-1">
                            <span>Category Share:</span>
                            <span className="font-bold text-[#004c4c] tabular-nums">{pct}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="sales" radius={[0, 5, 5, 0]} cursor="pointer">
                {categoryChartData.map((entry, index) => {
                  const isSelected = activeCategoryFilter === entry.category;
                  return (
                    <Cell
                      key={`cat-bar-${index}`}
                      fill={isSelected ? '#ff6b68' : '#34a1a5'}
                      stroke={isSelected ? '#8c1e1c' : 'none'}
                      opacity={activeCategoryFilter !== 'All' && !isSelected ? 0.35 : 1}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
