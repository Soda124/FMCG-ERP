import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  Coins,
  Package,
  Receipt,
  FileCheck2,
} from 'lucide-react';
import { KPISummary } from '../types/fmcg';
import {
  formatINR,
  formatUnits,
  formatNumberFull,
  formatINRFull,
} from '../utils/currencyFormatter';

interface KPICardsProps {
  kpis: KPISummary;
  comparisonMode?: 'month' | 'quarter';
  onToggleComparisonMode?: (mode: 'month' | 'quarter') => void;
}

export const KPICards: React.FC<KPICardsProps> = ({
  kpis,
  comparisonMode = 'month',
  onToggleComparisonMode,
}) => {
  const comparison = kpis.comparison;

  const renderAbsoluteChange = (cardId: string, diff?: number) => {
    if (diff === undefined || isNaN(diff)) return null;
    const sign = diff >= 0 ? '+' : '';
    switch (cardId) {
      case 'sales':
        return `${sign}${formatINR(diff)}`;
      case 'units':
        return `${sign}${formatUnits(diff)}`;
      case 'realization':
        return `${sign}₹${diff.toFixed(2)}`;
      case 'transactions':
        return `${sign}${formatNumberFull(diff)}`;
      default:
        return null;
    }
  };

  // Strictly adhering to the 4 core theme colors:
  // 1. #004c4c (Deep Pine Teal)
  // 2. #34a1a5 (Ocean Teal)
  // 3. #ff6b68 (Coral Rose)
  // 4. #ffedd5 (Warm Cream Accent) with #004c4c deep pine contrast
  const cards = [
    {
      id: 'sales',
      title: 'Total Sales (INR)',
      primaryValue: formatINR(kpis.totalSales),
      fullValue: formatINRFull(kpis.totalSales),
      trend: comparison?.salesTrend,
      metricCode: 'Gross Revenue',
      icon: Coins,
      theme: {
        containerClass:
          'border-l-[5px] border-l-[#004c4c] border-t-2 border-r-2 border-b-2 border-[#004c4c]/30 bg-gradient-to-br from-[#004c4c]/[0.08] via-white/90 to-white shadow-xs hover:border-[#004c4c]/55 hover:shadow-md',
        iconBg: 'bg-[#004c4c] text-white shadow-xs shadow-[#004c4c]/30',
        titleColor: 'text-[#004c4c]',
        valueColor: 'text-[#004c4c]',
        badgeClass: 'bg-[#004c4c]/12 text-[#004c4c] border border-[#004c4c]/35',
        subBorderClass: 'border-[#004c4c]/20',
        activePill: 'bg-[#004c4c]/10 text-[#004c4c]',
      },
    },
    {
      id: 'units',
      title: 'Units Sold',
      primaryValue: formatUnits(kpis.totalUnits),
      fullValue: `${formatNumberFull(kpis.totalUnits)} total units`,
      trend: comparison?.unitsTrend,
      metricCode: 'Dispatched Volume',
      icon: Package,
      theme: {
        containerClass:
          'border-l-[5px] border-l-[#34a1a5] border-t-2 border-r-2 border-b-2 border-[#34a1a5]/35 bg-gradient-to-br from-[#34a1a5]/[0.10] via-white/90 to-white shadow-xs hover:border-[#34a1a5]/60 hover:shadow-md',
        iconBg: 'bg-[#34a1a5] text-white shadow-xs shadow-[#34a1a5]/30',
        titleColor: 'text-[#003d42]',
        valueColor: 'text-[#003d42]',
        badgeClass: 'bg-[#34a1a5]/20 text-[#004c4c] border border-[#34a1a5]/40',
        subBorderClass: 'border-[#34a1a5]/25',
        activePill: 'bg-[#34a1a5]/15 text-[#003d42]',
      },
    },
    {
      id: 'realization',
      title: 'Average Realization',
      primaryValue: `₹${kpis.avgRealization.toFixed(2)}`,
      fullValue: `₹${kpis.avgRealization.toFixed(2)} net realization per unit`,
      trend: comparison?.realizationTrend,
      metricCode: 'Sales ÷ Units',
      icon: Receipt,
      theme: {
        containerClass:
          'border-l-[5px] border-l-[#ff6b68] border-t-2 border-r-2 border-b-2 border-[#ff6b68]/40 bg-gradient-to-br from-[#ff6b68]/[0.10] via-[#ffedd5]/30 to-white shadow-xs hover:border-[#ff6b68]/65 hover:shadow-md',
        iconBg: 'bg-[#ff6b68] text-white shadow-xs shadow-[#ff6b68]/30',
        titleColor: 'text-[#8c1e1c]',
        valueColor: 'text-[#8c1e1c]',
        badgeClass: 'bg-[#ff6b68]/20 text-[#8c1e1c] border border-[#ff6b68]/40',
        subBorderClass: 'border-[#ff6b68]/25',
        activePill: 'bg-[#ff6b68]/15 text-[#8c1e1c]',
      },
    },
    {
      id: 'transactions',
      title: 'Transaction Count',
      primaryValue: formatNumberFull(kpis.totalTransactions),
      fullValue: `${formatNumberFull(kpis.totalTransactions)} dispatch orders`,
      trend: comparison?.transactionsTrend,
      metricCode: 'Order Records',
      icon: FileCheck2,
      theme: {
        // Strict theme color #ffedd5 (cream) paired with deep teal #004c4c
        containerClass:
          'border-l-[5px] border-l-[#004c4c] border-t-2 border-r-2 border-b-2 border-[#ffedd5]/90 bg-gradient-to-br from-[#ffedd5]/85 via-white/90 to-white shadow-xs hover:border-[#34a1a5]/50 hover:shadow-md',
        iconBg: 'bg-[#004c4c] text-[#ffedd5] shadow-xs shadow-[#004c4c]/30',
        titleColor: 'text-[#004c4c]',
        valueColor: 'text-[#002d2d]',
        badgeClass: 'bg-[#ffedd5] text-[#004c4c] border border-[#004c4c]/30',
        subBorderClass: 'border-[#004c4c]/15',
        activePill: 'bg-[#ffedd5] text-[#004c4c]',
      },
    },
  ];

  return (
    <div className="flex flex-col gap-2.5">
      {/* Benchmark Period Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-[#1c4b4b] px-0.5">
        <div className="flex items-center gap-1.5 font-medium">
          <Calendar className="w-3.5 h-3.5 text-[#004c4c]" />
          <span className="text-[#002d2d] font-bold">Comparison Baseline:</span>
          {comparison && (
            <span className="text-[#004c4c] font-semibold bg-white/85 px-2.5 py-0.5 rounded-md border border-[#34a1a5]/35 text-[11px] tabular-nums shadow-2xs">
              vs dataset for {comparison.priorPeriodLabel}
            </span>
          )}
        </div>

        {onToggleComparisonMode && (
          <div className="p-1 rounded-xl bg-white/70 backdrop-blur-md border border-[#34a1a5]/25 flex items-center shadow-inner">
            <button
              onClick={() => onToggleComparisonMode('month')}
              className={`px-3 py-1 rounded-lg text-[11.5px] font-bold transition-all duration-200 cursor-pointer ${
                comparisonMode === 'month'
                  ? 'glass-btn-primary shadow-sm'
                  : 'text-[#004c4c] hover:bg-white/80'
              }`}
            >
              vs Previous Month
            </button>
            <button
              onClick={() => onToggleComparisonMode('quarter')}
              className={`px-3 py-1 rounded-lg text-[11.5px] font-bold transition-all duration-200 cursor-pointer ${
                comparisonMode === 'quarter'
                  ? 'glass-btn-primary shadow-sm'
                  : 'text-[#004c4c] hover:bg-white/80'
              }`}
            >
              vs Previous Quarter
            </button>
          </div>
        )}
      </div>

      {/* KPI 4 Cards Grid - Differentiated within Allowed Color Palette */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          const trend = card.trend;
          const isPositive = trend?.isPositive ?? false;
          const pct = trend?.pctChange ?? 0;
          const isFlat = pct === 0;

          return (
            <div
              key={card.id}
              className={`relative rounded-2xl p-4 transition-all duration-200 backdrop-blur-md flex flex-col justify-between ${card.theme.containerClass}`}
            >
              <div>
                {/* Header: Title + Badge + Icon */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex flex-col">
                    <span
                      className={`text-[10px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded w-fit mb-1 ${card.theme.badgeClass}`}
                    >
                      {card.metricCode}
                    </span>
                    <h3 className={`text-[13px] font-bold ${card.theme.titleColor}`}>
                      {card.title}
                    </h3>
                  </div>

                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 hover:scale-105 ${card.theme.iconBg}`}
                  >
                    <Icon className="w-4.5 h-4.5" />
                  </div>
                </div>

                {/* Primary Metric Value */}
                <div className="my-1">
                  <div
                    className={`text-[25px] sm:text-[27px] font-extrabold tracking-tight tabular-nums leading-none ${card.theme.valueColor}`}
                    title={card.fullValue}
                  >
                    {card.primaryValue}
                  </div>
                  <div className="text-[10.5px] text-[#1c4b4b] mt-1 font-medium truncate">
                    {card.fullValue}
                  </div>
                </div>
              </div>

              {/* Bottom: Trend Badge vs Prior Period */}
              <div
                className={`pt-2.5 mt-2 border-t ${card.theme.subBorderClass} flex items-center justify-between text-[11px]`}
              >
                {trend ? (
                  <>
                    <div className="flex items-center gap-1">
                      <span
                        className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded font-bold tabular-nums text-[10.5px] ${
                          isFlat
                            ? 'bg-neutral-100 text-neutral-700'
                            : isPositive
                            ? 'bg-[#004c4c]/15 text-[#004c4c]'
                            : 'bg-[#ff6b68]/20 text-[#8c1e1c]'
                        }`}
                      >
                        {isFlat ? (
                          <Minus className="w-3 h-3" />
                        ) : isPositive ? (
                          <TrendingUp className="w-3 h-3 text-[#004c4c]" />
                        ) : (
                          <TrendingDown className="w-3 h-3 text-[#ff6b68]" />
                        )}
                        <span>{Math.abs(pct).toFixed(1)}%</span>
                      </span>

                      {trend.absoluteDiff !== undefined && (
                        <span className="text-[10px] text-[#1c4b4b] font-semibold tabular-nums hidden xl:inline">
                          ({renderAbsoluteChange(card.id, trend.absoluteDiff)})
                        </span>
                      )}
                    </div>

                    <span className="text-[10.5px] text-[#1c4b4b] font-medium tabular-nums text-right">
                      Prior: {trend.formattedPrior}
                    </span>
                  </>
                ) : (
                  <span className="text-[10px] text-[#1c4b4b]">No prior comparison data</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
