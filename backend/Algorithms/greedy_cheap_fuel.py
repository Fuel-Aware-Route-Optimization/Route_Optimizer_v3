from __future__ import annotations
from typing import Any, Dict, List
from Algorithms.base import BaseAlgorithm

class GreedyCheapFuel(BaseAlgorithm):

    name = "GreedyCheapFuel"

    def solve(self, graph, start: str, goal: str, vehicle, weights: Dict[str, float], positions=None) -> Dict[str, Any]:
        cur = start
        cap = vehicle.tank_capacity
        cons = vehicle.consumption_per_dist
        fuel = vehicle.fuel
        w_dist = float(weights.get("distance", 1.0))
        w_fuel = float(weights.get("fuel", 1.0))

        total_dist = 0.0
        fuel_cost = 0.0
        path = [cur]
        expanded = 0
        hops = 0

        while cur != goal and hops < 5_000:
            expanded += 1
            if positions:
                gx, gy = positions[goal]
                candidates = sorted(graph.neighbors(cur), key=lambda e: (
                    (positions[e.to][0]-gx)**2 + (positions[e.to][1]-gy)**2, e.distance))
            else:
                candidates = sorted(graph.neighbors(cur), key=lambda e: e.distance)

            if not candidates:
                break

            nxt = None
            for e in candidates:
                need = e.distance * cons
                if fuel + 1e-9 < need:
                    next_price = graph.fuel_price(e.to)
                    here_price = graph.fuel_price(cur)
                    if next_price < here_price:
                        buy = max(0.0, min(cap - fuel, need - fuel))
                    else:
                        buy = max(0.0, cap - fuel)
                    fuel_cost += buy * here_price
                    fuel += buy
                if fuel + 1e-9 >= need:
                    nxt = e
                    break
            if nxt is None:
                break

            fuel -= nxt.distance * cons
            cur = nxt.to
            path.append(cur)
            total_dist += nxt.distance
            hops += 1

        objective = w_dist * total_dist + w_fuel * fuel_cost
        if cur != goal:
            return {"path": path, "total_distance": float('inf'), "fuel_cost": float('inf'),
                    "objective": float('inf'), "expanded": expanded, "notes": "Failed to reach goal"}
        return {"path": path, "total_distance": total_dist, "fuel_cost": fuel_cost,
                "objective": objective, "expanded": expanded, "notes": "Greedy baseline"}
