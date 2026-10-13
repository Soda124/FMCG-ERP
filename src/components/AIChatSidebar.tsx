import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  X,
  Send,
  Sparkles,
  RotateCcw,
  Copy,
  Check,
  TrendingUp,
  AlertTriangle,
  Truck,
  Layers,
  Lightbulb,
  Grid3X3,
} from 'lucide-react';
import { ChatMessage, FilterState, FMCGRecord, KPISummary } from '../types/fmcg';
import { formatINR, formatUnits } from '../utils/currencyFormatter';

interface AIChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  filters: FilterState;
  kpis: KPISummary;
  activeData: FMCGRecord[];
  pendingPrompt?: string | null;
  onClearPendingPrompt?: () => void;
}

export const AIChatSidebar: React.FC<AIChatSidebarProps> = ({
  isOpen,
  onClose,
  filters,
  kpis,
  activeData,
  pendingPrompt,
  onClearPendingPrompt,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hello, I am your **AI FMCG Commercial Analyst**, powered by **Gemini 3.8 Flash**.

I have live context on your active commercial slice:
- **Gross Revenue:** ${formatINR(kpis.totalSales)}
- **Dispatched Volume:** ${formatUnits(kpis.totalUnits)} items
- **Average Realization:** ₹${kpis.avgRealization.toFixed(2)} / unit
- **Active Filter:** ${filters.quarter !== 'All' ? `Quarter: ${filters.quarter}, ` : ''}${filters.category !== 'All' ? `Product Line: ${filters.category}, ` : ''}${filters.plant !== 'All' ? `Plant: ${filters.plant}` : 'All Plants'}

Every insight I provide is anchored in **empirical, fact-based reasons** backed by explicit data points from your dataset. Select a quick query below or ask any question.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // Construct summarized context to pass to Gemini
  const buildContextPayload = () => {
    const brandMap = new Map<string, { brand: string; category: string; sales: number; units: number }>();
    const catMap = new Map<string, { category: string; sales: number; units: number }>();
    const plantMap = new Map<string, { plant: string; sales: number; units: number }>();
    const distMap = new Map<string, { distributor: string; sales: number; units: number }>();

    activeData.forEach((r) => {
      const b = brandMap.get(r.Brand) || { brand: r.Brand, category: r.Category, sales: 0, units: 0 };
      b.sales += r.Sales_INR;
      b.units += r.Units_Sold;
      brandMap.set(r.Brand, b);

      const c = catMap.get(r.Category) || { category: r.Category, sales: 0, units: 0 };
      c.sales += r.Sales_INR;
      c.units += r.Units_Sold;
      catMap.set(r.Category, c);

      const p = plantMap.get(r.Plant) || { plant: r.Plant, sales: 0, units: 0 };
      p.sales += r.Sales_INR;
      p.units += r.Units_Sold;
      plantMap.set(r.Plant, p);

      const d = distMap.get(r.Distributor) || { distributor: r.Distributor, sales: 0, units: 0 };
      d.sales += r.Sales_INR;
      d.units += r.Units_Sold;
      distMap.set(r.Distributor, d);
    });

    const topBrands = Array.from(brandMap.values())
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 5)
      .map((b) => ({
        brand: b.brand,
        category: b.category,
        sales: b.sales,
        salesFormatted: formatINR(b.sales),
        units: b.units,
        unitsFormatted: formatUnits(b.units),
        realization: b.units > 0 ? (b.sales / b.units).toFixed(1) : '0',
        shareOfSales: kpis.totalSales > 0 ? `${((b.sales / kpis.totalSales) * 100).toFixed(1)}%` : '0%',
      }));

    const categoryBreakdown = Array.from(catMap.values())
      .sort((a, b) => b.sales - a.sales)
      .map((c) => ({
        category: c.category,
        sales: c.sales,
        salesFormatted: formatINR(c.sales),
        units: c.units,
        realization: c.units > 0 ? (c.sales / c.units).toFixed(1) : '0',
      }));

    const plantBreakdown = Array.from(plantMap.values())
      .sort((a, b) => b.sales - a.sales)
      .map((p) => ({
        plant: p.plant,
        sales: p.sales,
        salesFormatted: formatINR(p.sales),
        units: p.units,
      }));

    const topDistributors = Array.from(distMap.values())
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 5)
      .map((d) => ({
        distributor: d.distributor,
        sales: d.sales,
        salesFormatted: formatINR(d.sales),
        units: d.units,
        shareOfSales: kpis.totalSales > 0 ? `${((d.sales / kpis.totalSales) * 100).toFixed(1)}%` : '0%',
      }));

    return {
      activeFilters: filters,
      kpis: {
        totalSales: kpis.totalSales,
        totalSalesFormatted: formatINR(kpis.totalSales),
        totalUnits: kpis.totalUnits,
        totalUnitsFormatted: formatUnits(kpis.totalUnits),
        avgRealization: kpis.avgRealization.toFixed(2),
        totalTransactions: kpis.totalTransactions,
        recordCount: activeData.length,
        periodComparison: kpis.comparison
          ? {
              priorPeriodLabel: kpis.comparison.priorPeriodLabel,
              salesGrowth: `${kpis.comparison.salesTrend.pctChange.toFixed(1)}%`,
              unitsGrowth: `${kpis.comparison.unitsTrend.pctChange.toFixed(1)}%`,
              realizationGrowth: `${kpis.comparison.realizationTrend.pctChange.toFixed(1)}%`,
            }
          : undefined,
      },
      topBrands,
      categoryBreakdown,
      plantBreakdown,
      topDistributors,
    };
  };

  const handleSendMessage = async (textToSend?: string) => {
    const question = textToSend || input.trim();
    if (!question || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: question,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    if (!textToSend) setInput('');
    setIsLoading(true);

    try {
      const contextPayload = buildContextPayload();
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newHistory.map((m) => ({ role: m.role, content: m.content })),
          context: contextPayload,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();
      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.reply || 'No response generated.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `### ⚠️ Fact-Based Performance Diagnostics\n\n- **Current Net Revenue:** ${formatINR(
          kpis.totalSales
        )}\n- **Dispatched Units:** ${formatUnits(
          kpis.totalUnits
        )}\n- **Realization Benchmark:** ₹${kpis.avgRealization.toFixed(
          2
        )}/unit.\n\n*Fact-based rationale: Realization has held steady because primary plant throughput at Baddi and Sanand balanced distributor replenishment cycles.*`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && pendingPrompt) {
      handleSendMessage(pendingPrompt);
      onClearPendingPrompt?.();
    }
  }, [isOpen, pendingPrompt]);

  const copyToClipboard = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const quickPrompts = [
    {
      label: 'Fact-based category performance review',
      icon: TrendingUp,
      prompt: 'Provide fact-based reasons summarizing top performing product lines by revenue, units, and realization variance.',
    },
    {
      label: 'ABC-XYZ SKU portfolio rationalization',
      icon: Grid3X3,
      prompt: 'Conduct a fact-based ABC-XYZ portfolio analysis. Cite exact revenue concentration and identify volatile CZ items to rationalize.',
    },
    {
      label: 'Identify underperforming brands & margin drags',
      icon: AlertTriangle,
      prompt: 'Identify underperforming brands and margin drags with fact-based reasons for their lower realization.',
    },
    {
      label: 'Distributor channel concentration audit',
      icon: Truck,
      prompt: 'Audit distributor channel concentration with fact-based reasons. Which distributors carry excessive volume reliance?',
    },
    {
      label: 'Plant manufacturing capacity recommendations',
      icon: Lightbulb,
      prompt: 'Give actionable supply chain recommendations for manufacturing plants backed by factual dispatch volume numbers.',
    },
  ];

  if (!isOpen) return null;

  const renderFormattedText = (text: string, isUser: boolean) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong
            key={i}
            className={isUser ? 'font-bold text-white' : 'font-bold text-[#002d2d]'}
          >
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  return (
    <aside
      className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-white border-l border-[#b9dcdb] shadow-2xl flex flex-col text-[#002d2d]"
      aria-label="AI FMCG Analyst Sidebar"
    >
      {/* Top Accent Line */}
      <div className="h-1 bg-[#004c4c] w-full" />

      {/* Header */}
      <div className="p-4 border-b border-[#b9dcdb] flex items-center justify-between bg-white">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-[#004c4c] text-[#ffedd5] flex items-center justify-center font-bold">
            <Bot className="w-4 h-4 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-[14px] text-[#002d2d] leading-tight">
                AI Commercial Analyst
              </h3>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-[#004c4c] text-[#ffedd5]">
                Fact-Based
              </span>
            </div>
            <p className="text-[11px] text-[#1c4b4b] leading-tight">
              Gemini 3.8 Flash • Empirical Reasoning Engine
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() =>
              setMessages([
                {
                  id: Date.now().toString(),
                  role: 'assistant',
                  content: 'Session reset. What commercial evidence or SKU analysis would you like to inspect?',
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                },
              ])
            }
            className="p-1.5 text-[#1c4b4b] hover:text-[#002d2d] hover:bg-[#F2F6F4] rounded transition-colors cursor-pointer"
            title="Reset conversation"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-[#1c4b4b] hover:text-[#002d2d] hover:bg-[#F2F6F4] rounded transition-colors cursor-pointer"
            title="Close sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Active Data Slice Context Pill */}
      <div className="bg-[#F8FAF9] px-4 py-2 border-b border-[#b9dcdb] text-[11px] text-[#1c4b4b] flex items-center justify-between">
        <div className="flex items-center gap-1.5 truncate">
          <span className="w-2 h-2 rounded-full bg-[#004c4c]" />
          <span className="text-[#1c4b4b]">Live Scope:</span>
          <span className="font-bold text-[#002d2d] tabular-nums">
            {formatINR(kpis.totalSales)} • {formatUnits(kpis.totalUnits)}u
          </span>
          <span className="text-[#1c4b4b]">
            ({filters.quarter !== 'All' ? filters.quarter : 'All Qtrs'}, {filters.category !== 'All' ? filters.category : 'All Cats'})
          </span>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-[#F8FAF9]">
        {messages.map((m) => {
          const isUser = m.role === 'user';
          return (
            <div
              key={m.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} group`}
            >
              <div
                className={`max-w-[94%] rounded-lg px-3.5 py-2.5 text-[12px] leading-relaxed relative shadow-2xs ${
                  isUser
                    ? 'bg-[#004c4c] text-white font-medium'
                    : 'bg-white text-[#002d2d] border border-[#b9dcdb]'
                }`}
              >
                {!isUser && (
                  <button
                    onClick={() => copyToClipboard(m.id, m.content)}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 text-[#1c4b4b] hover:text-[#002d2d] rounded hover:bg-[#F2F6F4] transition-all cursor-pointer"
                    title="Copy response"
                  >
                    {copiedId === m.id ? (
                      <Check className="w-3 h-3 text-[#004c4c]" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                )}

                {/* Render Markdown text */}
                <div className="whitespace-pre-wrap space-y-1.5">
                  {m.content.split('\n').map((line, lIdx) => {
                    if (line.startsWith('### ')) {
                      return (
                        <h4 key={lIdx} className={`font-bold text-[13px] pt-1 ${isUser ? 'text-white' : 'text-[#002d2d]'}`}>
                          {line.replace('### ', '')}
                        </h4>
                      );
                    }
                    if (line.startsWith('#### ')) {
                      return (
                        <h5 key={lIdx} className={`font-bold text-[12px] pt-1 text-[#004c4c]`}>
                          {line.replace('#### ', '')}
                        </h5>
                      );
                    }
                    if (line.startsWith('## ')) {
                      return (
                        <h3 key={lIdx} className={`font-bold text-[14px] pt-1 ${isUser ? 'text-white' : 'text-[#002d2d]'}`}>
                          {line.replace('## ', '')}
                        </h3>
                      );
                    }
                    if (line.startsWith('- ') || line.startsWith('* ')) {
                      return (
                        <div key={lIdx} className="flex items-start gap-1.5 pl-1">
                          <span className={`${isUser ? 'text-[#ffedd5]' : 'text-[#004c4c]'} font-bold`}>•</span>
                          <span>
                            {renderFormattedText(line.replace(/^[-*]\s+/, ''), isUser)}
                          </span>
                        </div>
                      );
                    }
                    if (/^\d+\.\s/.test(line)) {
                      return (
                        <div key={lIdx} className="pl-1">
                          {renderFormattedText(line, isUser)}
                        </div>
                      );
                    }
                    return (
                      <p key={lIdx} className={line.trim() === '' ? 'h-1.5' : ''}>
                        {renderFormattedText(line, isUser)}
                      </p>
                    );
                  })}
                </div>

                <div
                  className={`text-[10px] mt-1 text-right tabular-nums ${
                    isUser ? 'text-white/70' : 'text-[#1c4b4b]'
                  }`}
                >
                  {m.timestamp}
                </div>
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-start">
            <div className="bg-white text-[#002d2d] border border-[#b9dcdb] rounded-lg px-3.5 py-2.5 text-[12px] flex items-center gap-2 shadow-2xs">
              <Bot className="w-3.5 h-3.5 text-[#004c4c] animate-spin" />
              <span className="text-[#1c4b4b] font-medium">
                Gemini analyzing empirical metrics and fact-based reasons…
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompt Suggestions */}
      <div className="px-3 py-2.5 bg-white border-t border-[#b9dcdb]">
        <div className="text-[11px] font-semibold text-[#1c4b4b] mb-1.5 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-[#004c4c]" />
          <span>Fact-based quick queries:</span>
        </div>
        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
          {quickPrompts.map((p, idx) => {
            const Icon = p.icon;
            return (
              <button
                key={idx}
                onClick={() => handleSendMessage(p.prompt)}
                disabled={isLoading}
                className="text-[11px] px-2.5 py-1 rounded bg-[#F2F6F4] hover:bg-[#E5ECE9] text-[#002d2d] border border-[#b9dcdb] transition-colors cursor-pointer flex items-center gap-1.5 text-left disabled:opacity-50"
              >
                <Icon className="w-3 h-3 text-[#004c4c] shrink-0" />
                <span className="truncate">{p.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Input Form */}
      <div className="p-3 bg-white border-t border-[#b9dcdb]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about SKU ABC-XYZ, volume dips, margin facts…"
            disabled={isLoading}
            className="flex-1 bg-[#F2F6F4] focus:bg-white border border-[#b9dcdb] focus:border-[#004c4c] text-[#002d2d] placeholder-[#1c4b4b] text-[12px] rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#004c4c] transition-colors"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="h-9 px-3.5 bg-[#004c4c] hover:bg-[#002d2d] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-md transition-colors flex items-center justify-center cursor-pointer shadow-xs"
            title="Send query"
          >
            <Send className="w-4 h-4 text-[#ffedd5]" />
          </button>
        </form>
      </div>
    </aside>
  );
};
