import React from 'react';
import { FMCGRecord } from '../types/fmcg';
import { formatINR, formatUnits } from '../utils/currencyFormatter';
import { Check, Filter, Factory, Truck } from 'lucide-react';

interface VisualSupplyChainMatrixProps {
  data: FMCGRecord[];
  activePlantFilter: string;
  activeDistributorFilter: string;
  onPlantClick: (plant: string) => void;
  onDistributorClick: (distributor: string) => void;
}

export const VisualSupplyChainMatrix: React.FC<VisualSupplyChainMatrixProps> = ({
  data,
  activePlantFilter,
  activeDistributorFilter,
  onPlantClick,
  onDistributorClick,
}) => {
  // Aggregate Plants
  const plantMap = new Map<string, { plant: string; sales: number; units: number; count: number }>();
  // Aggregate Distributors
  const distMap = new Map<string, { distributor: string; sales: number; units: number; count: number }>();

  let totalSales = 0;
  let totalUnits = 0;

  data.forEach((r) => {
    totalSales += r.Sales_INR;
    totalUnits += r.Units_Sold;

    const p = plantMap.get(r.Plant) || { plant: r.Plant, sales: 0, units: 0, count: 0 };
    p.sales += r.Sales_INR;
    p.units += r.Units_Sold;
    p.count += r.Transaction_Rows;
    plantMap.set(r.Plant, p);

    const d = distMap.get(r.Distributor) || { distributor: r.Distributor, sales: 0, units: 0, count: 0 };
    d.sales += r.Sales_INR;
    d.units += r.Units_Sold;
    d.count += r.Transaction_Rows;
    distMap.set(r.Distributor, d);
  });

  const plantList = Array.from(plantMap.values()).sort((a, b) => b.sales - a.sales);
  const distList = Array.from(distMap.values()).sort((a, b) => b.sales - a.sales);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Panel 1: Manufacturing Contribution by Plant */}
      <div className="glass-panel rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-sm">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-[#34a1a5]/20">
            <div>
              <h3 className="text-[15px] font-extrabold text-[#002d2d] flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#004c4c] text-white flex items-center justify-center">
                  <Factory className="w-4 h-4" />
                </div>
                <span>Manufacturing Hub Sourcing</span>
              </h3>
              <p className="text-[11.5px] text-[#1c4b4b] font-medium mt-0.5">
                8 dedicated plants (2 per product line) • Click plant to filter
              </p>
            </div>
            <span className="text-[11px] font-bold text-[#004c4c] bg-[#ffedd5] px-2.5 py-1 rounded-full border border-[#f59e0b]/30">
              {plantList.length} Plants Active
            </span>
          </div>

          <div className="mt-3 space-y-2 max-h-[380px] overflow-y-auto pr-1">
            {plantList.map((p) => {
              const share = totalSales > 0 ? (p.sales / totalSales) * 100 : 0;
              const isSelected = activePlantFilter === p.plant;
              const realization = p.units > 0 ? (p.sales / p.units).toFixed(1) : '0';

              return (
                <div
                  key={p.plant}
                  onClick={() => onPlantClick(p.plant)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-[#004c4c] bg-[#ffedd5]/60 shadow-sm ring-1 ring-[#004c4c]'
                      : 'border-[#34a1a5]/20 hover:border-[#34a1a5]/60 hover:bg-white/80 bg-white/60'
                  }`}
                >
                  <div className="flex items-center justify-between text-[12px] mb-1.5">
                    <span className="font-bold text-[#002d2d] flex items-center gap-1.5">
                      {isSelected && <Check className="w-3.5 h-3.5 text-[#004c4c] stroke-[2.5]" />}
                      <span>{p.plant}</span>
                    </span>
                    <div className="text-right">
                      <span className="font-extrabold text-[#002d2d] tabular-nums">{formatINR(p.sales)}</span>
                      <span className="text-[#1c4b4b] text-[11px] ml-1.5 font-bold tabular-nums">({share.toFixed(1)}%)</span>
                    </div>
                  </div>

                  {/* Horizontal Contribution Bar */}
                  <div className="w-full bg-[#34a1a5]/15 h-2 rounded-full overflow-hidden border border-[#34a1a5]/20">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isSelected ? 'bg-[#ff6b68]' : 'bg-[#004c4c]'
                      }`}
                      style={{ width: `${Math.min(100, share)}%` }}
                    />
                  </div>

                  <div className="flex justify-between items-center text-[11px] text-[#1c4b4b] mt-1.5 font-medium">
                    <span className="tabular-nums">Dispatched: <strong className="text-[#002d2d]">{formatUnits(p.units)}</strong> units</span>
                    <span className="tabular-nums text-[#004c4c] font-bold">₹{realization}/unit</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {activePlantFilter !== 'All' && (
          <div className="mt-3 pt-2.5 border-t border-[#34a1a5]/20 flex items-center justify-between text-[11.5px]">
            <span className="text-[#004c4c] font-bold flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5" /> Filtered to: {activePlantFilter}
            </span>
            <button
              onClick={() => onPlantClick(activePlantFilter)}
              className="glass-btn-coral px-2.5 py-0.5 text-[10.5px]"
            >
              Clear plant filter
            </button>
          </div>
        )}
      </div>

      {/* Panel 2: Distributor Sales and Channel Volume */}
      <div className="glass-panel rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-sm">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-[#34a1a5]/20">
            <div>
              <h3 className="text-[15px] font-extrabold text-[#002d2d] flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#34a1a5] text-white flex items-center justify-center">
                  <Truck className="w-4 h-4" />
                </div>
                <span>Distributor Channel Volume</span>
              </h3>
              <p className="text-[11.5px] text-[#1c4b4b] font-medium mt-0.5">
                13 regional distributors (each handling ≥ 140 SKUs) • Click channel to filter
              </p>
            </div>
            <span className="text-[11px] font-bold text-[#004c4c] bg-[#ffedd5] px-2.5 py-1 rounded-full border border-[#f59e0b]/30">
              {distList.length} Channels Active
            </span>
          </div>

          <div className="mt-3 space-y-2 max-h-[380px] overflow-y-auto pr-1">
            {distList.map((d) => {
              const share = totalSales > 0 ? (d.sales / totalSales) * 100 : 0;
              const isSelected = activeDistributorFilter === d.distributor;
              const realization = d.units > 0 ? (d.sales / d.units).toFixed(1) : '0';

              return (
                <div
                  key={d.distributor}
                  onClick={() => onDistributorClick(d.distributor)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-[#004c4c] bg-[#ffedd5]/60 shadow-sm ring-1 ring-[#004c4c]'
                      : 'border-[#34a1a5]/20 hover:border-[#34a1a5]/60 hover:bg-white/80 bg-white/60'
                  }`}
                >
                  <div className="flex items-center justify-between text-[12px] mb-1.5">
                    <span className="font-bold text-[#002d2d] flex items-center gap-1.5 truncate max-w-[240px]">
                      {isSelected && <Check className="w-3.5 h-3.5 text-[#004c4c] stroke-[2.5]" />}
                      <span className="truncate">{d.distributor}</span>
                    </span>
                    <div className="text-right shrink-0">
                      <span className="font-extrabold text-[#002d2d] tabular-nums">{formatINR(d.sales)}</span>
                      <span className="text-[#1c4b4b] text-[11px] ml-1.5 font-bold tabular-nums">({share.toFixed(1)}%)</span>
                    </div>
                  </div>

                  {/* Horizontal Contribution Bar */}
                  <div className="w-full bg-[#34a1a5]/15 h-2 rounded-full overflow-hidden border border-[#34a1a5]/20">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isSelected ? 'bg-[#ff6b68]' : 'bg-[#34a1a5]'
                      }`}
                      style={{ width: `${Math.min(100, share)}%` }}
                    />
                  </div>

                  <div className="flex justify-between items-center text-[11px] text-[#1c4b4b] mt-1.5 font-medium">
                    <span className="tabular-nums">Dispatched: <strong className="text-[#002d2d]">{formatUnits(d.units)}</strong> units</span>
                    <span className="tabular-nums text-[#004c4c] font-bold">Avg ₹{realization}/u</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {activeDistributorFilter !== 'All' && (
          <div className="mt-3 pt-2.5 border-t border-[#34a1a5]/20 flex items-center justify-between text-[11.5px]">
            <span className="text-[#004c4c] font-bold flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5" /> Filtered to: {activeDistributorFilter}
            </span>
            <button
              onClick={() => onDistributorClick(activeDistributorFilter)}
              className="glass-btn-coral px-2.5 py-0.5 text-[10.5px]"
            >
              Clear distributor filter
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
