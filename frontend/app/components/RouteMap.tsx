"use client";

import React from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Tooltip,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type NodeId = string;

export interface MapNode {
  id: NodeId;
  x: number; // lon
  y: number; // lat
  fuel_price: number;
}

export interface MapEdge {
  from_: NodeId;
  to: NodeId;
  distance: number;
  geometry: number[][] | null;
}

interface RouteMapProps {
  nodes: MapNode[];
  edges: MapEdge[];
  routePath: NodeId[];
  fromNode?: NodeId;
  toNode?: NodeId;
}

function buildEdgeKey(a: NodeId, b: NodeId) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

// auto-fit map to show all nodes
function FitBounds({ nodes }: { nodes: MapNode[] }) {
  const map = useMap();
  React.useEffect(() => {
    if (nodes.length > 0) {
      const bounds = L.latLngBounds(
        nodes.map((n) => [n.y, n.x] as [number, number])
      );
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [nodes, map]);
  return null;
}

export default function RouteMap({
  nodes,
  edges,
  routePath,
  fromNode,
  toNode,
}: RouteMapProps) {
  const nodesById = React.useMemo(() => {
    const m = new Map<NodeId, MapNode>();
    nodes.forEach((n) => m.set(n.id, n));
    return m;
  }, [nodes]);

  // build edge geometry lookup
  const edgeGeoByKey = React.useMemo(() => {
    const byKey = new Map<string, { from: NodeId; to: NodeId; positions: [number, number][] }>();
    for (const edge of edges) {
      const from = nodesById.get(edge.from_);
      const to = nodesById.get(edge.to);
      if (!from || !to) continue;
      const key = buildEdgeKey(edge.from_, edge.to);
      const positions: [number, number][] =
        edge.geometry && edge.geometry.length > 0
          ? edge.geometry.map(([lon, lat]) => [lat, lon])
          : [[from.y, from.x], [to.y, to.x]];
      byKey.set(key, { from: edge.from_, to: edge.to, positions });
    }
    return byKey;
  }, [edges, nodesById]);

  // build the blue polyline segments from the route path
  const routeSegments = React.useMemo(() => {
    const segs: { key: string; positions: [number, number][] }[] = [];
    if (routePath.length < 2) return segs;

    for (let i = 0; i < routePath.length - 1; i++) {
      const fromId = routePath[i];
      const toId = routePath[i + 1];
      const edgeKey = buildEdgeKey(fromId, toId);
      const edge = edgeGeoByKey.get(edgeKey);

      if (edge) {
        // flip if direction doesn't match
        const positions =
          edge.from === fromId ? edge.positions : [...edge.positions].reverse();
        segs.push({ key: `${fromId}-${toId}-${i}`, positions });
      } else {
        const fromN = nodesById.get(fromId);
        const toN = nodesById.get(toId);
        if (fromN && toN) {
          segs.push({
            key: `${fromId}-${toId}-${i}`,
            positions: [[fromN.y, fromN.x], [toN.y, toN.x]],
          });
        }
      }
    }
    return segs;
  }, [routePath, edgeGeoByKey, nodesById]);

  const pathSet = React.useMemo(() => new Set(routePath), [routePath]);

  const center: [number, number] = React.useMemo(() => {
    if (nodes.length === 0) return [32, -100];
    const avgY = nodes.reduce((s, n) => s + n.y, 0) / nodes.length;
    const avgX = nodes.reduce((s, n) => s + n.x, 0) / nodes.length;
    return [avgY, avgX];
  }, [nodes]);

  if (nodes.length === 0) {
    return <div className="map-loading">no route data yet</div>;
  }

  return (
    <MapContainer center={center} zoom={6} className="route-map" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      <FitBounds nodes={nodes} />

      {/* blue polyline for computed route */}
      {routeSegments.map((seg) => (
        <Polyline
          key={seg.key}
          positions={seg.positions}
          pathOptions={{ color: "#57a0ff", weight: 4, opacity: 0.9 }}
        />
      ))}

      {/* city markers */}
      {nodes.map((node) => {
        const isStart = node.id === fromNode;
        const isEnd = node.id === toNode;
        const isOnRoute = pathSet.has(node.id);
        return (
          <CircleMarker
            key={node.id}
            center={[node.y, node.x]}
            radius={isStart || isEnd ? 9 : isOnRoute ? 7 : 4}
            pathOptions={{
              color: isStart ? "#10B981" : isEnd ? "#EF4444" : isOnRoute ? "#57a0ff" : "#888",
              fillColor: isStart ? "#10B981" : isEnd ? "#EF4444" : isOnRoute ? "#57a0ff" : "#555",
              fillOpacity: 0.85,
              weight: 2,
            }}
          >
            <Tooltip direction="top" offset={[0, -8]}>
              <span>
                {node.id} — ${node.fuel_price.toFixed(2)}/gal
                {isStart ? " (start)" : isEnd ? " (end)" : ""}
              </span>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
