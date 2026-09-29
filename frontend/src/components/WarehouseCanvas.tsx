import React, { useRef, useEffect, useState, useCallback } from 'react';
import { WarehouseLayout, CellData, RobotInfo, ConflictReport, ReservationSummary, Reservation } from '../types/warehouse';
import { AMR } from './AMR';

interface WarehouseCanvasProps {
  layout: WarehouseLayout | null;
  robots: RobotInfo[];
  conflicts?: ConflictReport;
  reservations?: ReservationSummary;
  selectedRobotId: string | null;
  onSelectRobot: (robotId: string | null) => void;
  onCellClick: (x: number, y: number) => void;
  onSelectReservation?: (res: Reservation | null) => void;
  activeObstacleBrush: boolean;
  showGrid?: boolean;
  showLabels?: boolean;
  zoomLevel: number;
  panOffset: { x: number; y: number };
  onPanChange: (offset: { x: number; y: number }) => void;
  onZoomChange: (zoom: number) => void;
}

export const WarehouseCanvas: React.FC<WarehouseCanvasProps> = ({
  layout,
  robots,
  conflicts,
  reservations,
  selectedRobotId,
  onSelectRobot,
  onCellClick,
  onSelectReservation,
  activeObstacleBrush,
  showGrid = true,
  showLabels = true,
  zoomLevel,
  panOffset,
  onPanChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [hoveredCell, setHoveredCell] = useState<CellData | null>(null);
  const [hoveredRobot, setHoveredRobot] = useState<RobotInfo | null>(null);
  const [mouseScreenPos, setMouseScreenPos] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const [canvasDim, setCanvasDim] = useState<{ width: number; height: number }>({ width: 800, height: 571 });

  // Main Canvas Render Routine
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !layout) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const cols = layout.width;
    const rows = layout.height;

    ctx.save();
    // 1. Warehouse Perimeter / Concrete Floor Base
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(0, 0, width, height);

    // Apply Pan & Zoom
    ctx.translate(width / 2 + panOffset.x, height / 2 + panOffset.y);
    ctx.scale(zoomLevel, zoomLevel);
    ctx.translate(-width / 2, -height / 2);

    const cellW = width / cols;
    const cellH = height / rows;

    // 2. Draw Floor & Aisle Tiles
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * cellW;
        const y = r * cellH;
        const cell = layout.cells[r]?.[c];

        // Base epoxy floor tile
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(x, y, cellW, cellH);

        // Floor tile joints
        if (showGrid) {
          ctx.strokeStyle = '#cbd5e1';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(x, y, cellW, cellH);
        }

        // Aisle guidance markers
        if (cell && (cell.type === 'aisle' || cell.type === 'empty')) {
          ctx.fillStyle = '#94a3b8';
          ctx.beginPath();
          ctx.arc(x + cellW / 2, y + cellH / 2, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }

        // Intersection junction
        if (cell && cell.type === 'intersection') {
          ctx.fillStyle = '#edf2f7';
          ctx.fillRect(x, y, cellW, cellH);

          const isCentral = (c >= 12 && c <= 15 && (r === 7 || r === 8));
          ctx.strokeStyle = isCentral ? '#3b82f6' : '#94a3b8';
          ctx.lineWidth = isCentral ? 1.5 : 0.8;
          ctx.beginPath();
          ctx.arc(x + cellW / 2, y + cellH / 2, Math.min(cellW, cellH) * 0.32, 0, Math.PI * 2);
          ctx.stroke();

          if (isCentral) {
            ctx.fillStyle = 'rgba(59, 130, 246, 0.12)';
            ctx.beginPath();
            ctx.arc(x + cellW / 2, y + cellH / 2, Math.min(cellW, cellH) * 0.32, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    // 3. Draw Logistics Stations & Charging Docks
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = layout.cells[r]?.[c];
        if (!cell) continue;

        const x = c * cellW;
        const y = r * cellH;

        if (cell.type === 'pickup_station') {
          // INBOUND PICKING STATION
          ctx.fillStyle = '#ecfdf5';
          ctx.fillRect(x + 1, y + 1, cellW - 2, cellH - 2);

          ctx.strokeStyle = '#059669';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x + 1, y + 1, cellW - 2, cellH - 2);

          // Roller conveyor
          ctx.strokeStyle = '#34d399';
          ctx.lineWidth = 1;
          for (let ly = y + 4; ly < y + cellH - 4; ly += 4) {
            ctx.beginPath();
            ctx.moveTo(x + 3, ly);
            ctx.lineTo(x + cellW - 3, ly);
            ctx.stroke();
          }

          if (showLabels && cellW > 18) {
            ctx.fillStyle = '#065f46';
            ctx.font = 'bold 9px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('IN', x + cellW / 2, y + cellH / 2);
          }
        } else if (cell.type === 'dropoff_station') {
          // OUTBOUND PACKING BAY
          ctx.fillStyle = '#fffbeb';
          ctx.fillRect(x + 1, y + 1, cellW - 2, cellH - 2);

          ctx.strokeStyle = '#d97706';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x + 1, y + 1, cellW - 2, cellH - 2);

          // Sorting hatch
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 1;
          for (let lx = x + 4; lx < x + cellW - 4; lx += 4) {
            ctx.beginPath();
            ctx.moveTo(lx, y + 3);
            ctx.lineTo(lx, y + cellH - 3);
            ctx.stroke();
          }

          if (showLabels && cellW > 18) {
            ctx.fillStyle = '#92400e';
            ctx.font = 'bold 9px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('OUT', x + cellW / 2, y + cellH / 2);
          }
        } else if (cell.type === 'charging_station') {
          // CHARGING BAY
          ctx.fillStyle = '#f5f3ff';
          ctx.fillRect(x + 1, y + 1, cellW - 2, cellH - 2);

          ctx.strokeStyle = '#7c3aed';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x + 1, y + 1, cellW - 2, cellH - 2);

          // Inductive coil rings
          ctx.strokeStyle = '#c4b5fd';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(x + cellW / 2, y + cellH / 2, Math.min(cellW, cellH) * 0.32, 0, Math.PI * 2);
          ctx.stroke();

          if (showLabels && cellW > 18) {
            ctx.fillStyle = '#5b21b6';
            ctx.font = 'bold 9px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('⚡', x + cellW / 2, y + cellH / 2);
          }
        }
      }
    }

    // 4. Draw Storage Racks (Graphite Steel 2.5D)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = layout.cells[r]?.[c];
        if (!cell || cell.type !== 'shelf') continue;

        const x = c * cellW;
        const y = r * cellH;
        const pad = 2;

        const rackBody = '#1e293b';
        const rackBorder = '#0f172a';
        const uprightPost = '#64748b';
        const beamColor = '#475569';

        let zoneStrip = '#3b82f6';
        if (cell.zone?.includes('Zone B')) zoneStrip = '#6366f1';
        if (cell.zone?.includes('Zone C')) zoneStrip = '#64748b';

        // 2.5D Drop Shadow
        ctx.fillStyle = 'rgba(15, 23, 42, 0.15)';
        ctx.fillRect(x + pad + 1.5, y + pad + 1.5, cellW - pad * 2, cellH - pad * 2);

        // Rack Body
        ctx.fillStyle = rackBody;
        ctx.fillRect(x + pad, y + pad, cellW - pad * 2, cellH - pad * 2);

        // Outer Metallic Border
        ctx.strokeStyle = rackBorder;
        ctx.lineWidth = 1.2;
        ctx.strokeRect(x + pad, y + pad, cellW - pad * 2, cellH - pad * 2);

        // Zone Accent Strip
        ctx.fillStyle = zoneStrip;
        ctx.fillRect(x + pad, y + pad, cellW - pad * 2, 2.5);

        // Steel Upright Posts
        ctx.fillStyle = uprightPost;
        const postSize = 2;
        ctx.fillRect(x + pad, y + pad, postSize, postSize);
        ctx.fillRect(x + cellW - pad - postSize, y + pad, postSize, postSize);
        ctx.fillRect(x + pad, y + cellH - pad - postSize, postSize, postSize);
        ctx.fillRect(x + cellW - pad - postSize, y + cellH - pad - postSize, postSize, postSize);

        // Cross-Beam
        ctx.strokeStyle = beamColor;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(x + pad + 2, y + cellH / 2);
        ctx.lineTo(x + cellW - pad - 2, y + cellH / 2);
        ctx.stroke();

        // Shelf ID Label
        if (showLabels && cellW > 22) {
          ctx.fillStyle = '#cbd5e1';
          ctx.font = '8px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const tag = cell.meta_id ? cell.meta_id.replace('SH-', '') : '';
          ctx.fillText(tag, x + cellW / 2, y + cellH / 2 + 1);
        }
      }
    }

    // 5. Draw Dynamic Obstacles (Industrial Hazard Stripes & Clear "BLOCKED" Label)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = layout.cells[r]?.[c];
        if (!cell || cell.type !== 'obstacle') continue;

        const x = c * cellW;
        const y = r * cellH;
        const pad = 1.0;

        // Base Hazard Amber
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(x + pad, y + pad, cellW - pad * 2, cellH - pad * 2);

        // High-contrast diagonal industrial hazard stripes
        ctx.save();
        ctx.beginPath();
        ctx.rect(x + pad, y + pad, cellW - pad * 2, cellH - pad * 2);
        ctx.clip();

        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 4.0;
        for (let offset = -cellH * 2; offset < cellW + cellH * 2; offset += 8) {
          ctx.beginPath();
          ctx.moveTo(x + offset, y);
          ctx.lineTo(x + offset + cellH, y + cellH);
          ctx.stroke();
        }
        ctx.restore();

        // Thick Industrial Red Border Frame
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 2.4;
        ctx.strokeRect(x + pad, y + pad, cellW - pad * 2, cellH - pad * 2);

        // Bold "BLOCKED" Central Pill Badge
        const pillW = Math.min(cellW * 0.88, 48);
        const pillH = Math.min(cellH * 0.44, 14);
        const pillX = x + cellW / 2 - pillW / 2;
        const pillY = y + cellH / 2 - pillH / 2;

        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.roundRect(pillX, pillY, pillW, pillH, 3);
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 0.8;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 8px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('BLOCKED', x + cellW / 2, y + cellH / 2);
      }
    }

    // 6. Draw Robot A* Path Traces (Old Invalidated Route vs New Active Route)
    robots.forEach((robot) => {
      const isSelected = robot.robot_id === selectedRobotId;
      const isHovered = hoveredRobot?.robot_id === robot.robot_id;

      ctx.save();

      // 6.1 ALWAYS DRAW PREVIOUS ABANDONED / BLOCKED PATH IF PRESENT
      if (robot.previous_path && robot.previous_path.length > 0) {
        // Red dashed line for the invalidated route
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)';
        ctx.lineWidth = 2.2;
        ctx.setLineDash([4, 4]);

        ctx.beginPath();
        const prevStartX = robot.previous_path[0][0] * cellW + cellW / 2;
        const prevStartY = robot.previous_path[0][1] * cellH + cellH / 2;
        ctx.moveTo(prevStartX, prevStartY);

        for (const pt of robot.previous_path) {
          ctx.lineTo(pt[0] * cellW + cellW / 2, pt[1] * cellH + cellH / 2);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Mark waypoint dots on old route
        for (const pt of robot.previous_path) {
          const px = pt[0] * cellW + cellW / 2;
          const py = pt[1] * cellH + cellH / 2;
          ctx.fillStyle = 'rgba(239, 68, 68, 0.6)';
          ctx.beginPath();
          ctx.arc(px, py, 2, 0, Math.PI * 2);
          ctx.fill();
        }

        // Draw an 'X' mark at the last / blocked point of the old path
        const lastPt = robot.previous_path[robot.previous_path.length - 1];
        if (lastPt) {
          const lx = lastPt[0] * cellW + cellW / 2;
          const ly = lastPt[1] * cellH + cellH / 2;
          const sz = 5;

          ctx.strokeStyle = '#dc2626';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(lx - sz, ly - sz);
          ctx.lineTo(lx + sz, ly + sz);
          ctx.moveTo(lx + sz, ly - sz);
          ctx.lineTo(lx - sz, ly + sz);
          ctx.stroke();
        }
      }

      // 6.2 DRAW CURRENT ACTIVE ROUTE
      if (robot.current_path && robot.current_path.length > 0) {
        if (isSelected || isHovered) {
          // High-visibility illuminated route for selected / hovered AMR
          ctx.strokeStyle = robot.color_accent;
          ctx.lineWidth = 2.8;
          ctx.setLineDash([5, 4]);

          ctx.beginPath();
          const startX = robot.position[0] * cellW + cellW / 2;
          const startY = robot.position[1] * cellH + cellH / 2;
          ctx.moveTo(startX, startY);

          for (const pt of robot.current_path) {
            const px = pt[0] * cellW + cellW / 2;
            const py = pt[1] * cellH + cellH / 2;
            ctx.lineTo(px, py);
          }
          ctx.stroke();
          ctx.setLineDash([]);

          // Waypoint node dots
          for (const pt of robot.current_path) {
            const px = pt[0] * cellW + cellW / 2;
            const py = pt[1] * cellH + cellH / 2;
            ctx.fillStyle = robot.color_accent;
            ctx.beginPath();
            ctx.arc(px, py, 2.5, 0, Math.PI * 2);
            ctx.fill();
          }
        } else {
          // Visible active planned route for all robots
          ctx.strokeStyle = robot.color_accent;
          ctx.lineWidth = 1.8;
          ctx.setLineDash([4, 3]);

          ctx.beginPath();
          const startX = robot.position[0] * cellW + cellW / 2;
          const startY = robot.position[1] * cellH + cellH / 2;
          ctx.moveTo(startX, startY);

          for (const pt of robot.current_path) {
            const px = pt[0] * cellW + cellW / 2;
            const py = pt[1] * cellH + cellH / 2;
            ctx.lineTo(px, py);
          }
          ctx.stroke();
          ctx.setLineDash([]);

          for (const pt of robot.current_path) {
            const px = pt[0] * cellW + cellW / 2;
            const py = pt[1] * cellH + cellH / 2;
            ctx.fillStyle = robot.color_accent;
            ctx.beginPath();
            ctx.arc(px, py, 1.8, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Draw destination target bullseye
        if (robot.destination) {
          const destX = robot.destination[0] * cellW + cellW / 2;
          const destY = robot.destination[1] * cellH + cellH / 2;

          ctx.strokeStyle = robot.color_accent;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(destX, destY, Math.min(cellW, cellH) * 0.42, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = robot.color_accent;
          ctx.beginPath();
          ctx.arc(destX, destY, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();
    });

    // 6.4. Draw Spatio-Temporal Reservation Overlays (Phase 5)
    if (reservations && reservations.active_reservations) {
      reservations.active_reservations.forEach((res) => {
        if (res.cell && res.resource_type === 'CELL') {
          const rx = res.cell[0] * cellW;
          const ry = res.cell[1] * cellH;
          const isSelectedRobot = res.robot_id === selectedRobotId;

          if (isSelectedRobot) {
            ctx.save();
            // Clean semi-transparent blue reservation overlay
            ctx.fillStyle = 'rgba(37, 99, 235, 0.12)';
            ctx.fillRect(rx + 1, ry + 1, cellW - 2, cellH - 2);

            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 2]);
            ctx.strokeRect(rx + 2, ry + 2, cellW - 4, cellH - 4);
            ctx.setLineDash([]);

            // Small time-window badge
            if (showLabels && cellW > 24) {
              ctx.fillStyle = '#1d4ed8';
              ctx.font = '7px "JetBrains Mono", monospace';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'top';
              ctx.fillText(`T+${res.start_time}`, rx + cellW / 2, ry + 2.5);
            }
            ctx.restore();
          }
        }
      });
    }

    // 6.5. Draw Spatio-Temporal Conflict Zones
    if (conflicts && conflicts.conflicts) {
      conflicts.conflicts.forEach((conf) => {
        if (conf.cell) {
          const cx = conf.cell[0] * cellW;
          const cy = conf.cell[1] * cellH;
          const isCrit = conf.severity === 'CRITICAL';

          ctx.save();
          // Floor highlight zone
          ctx.fillStyle = isCrit ? 'rgba(239, 68, 68, 0.22)' : 'rgba(245, 158, 11, 0.20)';
          ctx.fillRect(cx + 1, cy + 1, cellW - 2, cellH - 2);

          // Warning perimeter border
          ctx.strokeStyle = isCrit ? '#dc2626' : '#d97706';
          ctx.lineWidth = 1.8;
          ctx.setLineDash([4, 3]);
          ctx.strokeRect(cx + 1, cy + 1, cellW - 2, cellH - 2);
          ctx.setLineDash([]);

          // Corner hazard brackets
          const bl = Math.min(cellW, cellH) * 0.35;
          ctx.lineWidth = 2.2;
          ctx.strokeStyle = isCrit ? '#ef4444' : '#f59e0b';

          ctx.beginPath();
          ctx.moveTo(cx, cy + bl); ctx.lineTo(cx, cy); ctx.lineTo(cx + bl, cy);
          ctx.moveTo(cx + cellW - bl, cy); ctx.lineTo(cx + cellW, cy); ctx.lineTo(cx + cellW, cy + bl);
          ctx.moveTo(cx, cy + cellH - bl); ctx.lineTo(cx, cy + cellH); ctx.lineTo(cx + bl, cy + cellH);
          ctx.moveTo(cx + cellW - bl, cy + cellH); ctx.lineTo(cx + cellW, cy + cellH); ctx.lineTo(cx + cellW, cy + cellH - bl);
          ctx.stroke();

          ctx.restore();
        } else if (conf.from_cell && conf.to_cell) {
          // Edge Conflict opposing arrows
          const x1 = conf.from_cell[0] * cellW + cellW / 2;
          const y1 = conf.from_cell[1] * cellH + cellH / 2;
          const x2 = conf.to_cell[0] * cellW + cellW / 2;
          const y2 = conf.to_cell[1] * cellH + cellH / 2;

          ctx.save();
          ctx.strokeStyle = '#dc2626';
          ctx.lineWidth = 3;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
          ctx.restore();
        }
      });
    }

    // 7. Draw Tactical Hover Reticle
    if (hoveredCell) {
      const hx = hoveredCell.x * cellW;
      const hy = hoveredCell.y * cellH;

      ctx.fillStyle = activeObstacleBrush
        ? 'rgba(239, 68, 68, 0.18)'
        : 'rgba(59, 130, 246, 0.15)';
      ctx.fillRect(hx, hy, cellW, cellH);

      ctx.strokeStyle = activeObstacleBrush ? '#dc2626' : '#2563eb';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(hx + 0.5, hy + 0.5, cellW - 1, cellH - 1);

      const bLen = Math.min(cellW, cellH) * 0.28;
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = activeObstacleBrush ? '#ef4444' : '#1d4ed8';

      ctx.beginPath();
      ctx.moveTo(hx, hy + bLen);
      ctx.lineTo(hx, hy);
      ctx.lineTo(hx + bLen, hy);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(hx + cellW - bLen, hy);
      ctx.lineTo(hx + cellW, hy);
      ctx.lineTo(hx + cellW, hy + bLen);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(hx, hy + cellH - bLen);
      ctx.lineTo(hx, hy + cellH);
      ctx.lineTo(hx + bLen, hy + cellH);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(hx + cellW - bLen, hy + cellH);
      ctx.lineTo(hx + cellW, hy + cellH);
      ctx.lineTo(hx + cellW, hy + cellH - bLen);
      ctx.stroke();
    }

    ctx.restore();
  }, [
    layout,
    robots,
    conflicts,
    reservations,
    selectedRobotId,
    hoveredCell,
    activeObstacleBrush,
    showGrid,
    showLabels,
    zoomLevel,
    panOffset,
  ]);

  useEffect(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    animationFrameRef.current = requestAnimationFrame(() => {
      draw();
      animationFrameRef.current = null;
    });

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [draw]);

  useEffect(() => {
    const handleResize = () => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas || !layout) return;

      const rect = container.getBoundingClientRect();
      const maxW = Math.floor(rect.width);
      const availableHeight = Math.max(340, window.innerHeight - 225);
      const aspectRatio = layout.width / layout.height;

      let targetWidth = maxW;
      let targetHeight = Math.floor(targetWidth / aspectRatio);

      if (targetHeight > availableHeight) {
        targetHeight = availableHeight;
        targetWidth = Math.floor(targetHeight * aspectRatio);
      }

      canvas.width = targetWidth;
      canvas.height = targetHeight;
      setCanvasDim({ width: targetWidth, height: targetHeight });
      draw();
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [layout, draw]);

  const getGridCoords = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas || !layout) return null;

    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    const transformedX = (screenX - centerX - panOffset.x) / zoomLevel + centerX;
    const transformedY = (screenY - centerY - panOffset.y) / zoomLevel + centerY;

    const cellW = canvas.width / layout.width;
    const cellH = canvas.height / layout.height;

    const col = Math.floor(transformedX / cellW);
    const row = Math.floor(transformedY / cellH);

    if (col >= 0 && col < layout.width && row >= 0 && row < layout.height) {
      const cell = layout.cells[row]?.[col] || null;
      const robotOnCell = robots.find((r) => r.position[0] === col && r.position[1] === row) || null;
      return { col, row, cell, robot: robotOnCell };
    }
    return null;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      onPanChange({
        x: panOffset.x + (e.clientX - dragStart.x),
        y: panOffset.y + (e.clientY - dragStart.y),
      });
      setDragStart({ x: e.clientX, y: e.clientY });
      return;
    }

    const gridInfo = getGridCoords(e);
    if (gridInfo) {
      setHoveredCell(gridInfo.cell);
      setHoveredRobot(gridInfo.robot);
      setMouseScreenPos({ x: e.clientX, y: e.clientY });
    } else {
      setHoveredCell(null);
      setHoveredRobot(null);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || e.altKey) {
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isDragging) return;
    const gridInfo = getGridCoords(e);
    if (!gridInfo) return;

    if (gridInfo.robot) {
      onSelectRobot(gridInfo.robot.robot_id);
      return;
    }

    if (activeObstacleBrush) {
      onCellClick(gridInfo.col, gridInfo.row);
      return;
    }

    const activeRes = reservations?.active_reservations.find(
      (r) => r.cell && r.cell[0] === gridInfo.col && r.cell[1] === gridInfo.row
    );
    if (activeRes && onSelectReservation) {
      onSelectReservation(activeRes);
    } else if (onSelectReservation) {
      onSelectReservation(null);
    }

    onSelectRobot(null);
  };

  const cellW = layout ? canvasDim.width / layout.width : 30;
  const cellH = layout ? canvasDim.height / layout.height : 30;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        setIsDragging(false);
        setHoveredCell(null);
        setHoveredRobot(null);
        setMouseScreenPos(null);
      }}
      onClick={handleClick}
      className="relative w-full flex justify-center items-center overflow-hidden rounded-xl border border-slate-300/80 bg-slate-200/80 p-1.5 shadow-sm"
    >
      {/* 1. Underlying Warehouse Canvas (Floor, Racks, Stations, Obstacles, Path Traces, Conflict Zones) */}
      <canvas
        ref={canvasRef}
        style={{ width: `${canvasDim.width}px`, height: `${canvasDim.height}px` }}
        className="cursor-crosshair block rounded-lg shadow-inner bg-slate-200"
      />

      {/* 2. Vector AMR Layer + Vector Conflict Badges */}
      {layout && (
        <svg
          className="absolute pointer-events-none"
          style={{ width: `${canvasDim.width}px`, height: `${canvasDim.height}px`, overflow: 'visible' }}
          viewBox={`0 0 ${canvasDim.width} ${canvasDim.height}`}
        >
          <g
            style={{
              transform: `translate(${canvasDim.width / 2 + panOffset.x}px, ${canvasDim.height / 2 + panOffset.y}px) scale(${zoomLevel}) translate(${-canvasDim.width / 2}px, ${-canvasDim.height / 2}px)`,
              transformOrigin: '0 0',
            }}
          >
            {/* AMRs */}
            {robots.map((robot) => (
              <AMR
                key={robot.robot_id}
                robot={robot}
                cellW={cellW}
                cellH={cellH}
                selected={robot.robot_id === selectedRobotId}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectRobot(robot.robot_id);
                }}
                onMouseEnter={(e) => {
                  setHoveredRobot(robot);
                  setMouseScreenPos({ x: e.clientX, y: e.clientY });
                }}
                onMouseLeave={() => {
                  setHoveredRobot(null);
                }}
              />
            ))}

            {/* P2P Wireless Communication Mesh Beams between interacting robots */}
            {conflicts && conflicts.conflicts.map((conf, idx) => {
              if (!conf.robots || conf.robots.length < 2) return null;
              const botA = robots.find((r) => r.robot_id === conf.robots[0]);
              const botB = robots.find((r) => r.robot_id === conf.robots[1]);
              if (!botA || !botB) return null;

              const ax = botA.position[0] * cellW + cellW / 2;
              const ay = botA.position[1] * cellH + cellH / 2;
              const bx = botB.position[0] * cellW + cellW / 2;
              const by = botB.position[1] * cellH + cellH / 2;
              const midX = (ax + bx) / 2;
              const midY = (ay + by) / 2;

              return (
                <g key={`p2p-beam-${idx}`} className="pointer-events-none">
                  {/* Glowing wireless communication beam line */}
                  <line
                    x1={ax}
                    y1={ay}
                    x2={bx}
                    y2={by}
                    stroke="#06b6d4"
                    strokeWidth="2.5"
                    strokeDasharray="6 4"
                    strokeOpacity="0.9"
                  />
                  {/* Outer cyan glow */}
                  <line
                    x1={ax}
                    y1={ay}
                    x2={bx}
                    y2={by}
                    stroke="#38bdf8"
                    strokeWidth="7"
                    strokeOpacity="0.3"
                  />
                  {/* Animated P2P Packets / Pulse Badge */}
                  <g transform={`translate(${midX}, ${midY})`}>
                    <rect
                      x="-85"
                      y="-11"
                      width="170"
                      height="22"
                      rx="5"
                      fill="#0f172a"
                      stroke="#06b6d4"
                      strokeWidth="1.5"
                      filter="drop-shadow(0 3px 6px rgba(0,0,0,0.4))"
                    />
                    <text
                      x="0"
                      y="1"
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="#38bdf8"
                      fontSize="8px"
                      fontWeight="bold"
                      fontFamily="monospace"
                      letterSpacing="0.2px"
                    >
                      📡 P2P: {botA.robot_id} ⇄ {botB.robot_id} [NEGOTIATING · 4.2ms]
                    </text>
                  </g>
                </g>
              );
            })}

            {/* Vector Conflict Badges */}
            {conflicts && conflicts.conflicts.map((conf, idx) => {
              if (!conf.cell) return null;
              const cx = conf.cell[0] * cellW + cellW / 2;
              const cy = conf.cell[1] * cellH + cellH / 2;
              const isCrit = conf.severity === 'CRITICAL';
              return (
                <g key={conf.conflict_id || idx} transform={`translate(${cx}, ${cy})`} className="pointer-events-none">
                  {/* Outer Pulsing Reticle Ring */}
                  <circle
                    r={Math.min(cellW, cellH) * 0.62}
                    fill="none"
                    stroke={isCrit ? '#ef4444' : '#f59e0b'}
                    strokeWidth="1.6"
                    strokeDasharray="4 3"
                    className="animate-spin"
                    style={{ transformOrigin: '0 0', animationDuration: '6s' }}
                  />
                  {/* Floating Threat Badge */}
                  <g transform={`translate(0, ${-cellH * 0.65})`}>
                    <rect
                      x="-38"
                      y="-9"
                      width="76"
                      height="18"
                      rx="4"
                      fill={isCrit ? '#b91c1c' : '#b45309'}
                      stroke="#ffffff"
                      strokeWidth="1.2"
                      filter="drop-shadow(0 2px 5px rgba(0,0,0,0.3))"
                    />
                    <text
                      x="0"
                      y="3"
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize="8"
                      fontWeight="bold"
                      fontFamily="monospace"
                      letterSpacing="0.3px"
                    >
                      {conf.robots[0]}⚡{conf.robots[1]} · T+{conf.time_step}
                    </text>
                  </g>
                </g>
              );
            })}
          </g>
        </svg>
      )}

      {/* 3. Industrial HUD Tooltip */}
      {hoveredCell && mouseScreenPos && (
        <div
          className="pointer-events-none fixed z-50 rounded-lg border border-slate-300 bg-white/95 p-2.5 text-xs shadow-xl backdrop-blur-md transition-opacity text-slate-800"
          style={{
            left: mouseScreenPos.x + 16,
            top: mouseScreenPos.y + 16,
          }}
        >
          {hoveredRobot ? (
            <div>
              <div className="flex items-center gap-2 font-mono font-bold text-slate-900 border-b border-slate-200 pb-1 mb-1.5">
                <span className="text-blue-600">AMR {hoveredRobot.robot_id}</span>
                <span className="rounded bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 text-[9px] uppercase font-bold">
                  {hoveredRobot.status}
                </span>
              </div>
              <div className="space-y-0.5 text-[11px]">
                <div className="text-slate-600">
                  Target: <span className="font-semibold text-slate-900">{hoveredRobot.destination_label}</span>
                </div>
                <div className="text-slate-600">
                  Battery: <span className="font-mono font-semibold text-emerald-700">{hoveredRobot.battery.toFixed(1)}%</span>
                </div>
                <div className="text-slate-600">
                  Task: <span className="font-medium text-slate-800">{hoveredRobot.current_task}</span>
                </div>
              </div>
              <div className="mt-1.5 border-t border-slate-100 pt-1 font-mono text-[9px] text-blue-600 font-semibold">
                Click to select AMR & view path
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 font-mono font-bold text-slate-900 border-b border-slate-200 pb-1 mb-1.5">
                <span>COORD [{hoveredCell.x}, {hoveredCell.y}]</span>
                <span className="rounded bg-slate-100 border border-slate-200 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-slate-700">
                  {hoveredCell.type.replace('_', ' ')}
                </span>
              </div>

              <div className="space-y-0.5 text-[11px]">
                {hoveredCell.zone && (
                  <div className="text-slate-600">
                    Zone: <span className="font-semibold text-slate-900">{hoveredCell.zone}</span>
                  </div>
                )}
                {hoveredCell.meta_id && (
                  <div className="text-slate-600">
                    Asset ID: <span className="font-mono font-semibold text-blue-700">{hoveredCell.meta_id}</span>
                  </div>
                )}
                {reservations?.active_reservations.find(
                  (r) => r.cell && r.cell[0] === hoveredCell.x && r.cell[1] === hoveredCell.y
                ) && (
                  <div className="text-slate-600 border-t border-slate-100 pt-0.5 mt-0.5">
                    Reservation:{' '}
                    <span className="font-mono font-bold text-blue-700">
                      {(() => {
                        const r = reservations.active_reservations.find(
                          (res) => res.cell && res.cell[0] === hoveredCell.x && res.cell[1] === hoveredCell.y
                        );
                        return `${r?.robot_id} · T+${r?.start_time}→T+${r?.end_time}`;
                      })()}
                    </span>
                  </div>
                )}
                <div className="text-slate-600">
                  State:{' '}
                  <span className={`font-semibold ${hoveredCell.is_walkable ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {hoveredCell.is_walkable ? 'CLEAR / NAVIGABLE' : 'STATIC ASSET / BLOCKED'}
                  </span>
                </div>
              </div>

              <div className="mt-1.5 border-t border-slate-100 pt-1 font-mono text-[9px] text-slate-500">
                {hoveredCell.is_walkable
                  ? activeObstacleBrush ? 'Click to toggle dynamic hazard' : 'Click to inspect space-time reservation'
                  : 'Fixed warehouse infrastructure'}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
