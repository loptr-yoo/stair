
export enum ElementType {
  // --- 1. 基础结构与边界 (Structural & Boundary) ---
  SLAB = 'floor_slab',           // 楼板：定义层高和水平平面
  WALL_EXTERNAL = 'exterior_wall', // 外墙：定义建筑轮廓，不可随意改动
  WALL_INTERNAL = 'partition_wall',// 内隔墙：用于房间分隔
  SHEAR_WALL = 'shear_wall',     // 剪力墙：结构核心，生成逻辑中的硬约束
  PILLAR = 'pillar',             // 柱体：按轴网分布的结构点
  ROOF_PARAPET = 'parapet',      // 女儿墙：顶层边界实体

  // --- 2. 核心筒与垂直交通 (Core & Vertical Circulation) ---
  ELEVATOR_SHAFT = 'elevator_shaft', // 电梯井道：贯穿全层的垂直空腔
  STAIRCASE = 'staircase',           // 楼梯间：包含踏步、平台和扶手
  SERVICE_SHAFT = 'pipe_shaft',      // 管井：走水、电、烟道的垂直通道（决定厨卫位置）
  ELEVATOR_HALL = 'elevator_lobby',  // 电梯厅：垂直交通到水平交通的转换空间

  // --- 3. 水平交通 (Horizontal Circulation) ---
  CORRIDOR = 'corridor',         // 走廊/楼道：连接各房间的水平通路
  LOBBY = 'lobby',               // 门厅/大堂：公共区域的宏观节点
  AISLE = 'aisle',               // 室内过道：大房间内部的小型动线

  // --- 4. 洞口与连接 (Apertures & Connectors) ---
  DOOR = 'door',                 // 标准门：定义空间可达性 (Reachability)
  FIRE_DOOR = 'fire_door',       // 防火门：安全分区的连接点
  WINDOW = 'window',             // 窗户：影响采光率和功能房判定 (如卧室必须有窗)
  ENTRANCE = 'entrance',         // 楼层/建筑入口
  EXIT = 'exit',                 // 安全出口

  // --- 5. 外部延展与附件 (Extension & Attachments) ---
  BALCONY = 'balcony',           // 阳台：室内向外的延伸实体
  TERRACE = 'terrace',           // 露台：通常位于退台或顶层
  AIR_CON_LEDGE = 'ac_ledge',    // 空调位/设备平台：外部悬挂实体
  WINDOW_SILL = 'window_sill',   // 窗台：影响家具布置的实体细节

  // --- 6. 宏观功能分区 (Macro Functional Zones - 用于标注生成目标) ---
  // 注意：在宏观生成中，这些通常作为带标签的“空间实体”处理
  KITCHEN_ZONE = 'kitchen',      // 厨房：必须靠近管井
  BATHROOM_ZONE = 'bathroom',    // 卫生间：必须靠近管井
  LIVING_ZONE = 'living_room',   // 起居室：通常拥有最大的采光面
  BEDROOM_ZONE = 'bedroom',      // 卧室：私密空间，需考虑开窗
  STORAGE_ZONE = 'storage',      // 储藏间：无窗亦可的功能块

  // --- 7. 安全与基础设施末端 (Safety & MEP) ---
  FIRE_HYDRANT = 'fire_hydrant', // 消火栓：固定在走廊墙体的实体
  SAFE_EXIT_SIGN = 'exit_sign',  // 安全出口标识
  HVAC_VENT = 'hvac_vent',       // 通风口：影响天花板布局
  ELECTRICAL_BOX = 'dist_box',   // 配电箱：通常位于门口或走廊

  // --- 8. Legacy / Parking Elements (Compatibility) ---
  // These members are added to support legacy parking logic used in geometry and geminiService files.
  PARKING_SPACE = 'parking_space',
  WALL = 'wall',
  ROAD = 'road',
  RAMP = 'ramp',
  CHARGING_STATION = 'charging_station',
  FIRE_EXTINGUISHER = 'fire_extinguisher',
  GROUND = 'ground',
  SAFE_EXIT = 'safe_exit',
  GUIDANCE_SIGN = 'guidance_sign',
  SIDEWALK = 'sidewalk',
  SPEED_BUMP = 'speed_bump',
  LANE_LINE = 'lane_line',
  ELEVATOR = 'elevator'
}

export interface LayoutElement {
  id: string;
  type: ElementType | string; // Allow string for backward compatibility/flexibility
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number; // Degrees
  label?: string;
  subType?: string; // For things like 'lane_line' direction
}

export interface ParkingLayout {
  width: number;
  height: number;
  elements: LayoutElement[];
}

export interface ConstraintViolation {
  elementId: string;
  targetId?: string; // If colliding with another element
  type: 'overlap' | 'out_of_bounds' | 'invalid_dimension' | 'placement_error' | 'connectivity_error' | 'width_mismatch';
  message: string;
}
