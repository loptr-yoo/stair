
import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import * as d3 from 'd3';
import { ElementType, LayoutElement } from '../types';
import { useStore } from '../store';

// STANDARDIZED ARCHITECTURAL PALETTE - NO STROKES
export const ELEMENT_STYLES: Record<string, { fill: string; opacity: number }> = {
  // --- 1. Structure (Uniform Wall Color) ---
  [ElementType.SLAB]: { fill: '#1e293b', opacity: 0.15 },
  [ElementType.WALL_EXTERNAL]: { fill: '#475569', opacity: 1 },
  [ElementType.WALL_INTERNAL]: { fill: '#475569', opacity: 1 },
  [ElementType.SHEAR_WALL]: { fill: '#475569', opacity: 1 },
  [ElementType.PILLAR]: { fill: '#475569', opacity: 1 },
  
  // --- 2. Vertical Cores ---
  [ElementType.ELEVATOR_SHAFT]: { fill: '#991b1b', opacity: 1 },
  [ElementType.STAIRCASE]: { fill: '#b45309', opacity: 1 },
  [ElementType.SERVICE_SHAFT]: { fill: '#064e3b', opacity: 1 },

  // --- 3. Zones (Uniform Floor Color) ---
  [ElementType.LIVING_ZONE]: { fill: '#1e293b', opacity: 0.15 },
  [ElementType.BEDROOM_ZONE]: { fill: '#1e293b', opacity: 0.15 },
  [ElementType.KITCHEN_ZONE]: { fill: '#1e293b', opacity: 0.15 },
  [ElementType.BATHROOM_ZONE]: { fill: '#1e293b', opacity: 0.15 },
  [ElementType.CORRIDOR]: { fill: '#1e293b', opacity: 0.15 },
  [ElementType.STORAGE_ZONE]: { fill: '#1e293b', opacity: 0.15 },

  // --- 4. Furniture & Fixtures (Fixed Semantic Table) ---
  'bed': { fill: '#4338ca', opacity: 1 },
  'sofa': { fill: '#be123c', opacity: 1 },
  'dining_table': { fill: '#78350f', opacity: 1 },
  'desk': { fill: '#0e7490', opacity: 1 },
  'wardrobe': { fill: '#6d28d9', opacity: 1 },
  'toilet': { fill: '#f8fafc', opacity: 1 },
  'sink': { fill: '#1d4ed8', opacity: 1 },
  'cabinet': { fill: '#059669', opacity: 1 },

  // --- 5. Openings ---
  [ElementType.DOOR]: { fill: '#f8fafc', opacity: 1 },
  [ElementType.WINDOW]: { fill: '#7dd3fc', opacity: 0.8 },
};

export interface MapRendererHandle {
  downloadJpg: () => void;
}

const MapRenderer = forwardRef<MapRendererHandle>((props, ref) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const { layout, violations, showLabels } = useStore();

  useImperativeHandle(ref, () => ({
    downloadJpg: () => {
      if (!svgRef.current || !layout) return;
      const svgNode = svgRef.current;
      const zoomGroup = d3.select(svgNode).select("g.main-group");
      const prevTransform = zoomGroup.attr("transform");
      zoomGroup.attr("transform", null); 
      svgNode.setAttribute("width", layout.width.toString());
      svgNode.setAttribute("height", layout.height.toString());
      svgNode.setAttribute("viewBox", `0 0 ${layout.width} ${layout.height}`);

      const serializer = new XMLSerializer();
      let svgString = serializer.serializeToString(svgNode);
      if (!svgString.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
        svgString = svgString.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
      }
      
      if (prevTransform) zoomGroup.attr("transform", prevTransform);

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = layout.width;
        canvas.height = layout.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#020617"; 
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          const jpgUrl = canvas.toDataURL("image/jpeg", 0.95);
          const link = document.createElement("a");
          link.download = `blueprint_${Date.now()}.jpg`;
          link.href = jpgUrl;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      };
      img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgString)));
    }
  }));

  useEffect(() => {
    if (!layout || !svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); 

    const { width, height, elements } = layout;
    svg.attr("viewBox", `0 0 ${width} ${height}`)
       .attr("width", "100%")
       .attr("height", "100%")
       .style("shape-rendering", "geometricPrecision"); 
    
    const mainGroup = svg.append("g").attr("class", "main-group");
    
    // Z-Order: Higher index renders on top
    const zOrder = [
        ElementType.SLAB,
        ElementType.LIVING_ZONE, ElementType.BEDROOM_ZONE, ElementType.KITCHEN_ZONE, ElementType.BATHROOM_ZONE, ElementType.STORAGE_ZONE,
        ElementType.CORRIDOR, 
        'cabinet', 'wardrobe', 'desk', 'dining_table', 'sofa', 'bed', 'toilet', 'sink',
        ElementType.SERVICE_SHAFT, ElementType.STAIRCASE, ElementType.ELEVATOR_SHAFT,
        ElementType.WALL_INTERNAL, ElementType.WALL_EXTERNAL, ElementType.SHEAR_WALL, ElementType.PILLAR,
        ElementType.WINDOW, ElementType.DOOR
    ];
    
    const sortedElements = [...elements].sort((a, b) => {
      const idxA = zOrder.indexOf(a.type as string);
      const idxB = zOrder.indexOf(b.type as string);
      return (idxA === -1 ? 500 : idxA) - (idxB === -1 ? 500 : idxB);
    });

    mainGroup.selectAll("g.element")
      .data(sortedElements)
      .enter()
      .append("g")
      .attr("class", "element")
      .attr("transform", d => `translate(${d.x}, ${d.y}) rotate(${d.rotation || 0}, ${d.width/2}, ${d.height/2})`)
      .each(function(this: any, d) {
        const g = d3.select(this);
        const style = ELEMENT_STYLES[d.type as string] || { fill: '#475569', opacity: 0.5 };
        const w = d.width;
        const h = d.height;
        const cx = w / 2;
        const cy = h / 2;

        // Render solid geometry - Removed rx and strokes
        g.append("rect")
          .attr("width", w).attr("height", h)
          .attr("fill", style.fill)
          .attr("opacity", style.opacity)
          .attr("stroke", "none");

        // Functional Decorations (Minimalist, no border strokes)
        if (d.type === ElementType.STAIRCASE) {
            g.append("path")
             .attr("d", w > h ? `M 10 ${cy} L ${w-10} ${cy} M ${w-20} ${cy-5} L ${w-10} ${cy} L ${w-20} ${cy+5}` : `M ${cx} 10 L ${cx} ${h-10} M ${cx-5} ${h-20} L ${cx} ${h-10} L ${cx+5} ${h-20}`)
             .attr("stroke", "#ffffff").attr("fill", "none").attr("stroke-width", 1.5).attr("opacity", 0.4);
        }

        // Semantic Annotations
        if (showLabels) {
            const labelText = d.label || (d.type as string).toUpperCase().replace(/_/g, ' ');
            const isStructural = [ElementType.WALL_EXTERNAL, ElementType.WALL_INTERNAL, ElementType.SHEAR_WALL, ElementType.PILLAR].includes(d.type as ElementType);
            
            if (!isStructural && w > 20 && h > 12) {
                g.append("text")
                 .attr("x", cx)
                 .attr("y", cy)
                 .attr("text-anchor", "middle")
                 .attr("dominant-baseline", "middle")
                 .attr("fill", "#ffffff")
                 .attr("font-size", "6px")
                 .attr("font-family", "Inter, sans-serif")
                 .attr("font-weight", "700")
                 .attr("opacity", 0.8)
                 .attr("pointer-events", "none")
                 .text(labelText);
            }
        }

        if (violations.some(v => v.elementId === d.id)) {
            g.append("rect").attr("width", w).attr("height", h).attr("fill", "none").attr("stroke", "#ef4444").attr("stroke-width", 2).style("stroke-dasharray", "4,2");
        }
      });

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 15])
      .on("zoom", (event) => mainGroup.attr("transform", event.transform));
    svg.call(zoom);

    if (svgRef.current?.parentElement) {
        const { clientWidth: pw, clientHeight: ph } = svgRef.current.parentElement;
        const scale = Math.min(pw / width, ph / height) * 0.9;
        svg.call(zoom.transform, d3.zoomIdentity.translate((pw - width * scale) / 2, (ph - height * scale) / 2).scale(scale));
    }
  }, [layout, violations, showLabels]);

  return (
    <div className="w-full h-full bg-slate-950 rounded-lg overflow-hidden border border-slate-800 shadow-inner relative">
       <svg ref={svgRef} className="block cursor-grab active:cursor-grabbing w-full h-full" />
    </div>
  );
});

export default MapRenderer;
