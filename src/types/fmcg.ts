export interface FMCGRecord {
  Month: string;
  Month_Index: number;
  Quarter: string;
  Category: string; // 4 Product Lines
  Brand: string;
  SKU?: string; // 600+ unique SKUs
  Plant: string; // 8 Plants (2 per Product Line)
  Distributor: string; // 13 Regional Distributors spread across India
  Units_Sold: number;
  Sales_INR: number;
  Transaction_Rows: number;
}

export interface FilterState {
  quarter: string;
  month: string;
  category: string;
  brand: string;
  sku: string;
  plant: string;
  distributor: string;
  search: string;
}

export type LogisticsNodeType = 'plant' | 'mother_warehouse' | 'distributor';

export interface LogisticsNode {
  id: string;
  name: string;
  shortName: string;
  type: LogisticsNodeType;
  city: string;
  state: string;
  lat: number;
  lng: number;
  category?: string;
  motherWarehouseId?: string;
  description?: string;
}

export interface MetricTrend {
  pctChange: number;
  isPositive: boolean;
  priorValue: number;
  formattedPrior: string;
  absoluteDiff?: number;
}

export interface PeriodComparison {
  comparisonType: 'month' | 'quarter';
  currentPeriodLabel: string;
  priorPeriodLabel: string;
  salesTrend: MetricTrend;
  unitsTrend: MetricTrend;
  realizationTrend: MetricTrend;
  transactionsTrend: MetricTrend;
}

export type SummaryViewLevel = 'executive' | 'manager';

export interface KPISummary {
  totalSales: number;
  totalUnits: number;
  avgRealization: number;
  totalTransactions: number;
  recordCount: number;
  comparison?: PeriodComparison;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

// ABC-XYZ Analysis Interfaces
export type ABCClass = 'A' | 'B' | 'C';
export type XYZClass = 'X' | 'Y' | 'Z';
export type ABCXYZSegment = 'AX' | 'AY' | 'AZ' | 'BX' | 'BY' | 'BZ' | 'CX' | 'CY' | 'CZ';

export interface SKUAnalysisItem {
  sku: string;
  brand: string;
  category: string;
  sales: number;
  units: number;
  revenueShare: number;
  cumulativeRevenueShare: number;
  abc: ABCClass;
  monthlySales: number[];
  meanMonthlySales: number;
  stdDevMonthlySales: number;
  coefficientOfVariation: number;
  xyz: XYZClass;
  segment: ABCXYZSegment;
  distributorCount?: number;
  avgRealization: number;
}

export interface MatrixCellData {
  segment: ABCXYZSegment;
  abc: ABCClass;
  xyz: XYZClass;
  skuCount: number;
  skuShare: number;
  sales: number;
  salesShare: number;
  units: number;
  skus: SKUAnalysisItem[];
  strategyTitle: string;
  strategyDirective: string;
}
