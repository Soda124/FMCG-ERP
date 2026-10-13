import { FMCGRecord, ABCXYZSegment } from '../types/fmcg';

// Month definitions matching Indian Financial Year
export const MONTHS_METADATA = [
  { name: 'April', index: 1, quarter: 'Q1' },
  { name: 'May', index: 2, quarter: 'Q1' },
  { name: 'June', index: 3, quarter: 'Q1' },
  { name: 'July', index: 4, quarter: 'Q2' },
  { name: 'August', index: 5, quarter: 'Q2' },
  { name: 'September', index: 6, quarter: 'Q2' },
  { name: 'October', index: 7, quarter: 'Q3' },
  { name: 'November', index: 8, quarter: 'Q3' },
  { name: 'December', index: 9, quarter: 'Q3' },
  { name: 'January', index: 10, quarter: 'Q4' },
  { name: 'February', index: 11, quarter: 'Q4' },
  { name: 'March', index: 12, quarter: 'Q4' },
];

// EXACTLY 4 Product Lines
export const CATEGORIES = [
  'Home Care',
  'Personal Care',
  'Food & Beverages',
  'Health & Hygiene',
];

// EXACTLY 8 Plants (2 primary plants per Product Line)
export const PLANTS_BY_CATEGORY: Record<string, string[]> = {
  'Home Care': ['Baddi Plant 1', 'Sanand Plant 2'],
  'Personal Care': ['Haridwar Plant 1', 'Hosur Plant 2'],
  'Food & Beverages': ['Guwahati Agro 1', 'Pune Facility 2'],
  'Health & Hygiene': ['Kolkata Pharma 1', 'Bhiwadi Complex 2'],
};

export const ALL_PLANTS: string[] = [
  'Baddi Plant 1',
  'Sanand Plant 2',
  'Haridwar Plant 1',
  'Hosur Plant 2',
  'Guwahati Agro 1',
  'Pune Facility 2',
  'Kolkata Pharma 1',
  'Bhiwadi Complex 2',
];

// EXACTLY 13 Regional Distributors spread geographically across all zones of India
export const DISTRIBUTORS: string[] = [
  'West FMCG Logistics',
  'East Apex Wholesalers',
  'NCR Direct Wholesalers',
  'Gujarat Express Wholesalers',
  'Bengal Distribution Alliance',
  'Tamil Nadu Prime Logistics',
  'Rajasthan Mega Stockist',
  'Andhra Channel Express',
  'Odisha State Wholesalers',
  'Bihar Direct Distributing',
  'Haryana Metro Wholesalers',
  'Goa Coastal Trade Alliance',
  'Uttarakhand Supply Chain Co',
];

// Brands across the 4 Product Lines
export const BRANDS_BY_CATEGORY: Record<string, string[]> = {
  'Home Care': ['CleanMax Detergent', 'Sparkle Dishwash', 'EcoFresh Fabric Care', 'PureWash Laundry Bar'],
  'Personal Care': ['DermaGlow Skincare', 'SilkShine Shampoo', 'Velvet Soft Soap', 'OralFresh Dental'],
  'Food & Beverages': ['FreshBrew Tea & Coffee', 'NutriHarvest Snacks', 'PureDrop Edible Oils', 'CrispGrain Cereals'],
  'Health & Hygiene': ['MedShield Sanitizer', 'ActiveGuard Antiseptic', 'GermKill Hygiene', 'VitaPlus Wellness'],
};

export interface SKUDefinition {
  sku: string;
  brand: string;
  category: string;
  basePrice: number;
  weight: number; // Volume weight
  volatility: number; // For XYZ dispersion (0.05 = X steady, 0.4 = Y seasonal, 0.85 = Z erratic)
  designatedSegment?: ABCXYZSegment;
  // Specific physical network mapping meeting strict user constraints:
  // - Max 3 plants produce this SKU
  // - Max 15 distributors handle this SKU (spread across India)
  allocatedPlants: string[];
  allocatedDistributors: string[];
}

/**
 * Deterministic Pseudo-Random Generator with seeded state
 */
function createDeterministicRandom(seed: number) {
  let s = seed;
  return function () {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/**
 * Generate 640 SKUs across 4 Product Lines.
 * STRICT REQUIREMENTS:
 * - Exactly 12% in X category (77 SKUs out of 640 = 12.0%)
 * - Of the X category:
 *   - AX = 19% (15 SKUs)
 *   - BX = 32% (25 SKUs)
 *   - CX = 49% (37 SKUs)
 * - Remaining 563 SKUs (88%) distributed across Y and Z segments.
 * - FOR EACH SKU:
 *   - Max 3 plants produce it (typically 1 to 2, at most 3).
 *   - Max 15 distributors sell it (ranging from 6 to 15, well-distributed across North, South, East, West, Central).
 */
export function generateSKUCatalog(): SKUDefinition[] {
  const skus: SKUDefinition[] = [];
  const rng = createDeterministicRandom(42);

  const packVariants = [
    { name: '100g Sachet', multiplier: 0.25, priceFactor: 0.3 },
    { name: '200g Standard', multiplier: 0.45, priceFactor: 0.5 },
    { name: '500g Value Pack', multiplier: 1.0, priceFactor: 1.0 },
    { name: '1kg Family Saver', multiplier: 1.8, priceFactor: 1.75 },
    { name: '2kg Bulk Pack', multiplier: 2.8, priceFactor: 2.6 },
    { name: '5kg Institutional', multiplier: 5.2, priceFactor: 4.8 },
    { name: '250ml Bottle', multiplier: 0.6, priceFactor: 0.65 },
    { name: '500ml Pump', multiplier: 1.1, priceFactor: 1.15 },
    { name: '1L Refill Pouch', multiplier: 1.9, priceFactor: 1.8 },
    { name: '5L Canister', multiplier: 4.5, priceFactor: 4.2 },
  ];

  const subVariants = ['Classic', 'Lemon Fresh', 'Active Bio', 'Ultra Concentrated'];

  let skuCounter = 100;
  let globalIndex = 0;

  // We assign 77 items out of 640 to be X category:
  // 15 AX, 25 BX, 37 CX
  let axCount = 0;
  let bxCount = 0;
  let cxCount = 0;

  CATEGORIES.forEach((category) => {
    const brands = BRANDS_BY_CATEGORY[category] || [];
    const skusPerBrand = Math.floor(160 / brands.length); // 40 SKUs per brand

    const primaryPlants = PLANTS_BY_CATEGORY[category] || ['Baddi Plant 1', 'Sanand Plant 2'];
    // Complementary plants from other categories that can occasionally run dual-lines (max 3 plants total)
    const otherPlants = ALL_PLANTS.filter((p) => !primaryPlants.includes(p));

    brands.forEach((brand) => {
      let basePrice = 85;
      if (category === 'Home Care') basePrice = 95;
      if (category === 'Personal Care') basePrice = 145;
      if (category === 'Food & Beverages') basePrice = 110;
      if (category === 'Health & Hygiene') basePrice = 120;

      for (let i = 0; i < skusPerBrand; i++) {
        skuCounter++;
        globalIndex++;
        const pack = packVariants[i % packVariants.length];
        const sub = subVariants[Math.floor(i / packVariants.length) % subVariants.length];
        const skuCode = `SKU-${category.slice(0, 2).toUpperCase()}-${skuCounter}`;
        const skuName = `${brand} ${sub} ${pack.name}`;

        let designatedSegment: ABCXYZSegment = 'CY';
        let volatility = 0.42;
        let weight = pack.multiplier * (0.8 + (i % 5) * 0.15);

        // Distribute the 77 X category items across the catalog
        if (axCount < 15 && globalIndex % 42 === 0) {
          designatedSegment = 'AX';
          volatility = 0.05; // Extremely steady
          weight = 4.2 + (axCount % 3) * 0.4;
          axCount++;
        } else if (bxCount < 25 && globalIndex % 25 === 0) {
          designatedSegment = 'BX';
          volatility = 0.06; // Extremely steady
          weight = 1.6 + (bxCount % 3) * 0.25;
          bxCount++;
        } else if (cxCount < 37 && (globalIndex % 17 === 0 || globalIndex % 29 === 0)) {
          designatedSegment = 'CX';
          volatility = 0.07; // Extremely steady
          weight = 0.35 + (cxCount % 3) * 0.12;
          cxCount++;
        } else {
          // Non-X items (88% of products)
          if (globalIndex % 5 === 0) {
            designatedSegment = 'CZ';
            volatility = 0.85;
            weight *= 0.6;
          } else if (globalIndex % 3 === 0) {
            designatedSegment = 'BY';
            volatility = 0.45;
          } else if (globalIndex % 7 === 0) {
            designatedSegment = 'AZ';
            volatility = 0.82;
            weight *= 2.5;
          } else if (globalIndex % 4 === 0) {
            designatedSegment = 'AY';
            volatility = 0.42;
            weight *= 2.8;
          } else {
            designatedSegment = 'CY';
            volatility = 0.48;
          }
        }

        // STRICT CONSTRAINT: Max 3 plants produced per SKU (1, 2, or 3)
        // Primary plant is always from the category's dedicated plants
        const allocatedPlants: string[] = [];
        if (i % 5 === 0) {
          // 3 plants max (both primary + 1 flexible swing plant)
          allocatedPlants.push(primaryPlants[0], primaryPlants[1], otherPlants[i % otherPlants.length]);
        } else if (i % 2 === 0) {
          // 2 plants
          allocatedPlants.push(primaryPlants[0], primaryPlants[1]);
        } else {
          // 1 plant
          allocatedPlants.push(primaryPlants[i % primaryPlants.length]);
        }

        // Regional distributor allocation (between 6 and 13 distributors per SKU, spread across India)
        const targetDistCount = Math.min(DISTRIBUTORS.length, Math.max(6, 7 + (globalIndex % 7)));
        const allocatedDistributors: string[] = [];
        const startOffset = (globalIndex * 3 + i * 2) % DISTRIBUTORS.length;

        for (let d = 0; d < targetDistCount; d++) {
          const distCandidate = DISTRIBUTORS[(startOffset + d) % DISTRIBUTORS.length];
          if (!allocatedDistributors.includes(distCandidate)) {
            allocatedDistributors.push(distCandidate);
          }
        }

        skus.push({
          sku: `${skuCode} ${skuName}`,
          brand,
          category,
          basePrice: Math.round(basePrice * pack.priceFactor),
          weight,
          volatility,
          designatedSegment,
          allocatedPlants,
          allocatedDistributors,
        });
      }
    });
  });

  // Guarantee exact counts: 15 AX, 25 BX, 37 CX (Total 77 = 12.0% of 640)
  while (axCount < 15) {
    const candidate = skus.find((s) => s.designatedSegment !== 'AX' && s.designatedSegment !== 'BX' && s.designatedSegment !== 'CX');
    if (candidate) {
      candidate.designatedSegment = 'AX';
      candidate.volatility = 0.05;
      candidate.weight = 4.5;
      axCount++;
    } else break;
  }
  while (bxCount < 25) {
    const candidate = skus.find((s) => s.designatedSegment !== 'AX' && s.designatedSegment !== 'BX' && s.designatedSegment !== 'CX');
    if (candidate) {
      candidate.designatedSegment = 'BX';
      candidate.volatility = 0.06;
      candidate.weight = 1.8;
      bxCount++;
    } else break;
  }
  while (cxCount < 37) {
    const candidate = skus.find((s) => s.designatedSegment !== 'AX' && s.designatedSegment !== 'BX' && s.designatedSegment !== 'CX');
    if (candidate) {
      candidate.designatedSegment = 'CX';
      candidate.volatility = 0.07;
      candidate.weight = 0.4;
      cxCount++;
    } else break;
  }

  return skus;
}

export const SKU_CATALOG: SKUDefinition[] = generateSKUCatalog();

/**
 * Generates realistic FMCG records satisfying all constraints:
 * - EXACTLY 11,000 records default
 * - 640 distinct SKUs across 4 Product Lines
 * - 8 Plants (Max 3 plants per SKU, adhering to designated allocation)
 * - 13 Distributors (spread across India)
 * - X category represents 12% of SKUs, with AX 19%, BX 32%, CX 49%
 */
export function generateDefaultFMCGData(targetCount = 11000): FMCGRecord[] {
  const records: FMCGRecord[] = [];
  const rng = createDeterministicRandom(88);

  // Phase 1: Create authentic monthly transactions honoring allocated plants and distributors
  let recordCounter = 0;

  // Distribute records smoothly across all SKUs, active months, and their allocated distributors/plants
  while (records.length < targetCount) {
    const skuDef = SKU_CATALOG[recordCounter % SKU_CATALOG.length];
    const monthMeta = MONTHS_METADATA[(recordCounter + Math.floor(recordCounter / SKU_CATALOG.length)) % MONTHS_METADATA.length];

    // Pick from SKU's designated plants (STRICT: MAX 3)
    const plant = skuDef.allocatedPlants[recordCounter % skuDef.allocatedPlants.length];

    // Pick from SKU's designated distributors (STRICT: MAX 15)
    const distributor = skuDef.allocatedDistributors[
      (recordCounter + Math.floor(recordCounter / 12)) % skuDef.allocatedDistributors.length
    ];

    let seasonalBoost = 1.0;
    if (skuDef.volatility < 0.1) {
      // Steady X class: minimal variance
      seasonalBoost = 0.98 + rng() * 0.04;
    } else {
      if (monthMeta.quarter === 'Q3') seasonalBoost = 1.25;
      if (monthMeta.name === 'March') seasonalBoost = 1.2;
      if (skuDef.volatility > 0.6) {
        seasonalBoost *= 0.45 + rng() * 1.35;
      } else {
        seasonalBoost *= 0.8 + rng() * 0.5;
      }
    }

    const baseUnits = Math.round(2400 * skuDef.weight * seasonalBoost);
    const unitsSold = Math.max(100, Math.round(baseUnits * (0.85 + rng() * 0.3)));

    const discountVariance = 0.96 + (rng() * 0.08 - 0.04);
    const realization = Math.max(10, Math.round(skuDef.basePrice * discountVariance));
    const salesINR = unitsSold * realization;
    const transactionRows = Math.max(8, Math.round(14 + unitsSold / 140));

    records.push({
      Month: monthMeta.name,
      Month_Index: monthMeta.index,
      Quarter: monthMeta.quarter,
      Category: skuDef.category,
      Brand: skuDef.brand,
      SKU: skuDef.sku,
      Plant: plant,
      Distributor: distributor,
      Units_Sold: unitsSold,
      Sales_INR: salesINR,
      Transaction_Rows: transactionRows,
    });

    recordCounter++;
  }

  return records;
}

export const defaultFMCGData: FMCGRecord[] = generateDefaultFMCGData(11000);
