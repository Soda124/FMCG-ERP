import { geoMercator } from 'd3-geo';
import { LogisticsNode } from '../types/fmcg';
import indiaGeoData from './indiaGeoJson.json';

// EXACTLY 8 Manufacturing Plants (2 per Product Line)
export const INDIA_PLANTS: LogisticsNode[] = [
  {
    id: 'plant-baddi-1',
    name: 'Baddi Plant 1',
    shortName: 'Baddi P1',
    type: 'plant',
    city: 'Baddi / Solan',
    state: 'Himachal Pradesh',
    lat: 30.9578,
    lng: 76.7914,
    category: 'Home Care',
    motherWarehouseId: 'mwh-north-gurgaon',
    description: 'High-speed automated detergent & fabric care production complex in Himachal Himalayan corridor.',
  },
  {
    id: 'plant-sanand-2',
    name: 'Sanand Plant 2',
    shortName: 'Sanand P2',
    type: 'plant',
    city: 'Sanand',
    state: 'Gujarat',
    lat: 22.9927,
    lng: 72.3813,
    category: 'Home Care',
    motherWarehouseId: 'mwh-west-bhiwandi',
    description: 'Specialized dishwash & pure laundry bar high-volume manufacturing lines near Ahmedabad belt.',
  },
  {
    id: 'plant-haridwar-1',
    name: 'Haridwar Plant 1',
    shortName: 'Haridwar P1',
    type: 'plant',
    city: 'Haridwar',
    state: 'Uttarakhand',
    lat: 29.9457,
    lng: 78.1642,
    category: 'Personal Care',
    motherWarehouseId: 'mwh-north-gurgaon',
    description: 'DermaGlow skincare & herbal formulation facility operating in SIDCUL industrial estate.',
  },
  {
    id: 'plant-hosur-2',
    name: 'Hosur Plant 2',
    shortName: 'Hosur P2',
    type: 'plant',
    city: 'Hosur',
    state: 'Tamil Nadu',
    lat: 12.7409,
    lng: 77.8253,
    category: 'Personal Care',
    motherWarehouseId: 'mwh-south-bengaluru',
    description: 'SilkShine haircare & Velvet Soft soap automated filling lines catering to South & West markets.',
  },
  {
    id: 'plant-guwahati-1',
    name: 'Guwahati Agro 1',
    shortName: 'Guwahati P1',
    type: 'plant',
    city: 'Guwahati',
    state: 'Assam',
    lat: 26.1445,
    lng: 91.7362,
    category: 'Food & Beverages',
    motherWarehouseId: 'mwh-north-gurgaon',
    description: 'Tea processing, coffee packaging and breakfast cereals plant in Brahmaputra industrial corridor.',
  },
  {
    id: 'plant-pune-2',
    name: 'Pune Facility 2',
    shortName: 'Pune P2',
    type: 'plant',
    city: 'Pune / Chakan',
    state: 'Maharashtra',
    lat: 18.5204,
    lng: 73.8567,
    category: 'Food & Beverages',
    motherWarehouseId: 'mwh-west-bhiwandi',
    description: 'NutriHarvest savory snacks & PureDrop edible oils automated refining & packing hub.',
  },
  {
    id: 'plant-kolkata-1',
    name: 'Kolkata Pharma 1',
    shortName: 'Kolkata P1',
    type: 'plant',
    city: 'Kolkata / Dankuni',
    state: 'West Bengal',
    lat: 22.5726,
    lng: 88.3639,
    category: 'Health & Hygiene',
    motherWarehouseId: 'mwh-north-gurgaon',
    description: 'MedShield sanitizer & active germicidal hygiene formulations adhering to WHO-GMP standards.',
  },
  {
    id: 'plant-bhiwadi-2',
    name: 'Bhiwadi Complex 2',
    shortName: 'Bhiwadi P2',
    type: 'plant',
    city: 'Bhiwadi',
    state: 'Rajasthan',
    lat: 28.2104,
    lng: 76.8606,
    category: 'Health & Hygiene',
    motherWarehouseId: 'mwh-north-gurgaon',
    description: 'ActiveGuard antiseptic liquids and wellness tablets cleanroom manufacturing complex.',
  },
];

// EXACTLY 3 Mother Warehouses (Central Warehouses / Mega Distribution Centers)
export const INDIA_MOTHER_WAREHOUSES: LogisticsNode[] = [
  {
    id: 'mwh-north-gurgaon',
    name: 'North Central Mother DC (Gurgaon Hub)',
    shortName: 'North Mother DC',
    type: 'mother_warehouse',
    city: 'Gurugram',
    state: 'Haryana / NCR',
    lat: 28.4595,
    lng: 77.0266,
    description: 'Flagship Tier-1 automated mega fulfillment mother warehouse serving North, Gangetic, East & North-East zones.',
  },
  {
    id: 'mwh-west-bhiwandi',
    name: 'West Central Mother DC (Bhiwandi Hub)',
    shortName: 'West Mother DC',
    type: 'mother_warehouse',
    city: 'Bhiwandi / Mumbai',
    state: 'Maharashtra',
    lat: 19.2967,
    lng: 73.0631,
    description: 'High-throughput western multi-modal logistics mega hub connected to JNPT port & central corridors.',
  },
  {
    id: 'mwh-south-bengaluru',
    name: 'South Central Mother DC (Bengaluru Hub)',
    shortName: 'South Mother DC',
    type: 'mother_warehouse',
    city: 'Bengaluru / Hoskote',
    state: 'Karnataka',
    lat: 12.9716,
    lng: 77.5946,
    description: 'Robotic high-bay mother distribution center supplying Southern Peninsular states & Deccan plateau.',
  },
];

// EXACTLY 13 Regional Distributors mapped across India's commercial hubs
export const INDIA_DISTRIBUTORS: LogisticsNode[] = [
  {
    id: 'dist-01',
    name: 'West FMCG Logistics',
    shortName: 'West FMCG Log.',
    type: 'distributor',
    city: 'Mumbai',
    state: 'Maharashtra',
    lat: 19.0760,
    lng: 72.8777,
    motherWarehouseId: 'mwh-west-bhiwandi',
  },
  {
    id: 'dist-02',
    name: 'East Apex Wholesalers',
    shortName: 'East Apex Wholesalers',
    type: 'distributor',
    city: 'Kolkata',
    state: 'West Bengal',
    lat: 22.5726,
    lng: 88.3639,
    motherWarehouseId: 'mwh-north-gurgaon',
  },
  {
    id: 'dist-03',
    name: 'NCR Direct Wholesalers',
    shortName: 'NCR Direct Wholesalers',
    type: 'distributor',
    city: 'Gurugram',
    state: 'Haryana',
    lat: 28.4595,
    lng: 77.0266,
    motherWarehouseId: 'mwh-north-gurgaon',
  },
  {
    id: 'dist-04',
    name: 'Gujarat Express Wholesalers',
    shortName: 'Gujarat Express',
    type: 'distributor',
    city: 'Ahmedabad',
    state: 'Gujarat',
    lat: 23.0225,
    lng: 72.5714,
    motherWarehouseId: 'mwh-west-bhiwandi',
  },
  {
    id: 'dist-05',
    name: 'Bengal Distribution Alliance',
    shortName: 'Bengal Dist. Alliance',
    type: 'distributor',
    city: 'Siliguri',
    state: 'West Bengal',
    lat: 26.7271,
    lng: 88.3953,
    motherWarehouseId: 'mwh-north-gurgaon',
  },
  {
    id: 'dist-06',
    name: 'Tamil Nadu Prime Logistics',
    shortName: 'TN Prime Log.',
    type: 'distributor',
    city: 'Coimbatore',
    state: 'Tamil Nadu',
    lat: 11.0168,
    lng: 76.9558,
    motherWarehouseId: 'mwh-south-bengaluru',
  },
  {
    id: 'dist-07',
    name: 'Rajasthan Mega Stockist',
    shortName: 'Rajasthan Mega',
    type: 'distributor',
    city: 'Jaipur',
    state: 'Rajasthan',
    lat: 26.9124,
    lng: 75.7873,
    motherWarehouseId: 'mwh-north-gurgaon',
  },
  {
    id: 'dist-08',
    name: 'Andhra Channel Express',
    shortName: 'Andhra Channel Exp.',
    type: 'distributor',
    city: 'Vijayawada',
    state: 'Andhra Pradesh',
    lat: 16.5062,
    lng: 80.6480,
    motherWarehouseId: 'mwh-south-bengaluru',
  },
  {
    id: 'dist-09',
    name: 'Odisha State Wholesalers',
    shortName: 'Odisha State Wholesalers',
    type: 'distributor',
    city: 'Bhubaneswar',
    state: 'Odisha',
    lat: 20.2961,
    lng: 85.8245,
    motherWarehouseId: 'mwh-north-gurgaon',
  },
  {
    id: 'dist-10',
    name: 'Bihar Direct Distributing',
    shortName: 'Bihar Direct Dist.',
    type: 'distributor',
    city: 'Patna',
    state: 'Bihar',
    lat: 25.5941,
    lng: 85.1376,
    motherWarehouseId: 'mwh-north-gurgaon',
  },
  {
    id: 'dist-11',
    name: 'Haryana Metro Wholesalers',
    shortName: 'Haryana Metro',
    type: 'distributor',
    city: 'Ambala',
    state: 'Haryana',
    lat: 30.3782,
    lng: 76.7767,
    motherWarehouseId: 'mwh-north-gurgaon',
  },
  {
    id: 'dist-12',
    name: 'Goa Coastal Trade Alliance',
    shortName: 'Goa Coastal Alliance',
    type: 'distributor',
    city: 'Panaji',
    state: 'Goa',
    lat: 15.4909,
    lng: 73.8278,
    motherWarehouseId: 'mwh-west-bhiwandi',
  },
  {
    id: 'dist-13',
    name: 'Uttarakhand Supply Chain Co',
    shortName: 'Uttarakhand Supply Co',
    type: 'distributor',
    city: 'Dehradun',
    state: 'Uttarakhand',
    lat: 30.3165,
    lng: 78.0322,
    motherWarehouseId: 'mwh-north-gurgaon',
  },
];

// All nodes combined for quick index lookup
export const ALL_LOGISTICS_NODES: LogisticsNode[] = [
  ...INDIA_PLANTS,
  ...INDIA_MOTHER_WAREHOUSES,
  ...INDIA_DISTRIBUTORS,
];

// SVG Canvas dimensions
export const MAP_CONFIG = {
  viewBoxWidth: 850,
  viewBoxHeight: 950,
};

// Calibrated Standard Mercator projection aligned strictly with India GeoJSON boundaries
export const indiaProjection = geoMercator().fitExtent(
  [[50, 40], [800, 910]],
  indiaGeoData as any
);

/**
 * Projects standard WGS84 [lat, lng] coordinates directly to SVG canvas coordinates.
 */
export function projectCoordinates(lat: number, lng: number): { x: number; y: number } {
  const projected = indiaProjection([lng, lat]);
  if (!projected) return { x: 425, y: 475 };
  return {
    x: Math.round(projected[0] * 10) / 10,
    y: Math.round(projected[1] * 10) / 10,
  };
}

/**
 * Calculates non-overlapping visual coordinates for nodes.
 * When a plant, warehouse, or distributor share very close city coordinates,
 * a small cartographic offset is applied so all entity tiers remain distinctly visible & clickable.
 */
export function getNodeCoordinates(node: LogisticsNode): { x: number; y: number } {
  const base = projectCoordinates(node.lat, node.lng);

  // Intentional cartographic micro-offsets for nodes in close geographic proximity
  if (node.city.includes('Kolkata')) {
    if (node.type === 'plant') return { x: base.x - 14, y: base.y - 12 };
    if (node.type === 'distributor') return { x: base.x + 10, y: base.y + 10 };
  }
  if (node.city.includes('Gurugram') || node.city.includes('New Delhi')) {
    if (node.type === 'mother_warehouse') return { x: base.x + 12, y: base.y - 6 };
    if (node.type === 'plant') return { x: base.x - 12, y: base.y + 12 };
    if (node.id === 'dist-06') return { x: base.x - 8, y: base.y - 14 };
    if (node.id === 'dist-01') return { x: base.x + 14, y: base.y + 10 };
  }
  if (node.city.includes('Bengaluru') || node.city.includes('Hosur')) {
    if (node.type === 'mother_warehouse') return { x: base.x - 14, y: base.y - 8 };
    if (node.type === 'plant') return { x: base.x + 14, y: base.y + 12 };
    if (node.type === 'distributor') return { x: base.x + 10, y: base.y - 12 };
  }
  if (node.city.includes('Mumbai') || node.city.includes('Bhiwandi')) {
    if (node.type === 'mother_warehouse') return { x: base.x + 12, y: base.y - 12 };
    if (node.type === 'distributor') return { x: base.x - 10, y: base.y + 10 };
  }
  if (node.city.includes('Pune')) {
    if (node.type === 'plant') return { x: base.x - 12, y: base.y - 10 };
    if (node.type === 'distributor') return { x: base.x + 10, y: base.y + 10 };
  }
  if (node.city.includes('Guwahati')) {
    if (node.type === 'plant') return { x: base.x - 14, y: base.y - 12 };
    if (node.type === 'distributor') return { x: base.x + 12, y: base.y + 10 };
  }
  if (node.city.includes('Ahmedabad') || node.city.includes('Sanand')) {
    if (node.type === 'plant') return { x: base.x - 12, y: base.y - 10 };
    if (node.type === 'distributor') return { x: base.x + 10, y: base.y + 10 };
  }

  return base;
}

// Map Node lookup by name
export function findNodeByName(name: string): LogisticsNode | undefined {
  return ALL_LOGISTICS_NODES.find(
    (n) => n.name.toLowerCase() === name.toLowerCase() || n.shortName.toLowerCase() === name.toLowerCase()
  );
}

// Find Mother Warehouse serving a given node
export function getServicingMotherWarehouse(node: LogisticsNode): LogisticsNode | undefined {
  if (node.type === 'mother_warehouse') return node;
  return INDIA_MOTHER_WAREHOUSES.find((mw) => mw.id === node.motherWarehouseId);
}
