
import { LayoutElement, ParkingLayout, ConstraintViolation, ElementType } from '../types';

// --- SPATIAL PARTITIONING SYSTEM ---
class SpatialGrid {
    private grid = new Map<string, LayoutElement[]>();
    private cellSize: number;

    constructor(cellSize = 100) {
        this.cellSize = cellSize;
    }

    private getKeysForElement(el: LayoutElement): string[] {
        const startX = Math.floor(el.x / this.cellSize);
        const endX = Math.floor((el.x + el.width) / this.cellSize);
        const startY = Math.floor(el.y / this.cellSize);
        const endY = Math.floor((el.y + el.height) / this.cellSize);

        const keys: string[] = [];
        for (let x = startX; x <= endX; x++) {
            for (let y = startY; y <= endY; y++) {
                keys.push(`${x},${y}`);
            }
        }
        return keys;
    }

    add(el: LayoutElement) {
        const keys = this.getKeysForElement(el);
        keys.forEach(key => {
            if (!this.grid.has(key)) {
                this.grid.set(key, []);
            }
            this.grid.get(key)!.push(el);
        });
    }

    getPotentialCollisions(el: LayoutElement): LayoutElement[] {
        const keys = this.getKeysForElement(el);
        const candidates = new Set<LayoutElement>();
        
        keys.forEach(key => {
            const cell = this.grid.get(key);
            if (cell) {
                cell.forEach(candidate => {
                    if (candidate.id !== el.id) {
                        candidates.add(candidate);
                    }
                });
            }
        });

        return Array.from(candidates);
    }
}

// --- GEOMETRY UTILS ---
const EPSILON = 1.0;

export function getRotatedAABB(el: LayoutElement) {
    const corners = getCorners(el);
    const xs = corners.map(p => p.x);
    const ys = corners.map(p => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
    };
}

function getCorners(el: LayoutElement): {x: number, y: number}[] {
    const rad = ((el.rotation || 0) * Math.PI) / 180;
    const cx = el.x + el.width / 2;
    const cy = el.y + el.height / 2;

    return [
        { x: el.x, y: el.y },
        { x: el.x + el.width, y: el.y },
        { x: el.x + el.width, y: el.y + el.height },
        { x: el.x, y: el.y + el.height },
    ].map(p => {
        const dx = p.x - cx;
        const dy = p.y - cy;
        return {
            x: cx + dx * Math.cos(rad) - dy * Math.sin(rad),
            y: cy + dx * Math.sin(rad) + dy * Math.cos(rad),
        };
    });
}

/**
 * Separating Axis Theorem (SAT) for OBB collision detection
 */
function isColliding(el1: LayoutElement, el2: LayoutElement): boolean {
    const corners1 = getCorners(el1);
    const corners2 = getCorners(el2);

    const getAxes = (corners: {x: number, y: number}[]) => {
        const axes = [];
        for (let i = 0; i < corners.length; i++) {
            const p1 = corners[i];
            const p2 = corners[(i + 1) % corners.length];
            const edge = { x: p1.x - p2.x, y: p1.y - p2.y };
            const normal = { x: -edge.y, y: edge.x };
            const length = Math.sqrt(normal.x * normal.x + normal.y * normal.y);
            axes.push({ x: normal.x / length, y: normal.y / length });
        }
        return axes;
    };

    const project = (corners: {x: number, y: number}[], axis: {x: number, y: number}) => {
        let min = Infinity;
        let max = -Infinity;
        for (const p of corners) {
            const dot = p.x * axis.x + p.y * axis.y;
            if (dot < min) min = dot;
            if (dot > max) max = dot;
        }
        return { min, max };
    };

    const axes = [...getAxes(corners1), ...getAxes(corners2)];

    for (const axis of axes) {
        const p1 = project(corners1, axis);
        const p2 = project(corners2, axis);
        if (p1.max < p2.min || p2.max < p1.min) {
            return false;
        }
    }

    return true;
}

export function getIntersectionBox(r1: LayoutElement, r2: LayoutElement) {
    // For rotated elements, we use the AABB of the rotated corners for area estimation
    const a1 = getRotatedAABB(r1);
    const a2 = getRotatedAABB(r2);

    const x1 = Math.max(a1.x, a2.x);
    const y1 = Math.max(a1.y, a2.y);
    const x2 = Math.min(a1.x + a1.width, a2.x + a2.width);
    const y2 = Math.min(a1.y + a1.height, a2.y + a2.height);

    const width = x2 - x1;
    const height = y2 - y1;

    if (width > 0 && height > 0) {
        // If they overlap in AABB, check if they actually collide using SAT
        if (isColliding(r1, r2)) {
            return { x: x1, y: y1, width, height };
        }
    }
    return null;
}

function isTouching(a: LayoutElement, b: LayoutElement, margin = 2.0): boolean {
    const aAABB = getRotatedAABB(a);
    const bAABB = getRotatedAABB(b);

    const aRect = { l: aAABB.x - margin, r: aAABB.x + aAABB.width + margin, t: aAABB.y - margin, b: aAABB.y + aAABB.height + margin };
    const bRect = { l: bAABB.x - margin, r: bAABB.x + bAABB.width + margin, t: bAABB.y - margin, b: bAABB.y + bAABB.height + margin };

    const overlapX = Math.min(aRect.r, bRect.r) - Math.max(aRect.l, bRect.l);
    const overlapY = Math.min(aRect.b, bRect.b) - Math.max(aRect.t, bRect.t);

    return overlapX >= 0 && overlapY >= 0;
}

function isPointCovered(x: number, y: number, elements: LayoutElement[], padding = 10): boolean {
    return elements.some(el => {
        const aabb = getRotatedAABB(el);
        return x >= aabb.x - padding && x <= aabb.x + aabb.width + padding &&
               y >= aabb.y - padding && y <= aabb.y + aabb.height + padding;
    });
}

export function validateLayout(layout: ParkingLayout): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];
  if (!layout || !layout.elements) return violations;

  const grid = new SpatialGrid(100);
  layout.elements.forEach(el => grid.add(el));

  // 1. Out of Bounds
  layout.elements.forEach(el => {
    if (el.x < -EPSILON || el.x + el.width > layout.width + EPSILON || el.y < -EPSILON || el.y + el.height > layout.height + EPSILON) {
        violations.push({
            elementId: el.id,
            type: 'out_of_bounds',
            message: `Element '${el.type}' is outside boundary.`
        });
    }
  });

  // 2. Overlap Checks (Architectural Logic)
  const solidStructure = new Set([
    ElementType.WALL_EXTERNAL, ElementType.WALL_INTERNAL, ElementType.SHEAR_WALL, 
    ElementType.PILLAR, ElementType.ELEVATOR_SHAFT, ElementType.STAIRCASE, ElementType.SERVICE_SHAFT
  ]);
  
  const zones = new Set([
      ElementType.LIVING_ZONE, ElementType.BEDROOM_ZONE, ElementType.KITCHEN_ZONE, 
      ElementType.BATHROOM_ZONE, ElementType.STORAGE_ZONE, ElementType.CORRIDOR, ElementType.LOBBY
  ]);

  layout.elements.forEach(el1 => {
      const candidates = grid.getPotentialCollisions(el1);
      candidates.forEach(el2 => {
          if (el1.id >= el2.id) return; 

          // Zones should not overlap each other
          if (zones.has(el1.type as ElementType) && zones.has(el2.type as ElementType)) {
              const box = getIntersectionBox(el1, el2);
              if (box && box.width > 2 && box.height > 2) {
                  violations.push({
                      elementId: el1.id, targetId: el2.id, type: 'overlap',
                      message: `Zones overlap: ${el1.type} vs ${el2.type}`
                  });
              }
          }

          // Structural elements overlap check
          if (solidStructure.has(el1.type as ElementType) && solidStructure.has(el2.type as ElementType)) {
              // Internal walls can meet, but large overlaps are bad
              const box = getIntersectionBox(el1, el2);
              if (box) {
                  const area = box.width * box.height;
                  const minArea = Math.min(el1.width * el1.height, el2.width * el2.height);
                  if (area > minArea * 0.5) { // Major structural overlap
                      violations.push({
                          elementId: el1.id, targetId: el2.id, type: 'overlap',
                          message: `Structural conflict: ${el1.type} overlaps significantly with ${el2.type}`
                      });
                  }
              }
          }
      });
  });

  // 3. Opening Constraints (Windows & Doors)
  const extWalls = layout.elements.filter(e => e.type === ElementType.WALL_EXTERNAL);
  const corridors = layout.elements.filter(e => e.type === ElementType.CORRIDOR || e.type === ElementType.LOBBY);

  layout.elements.forEach(item => {
      if (item.type === ElementType.WINDOW) {
          const isOnExtWall = extWalls.some(wall => isTouching(wall, item, 5));
          if (!isOnExtWall) {
              violations.push({
                  elementId: item.id, type: 'placement_error',
                  message: `Window must be placed on an exterior wall.`
              });
          }
      }

      if (item.type === ElementType.DOOR || item.type === ElementType.FIRE_DOOR) {
          const connectsToCirculation = corridors.some(corr => isTouching(corr, item, 5));
          const connectsToRoom = layout.elements.some(el => zones.has(el.type as ElementType) && el.type !== ElementType.CORRIDOR && isTouching(el, item, 5));
          const isOnWall = layout.elements.some(el => (el.type === ElementType.WALL_INTERNAL || el.type === ElementType.WALL_EXTERNAL || el.type === ElementType.SHEAR_WALL) && isTouching(el, item, 5));
          
          if (!isOnWall) {
              violations.push({
                  elementId: item.id, type: 'placement_error',
                  message: `Door must be placed on a wall (internal or external).`
              });
          }

          if (!connectsToCirculation && !connectsToRoom) {
              violations.push({
                  elementId: item.id, type: 'connectivity_error',
                  message: `Door is floating. It must connect a room to a corridor or lobby.`
              });
          }
      }
  });

  // 4. Room Functionality & Connectivity Checks
  const allZones = layout.elements.filter(e => zones.has(e.type as ElementType));
  allZones.forEach(room => {
      // Basic accessibility
      const hasDoor = layout.elements.some(el => (el.type === ElementType.DOOR || el.type === ElementType.FIRE_DOOR) && isTouching(el, room, 5));
      if (!hasDoor) {
          violations.push({
              elementId: room.id, type: 'connectivity_error',
              message: `${room.type} is inaccessible. Every room must have at least one door.`
          });
      }

      // Natural light for primary rooms
      if (room.type === ElementType.BEDROOM_ZONE || room.type === ElementType.LIVING_ZONE) {
          const hasWindow = layout.elements.some(el => el.type === ElementType.WINDOW && isTouching(el, room, 5));
          if (!hasWindow) {
              violations.push({
                  elementId: room.id, type: 'placement_error',
                  message: `${room.type} lacks a window. Primary rooms require natural light.`
              });
          }
      }
  });

  // 5. Global Connectivity (Graph-based reachability)
  // We want to ensure all rooms can reach a "Corridor" or "Lobby" and eventually an "Entrance"
  // For simplicity in this stage, we check if all rooms are connected to the circulation network.
  const circulationIds = new Set(corridors.map(c => c.id));
  const visited = new Set<string>();
  const queue: string[] = corridors.length > 0 ? [corridors[0].id] : [];
  
  // BFS to find all reachable circulation elements
  while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const current = layout.elements.find(e => e.id === currentId)!;
      layout.elements.forEach(other => {
          if (circulationIds.has(other.id) && !visited.has(other.id) && isTouching(current, other, 10)) {
              queue.push(other.id);
          }
      });
  }

  if (corridors.length > 0 && visited.size < corridors.length) {
      violations.push({
          elementId: 'circulation_network',
          type: 'connectivity_error',
          message: `Circulation network is fragmented. Corridors must be connected to each other.`
      });
  }

  // 5. Perimeter Shell Check
  const corners = [
      { x: 0, y: 0, label: "Top-Left" },
      { x: layout.width, y: 0, label: "Top-Right" },
      { x: layout.width, y: layout.height, label: "Bottom-Right" },
      { x: 0, y: layout.height, label: "Bottom-Left" }
  ];
  corners.forEach(pt => {
      if (!isPointCovered(pt.x, pt.y, extWalls, 15)) {
          violations.push({
              elementId: `wall_gap_${pt.label}`,
              type: 'connectivity_error',
              message: `Building shell is broken at ${pt.label}. Exterior walls must form a closed loop.`
          });
      }
  });

  // 6. Furniture & Interior Logic (Phase 2)
  const furnitureTypes = new Set(['bed', 'sofa', 'dining_table', 'desk', 'wardrobe', 'toilet', 'sink', 'cabinet']);
  const furniture = layout.elements.filter(e => furnitureTypes.has(e.type));
  
  furniture.forEach(item => {
      // a. Containment Check: Must be fully inside a valid zone
      const itemAABB = getRotatedAABB(item);
      const containerZone = layout.elements.find(zone => 
          zones.has(zone.type as ElementType) &&
          itemAABB.x >= zone.x - 1 && itemAABB.y >= zone.y - 1 &&
          (itemAABB.x + itemAABB.width) <= (zone.x + zone.width + 1) &&
          (itemAABB.y + itemAABB.height) <= (zone.y + zone.height + 1)
      );

      if (!containerZone) {
          violations.push({
              elementId: item.id, type: 'placement_error',
              message: `Furniture '${item.type}' (${item.label}) is outside its room zone or clipping through walls.`
          });
      } else {
          // b. Semantic Logic: Is it in the right room?
          const roomType = containerZone.type;
          let isLogical = true;
          if (item.type === 'bed' && roomType !== ElementType.BEDROOM_ZONE) isLogical = false;
          if ((item.type === 'toilet' || item.type === 'sink') && roomType !== ElementType.BATHROOM_ZONE) isLogical = false;
          if (item.type === 'cabinet' && roomType !== ElementType.KITCHEN_ZONE) isLogical = false;
          if (item.type === 'sofa' && roomType !== ElementType.LIVING_ZONE) isLogical = false;

          if (!isLogical) {
              violations.push({
                  elementId: item.id, type: 'placement_error',
                  message: `Logical error: '${item.type}' should not be placed in a ${roomType}.`
              });
          }
      }

      // c. Clipping Check: Overlap with structural elements or other furniture
      const candidates = grid.getPotentialCollisions(item);
      candidates.forEach(other => {
          // Structural clipping
          if (solidStructure.has(other.type as ElementType)) {
              if (isColliding(item, other)) {
                  violations.push({
                      elementId: item.id, targetId: other.id, type: 'overlap',
                      message: `Furniture '${item.type}' is clipping into structural ${other.type}.`
                  });
              }
          }
          // Furniture-on-furniture clipping
          if (furnitureTypes.has(other.type)) {
              if (item.id >= other.id) return;
              if (isColliding(item, other)) {
                  violations.push({
                      elementId: item.id, targetId: other.id, type: 'overlap',
                      message: `Furniture overlap: ${item.type} and ${other.type} are occupying the same space.`
                  });
              }
          }
      });
  });

  return violations;
}
