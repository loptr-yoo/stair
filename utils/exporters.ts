
import { ParkingLayout } from '../types';

export const generatePythonScript = (layout: ParkingLayout): string => {
  const jsonData = JSON.stringify(layout, null, 2);
  
  return `
import json
import matplotlib.pyplot as plt
import matplotlib.patches as patches

# 1. 传入地下停车场的布局 JSON 数据
layout_json = '''
${jsonData}
'''

def draw_layout(json_str):
    data = json.loads(json_str)
    width = data.get('width', 800)
    height = data.get('height', 600)
    
    # 颜色映射表 (语义 -> 颜色)
    color_map = {
        'exterior_wall': '#0f172a',
        'partition_wall': '#334155',
        'floor_slab': '#020617',
        'parking_space': '#1e293b',
        'road': '#1e293b',
        'living_room': '#0ea5e9',
        'bedroom': '#8b5cf6',
        'kitchen': '#eab308',
        'bathroom': '#14b8a6',
        'door': '#f8fafc',
        'window': '#7dd3fc',
        'staircase': '#b45309',
        'elevator_shaft': '#991b1b'
    }

    fig, ax = plt.subplots(figsize=(12, 8))
    ax.set_xlim(0, width)
    ax.set_ylim(height, 0) # 反转 Y 轴以符合绘图习惯
    ax.set_aspect('equal')
    ax.set_facecolor('#020617')

    # 绘制元素
    for el in data.get('elements', []):
        t = el.get('type')
        color = color_map.get(t, '#475569')
        alpha = 0.2 if '_room' in t or '_zone' in t else 1.0
        
        rect = patches.Rectangle(
            (el['x'], el['y']), 
            el['width'], 
            el['height'], 
            angle=el.get('rotation', 0),
            linewidth=0, 
            edgecolor='none', 
            facecolor=color, 
            alpha=alpha
        )
        ax.add_patch(rect)
        
        # 绘制标签 (可选)
        if el.get('label'):
            ax.text(el['x'] + el['width']/2, el['y'] + el['height']/2, 
                    el['label'], color='white', fontsize=6, 
                    ha='center', va='center', fontweight='bold')

    plt.title("AI Semantic Layout Visualization (Exported from ParkingViz)", color='white')
    plt.tight_layout()
    plt.show()

if __name__ == "__main__":
    draw_layout(layout_json)
`;
};

// New function to download pure JSON
export const downloadJson = (layout: ParkingLayout) => {
    const content = JSON.stringify(layout, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `layout_data_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

export const downloadTextFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};
