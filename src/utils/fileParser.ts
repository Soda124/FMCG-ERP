import * as XLSX from 'xlsx';
import { FMCGRecord } from '../types/fmcg';
import { MONTHS_METADATA } from '../data/defaultFMCGData';

const MONTH_MAP: Record<string, { index: number; quarter: string }> = {
  january: { index: 10, quarter: 'Q4' },
  jan: { index: 10, quarter: 'Q4' },
  february: { index: 11, quarter: 'Q4' },
  feb: { index: 11, quarter: 'Q4' },
  march: { index: 12, quarter: 'Q4' },
  mar: { index: 12, quarter: 'Q4' },
  april: { index: 1, quarter: 'Q1' },
  apr: { index: 1, quarter: 'Q1' },
  may: { index: 2, quarter: 'Q1' },
  june: { index: 3, quarter: 'Q1' },
  jun: { index: 3, quarter: 'Q1' },
  july: { index: 4, quarter: 'Q2' },
  jul: { index: 4, quarter: 'Q2' },
  august: { index: 5, quarter: 'Q2' },
  aug: { index: 5, quarter: 'Q2' },
  september: { index: 6, quarter: 'Q2' },
  sep: { index: 6, quarter: 'Q2' },
  sept: { index: 6, quarter: 'Q2' },
  october: { index: 7, quarter: 'Q3' },
  oct: { index: 7, quarter: 'Q3' },
  november: { index: 8, quarter: 'Q3' },
  nov: { index: 8, quarter: 'Q3' },
  december: { index: 9, quarter: 'Q3' },
  dec: { index: 9, quarter: 'Q3' },
};

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[\s_-]+/g, '');
}

export async function parseFMCGFile(file: File): Promise<{
  records: FMCGRecord[];
  fileName: string;
  rowCount: number;
  warnings: string[];
}> {
  const warnings: string[] = [];
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('The uploaded file does not contain any sheets.');
  }

  const rawRows: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], {
    defval: '',
  });

  if (!rawRows || rawRows.length === 0) {
    throw new Error('The uploaded sheet is empty.');
  }

  const records: FMCGRecord[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    const normalizedRow: Record<string, any> = {};

    Object.keys(row).forEach((k) => {
      normalizedRow[normalizeKey(k)] = row[k];
    });

    const monthRaw = String(
      normalizedRow['month'] ||
      normalizedRow['monthname'] ||
      'April'
    ).trim();

    const monthLower = monthRaw.toLowerCase();
    const monthMeta = MONTH_MAP[monthLower] || { index: 1, quarter: 'Q1' };

    const monthIndex = Number(
      normalizedRow['monthindex'] ||
      normalizedRow['monthno'] ||
      monthMeta.index
    ) || monthMeta.index;

    const quarter = String(
      normalizedRow['quarter'] ||
      normalizedRow['qtr'] ||
      monthMeta.quarter
    ).trim().toUpperCase();

    const category = String(
      normalizedRow['category'] ||
      normalizedRow['segment'] ||
      'General FMCG'
    ).trim();

    const brand = String(
      normalizedRow['brand'] ||
      normalizedRow['brandname'] ||
      'Brand Unspecified'
    ).trim();

    const plant = String(
      normalizedRow['plant'] ||
      normalizedRow['manufacturingplant'] ||
      'Plant 1'
    ).trim();

    const distributor = String(
      normalizedRow['distributor'] ||
      normalizedRow['channel'] ||
      'Distributor 1'
    ).trim();

    const unitsSold = Number(
      normalizedRow['unitssold'] ||
      normalizedRow['units'] ||
      normalizedRow['volume'] ||
      0
    );

    const salesINR = Number(
      normalizedRow['salesinr'] ||
      normalizedRow['sales'] ||
      normalizedRow['revenue'] ||
      normalizedRow['revenueinr'] ||
      0
    );

    const transactionRows = Number(
      normalizedRow['transactionrows'] ||
      normalizedRow['transactions'] ||
      normalizedRow['orders'] ||
      1
    );

    // Only skip completely blank rows
    if (!brand && unitsSold === 0 && salesINR === 0) {
      continue;
    }

    const sku = String(
      normalizedRow['sku'] ||
      normalizedRow['skuname'] ||
      normalizedRow['skucode'] ||
      normalizedRow['item'] ||
      brand ||
      'SKU-001'
    ).trim();

    records.push({
      Month: monthRaw,
      Month_Index: monthIndex,
      Quarter: quarter,
      Category: category,
      Brand: brand,
      SKU: sku,
      Plant: plant,
      Distributor: distributor,
      Units_Sold: isNaN(unitsSold) ? 0 : unitsSold,
      Sales_INR: isNaN(salesINR) ? 0 : salesINR,
      Transaction_Rows: isNaN(transactionRows) ? 1 : transactionRows,
    });
  }

  if (records.length === 0) {
    throw new Error('Could not identify valid FMCG data rows in the file.');
  }

  return {
    records,
    fileName: file.name,
    rowCount: records.length,
    warnings,
  };
}

export function exportDatasetToExcel(records: any[], filename = 'FMCG_Pulse_Dataset.xlsx'): void {
  const ws = XLSX.utils.json_to_sheet(records);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'FMCG_Data');
  XLSX.writeFile(wb, filename);
}

export function exportDatasetToCSV(records: any[], filename = 'FMCG_Pulse_Dataset.csv'): void {
  const ws = XLSX.utils.json_to_sheet(records);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
