import React, { useState, useMemo } from 'react';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  Search,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Bot,
  Filter,
} from 'lucide-react';
import { FMCGRecord } from '../types/fmcg';
import { formatINR, formatUnits, formatNumberFull } from '../utils/currencyFormatter';
import { exportDatasetToCSV } from '../utils/fileParser';
import { RecordDetailModal } from './RecordDetailModal';

interface VisualDataTableProps {
  data: FMCGRecord[];
  onFilterBrand: (brand: string) => void;
  onFilterPlant: (plant: string) => void;
  onAskAI: (prompt: string) => void;
}

type SortField =
  | 'Category'
  | 'Brand'
  | 'SKU'
  | 'Month'
  | 'Plant'
  | 'Distributor'
  | 'Units_Sold'
  | 'Sales_INR'
  | 'Realization'
  | 'Transaction_Rows';

type SortDirection = 'asc' | 'desc';

export const VisualDataTable: React.FC<VisualDataTableProps> = ({
  data,
  onFilterBrand,
  onFilterPlant,
  onAskAI,
}) => {
  const [sortField, setSortField] = useState<SortField>('Sales_INR');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(15);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Selected Record for Detail Modal
  const [selectedRecord, setSelectedRecord] = useState<FMCGRecord | null>(null);

  // Search filter inside table
  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return data;
    const q = searchTerm.toLowerCase();
    return data.filter(
      (r) =>
        r.Category.toLowerCase().includes(q) ||
        r.Brand.toLowerCase().includes(q) ||
        (r.SKU && r.SKU.toLowerCase().includes(q)) ||
        r.Plant.toLowerCase().includes(q) ||
        r.Distributor.toLowerCase().includes(q) ||
        r.Month.toLowerCase().includes(q) ||
        r.Quarter.toLowerCase().includes(q)
    );
  }, [data, searchTerm]);

  // Sort handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setPage(1);
  };

  // Sorted data
  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      let valA: any = a[sortField as keyof FMCGRecord] ?? '';
      let valB: any = b[sortField as keyof FMCGRecord] ?? '';

      if (sortField === 'Realization') {
        valA = a.Units_Sold > 0 ? a.Sales_INR / a.Units_Sold : 0;
        valB = b.Units_Sold > 0 ? b.Sales_INR / b.Units_Sold : 0;
      }

      if (typeof valA === 'string') {
        const cmp = valA.localeCompare(valB);
        return sortDirection === 'asc' ? cmp : -cmp;
      }
      return sortDirection === 'asc' ? valA - valB : valB - valA;
    });
  }, [filteredData, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  // Aggregate totals
  const totalUnits = useMemo(() => filteredData.reduce((acc, r) => acc + r.Units_Sold, 0), [filteredData]);
  const totalSales = useMemo(() => filteredData.reduce((acc, r) => acc + r.Sales_INR, 0), [filteredData]);
  const avgRealization = totalUnits > 0 ? totalSales / totalUnits : 0;
  const totalTransactions = useMemo(() => filteredData.reduce((acc, r) => acc + r.Transaction_Rows, 0), [filteredData]);
  const uniqueBrandsCount = useMemo(() => new Set(filteredData.map((r) => r.Brand)).size, [filteredData]);

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-[#1c4b4b]/50 group-hover:text-[#1c4b4b]" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-[#004c4c] stroke-[2.5]" />
    ) : (
      <ArrowDown className="w-3 h-3 text-[#004c4c] stroke-[2.5]" />
    );
  };

  return (
    <div className="bg-white rounded-lg border border-[#b9dcdb] flex flex-col overflow-hidden shadow-2xs">
      {/* Enterprise Table Header Toolbar */}
      <div className="p-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#b9dcdb]">
        <div>
          <h2 className="text-[15px] font-bold text-[#002d2d] tracking-tight">
            Commercial Ledger & SKU Line Detail
          </h2>
          <p className="text-[12px] text-[#1c4b4b]">
            Showing {filteredData.length.toLocaleString()} transaction records across {uniqueBrandsCount} brand lines • Click any row for record details
          </p>
        </div>

        {/* Controls: Search, Page Size, Export */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Table Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search table..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="h-8 w-44 sm:w-52 bg-[#F2F6F4] focus:bg-white border border-[#b9dcdb] focus:border-[#004c4c] text-[#002d2d] placeholder-[#1c4b4b] text-[12px] rounded-md pl-7 pr-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-[#004c4c] transition-colors"
            />
            <Search className="w-3.5 h-3.5 text-[#1c4b4b] absolute left-2 top-2.5 pointer-events-none" />
          </div>

          {/* Rows per page selector */}
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="h-8 bg-[#F2F6F4] hover:bg-white border border-[#b9dcdb] text-[#002d2d] text-[12px] rounded-md px-2 py-1 font-medium focus:outline-none focus:ring-1 focus:ring-[#004c4c] cursor-pointer"
          >
            <option value={10}>10 rows</option>
            <option value={15}>15 rows</option>
            <option value={25}>25 rows</option>
            <option value={50}>50 rows</option>
          </select>

          {/* Export CSV */}
          <button
            onClick={() => exportDatasetToCSV(sortedData, 'FMCG_Commercial_Ledger.csv')}
            className="h-8 px-2.5 rounded-md bg-white hover:bg-[#F2F6F4] text-[#002d2d] border border-[#b9dcdb] text-[12px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Download visible table rows as CSV"
          >
            <Download className="w-3.5 h-3.5 text-[#1c4b4b]" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[12px] border-collapse">
          <thead>
            <tr className="border-b border-[#b9dcdb] text-[#1c4b4b] font-bold bg-[#F2F6F4] select-none">
              <th
                onClick={() => handleSort('Category')}
                className="py-2.5 px-3 cursor-pointer group hover:bg-[#E5ECE9] transition-colors"
              >
                <div className="flex items-center gap-1">
                  <span>Product Line</span>
                  {renderSortIcon('Category')}
                </div>
              </th>
              <th
                onClick={() => handleSort('Brand')}
                className="py-2.5 px-3 cursor-pointer group hover:bg-[#E5ECE9] transition-colors"
              >
                <div className="flex items-center gap-1">
                  <span>Brand</span>
                  {renderSortIcon('Brand')}
                </div>
              </th>
              <th
                onClick={() => handleSort('SKU')}
                className="py-2.5 px-3 cursor-pointer group hover:bg-[#E5ECE9] transition-colors hidden xl:table-cell"
              >
                <div className="flex items-center gap-1">
                  <span>SKU Variant</span>
                  {renderSortIcon('SKU')}
                </div>
              </th>
              <th
                onClick={() => handleSort('Month')}
                className="py-2.5 px-3 cursor-pointer group hover:bg-[#E5ECE9] transition-colors"
              >
                <div className="flex items-center gap-1">
                  <span>Month (Qtr)</span>
                  {renderSortIcon('Month')}
                </div>
              </th>
              <th
                onClick={() => handleSort('Plant')}
                className="py-2.5 px-3 cursor-pointer group hover:bg-[#E5ECE9] transition-colors hidden md:table-cell"
              >
                <div className="flex items-center gap-1">
                  <span>Plant</span>
                  {renderSortIcon('Plant')}
                </div>
              </th>
              <th
                onClick={() => handleSort('Distributor')}
                className="py-2.5 px-3 cursor-pointer group hover:bg-[#E5ECE9] transition-colors hidden lg:table-cell"
              >
                <div className="flex items-center gap-1">
                  <span>Distributor</span>
                  {renderSortIcon('Distributor')}
                </div>
              </th>
              <th
                onClick={() => handleSort('Units_Sold')}
                className="py-2.5 px-3 text-right cursor-pointer group hover:bg-[#E5ECE9] transition-colors"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Units Sold</span>
                  {renderSortIcon('Units_Sold')}
                </div>
              </th>
              <th
                onClick={() => handleSort('Sales_INR')}
                className="py-2.5 px-3 text-right cursor-pointer group hover:bg-[#E5ECE9] transition-colors"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Sales (INR)</span>
                  {renderSortIcon('Sales_INR')}
                </div>
              </th>
              <th
                onClick={() => handleSort('Realization')}
                className="py-2.5 px-3 text-right cursor-pointer group hover:bg-[#E5ECE9] transition-colors hidden sm:table-cell"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Realization</span>
                  {renderSortIcon('Realization')}
                </div>
              </th>
              <th
                onClick={() => handleSort('Transaction_Rows')}
                className="py-2.5 px-3 text-right cursor-pointer group hover:bg-[#E5ECE9] transition-colors hidden sm:table-cell"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Txn Rows</span>
                  {renderSortIcon('Transaction_Rows')}
                </div>
              </th>
              <th className="py-2.5 px-2 text-center w-8 text-[#1c4b4b]"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#b9dcdb]/80">
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-8 text-center text-[#1c4b4b]">
                  No records found matching filters.
                </td>
              </tr>
            ) : (
              paginatedData.map((row, idx) => {
                const realization =
                  row.Units_Sold > 0 ? (row.Sales_INR / row.Units_Sold).toFixed(2) : '0';
                return (
                  <tr
                    key={idx}
                    onClick={() => setSelectedRecord(row)}
                    className="hover:bg-[#F2F6F4] transition-colors text-[#002d2d] cursor-pointer group select-none"
                    title="Click to view full record metadata"
                  >
                    <td className="py-2.5 px-3">
                      <span className="font-semibold text-[#002d2d]">{row.Category}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-bold text-[#002d2d]">{row.Brand}</span>
                    </td>
                    <td className="py-2.5 px-3 text-[#1c4b4b] hidden xl:table-cell max-w-[200px] truncate" title={row.SKU}>
                      {row.SKU || `${row.Brand} Standard`}
                    </td>
                    <td className="py-2.5 px-3 text-[#1c4b4b] whitespace-nowrap">
                      <span>{row.Month}</span>
                      <span className="text-[10px] bg-[#F2F6F4] px-1 py-0.2 rounded ml-1 text-[#1c4b4b] border border-[#b9dcdb]">
                        {row.Quarter}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[#1c4b4b] hidden md:table-cell">
                      {row.Plant}
                    </td>
                    <td className="py-2.5 px-3 text-[#1c4b4b] hidden lg:table-cell max-w-[170px] truncate" title={row.Distributor}>
                      {row.Distributor}
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium text-[#002d2d] tabular-nums">
                      {row.Units_Sold.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-[#004c4c] tabular-nums">
                      {formatINR(row.Sales_INR)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-[#002d2d] tabular-nums hidden sm:table-cell font-medium">
                      ₹{realization}
                    </td>
                    <td className="py-2.5 px-3 text-right text-[#1c4b4b] tabular-nums hidden sm:table-cell">
                      {row.Transaction_Rows}
                    </td>
                    <td className="py-2.5 px-2 text-center text-[#1c4b4b] group-hover:text-[#004c4c]">
                      <ExternalLink className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 transition-opacity" />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>

          {/* Matrix Grand Total Row */}
          {filteredData.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-[#004c4c] bg-[#F2F6F4] font-bold text-[#002d2d]">
                <td className="py-2.5 px-3">
                  <span>Grand Total</span>
                </td>
                <td className="py-2.5 px-3 text-[11px] text-[#1c4b4b]" colSpan={4}>
                  {filteredData.length.toLocaleString()} records slice
                </td>
                <td className="py-2.5 px-3 hidden lg:table-cell"></td>
                <td className="py-2.5 px-3 text-right tabular-nums">
                  {totalUnits.toLocaleString()}
                </td>
                <td className="py-2.5 px-3 text-right text-[#004c4c] tabular-nums font-bold">
                  {formatINR(totalSales)}
                </td>
                <td className="py-2.5 px-3 text-right tabular-nums hidden sm:table-cell">
                  ₹{avgRealization.toFixed(2)}
                </td>
                <td className="py-2.5 px-3 text-right tabular-nums hidden sm:table-cell">
                  {totalTransactions.toLocaleString()}
                </td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Pagination Bar */}
      <div className="p-3 bg-[#F8FAF9] border-t border-[#b9dcdb] flex flex-wrap items-center justify-between gap-3 text-[12px] text-[#1c4b4b]">
        <div className="tabular-nums">
          Showing{' '}
          <strong className="text-[#002d2d]">
            {filteredData.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
          </strong>{' '}
          to{' '}
          <strong className="text-[#002d2d]">
            {Math.min(currentPage * pageSize, filteredData.length)}
          </strong>{' '}
          of <strong className="text-[#002d2d]">{filteredData.length.toLocaleString()}</strong> records
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setPage(1)}
            disabled={currentPage <= 1}
            className="h-7 px-2 rounded bg-white hover:bg-[#F2F6F4] border border-[#b9dcdb] text-[#002d2d] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors text-[11px]"
            title="First Page"
          >
            First
          </button>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="h-7 px-2 rounded bg-white hover:bg-[#F2F6F4] border border-[#b9dcdb] text-[#002d2d] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors flex items-center gap-0.5 text-[11px]"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Prev</span>
          </button>

          <span className="px-2 text-[11px] font-bold text-[#002d2d] tabular-nums">
            {currentPage} / {totalPages}
          </span>

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className="h-7 px-2 rounded bg-white hover:bg-[#F2F6F4] border border-[#b9dcdb] text-[#002d2d] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors flex items-center gap-0.5 text-[11px]"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setPage(totalPages)}
            disabled={currentPage >= totalPages}
            className="h-7 px-2 rounded bg-white hover:bg-[#F2F6F4] border border-[#b9dcdb] text-[#002d2d] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors text-[11px]"
            title="Last Page"
          >
            Last
          </button>
        </div>
      </div>

      {/* Row-Level Record Detail Modal */}
      {selectedRecord && (
        <RecordDetailModal
          record={selectedRecord}
          onClose={() => setSelectedRecord(null)}
          onFilterBrand={onFilterBrand}
          onFilterPlant={onFilterPlant}
          onAskAI={onAskAI}
        />
      )}
    </div>
  );
};
