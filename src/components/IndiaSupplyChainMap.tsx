import React, { useState, useMemo, useRef } from 'react';
import { geoPath } from 'd3-geo';
import {
  Factory,
  Warehouse,
  Store,
  RotateCcw,
  MapPin,
  ChevronRight,
  Filter,
  Package,
  Layers,
  X,
  Compass,
  Sliders,
  Info,
} from 'lucide-react';
import { FMCGRecord, FilterState, LogisticsNode } from '../types/fmcg';
import {
  INDIA_PLANTS,
  INDIA_MOTHER_WAREHOUSES,
  INDIA_DISTRIBUTORS,
  ALL_LOGISTICS_NODES,
  MAP_CONFIG,
  indiaProjection,
  getNodeCoordinates,
} from '../data/indiaLogisticsData';
import indiaGeoData from '../data/indiaGeoJson.json';
import { formatINR, formatUnits } from '../utils/currencyFormatter';

interface IndiaSupplyChainMapProps {
  data: FMCGRecord[];
  filters: FilterState;
  onFilterChange: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  onResetFilters: () => void;
}

// Directional Flow Route interface
interface FlowRoute {
  id: string;
  from: LogisticsNode;
  to: LogisticsNode;
  type: 'plant_to_wh' | 'wh_to_dist';
  isActive: boolean;
  volumeUnits: number;
  salesINR: number;
  skuCount: number;
}

interface HoveredTooltipData {
  node: LogisticsNode;
  pixelX: number;
  pixelY: number;
  placeBelow: boolean;
}

export const IndiaSupplyChainMap: React.FC<IndiaSupplyChainMapProps> = ({
  data,
  filters,
  onFilterChange,
  onResetFilters,
}) => {
  // Bi-directional node inspection drill-down state
  const [selectedNode, setSelectedNode] = useState<LogisticsNode | null>(null);
  const [hoveredTooltip, setHoveredTooltip] = useState<HoveredTooltipData | null>(null);
  const [hoveredStateName, setHoveredStateName] = useState<string | null>(null);

  // Layer visibility toggles (Legend)
  const [showPlants, setShowPlants] = useState<boolean>(true);
  const [showWarehouses, setShowWarehouses] = useState<boolean>(true);
  const [showDistributors, setShowDistributors] = useState<boolean>(true);
  const [showFlowRoutes, setShowFlowRoutes] = useState<boolean>(true);
  const [showNodeLabels, setShowNodeLabels] = useState<boolean>(true);
  const [hideUnconnected, setHideUnconnected] = useState<boolean>(false); // Dim vs Hide

  const mapContainerRef = useRef<HTMLDivElement | null>(null);

  // Generate path generator once with d3-geo projection
  const pathGenerator = useMemo(() => {
    return geoPath().projection(indiaProjection);
  }, []);

  // Precompute GeoJSON SVG path strings for all 37 Indian states & union territories
  const statePathData = useMemo<{ id: string; name: string; pathD: string }[]>(() => {
    return (indiaGeoData as any).features.map((feature: any, idx: number) => ({
      id: String(feature.properties?.st_nm || `state-${idx}`),
      name: String(feature.properties?.st_nm || 'State'),
      pathD: pathGenerator(feature) || '',
    }));
  }, [pathGenerator]);

  // Filter records matching active global slicers
  const activeRecords = useMemo(() => {
    return data.filter((row) => {
      if (filters.quarter !== 'All' && row.Quarter !== filters.quarter) return false;
      if (filters.month !== 'All' && row.Month !== filters.month) return false;
      if (filters.category !== 'All' && row.Category !== filters.category) return false;
      if (filters.brand !== 'All' && row.Brand !== filters.brand) return false;
      if (filters.sku !== 'All' && row.SKU !== filters.sku) return false;
      if (filters.plant !== 'All' && row.Plant !== filters.plant) return false;
      if (filters.distributor !== 'All' && row.Distributor !== filters.distributor) return false;
      return true;
    });
  }, [data, filters]);

  // Aggregate metrics per logistics node from active filtered records
  const nodeMetrics = useMemo(() => {
    const metrics: Record<
      string,
      {
        salesINR: number;
        unitsSold: number;
        transactionCount: number;
        skuList: string[];
        skuSet: Set<string>;
        upstreamNodes: Set<string>;
        downstreamNodes: Set<string>;
      }
    > = {};

    ALL_LOGISTICS_NODES.forEach((n) => {
      metrics[n.id] = {
        salesINR: 0,
        unitsSold: 0,
        transactionCount: 0,
        skuList: [],
        skuSet: new Set<string>(),
        upstreamNodes: new Set<string>(),
        downstreamNodes: new Set<string>(),
      };
    });

    activeRecords.forEach((r) => {
      const plant = INDIA_PLANTS.find((p) => p.name === r.Plant);
      const dist = INDIA_DISTRIBUTORS.find((d) => d.name === r.Distributor);
      const wh = dist ? INDIA_MOTHER_WAREHOUSES.find((w) => w.id === dist.motherWarehouseId) : null;

      if (plant) {
        metrics[plant.id].salesINR += r.Sales_INR;
        metrics[plant.id].unitsSold += r.Units_Sold;
        metrics[plant.id].transactionCount += r.Transaction_Rows;
        if (r.SKU && !metrics[plant.id].skuSet.has(r.SKU)) {
          metrics[plant.id].skuSet.add(r.SKU);
          metrics[plant.id].skuList.push(r.SKU);
        }
        if (wh) metrics[plant.id].downstreamNodes.add(wh.id);
        if (dist) metrics[plant.id].downstreamNodes.add(dist.id);
      }

      if (dist) {
        metrics[dist.id].salesINR += r.Sales_INR;
        metrics[dist.id].unitsSold += r.Units_Sold;
        metrics[dist.id].transactionCount += r.Transaction_Rows;
        if (r.SKU && !metrics[dist.id].skuSet.has(r.SKU)) {
          metrics[dist.id].skuSet.add(r.SKU);
          metrics[dist.id].skuList.push(r.SKU);
        }
        if (wh) metrics[dist.id].upstreamNodes.add(wh.id);
        if (plant) metrics[dist.id].upstreamNodes.add(plant.id);
      }

      if (wh) {
        metrics[wh.id].salesINR += r.Sales_INR;
        metrics[wh.id].unitsSold += r.Units_Sold;
        metrics[wh.id].transactionCount += r.Transaction_Rows;
        if (r.SKU && !metrics[wh.id].skuSet.has(r.SKU)) {
          metrics[wh.id].skuSet.add(r.SKU);
          metrics[wh.id].skuList.push(r.SKU);
        }
        if (plant) metrics[wh.id].upstreamNodes.add(plant.id);
        if (dist) metrics[wh.id].downstreamNodes.add(dist.id);
      }
    });

    return metrics;
  }, [activeRecords]);

  // Active supply chain entities based on global SKU / Category filters
  const activeNetwork = useMemo(() => {
    const isFiltered =
      filters.sku !== 'All' ||
      filters.category !== 'All' ||
      filters.brand !== 'All' ||
      filters.plant !== 'All' ||
      filters.distributor !== 'All';

    const plantIds = new Set<string>();
    const distributorIds = new Set<string>();
    const warehouseIds = new Set<string>();

    activeRecords.forEach((r) => {
      const plant = INDIA_PLANTS.find((p) => p.name === r.Plant);
      const dist = INDIA_DISTRIBUTORS.find((d) => d.name === r.Distributor);
      if (plant) plantIds.add(plant.id);
      if (dist) {
        distributorIds.add(dist.id);
        if (dist.motherWarehouseId) warehouseIds.add(dist.motherWarehouseId);
      }
    });

    // Also include warehouses fed by active plants
    if (warehouseIds.size === 0 && plantIds.size > 0) {
      plantIds.forEach((pId) => {
        const plant = INDIA_PLANTS.find((p) => p.id === pId);
        if (plant?.motherWarehouseId) warehouseIds.add(plant.motherWarehouseId);
      });
    }

    return {
      isFiltered,
      plantIds,
      distributorIds,
      warehouseIds,
      activeRecordsCount: activeRecords.length,
    };
  }, [activeRecords, filters]);

  // Compute multi-tier flow routes (Plant ➔ Warehouse ➔ Distributor)
  const flowRoutes = useMemo(() => {
    const routeMap = new Map<string, FlowRoute>();

    // Route Tier 1: Plant ➔ Mother Warehouse
    activeRecords.forEach((r) => {
      const plant = INDIA_PLANTS.find((p) => p.name === r.Plant);
      const dist = INDIA_DISTRIBUTORS.find((d) => d.name === r.Distributor);
      if (!plant || !dist) return;

      const wh = INDIA_MOTHER_WAREHOUSES.find((w) => w.id === dist.motherWarehouseId);
      if (!wh) return;

      const routeKey1 = `${plant.id}->${wh.id}`;
      const existing1 = routeMap.get(routeKey1);
      if (existing1) {
        existing1.volumeUnits += r.Units_Sold;
        existing1.salesINR += r.Sales_INR;
      } else {
        routeMap.set(routeKey1, {
          id: routeKey1,
          from: plant,
          to: wh,
          type: 'plant_to_wh',
          isActive: true,
          volumeUnits: r.Units_Sold,
          salesINR: r.Sales_INR,
          skuCount: 1,
        });
      }

      // Route Tier 2: Mother Warehouse ➔ Distributor
      const routeKey2 = `${wh.id}->${dist.id}`;
      const existing2 = routeMap.get(routeKey2);
      if (existing2) {
        existing2.volumeUnits += r.Units_Sold;
        existing2.salesINR += r.Sales_INR;
      } else {
        routeMap.set(routeKey2, {
          id: routeKey2,
          from: wh,
          to: dist,
          type: 'wh_to_dist',
          isActive: true,
          volumeUnits: r.Units_Sold,
          salesINR: r.Sales_INR,
          skuCount: 1,
        });
      }
    });

    // If no active transactions match the filter, fallback to primary structural connections
    if (routeMap.size === 0) {
      INDIA_PLANTS.forEach((plant) => {
        if (plant.motherWarehouseId) {
          const wh = INDIA_MOTHER_WAREHOUSES.find((w) => w.id === plant.motherWarehouseId);
          if (wh) {
            const key = `${plant.id}->${wh.id}`;
            routeMap.set(key, {
              id: key,
              from: plant,
              to: wh,
              type: 'plant_to_wh',
              isActive: true,
              volumeUnits: 0,
              salesINR: 0,
              skuCount: 0,
            });
          }
        }
      });

      INDIA_DISTRIBUTORS.forEach((dist) => {
        if (dist.motherWarehouseId) {
          const wh = INDIA_MOTHER_WAREHOUSES.find((w) => w.id === dist.motherWarehouseId);
          if (wh) {
            const key = `${wh.id}->${dist.id}`;
            routeMap.set(key, {
              id: key,
              from: wh,
              to: dist,
              type: 'wh_to_dist',
              isActive: true,
              volumeUnits: 0,
              salesINR: 0,
              skuCount: 0,
            });
          }
        }
      });
    }

    return Array.from(routeMap.values());
  }, [activeRecords]);

  // Bi-directional interactive trace calculation when a node is clicked
  const inspectionTrace = useMemo(() => {
    if (!selectedNode) {
      return {
        isTracing: false,
        tracedNodeIds: new Set<string>(),
        tracedRouteIds: new Set<string>(),
        traceTitle: '',
        traceSubtitle: '',
        upstreamCount: 0,
        downstreamCount: 0,
      };
    }

    const tracedNodeIds = new Set<string>([selectedNode.id]);
    const tracedRouteIds = new Set<string>();
    let traceTitle = '';
    let traceSubtitle = '';
    let upstreamCount = 0;
    let downstreamCount = 0;

    if (selectedNode.type === 'plant') {
      // DOWNSTREAM INSPECTION: Plant ➔ Warehouses ➔ Distributors
      const directWarehouses = new Set<string>();
      const directDistributors = new Set<string>();

      flowRoutes.forEach((route) => {
        if (route.from.id === selectedNode.id && route.type === 'plant_to_wh') {
          directWarehouses.add(route.to.id);
          tracedNodeIds.add(route.to.id);
          tracedRouteIds.add(route.id);
        }
      });

      flowRoutes.forEach((route) => {
        if (directWarehouses.has(route.from.id) && route.type === 'wh_to_dist') {
          directDistributors.add(route.to.id);
          tracedNodeIds.add(route.to.id);
          tracedRouteIds.add(route.id);
        }
      });

      downstreamCount = directDistributors.size;
      traceTitle = `Downstream Distribution Trace: ${selectedNode.name}`;
      traceSubtitle = `Tracing goods flow from manufacturing plant ➔ ${directWarehouses.size} Mother DCs ➔ ${directDistributors.size} Regional Distributors`;
    } else if (selectedNode.type === 'distributor') {
      // UPSTREAM INSPECTION: Distributor ⬅ Warehouse ⬅ Plants
      const servingWarehouses = new Set<string>();
      const sourcingPlants = new Set<string>();

      flowRoutes.forEach((route) => {
        if (route.to.id === selectedNode.id && route.type === 'wh_to_dist') {
          servingWarehouses.add(route.from.id);
          tracedNodeIds.add(route.from.id);
          tracedRouteIds.add(route.id);
        }
      });

      flowRoutes.forEach((route) => {
        if (servingWarehouses.has(route.to.id) && route.type === 'plant_to_wh') {
          sourcingPlants.add(route.from.id);
          tracedNodeIds.add(route.from.id);
          tracedRouteIds.add(route.id);
        }
      });

      upstreamCount = sourcingPlants.size;
      traceTitle = `Upstream Supply Trace: ${selectedNode.name}`;
      traceSubtitle = `Tracing replenishment back to ${servingWarehouses.size} Regional Mother DC ⬅ ${sourcingPlants.size} Origin Plants`;
    } else if (selectedNode.type === 'mother_warehouse') {
      // HUB INSPECTION: Plants ➔ Warehouse ➔ Distributors
      const supplyingPlants = new Set<string>();
      const servicedDistributors = new Set<string>();

      flowRoutes.forEach((route) => {
        if (route.to.id === selectedNode.id && route.type === 'plant_to_wh') {
          supplyingPlants.add(route.from.id);
          tracedNodeIds.add(route.from.id);
          tracedRouteIds.add(route.id);
        }
      });

      flowRoutes.forEach((route) => {
        if (route.from.id === selectedNode.id && route.type === 'wh_to_dist') {
          servicedDistributors.add(route.to.id);
          tracedNodeIds.add(route.to.id);
          tracedRouteIds.add(route.id);
        }
      });

      upstreamCount = supplyingPlants.size;
      downstreamCount = servicedDistributors.size;
      traceTitle = `Hub Multi-Echelon Trace: ${selectedNode.name}`;
      traceSubtitle = `Sourced from ${supplyingPlants.size} manufacturing plants ➔ central staging ➔ dispatching to ${servicedDistributors.size} distributor hubs`;
    }

    return {
      isTracing: true,
      tracedNodeIds,
      tracedRouteIds,
      traceTitle,
      traceSubtitle,
      upstreamCount,
      downstreamCount,
    };
  }, [selectedNode, flowRoutes]);

  // Reset node trace selection
  const handleResetTrace = () => {
    setSelectedNode(null);
  };

  // Robust tooltip positioning handler: calculates exact container pixel coordinates
  // and smartly decides whether to place above or below so it NEVER gets cut off
  const handleNodeMouseEnter = (node: LogisticsNode, e: React.MouseEvent<SVGElement>) => {
    const container = mapContainerRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const targetRect = e.currentTarget.getBoundingClientRect();

    // Center coordinates of hovered node inside mapContainer
    const centerX = targetRect.left - containerRect.left + targetRect.width / 2;
    const centerY = targetRect.top - containerRect.top + targetRect.height / 2;

    // Tooltip height is ~240px. If node is in the top 270px of the container,
    // place tooltip BELOW the node so it never overflows top boundary!
    const placeBelow = centerY < 270;

    // Clamp horizontal coordinate between 170px and (width - 170px) so tooltip never overflows sides
    const minX = 175;
    const maxX = Math.max(minX, containerRect.width - 175);
    const clampedX = Math.min(Math.max(centerX, minX), maxX);

    setHoveredTooltip({
      node,
      pixelX: clampedX,
      pixelY: centerY,
      placeBelow,
    });
  };

  const handleNodeMouseLeave = () => {
    setHoveredTooltip(null);
  };

  // Determine if a node should be highlighted/dimmed/hidden
  const getNodeVisibility = (node: LogisticsNode) => {
    // If tracing a specific node
    if (inspectionTrace.isTracing) {
      const isTraced = inspectionTrace.tracedNodeIds.has(node.id);
      if (!isTraced) {
        return { isVisible: !hideUnconnected, opacity: hideUnconnected ? 0 : 0.15, isHighlighted: false };
      }
      return { isVisible: true, opacity: 1, isHighlighted: true };
    }

    // If filtered by SKU or Category
    if (activeNetwork.isFiltered) {
      let isNodeActive = false;
      if (node.type === 'plant') isNodeActive = activeNetwork.plantIds.has(node.id);
      else if (node.type === 'mother_warehouse') isNodeActive = activeNetwork.warehouseIds.has(node.id);
      else if (node.type === 'distributor') isNodeActive = activeNetwork.distributorIds.has(node.id);

      if (!isNodeActive) {
        return { isVisible: !hideUnconnected, opacity: hideUnconnected ? 0 : 0.2, isHighlighted: false };
      }
      return { isVisible: true, opacity: 1, isHighlighted: true };
    }

    // Default: all active
    return { isVisible: true, opacity: 1, isHighlighted: false };
  };

  return (
    <div className="bg-[#FAFBF9] rounded-2xl border border-[#34a1a5]/30 shadow-sm flex flex-col relative">
      {/* Top Header & Context Banner */}
      <div className="p-4 bg-gradient-to-r from-white via-[#ffedd5]/30 to-white border-b border-[#34a1a5]/20 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#004c4c] flex items-center justify-center text-white shadow-md">
            <Compass className="w-5 h-5 text-[#ffedd5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-[#002d2d] tracking-tight">
                Pan-India Supply Chain Geospatial Network
              </h2>
              {activeNetwork.isFiltered && (
                <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-[#ff6b68]/15 text-[#004c4c] border border-[#ff6b68]/30 flex items-center gap-1">
                  <Filter className="w-3 h-3 text-[#ff6b68]" />
                  <span>Filtered for {filters.sku !== 'All' ? filters.sku.split(' ')[0] : filters.category}</span>
                </span>
              )}
            </div>
            <p className="text-[12px] text-[#133838] font-medium">
              Accurate TopoJSON projection of 8 Plants ➔ 3 Central Mother DCs ➔ 13 Regional Distributors with bi-directional trace
            </p>
          </div>
        </div>

        {/* Global Controls & Reset Buttons */}
        <div className="flex items-center gap-2">
          {inspectionTrace.isTracing && (
            <button
              onClick={handleResetTrace}
              className="px-3 py-1.5 rounded-xl bg-[#ff6b68] hover:bg-[#ff5252] text-white text-[11.5px] font-bold flex items-center gap-1.5 shadow-sm transition-all duration-200 cursor-pointer"
              title="Reset inspection selection and show all routes for current selection"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Selection / Show All for SKU</span>
            </button>
          )}

          {activeNetwork.isFiltered && (
            <button
              onClick={onResetFilters}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-[#ffedd5]/50 border border-[#34a1a5]/40 text-[#004c4c] text-[11.5px] font-bold flex items-center gap-1.5 transition-all duration-200 cursor-pointer shadow-xs"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear Slicers</span>
            </button>
          )}

          {/* Focus Mode Switch: Dim vs Hide Unconnected */}
          <button
            onClick={() => setHideUnconnected(!hideUnconnected)}
            className={`px-3 py-1.5 rounded-xl text-[11.5px] font-bold border transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
              hideUnconnected
                ? 'bg-[#004c4c] text-white border-[#004c4c]'
                : 'bg-white text-[#004c4c] border-[#34a1a5]/30 hover:bg-[#ffedd5]/40'
            }`}
            title="Toggle between ghosting and completely hiding inactive nodes"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{hideUnconnected ? 'Hiding Unconnected' : 'Dimming Unconnected'}</span>
          </button>
        </div>
      </div>

      {/* Active Tracing Status Announcement Bar */}
      {inspectionTrace.isTracing && (
        <div className="px-4 py-2.5 bg-[#ffedd5] border-b border-[#ff6b68]/30 flex items-center justify-between gap-3 text-[#002d2d] text-xs font-semibold animate-fadeIn">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff6b68]" />
            <strong className="text-[#004c4c] font-black">{inspectionTrace.traceTitle}:</strong>
            <span>{inspectionTrace.traceSubtitle}</span>
          </div>
          <button
            onClick={handleResetTrace}
            className="text-[11px] underline text-[#004c4c] hover:text-[#ff6b68] cursor-pointer font-bold"
          >
            Back to Full Network View
          </button>
        </div>
      )}

      {/* Main Map Container */}
      <div
        ref={mapContainerRef}
        className="relative flex-1 min-h-[640px] lg:min-h-[720px] bg-[#f5f8f8] flex items-center justify-center p-2 sm:p-4"
      >
        {/* Floating Interactive Legend & Layer Toggles (Top-Left) */}
        <div className="absolute top-4 left-4 z-20 bg-white/95 backdrop-blur-md p-3.5 rounded-2xl border border-[#34a1a5]/30 shadow-lg max-w-[280px]">
          <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-[#34a1a5]/20">
            <span className="text-[11.5px] font-black text-[#002d2d] flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#004c4c]" />
              <span>Multi-Tier Network Legend</span>
            </span>
            <span className="text-[10px] text-[#34a1a5] font-bold">Toggle Tiers</span>
          </div>

          <div className="flex flex-col gap-1.5">
            {/* Tier 1: Plants */}
            <button
              onClick={() => setShowPlants(!showPlants)}
              className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all duration-150 cursor-pointer border ${
                showPlants
                  ? 'bg-[#004c4c] text-white border-[#004c4c]'
                  : 'bg-white text-[#004c4c]/60 border-gray-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-[3px] bg-[#004c4c] border border-white flex items-center justify-center text-[9px] text-white shadow-xs">
                  🏭
                </span>
                <span>Manufacturing Plants</span>
              </div>
              <span className="text-[10px] opacity-80">8 Units</span>
            </button>

            {/* Tier 2: Warehouses */}
            <button
              onClick={() => setShowWarehouses(!showWarehouses)}
              className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all duration-150 cursor-pointer border ${
                showWarehouses
                  ? 'bg-[#ff6b68] text-white border-[#ff6b68]'
                  : 'bg-white text-[#ff6b68]/60 border-gray-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rotate-45 bg-[#ff6b68] border border-white flex items-center justify-center text-[8px] text-white shadow-xs">
                  🔶
                </span>
                <span>Central Mother DCs</span>
              </div>
              <span className="text-[10px] opacity-80">3 Hubs</span>
            </button>

            {/* Tier 3: Distributors */}
            <button
              onClick={() => setShowDistributors(!showDistributors)}
              className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all duration-150 cursor-pointer border ${
                showDistributors
                  ? 'bg-[#34a1a5] text-white border-[#34a1a5]'
                  : 'bg-white text-[#34a1a5]/60 border-gray-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full bg-[#34a1a5] border border-white flex items-center justify-center text-[9px] text-white shadow-xs">
                  🏪
                </span>
                <span>Regional Distributors</span>
              </div>
              <span className="text-[10px] opacity-80">13 Dist.</span>
            </button>

            {/* Flow Arcs & Labels Sub-toggles */}
            <div className="pt-2 mt-1 border-t border-[#34a1a5]/15 flex items-center justify-between text-[10.5px] font-semibold text-[#004c4c]">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showFlowRoutes}
                  onChange={(e) => setShowFlowRoutes(e.target.checked)}
                  className="rounded text-[#004c4c] focus:ring-[#34a1a5] w-3 h-3 cursor-pointer"
                />
                <span>Flow Routes</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showNodeLabels}
                  onChange={(e) => setShowNodeLabels(e.target.checked)}
                  className="rounded text-[#004c4c] focus:ring-[#34a1a5] w-3 h-3 cursor-pointer"
                />
                <span>City Labels</span>
              </label>
            </div>
          </div>
        </div>

        {/* Floating Network Quick Info Helper (Bottom-Left) */}
        <div className="absolute bottom-4 left-4 z-20 bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-[#34a1a5]/30 shadow-lg hidden md:flex items-center gap-2.5 text-xs">
          <span className="font-black text-[#002d2d] flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-[#004c4c]" />
            <span>Click any node to trace:</span>
          </span>
          <span className="text-[#133838] font-medium">
            Plant (downstream) • Warehouse (hub bi-directional) • Distributor (upstream)
          </span>
        </div>

        {/* Hover / Inspection Floating Tooltip Card - Fully Protected from Edge Clipping */}
        {hoveredTooltip && (
          <div
            className="absolute z-40 pointer-events-none transition-all duration-100 ease-out"
            style={{
              left: `${hoveredTooltip.pixelX}px`,
              top: hoveredTooltip.placeBelow
                ? `${hoveredTooltip.pixelY + 16}px`
                : `${hoveredTooltip.pixelY - 16}px`,
              transform: hoveredTooltip.placeBelow ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
            }}
          >
            <div className="bg-white/95 backdrop-blur-md p-3.5 rounded-2xl border border-[#004c4c]/30 shadow-2xl min-w-[260px] max-w-[320px] text-[#002d2d]">
              {/* Header */}
              <div className="flex items-start justify-between gap-2 border-b border-[#34a1a5]/20 pb-2 mb-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    {hoveredTooltip.node.type === 'plant' && (
                      <span className="px-1.5 py-0.5 rounded text-[9.5px] font-black bg-[#004c4c] text-white">
                        PLANT
                      </span>
                    )}
                    {hoveredTooltip.node.type === 'mother_warehouse' && (
                      <span className="px-1.5 py-0.5 rounded text-[9.5px] font-black bg-[#ff6b68] text-white">
                        MOTHER DC
                      </span>
                    )}
                    {hoveredTooltip.node.type === 'distributor' && (
                      <span className="px-1.5 py-0.5 rounded text-[9.5px] font-black bg-[#34a1a5] text-white">
                        DISTRIBUTOR
                      </span>
                    )}
                    <h4 className="text-xs font-black text-[#002d2d] leading-snug">
                      {hoveredTooltip.node.name}
                    </h4>
                  </div>
                  <p className="text-[10.5px] text-[#133838] font-medium mt-0.5 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-[#34a1a5]" />
                    <span>
                      {hoveredTooltip.node.city}, {hoveredTooltip.node.state}
                    </span>
                  </p>
                </div>
              </div>

              {/* Volume & Capacity Metrics */}
              <div className="grid grid-cols-2 gap-2 text-[10.5px] mb-2 bg-[#ffedd5]/40 p-2 rounded-xl">
                <div>
                  <span className="text-[#133838] block text-[9.5px] font-semibold">Handled Sales</span>
                  <strong className="text-[#004c4c] text-xs font-black">
                    {formatINR(nodeMetrics[hoveredTooltip.node.id]?.salesINR || 0)}
                  </strong>
                </div>
                <div>
                  <span className="text-[#133838] block text-[9.5px] font-semibold">Units Dispatched</span>
                  <strong className="text-[#004c4c] text-xs font-black">
                    {formatUnits(nodeMetrics[hoveredTooltip.node.id]?.unitsSold || 0)}
                  </strong>
                </div>
              </div>

              {/* Active SKUs handled */}
              <div className="text-[10px]">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-[#004c4c] flex items-center gap-1">
                    <Package className="w-3 h-3" />
                    <span>Active SKUs ({nodeMetrics[hoveredTooltip.node.id]?.skuSet.size || 0}):</span>
                  </span>
                  <span className="text-[9.5px] text-[#34a1a5] font-semibold">
                    {filters.sku !== 'All' ? 'Matched Filter' : 'Top Items'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 max-h-[60px] overflow-hidden">
                  {nodeMetrics[hoveredTooltip.node.id]?.skuList.slice(0, 3).map((sku, i) => (
                    <span
                      key={i}
                      className="px-1.5 py-0.5 rounded-md bg-white border border-[#34a1a5]/25 text-[9px] font-semibold text-[#002d2d] truncate max-w-[140px]"
                    >
                      {sku.split(' ').slice(0, 3).join(' ')}
                    </span>
                  ))}
                  {(nodeMetrics[hoveredTooltip.node.id]?.skuList.length || 0) > 3 && (
                    <span className="px-1.5 py-0.5 rounded-md bg-[#ffedd5] text-[9px] font-bold text-[#004c4c]">
                      +{(nodeMetrics[hoveredTooltip.node.id]?.skuList.length || 0) - 3} more
                    </span>
                  )}
                </div>
              </div>

              {/* Trace Hint */}
              <div className="mt-2.5 pt-2 border-t border-[#34a1a5]/15 text-[9.5px] font-bold text-[#ff6b68] flex items-center justify-between">
                <span>Click node for supply chain trace</span>
                <ChevronRight className="w-3 h-3" />
              </div>
            </div>
          </div>
        )}

        {/* Clean Static SVG GEO-CANVAS with Standard Mercator Projection (No Zoom In / Out Jitter) */}
        <svg
          viewBox={`0 0 ${MAP_CONFIG.viewBoxWidth} ${MAP_CONFIG.viewBoxHeight}`}
          className="w-full h-auto max-h-[850px] select-none"
          onMouseLeave={() => setHoveredTooltip(null)}
        >
          {/* SVG Definitions for Gradients, Markers, and Filters */}
          <defs>
            {/* National Land Gradient */}
            <radialGradient id="indiaLandGradient" cx="45%" cy="45%" r="65%">
              <stop offset="0%" stopColor="#ffedd5" stopOpacity="0.85" />
              <stop offset="60%" stopColor="#fff7ed" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#fed7aa" stopOpacity="0.75" />
            </radialGradient>

            {/* Ocean Waters Radial Depth */}
            <radialGradient id="oceanShading" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#e0f2f1" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#b2dfdb" stopOpacity="0.3" />
            </radialGradient>

            {/* Arrowhead Marker: Plant to Warehouse (Deep Pine Teal) */}
            <marker
              id="arrow-plant-wh"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 9 5 L 0 9 z" fill="#004c4c" />
            </marker>

            {/* Arrowhead Marker: Warehouse to Distributor (Ocean Teal) */}
            <marker
              id="arrow-wh-dist"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 9 5 L 0 9 z" fill="#34a1a5" />
            </marker>

            {/* Arrowhead Marker: Highlighted Traced Route (Coral Rose) */}
            <marker
              id="arrow-traced"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 9 5 L 0 9 z" fill="#ff6b68" />
            </marker>

            {/* Node Drop Shadows & Glow */}
            <filter id="nodeGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#004c4c" floodOpacity="0.35" />
            </filter>

            <filter id="diamondGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="2" stdDeviation="3.5" floodColor="#ff6b68" floodOpacity="0.45" />
            </filter>

            {/* Flow line gradients */}
            <linearGradient id="activeRoutePlantGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#004c4c" />
              <stop offset="100%" stopColor="#34a1a5" />
            </linearGradient>

            <linearGradient id="activeRouteDistGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ff6b68" />
              <stop offset="100%" stopColor="#34a1a5" />
            </linearGradient>
          </defs>

          {/* Master Viewport Group (Static, stable framing) */}
          <g>
            {/* Ambient Coastal Water Labels */}
            <g opacity="0.4" pointerEvents="none">
              <text x="110" y="620" fill="#34a1a5" fontSize="13" fontWeight="900" letterSpacing="4">
                ARABIAN SEA
              </text>
              <text x="590" y="630" fill="#34a1a5" fontSize="13" fontWeight="900" letterSpacing="4">
                BAY OF BENGAL
              </text>
              <text x="290" y="910" fill="#34a1a5" fontSize="11" fontWeight="900" letterSpacing="3">
                INDIAN OCEAN
              </text>
            </g>

            {/* HIGH-ACCURACY TOPOLOGY: 37 INDIAN STATES & UNION TERRITORIES */}
            <g id="india-states-layer">
              {statePathData.map((state) => {
                const isHovered = hoveredStateName === state.name;
                return (
                  <path
                    key={state.id}
                    d={state.pathD}
                    fill={isHovered ? '#fed7aa' : 'url(#indiaLandGradient)'}
                    stroke="#004c4c"
                    strokeWidth={isHovered ? '1.4' : '0.75'}
                    strokeOpacity={isHovered ? '0.9' : '0.45'}
                    className="transition-colors duration-150 cursor-default"
                    onMouseEnter={() => setHoveredStateName(state.name)}
                    onMouseLeave={() => setHoveredStateName(null)}
                  >
                    <title>{state.name}</title>
                  </path>
                );
              })}
            </g>

            {/* DIRECTIONAL CONNECTING SUPPLY FLOW ARCS (Plant ➔ Warehouse ➔ Distributor) */}
            {showFlowRoutes && (
              <g id="supply-chain-flow-routes">
                {flowRoutes.map((route) => {
                  const fromCoord = getNodeCoordinates(route.from);
                  const toCoord = getNodeCoordinates(route.to);

                  // Calculate curved quadratic bezier control point
                  const dx = toCoord.x - fromCoord.x;
                  const dy = toCoord.y - fromCoord.y;
                  const dist = Math.sqrt(dx * dx + dy * dy);
                  const curvature = dist * 0.15;
                  const midX = (fromCoord.x + toCoord.x) / 2 - (dy / dist) * curvature;
                  const midY = (fromCoord.y + toCoord.y) / 2 + (dx / dist) * curvature;

                  // Traced or active route styling
                  const isTraced = inspectionTrace.isTracing && inspectionTrace.tracedRouteIds.has(route.id);
                  const isDimmed = inspectionTrace.isTracing && !isTraced;
                  const isPlantTier = route.type === 'plant_to_wh';

                  if (isDimmed && hideUnconnected) return null;

                  return (
                    <g
                      key={route.id}
                      opacity={isTraced ? 1 : isDimmed ? 0.12 : activeNetwork.isFiltered ? 0.95 : 0.45}
                      className="transition-opacity duration-200"
                    >
                      <path
                        d={`M ${fromCoord.x},${fromCoord.y} Q ${midX},${midY} ${toCoord.x},${toCoord.y}`}
                        fill="none"
                        stroke={
                          isTraced
                            ? '#ff6b68'
                            : isPlantTier
                            ? 'url(#activeRoutePlantGrad)'
                            : 'url(#activeRouteDistGrad)'
                        }
                        strokeWidth={isTraced ? 2.8 : isPlantTier ? 2.0 : 1.6}
                        strokeDasharray={isTraced ? '8 4' : isPlantTier ? '6 4' : '4 3'}
                        strokeLinecap="round"
                        markerEnd={
                          isTraced
                            ? 'url(#arrow-traced)'
                            : isPlantTier
                            ? 'url(#arrow-plant-wh)'
                            : 'url(#arrow-wh-dist)'
                        }
                      />
                    </g>
                  );
                })}
              </g>
            )}

            {/* TIER 3: REGIONAL DISTRIBUTOR HOUSES (Teal Circles) */}
            {showDistributors && (
              <g id="distributors-layer">
                {INDIA_DISTRIBUTORS.map((dist) => {
                  const coord = getNodeCoordinates(dist);
                  const vis = getNodeVisibility(dist);
                  const isSelected = selectedNode?.id === dist.id;
                  const isHovered = hoveredTooltip?.node.id === dist.id;

                  if (!vis.isVisible) return null;

                  return (
                    <g
                      key={dist.id}
                      opacity={vis.opacity}
                      className="cursor-pointer transition-all duration-200"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedNode(selectedNode?.id === dist.id ? null : dist);
                      }}
                      onMouseEnter={(e) => handleNodeMouseEnter(dist, e)}
                      onMouseLeave={handleNodeMouseLeave}
                    >
                      {/* Clean static halo ring when selected or highlighted (no expanding moving circles) */}
                      {(isSelected || vis.isHighlighted) && (
                        <circle
                          cx={coord.x}
                          cy={coord.y}
                          r={isSelected ? 11 : 8.5}
                          fill="none"
                          stroke="#34a1a5"
                          strokeWidth={isSelected ? 2 : 1.5}
                          strokeOpacity={isSelected ? 0.85 : 0.55}
                          strokeDasharray={isSelected ? '3 2' : undefined}
                        />
                      )}

                      {/* Distributor Node Circle */}
                      <circle
                        cx={coord.x}
                        cy={coord.y}
                        r={isSelected ? 8 : isHovered ? 7 : 5.5}
                        fill={isSelected ? '#004c4c' : '#34a1a5'}
                        stroke="#ffffff"
                        strokeWidth={isSelected ? 2.5 : 1.8}
                        filter="url(#nodeGlow)"
                      />

                      {/* Node Inner Pin Dot */}
                      <circle cx={coord.x} cy={coord.y} r={isSelected ? 3 : 2} fill="#ffedd5" />

                      {/* Distributor City Name Label */}
                      {showNodeLabels && (
                        <text
                          x={coord.x}
                          y={coord.y + 13}
                          textAnchor="middle"
                          fill="#002d2d"
                          fontSize={isSelected ? '10' : '8.5'}
                          fontWeight={isSelected ? '900' : '700'}
                          className="pointer-events-none select-none drop-shadow-sm"
                        >
                          {dist.city}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            )}

            {/* TIER 2: CENTRAL MOTHER WAREHOUSES / TRANSSHIPMENT HUBS (Amber/Coral Diamonds) */}
            {showWarehouses && (
              <g id="mother-warehouses-layer">
                {INDIA_MOTHER_WAREHOUSES.map((wh) => {
                  const coord = getNodeCoordinates(wh);
                  const vis = getNodeVisibility(wh);
                  const isSelected = selectedNode?.id === wh.id;
                  const isHovered = hoveredTooltip?.node.id === wh.id;

                  if (!vis.isVisible) return null;

                  return (
                    <g
                      key={wh.id}
                      opacity={vis.opacity}
                      className="cursor-pointer transition-all duration-200"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedNode(selectedNode?.id === wh.id ? null : wh);
                      }}
                      onMouseEnter={(e) => handleNodeMouseEnter(wh, e)}
                      onMouseLeave={handleNodeMouseLeave}
                    >
                      {/* Clean static halo diamond when selected or highlighted */}
                      {(isSelected || vis.isHighlighted) && (
                        <polygon
                          points={`${coord.x},${coord.y - (isSelected ? 16 : 14)} ${
                            coord.x + (isSelected ? 16 : 14)
                          },${coord.y} ${coord.x},${coord.y + (isSelected ? 16 : 14)} ${
                            coord.x - (isSelected ? 16 : 14)
                          },${coord.y}`}
                          fill="none"
                          stroke="#ff6b68"
                          strokeWidth={isSelected ? 2.2 : 1.6}
                          strokeOpacity={isSelected ? 0.9 : 0.6}
                          strokeDasharray={isSelected ? '4 2' : undefined}
                        />
                      )}

                      {/* Outer Diamond Shape (Rotated Square) */}
                      <polygon
                        points={`${coord.x},${coord.y - (isSelected ? 14 : isHovered ? 12 : 10)} ${
                          coord.x + (isSelected ? 14 : isHovered ? 12 : 10)
                        },${coord.y} ${coord.x},${coord.y + (isSelected ? 14 : isHovered ? 12 : 10)} ${
                          coord.x - (isSelected ? 14 : isHovered ? 12 : 10)
                        },${coord.y}`}
                        fill="#ff6b68"
                        stroke="#ffffff"
                        strokeWidth={isSelected ? 2.5 : 2.0}
                        filter="url(#diamondGlow)"
                      />

                      {/* Inner Diamond Core */}
                      <polygon
                        points={`${coord.x},${coord.y - 5} ${coord.x + 5},${coord.y} ${coord.x},${
                          coord.y + 5
                        } ${coord.x - 5},${coord.y}`}
                        fill="#ffedd5"
                      />

                      {/* Warehouse Hub Label */}
                      {showNodeLabels && (
                        <g className="pointer-events-none select-none">
                          <rect
                            x={coord.x - 48}
                            y={coord.y + 12}
                            width="96"
                            height="16"
                            rx="4"
                            fill="#ffffff"
                            fillOpacity="0.88"
                            stroke="#ff6b68"
                            strokeWidth="0.8"
                          />
                          <text
                            x={coord.x}
                            y={coord.y + 24}
                            textAnchor="middle"
                            fill="#002d2d"
                            fontSize="9"
                            fontWeight="900"
                          >
                            {wh.shortName}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}
              </g>
            )}

            {/* TIER 1: MANUFACTURING PLANTS (Solid Blue-Teal Rounded Squares) */}
            {showPlants && (
              <g id="manufacturing-plants-layer">
                {INDIA_PLANTS.map((plant) => {
                  const coord = getNodeCoordinates(plant);
                  const vis = getNodeVisibility(plant);
                  const isSelected = selectedNode?.id === plant.id;
                  const isHovered = hoveredTooltip?.node.id === plant.id;

                  if (!vis.isVisible) return null;

                  const size = isSelected ? 22 : isHovered ? 19 : 16;
                  const half = size / 2;

                  return (
                    <g
                      key={plant.id}
                      opacity={vis.opacity}
                      className="cursor-pointer transition-all duration-200"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedNode(selectedNode?.id === plant.id ? null : plant);
                      }}
                      onMouseEnter={(e) => handleNodeMouseEnter(plant, e)}
                      onMouseLeave={handleNodeMouseLeave}
                    >
                      {/* Clean static halo frame when selected or highlighted */}
                      {(isSelected || vis.isHighlighted) && (
                        <rect
                          x={coord.x - half - 4}
                          y={coord.y - half - 4}
                          width={size + 8}
                          height={size + 8}
                          rx="6"
                          fill="none"
                          stroke="#004c4c"
                          strokeWidth={isSelected ? 2.2 : 1.6}
                          strokeOpacity={isSelected ? 0.9 : 0.6}
                          strokeDasharray={isSelected ? '4 2' : undefined}
                        />
                      )}

                      {/* Plant Square Body */}
                      <rect
                        x={coord.x - half}
                        y={coord.y - half}
                        width={size}
                        height={size}
                        rx="4"
                        fill="#004c4c"
                        stroke="#ffffff"
                        strokeWidth={isSelected ? 2.5 : 2.0}
                        filter="url(#nodeGlow)"
                      />

                      {/* Mini Factory Icon Silhouette Inside Square */}
                      <path
                        d={`M ${coord.x - 4} ${coord.y + 4} L ${coord.x - 4} ${coord.y - 1} L ${coord.x - 1} ${
                          coord.y + 1
                        } L ${coord.x - 1} ${coord.y - 2} L ${coord.x + 2} ${coord.y} L ${coord.x + 2} ${
                          coord.y - 4
                        } L ${coord.x + 4} ${coord.y - 4} L ${coord.x + 4} ${coord.y + 4} Z`}
                        fill="#ffedd5"
                        stroke="#004c4c"
                        strokeWidth="0.4"
                      />

                      {/* Plant Label Badge */}
                      {showNodeLabels && (
                        <g className="pointer-events-none select-none">
                          <rect
                            x={coord.x - 34}
                            y={coord.y - half - 16}
                            width="68"
                            height="14"
                            rx="3"
                            fill="#004c4c"
                            fillOpacity="0.9"
                          />
                          <text
                            x={coord.x}
                            y={coord.y - half - 6}
                            textAnchor="middle"
                            fill="#ffffff"
                            fontSize="8.5"
                            fontWeight="900"
                          >
                            {plant.shortName}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}
              </g>
            )}
          </g>
        </svg>
      </div>

      {/* Bottom Inspection Panel & Multi-Echelon Trace Summary */}
      <div className="p-4 bg-white border-t border-[#34a1a5]/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {selectedNode ? (
          <div className="flex-1 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-sm ${
                  selectedNode.type === 'plant'
                    ? 'bg-[#004c4c]'
                    : selectedNode.type === 'mother_warehouse'
                    ? 'bg-[#ff6b68]'
                    : 'bg-[#34a1a5]'
                }`}
              >
                {selectedNode.type === 'plant' && <Factory className="w-5 h-5 text-white" />}
                {selectedNode.type === 'mother_warehouse' && <Warehouse className="w-5 h-5 text-white" />}
                {selectedNode.type === 'distributor' && <Store className="w-5 h-5 text-white" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-[#002d2d]">{selectedNode.name}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#ffedd5] font-bold text-[#004c4c]">
                    {selectedNode.city}, {selectedNode.state}
                  </span>
                </div>
                <div className="text-[11px] text-[#133838] font-medium flex items-center gap-3 mt-0.5">
                  <span>
                    Volume: <strong className="text-[#004c4c]">{formatINR(nodeMetrics[selectedNode.id]?.salesINR || 0)}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Units: <strong className="text-[#004c4c]">{formatUnits(nodeMetrics[selectedNode.id]?.unitsSold || 0)}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Connected Nodes:{' '}
                    <strong className="text-[#004c4c]">{inspectionTrace.tracedNodeIds.size - 1}</strong>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (selectedNode.type === 'plant') onFilterChange('plant', selectedNode.name);
                  else if (selectedNode.type === 'distributor') onFilterChange('distributor', selectedNode.name);
                }}
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-[#ffedd5] border border-[#34a1a5]/40 text-[#004c4c] text-[11px] font-bold transition-all duration-150 cursor-pointer shadow-xs"
              >
                Apply as Global Filter
              </button>
              <button
                onClick={handleResetTrace}
                className="px-3 py-1.5 rounded-xl bg-[#004c4c] hover:bg-[#003838] text-white text-[11px] font-bold transition-all duration-150 cursor-pointer shadow-sm flex items-center gap-1.5"
              >
                <RotateCcw className="w-3 h-3 text-[#ffedd5]" />
                <span>Show All Network</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-wrap items-center justify-between gap-3 text-xs text-[#133838]">
            <div className="flex items-center gap-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-[#34a1a5] block">Active Network</span>
                <span className="text-xs font-black text-[#002d2d]">
                  {activeNetwork.isFiltered
                    ? `${activeNetwork.plantIds.size} Plants • ${activeNetwork.warehouseIds.size} DCs • ${activeNetwork.distributorIds.size} Dist.`
                    : '8 Plants • 3 Mother DCs • 13 Distributors'}
                </span>
              </div>
              <div className="hidden sm:block h-6 w-px bg-gray-200" />
              <div className="hidden sm:block">
                <span className="text-[10px] uppercase font-bold text-[#34a1a5] block">SKU / Product Line</span>
                <span className="text-xs font-black text-[#002d2d]">
                  {filters.sku !== 'All'
                    ? filters.sku.split(' ')[0]
                    : filters.category !== 'All'
                    ? filters.category
                    : 'All 640 SKUs (100%)'}
                </span>
              </div>
              <div className="hidden sm:block h-6 w-px bg-gray-200" />
              <div className="hidden sm:block">
                <span className="text-[10px] uppercase font-bold text-[#34a1a5] block">Active Routes</span>
                <span className="text-xs font-black text-[#002d2d]">{flowRoutes.length} Trunk & Local Lanes</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#133838] font-medium hidden md:inline">
                Click any plant, warehouse or distributor to isolate its end-to-end supply chain
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
