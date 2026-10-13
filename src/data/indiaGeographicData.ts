import { FMCGRecord } from '../types/fmcg';
import { INDIA_DISTRIBUTORS, INDIA_PLANTS, INDIA_MOTHER_WAREHOUSES } from './indiaLogisticsData';

// Normalized 5 Commercial Macro Zones of India
export type IndiaZone = 'North' | 'West' | 'South' | 'East' | 'Central';

export interface ZoneMetadata {
  id: IndiaZone;
  name: string;
  color: string;
  accent: string;
  states: string[];
}

export const INDIA_ZONES: Record<IndiaZone, ZoneMetadata> = {
  North: {
    id: 'North',
    name: 'Northern Zone',
    color: '#004c4c',
    accent: '#34a1a5',
    states: [
      'Delhi',
      'Haryana',
      'Punjab',
      'Himachal Pradesh',
      'Uttarakhand',
      'Uttar Pradesh',
      'Rajasthan',
      'Jammu and Kashmir',
      'Ladakh',
      'Chandigarh',
    ],
  },
  West: {
    id: 'West',
    name: 'Western Zone',
    color: '#34a1a5',
    accent: '#004c4c',
    states: ['Maharashtra', 'Gujarat', 'Goa', 'Dadra and Nagar Haveli', 'Daman and Diu'],
  },
  South: {
    id: 'South',
    name: 'Southern Zone',
    color: '#ff6b68',
    accent: '#8c1e1c',
    states: [
      'Karnataka',
      'Tamil Nadu',
      'Telangana',
      'Andhra Pradesh',
      'Kerala',
      'Puducherry',
      'Lakshadweep',
    ],
  },
  East: {
    id: 'East',
    name: 'Eastern Zone',
    color: '#f59e0b',
    accent: '#b45309',
    states: [
      'West Bengal',
      'Bihar',
      'Jharkhand',
      'Odisha',
      'Assam',
      'Arunachal Pradesh',
      'Manipur',
      'Meghalaya',
      'Mizoram',
      'Nagaland',
      'Sikkim',
      'Tripura',
      'Andaman and Nicobar Islands',
    ],
  },
  Central: {
    id: 'Central',
    name: 'Central Zone',
    color: '#6366f1',
    accent: '#4338ca',
    states: ['Madhya Pradesh', 'Chhattisgarh'],
  },
};

// State Aliases to match GeoJSON properties.st_nm exactly
export const STATE_ALIASES: Record<string, string> = {
  'Delhi NCR': 'Delhi',
  'Haryana / NCR': 'Haryana',
};

// Normalize state name to GeoJSON st_nm standard
export function normalizeStateName(rawState: string): string {
  if (STATE_ALIASES[rawState]) return STATE_ALIASES[rawState];
  return rawState.trim();
}

// Map each state to its macro zone
export const STATE_TO_ZONE: Record<string, IndiaZone> = (() => {
  const map: Record<string, IndiaZone> = {};
  Object.values(INDIA_ZONES).forEach((zone) => {
    zone.states.forEach((state) => {
      map[state] = zone.id;
    });
  });
  return map;
})();

// Distributor to State mapping lookup
export const DISTRIBUTOR_STATE_MAP: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  INDIA_DISTRIBUTORS.forEach((d) => {
    map[d.name] = normalizeStateName(d.state);
  });
  return map;
})();

// Plant to State mapping lookup
export const PLANT_STATE_MAP: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  INDIA_PLANTS.forEach((p) => {
    map[p.name] = normalizeStateName(p.state);
  });
  return map;
})();

// Warehouse to State mapping lookup
export const WAREHOUSE_STATE_MAP: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  INDIA_MOTHER_WAREHOUSES.forEach((w) => {
    map[w.name] = normalizeStateName(w.state);
  });
  return map;
})();

export interface StateGeographicMetrics {
  stateName: string;
  zone: IndiaZone;
  salesINR: number;
  unitsSold: number;
  transactionCount: number;
  activeDistributors: string[];
  activePlants: string[];
  activeWarehouses: string[];
  distributorCount: number;
  plantCount: number;
  shareOfSales: number;
  shareOfUnits: number;
}

export interface ZoneGeographicMetrics {
  zoneId: IndiaZone;
  zoneName: string;
  salesINR: number;
  unitsSold: number;
  shareOfSales: number;
  shareOfUnits: number;
  stateCount: number;
  distributorCount: number;
}

// Compute State and Zone aggregations from active FMCG records
export function computeGeographicMetrics(
  records: FMCGRecord[],
  metricType: 'sales' | 'units' = 'sales'
): {
  stateMetrics: Record<string, StateGeographicMetrics>;
  zoneMetrics: Record<IndiaZone, ZoneGeographicMetrics>;
  maxMetricValue: number;
  totalSales: number;
  totalUnits: number;
} {
  let totalSales = 0;
  let totalUnits = 0;

  // Initialize all known states with empty metrics
  const stateMap: Record<
    string,
    {
      salesINR: number;
      unitsSold: number;
      transactionCount: number;
      distributorSet: Set<string>;
      plantSet: Set<string>;
      warehouseSet: Set<string>;
    }
  > = {};

  Object.values(INDIA_ZONES).forEach((z) => {
    z.states.forEach((s) => {
      stateMap[s] = {
        salesINR: 0,
        unitsSold: 0,
        transactionCount: 0,
        distributorSet: new Set<string>(),
        plantSet: new Set<string>(),
        warehouseSet: new Set<string>(),
      };
    });
  });

  // Aggregate by distributor state
  records.forEach((row) => {
    totalSales += row.Sales_INR;
    totalUnits += row.Units_Sold;

    const distState = DISTRIBUTOR_STATE_MAP[row.Distributor];
    if (distState && stateMap[distState]) {
      stateMap[distState].salesINR += row.Sales_INR;
      stateMap[distState].unitsSold += row.Units_Sold;
      stateMap[distState].transactionCount += row.Transaction_Rows;
      stateMap[distState].distributorSet.add(row.Distributor);
    }

    const plantState = PLANT_STATE_MAP[row.Plant];
    if (plantState && stateMap[plantState]) {
      stateMap[plantState].plantSet.add(row.Plant);
    }
  });

  // Add mother warehouse states
  INDIA_MOTHER_WAREHOUSES.forEach((wh) => {
    const whState = normalizeStateName(wh.state);
    if (stateMap[whState]) {
      stateMap[whState].warehouseSet.add(wh.name);
    }
  });

  let maxMetricValue = 0;
  const stateMetrics: Record<string, StateGeographicMetrics> = {};

  Object.entries(stateMap).forEach(([stateName, val]) => {
    const valCompare = metricType === 'sales' ? val.salesINR : val.unitsSold;
    if (valCompare > maxMetricValue) {
      maxMetricValue = valCompare;
    }

    const zone = STATE_TO_ZONE[stateName] || 'North';

    stateMetrics[stateName] = {
      stateName,
      zone,
      salesINR: val.salesINR,
      unitsSold: val.unitsSold,
      transactionCount: val.transactionCount,
      activeDistributors: Array.from(val.distributorSet),
      activePlants: Array.from(val.plantSet),
      activeWarehouses: Array.from(val.warehouseSet),
      distributorCount: val.distributorSet.size,
      plantCount: val.plantSet.size,
      shareOfSales: totalSales > 0 ? (val.salesINR / totalSales) * 100 : 0,
      shareOfUnits: totalUnits > 0 ? (val.unitsSold / totalUnits) * 100 : 0,
    };
  });

  // Zone Aggregations
  const zoneMetrics: Record<IndiaZone, ZoneGeographicMetrics> = {
    North: { zoneId: 'North', zoneName: 'Northern Zone', salesINR: 0, unitsSold: 0, shareOfSales: 0, shareOfUnits: 0, stateCount: 0, distributorCount: 0 },
    West: { zoneId: 'West', zoneName: 'Western Zone', salesINR: 0, unitsSold: 0, shareOfSales: 0, shareOfUnits: 0, stateCount: 0, distributorCount: 0 },
    South: { zoneId: 'South', zoneName: 'Southern Zone', salesINR: 0, unitsSold: 0, shareOfSales: 0, shareOfUnits: 0, stateCount: 0, distributorCount: 0 },
    East: { zoneId: 'East', zoneName: 'Eastern Zone', salesINR: 0, unitsSold: 0, shareOfSales: 0, shareOfUnits: 0, stateCount: 0, distributorCount: 0 },
    Central: { zoneId: 'Central', zoneName: 'Central Zone', salesINR: 0, unitsSold: 0, shareOfSales: 0, shareOfUnits: 0, stateCount: 0, distributorCount: 0 },
  };

  const zoneDistributorSets: Record<IndiaZone, Set<string>> = {
    North: new Set(),
    West: new Set(),
    South: new Set(),
    East: new Set(),
    Central: new Set(),
  };

  Object.values(stateMetrics).forEach((sm) => {
    const z = zoneMetrics[sm.zone];
    if (z) {
      z.salesINR += sm.salesINR;
      z.unitsSold += sm.unitsSold;
      if (sm.salesINR > 0 || sm.distributorCount > 0) {
        z.stateCount += 1;
      }
      sm.activeDistributors.forEach((d) => zoneDistributorSets[sm.zone].add(d));
    }
  });

  Object.keys(zoneMetrics).forEach((key) => {
    const zKey = key as IndiaZone;
    zoneMetrics[zKey].distributorCount = zoneDistributorSets[zKey].size;
    zoneMetrics[zKey].shareOfSales = totalSales > 0 ? (zoneMetrics[zKey].salesINR / totalSales) * 100 : 0;
    zoneMetrics[zKey].shareOfUnits = totalUnits > 0 ? (zoneMetrics[zKey].unitsSold / totalUnits) * 100 : 0;
  });

  return {
    stateMetrics,
    zoneMetrics,
    maxMetricValue: maxMetricValue || 1,
    totalSales,
    totalUnits,
  };
}

// Generate choropleth color scale given ratio [0..1]
export function getChoroplethColor(ratio: number, metricType: 'sales' | 'units' = 'sales'): string {
  if (ratio <= 0) return '#f4f7f6'; // Neutral unserviced state
  
  if (metricType === 'sales') {
    // Deep pine teal gradient
    if (ratio < 0.15) return '#e0f2f1';
    if (ratio < 0.35) return '#b2dfdb';
    if (ratio < 0.55) return '#80cbc4';
    if (ratio < 0.75) return '#26a69a';
    if (ratio < 0.90) return '#00796b';
    return '#004c4c'; // Peak revenue
  } else {
    // Warm coral / amber volume gradient
    if (ratio < 0.15) return '#ffedd5';
    if (ratio < 0.35) return '#fed7aa';
    if (ratio < 0.55) return '#fdba74';
    if (ratio < 0.75) return '#fb923c';
    if (ratio < 0.90) return '#f97316';
    return '#c2410c'; // Peak volume
  }
}
