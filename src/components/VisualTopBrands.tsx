import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
} from 'recharts';
import { FMCGRecord } from '../types/fmcg';
import { formatINR, formatUnits } from '../utils/currencyFormatter';
import { BarChart3, Filter } from 'lucide-react';

interface VisualTopBrandsProps {
  data: FMCGRecord[];
  activeBrandFilter: string;
  onBrandClick: (brand: string) => void;
}

export const VisualTopBrands: React.FC<VisualTopBrandsProps> = ({
  data,
  activeBrandFilter,
  onBrandClick,
}) => {
  const [metric, setMetric] = useState<'sales' | 'units'>('sales');
  const [limit, setLimit] = useState<'4' | '6' | 'all'>('4');

  // Aggregate by Brand
  const brandMap = new Map<
    string,
    { brand: string; category: string; sales: number; units: number; count: number }
  >();

  let totalSales = 0;
  let totalUnits = 0;

  data.forEach((row) => {
    totalSales += row.Sales_INR;
    totalUnits += row.Units_Sold;

    const existing = brandMap.get(row.Brand) || {
      brand: row.Brand,
      category: row.Category,
      sales: 0,
      units: 0,
      count: 0,
    };
    existing.sales += row.Sales_INR;
    existing.units += row.Units_Sold;
    existing.count += row.Transaction_Rows;
    brandMap.set(row.Brand, existing);
  });

  const sortedBrands = Array.from(brandMap.values()).sort((a, b) =>
    metric === 'sales' ? b.sales - a.sales : b.units - a.units
  );

  const displayBrands =
    limit === 'all' ? sortedBrands : sortedBrands.slice(0, Number(limit));

  const chartData = displayBrands.map((b, idx) => ({
    name: b.brand,
    sales: b.sales,
    units: b.units,
    category: b.category,
    realization: b.units > 0 ? (b.sales / b.units).toFixed(1) : '0',
    shareOfTotal:
      totalSales > 0 ? ((b.sales / totalSales) * 100).toFixed(1) : '0',
    rank: idx + 1,
  }));

  return (
    <div className="glass-panel rounded-2xl p-4 sm:p-5 flex flex-col h-full shadow-sm">
      {/* Enterprise Visual Header */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#34a1a5]/20">
        <h2 className="text-[16px] font-extrabold text-[#002d2d] tracking-tight">
          Sales Contribution by Brand
        </h2>

        {/* MacBook Glassy Metric & Limit Toggles */}
        <div className="flex items-center gap-2">
          {/* Sales vs Units Toggle */}
          <div className="p-0.5 rounded-xl bg-white/75 backdrop-blur-md border border-[#34a1a5]/25 flex items-center shadow-inner">
            <button
              onClick={() => setMetric('sales')}
              className={`h-6.5 px-2.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                metric === 'sales'
                  ? 'glass-btn-primary shadow-xs'
                  : 'text-[#004c4c] hover:bg-white/80'
              }`}
            >
              Sales (INR)
            </button>
            <button
              onClick={() => setMetric('units')}
              className={`h-6.5 px-2.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                metric === 'units'
                  ? 'glass-btn-primary shadow-xs'
                  : 'text-[#004c4c] hover:bg-white/80'
              }`}
            >
              Units
            </button>
          </div>

          {/* Limit Toggle */}
          <div className="p-0.5 rounded-xl bg-white/75 backdrop-blur-md border border-[#34a1a5]/25 flex items-center shadow-inner">
            {(['4', '6', 'all'] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLimit(l)}
                className={`h-6.5 px-2 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                  limit === l
                    ? 'glass-btn-teal shadow-xs'
                    : 'text-[#1c4b4b] hover:bg-white/80'
                }`}
              >
                {l === 'all' ? 'All' : `Top ${l}`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Active Filter Indication */}
      {activeBrandFilter !== 'All' && (
        <div className="mt-2.5 py-1 px-2.5 bg-[#ffedd5] border border-[#f59e0b]/40 rounded-xl flex items-center justify-between text-[11.5px]">
          <span className="text-[#004c4c] font-bold flex items-center gap-1.5">
            <Filter className="w-3 h-3 text-[#004c4c]" />
            Filtered by: <strong>{activeBrandFilter}</strong>
          </span>
          <button
            onClick={() => onBrandClick(activeBrandFilter)}
            className="text-[11px] text-[#8c1e1c] hover:underline cursor-pointer font-bold"
          >
            Clear filter
          </button>
        </div>
      )}

      {/* Chart Canvas */}
      <div className="flex-1 w-full min-h-[200px] mt-2">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
              onClick={(state: any) => {
                if (state && state.activePayload && state.activePayload.length > 0) {
                  const clickedBrand = state.activePayload[0].payload.name;
                  onBrandClick(clickedBrand);
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(52, 161, 165, 0.15)" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: '#1c4b4b', fontWeight: 600 }}
                axisLine={{ stroke: 'rgba(52, 161, 165, 0.3)' }}
                tickLine={false}
                interval={0}
                tickFormatter={(val) => (val.length > 14 ? `${val.slice(0, 12)}…` : val)}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#1c4b4b', fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => (metric === 'sales' ? formatINR(v) : formatUnits(v))}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload;
                    return (
                      <div className="bg-white/95 backdrop-blur-md text-[#002d2d] text-[12px] rounded-xl shadow-lg p-3.5 border border-[#34a1a5]/30 min-w-[210px]">
                        <div className="font-bold text-[#002d2d] flex items-center justify-between pb-1.5 border-b border-[#34a1a5]/20">
                          <span>#{d.rank} {d.name}</span>
                          <span className="text-[10px] bg-[#ffedd5] px-2 py-0.5 rounded-full text-[#004c4c] font-bold border border-[#f59e0b]/30">
                            {d.category}
                          </span>
                        </div>
                        <div className="mt-2 space-y-1 text-[#1c4b4b]">
                          <div className="flex justify-between">
                            <span>Revenue:</span>
                            <span className="font-bold text-[#002d2d] tabular-nums">{formatINR(d.sales)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Units Sold:</span>
                            <span className="font-semibold text-[#002d2d] tabular-nums">{formatUnits(d.units)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Realization:</span>
                            <span className="font-bold text-[#004c4c] tabular-nums">₹{d.realization}/unit</span>
                          </div>
                          <div className="flex justify-between border-t border-[#34a1a5]/20 pt-1 mt-1">
                            <span>Portfolio Share:</span>
                            <span className="font-bold text-[#004c4c] tabular-nums">{d.shareOfTotal}%</span>
                          </div>
                        </div>
                        <div className="mt-2 text-[10.5px] text-[#004c4c] pt-1 border-t border-[#34a1a5]/20 font-bold">
                          Click bar to filter dashboard
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar
                dataKey={metric === 'sales' ? 'sales' : 'units'}
                radius={[5, 5, 0, 0]}
                cursor="pointer"
              >
                {chartData.map((entry, index) => {
                  const isFiltered = activeBrandFilter !== 'All' && activeBrandFilter === entry.name;
                  const isOtherFiltered = activeBrandFilter !== 'All' && activeBrandFilter !== entry.name;
                  return (
                    <Cell
                      key={`brand-cell-${index}`}
                      fill={isFiltered ? '#ff6b68' : isOtherFiltered ? '#b9dcdb' : '#004c4c'}
                      stroke={isFiltered ? '#8c1e1c' : 'none'}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-[#1c4b4b] text-[12px]">
            No brand data matches current filter selection.
          </div>
        )}
      </div>
    </div>
  );
};
