
import { ParkingLayout, ConstraintViolation } from '../types';

export const PROMPTS = {
  generation: (description: string) => `
  You are a **Structural Architectural Planner**. 
  Generate the BASIC SHELL, ZONES, and CONNECTIVITY (Doors/Windows) for: "${description}".
  
  **CANVAS CONSTRAINTS**: Width: 800, Height: 600.
  
  **PHASE 1 - CORE STRUCTURE RULES**:
  1. **DO NOT GENERATE FURNITURE**: No beds, sofas, or tables yet.
  2. **ENVELOPE**:
     - 'exterior_wall' (thickness 15): Must form a continuous, closed boundary around the entire plan.
     - 'window' (length 40-80, thickness 15): Must be embedded WITHIN 'exterior_wall' sections. Every primary room (living, bedroom) MUST have at least one window.
  3. **PARTITIONS & ZONES**:
     - 'partition_wall' (thickness 10): Define internal rooms.
     - Create solid rectangles for 'living_room', 'bedroom', 'kitchen', 'bathroom', 'corridor', 'staircase', 'elevator_shaft'.
     - All zones must be fully enclosed by walls (exterior or partition).
  4. **LOGICAL CONNECTIVITY (DOORS & REACHABILITY)**:
     - 'door' (size ~30x10 or 10x30): **CRITICAL RULE**: Every room must be accessible.
     - **DOOR PLACEMENT**: A door MUST sit ON a wall (overlap it) and connect two adjacent spaces.
     - **REACHABILITY**: All rooms must connect to the 'corridor' or 'lobby' network. No room should be isolated.
     - 'fire_door': Use for 'staircase' and 'elevator_lobby' entry points.
  5. **CIRCULATION**:
     - The 'corridor' is the backbone. It must touch the doors of all rooms.

  **JSON OUTPUT FORMAT**:
  {
    "reasoning_plan": "Step-by-step structural logic",
    "width": 800, "height": 600,
    "elements": [
      {"t": "exterior_wall", "x": 0, "y": 0, "w": 800, "h": 15},
      {"t": "bedroom", "x": 15, "y": 15, "w": 250, "h": 200},
      {"t": "door", "x": 265, "y": 100, "w": 10, "h": 30, "l": "BEDROOM ENTRANCE"}
    ]
  }
  `,

  refinement: (simplifiedLayout: any, width: number, height: number) => `
    You are an **Interior Layout Engine**.
    Populate the EXISTING room zones with fixed furniture and fixtures.

    **FIXED TYPE VOCABULARY & SEMANTICS**:
    You MUST ONLY use the following types for furniture:
    - 'bed': Place ONLY in 'bedroom'.
    - 'sofa': Place in 'living_room'.
    - 'dining_table': Place in 'kitchen' or 'living_room'.
    - 'desk': Place in 'bedroom'.
    - 'wardrobe': Place in 'bedroom'.
    - 'toilet': Place ONLY in 'bathroom'.
    - 'sink': Place ONLY in 'bathroom'.
    - 'cabinet': Place in 'kitchen'.

    **PLACEMENT LOGIC**:
    1. **STRICT CONTAINMENT**: Furniture MUST be fully inside its designated room zone. Even a 1px overlap with a wall or being outside the room is a violation.
    2. **WALL-MOUNTED**: Most furniture must be placed adjacent to a 'partition_wall' or 'exterior_wall' but NOT overlapping it.
    3. **NON-BLOCKING**: Do not block 'door' areas or 'corridor' access. Leave clear walking paths.
    4. **SOLID BLOCKS**: Width and height must be realistic (e.g., Bed ~60x80, Sofa ~40x120).
    5. **ROTATION**: Provide a reasonable rotation 'r' (0, 90, 180, 270) so the furniture aligns with the walls.
    6. **SEMANTIC LABELS**: Every element MUST have a label 'l' (e.g., "DOUBLE BED", "3-SEATER SOFA").
    7. **NO CLIPPING**: Furniture must not overlap with other furniture or any structural elements (walls, pillars).

    **INCREMENTAL UPDATE**:
    - RETURN ONLY THE NEW FURNITURE ELEMENTS. Do not repeat existing walls or zones.

    **CONTEXT (Existing Structure)**: ${JSON.stringify(simplifiedLayout.elements)}

    **OUTPUT FORMAT**:
    {"elements": [{"t": "bed", "x": 40, "y": 40, "w": 60, "h": 80, "r": 90, "l": "KING BED"}]}
  `,

  fix: (layout: any, violations: any[]) => `
    You are a **Topological Constraint Solver**. 
    Fix gaps, floating doors, or overlapping rooms in the current plan.
    
    **CORE RULES TO ENFORCE**:
    1. **DOOR PLACEMENT**: Every door must overlap a wall. No floating doors.
    2. **REACHABILITY**: Every room must have a door connecting it to a corridor or another room.
    3. **CIRCULATION**: Corridors must be connected to each other.
    4. **SHELL**: Exterior walls must form a closed loop.
    5. **FURNITURE**: Must be fully inside room zones. No overlapping with walls or other furniture.

    **VIOLATIONS TO FIX**: ${JSON.stringify(violations)}
    **CURRENT LAYOUT**: ${JSON.stringify(layout)}
    
    **OUTPUT**: Return the FULL corrected JSON layout.
  `
};
