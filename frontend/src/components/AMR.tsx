import React from 'react';
import { RobotInfo } from '../types/warehouse';

interface AMRProps {
  robot: RobotInfo;
  cellW: number;
  cellH: number;
  selected: boolean;
  onClick: (e: React.MouseEvent) => void;
  onMouseEnter: (e: React.MouseEvent) => void;
  onMouseLeave: () => void;
}

export const AMR: React.FC<AMRProps> = ({
  robot,
  cellW,
  cellH,
  selected,
  onClick,
  onMouseEnter,
  onMouseLeave,
}) => {
  // Center coordinates on the grid
  const cx = robot.position[0] * cellW + cellW / 2;
  const cy = robot.position[1] * cellH + cellH / 2;

  // AMR dimensions (76% width, 58% height of grid cell)
  const bodyW = Math.max(22, cellW * 0.76);
  const bodyH = Math.max(16, cellH * 0.58);

  // Rotation angle based on movement heading
  let angle = 0; // East (0 deg)
  if (robot.direction === 'S') angle = 90;
  else if (robot.direction === 'W') angle = 180;
  else if (robot.direction === 'N') angle = 270;

  // Status LED color
  let statusColor = '#3b82f6'; // MOVING = Blue
  if (robot.status === 'ARRIVED') statusColor = '#10b981'; // ARRIVED = Green
  else if (robot.status === 'PAUSED') statusColor = '#f59e0b'; // PAUSED = Amber
  else if (robot.status === 'IDLE') statusColor = '#94a3b8'; // IDLE = Slate
  else if (robot.status === 'REROUTING') statusColor = '#06b6d4'; // REROUTING = Cyan
  else if (robot.status === 'SAFE_WAIT') statusColor = '#ef4444'; // SAFE_WAIT = Red

  // Wheel dimensions
  const wheelL = bodyW * 0.32;
  const wheelT = Math.max(2.5, bodyH * 0.16);

  return (
    <g
      className="cursor-pointer select-none"
      style={{
        transform: `translate(${cx}px, ${cy}px)`,
        transformBox: 'view-box',
        transformOrigin: '0 0',
        transition: 'transform 100ms linear',
      }}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* 1. Selection Reticle / Target Glow */}
      {selected && (
        <g className="animate-pulse">
          <circle
            r={Math.max(bodyW, bodyH) * 0.76}
            fill="rgba(37, 99, 235, 0.08)"
            stroke={robot.color_accent}
            strokeWidth="1.8"
            strokeDasharray="4 3"
          />
        </g>
      )}

      {/* 1.1. Deadlock Halo Indicator (Phase 8) */}
      {robot.deadlock_state && robot.deadlock_state !== 'NO_DEADLOCK' && robot.deadlock_state !== 'RECOVERED' && (
        <g className="animate-pulse">
          <circle
            r={Math.max(bodyW, bodyH) * 0.88}
            fill={robot.is_yielding ? 'rgba(245, 158, 11, 0.15)' : 'rgba(244, 63, 94, 0.18)'}
            stroke={robot.is_yielding ? '#f59e0b' : '#f43f5e'}
            strokeWidth="2"
            strokeDasharray={robot.is_yielding ? '3 3' : '5 3'}
          />
        </g>
      )}

      {/* 1.2. Dynamic Rerouting Halo Indicator (Phase 9) */}
      {robot.status === 'REROUTING' && (
        <g className="animate-pulse">
          <circle
            r={Math.max(bodyW, bodyH) * 0.92}
            fill="rgba(6, 182, 212, 0.2)"
            stroke="#06b6d4"
            strokeWidth="2"
            strokeDasharray="4 2"
          />
        </g>
      )}

      {/* 2. Rotatable Robot Body Group */}
      <g transform={`rotate(${angle})`}>
        {/* Drop Shadow */}
        <rect
          x={-bodyW / 2 + 1.5}
          y={-bodyH / 2 + 1.5}
          width={bodyW}
          height={bodyH}
          rx={4}
          fill="rgba(15, 23, 42, 0.25)"
        />

        {/* 4 Rubberized Drive Wheels with Silver Axle Hubs */}
        {/* Top-Left Wheel */}
        <rect
          x={-bodyW * 0.4}
          y={-bodyH / 2 - wheelT + 1}
          width={wheelL}
          height={wheelT}
          rx={1}
          fill="#0f172a"
        />
        <rect
          x={-bodyW * 0.34}
          y={-bodyH / 2 - wheelT + 1.5}
          width={wheelL * 0.6}
          height={wheelT - 1}
          rx={0.5}
          fill="#94a3b8"
        />

        {/* Top-Right Wheel */}
        <rect
          x={bodyW * 0.08}
          y={-bodyH / 2 - wheelT + 1}
          width={wheelL}
          height={wheelT}
          rx={1}
          fill="#0f172a"
        />
        <rect
          x={bodyW * 0.14}
          y={-bodyH / 2 - wheelT + 1.5}
          width={wheelL * 0.6}
          height={wheelT - 1}
          rx={0.5}
          fill="#94a3b8"
        />

        {/* Bottom-Left Wheel */}
        <rect
          x={-bodyW * 0.4}
          y={bodyH / 2 - 1}
          width={wheelL}
          height={wheelT}
          rx={1}
          fill="#0f172a"
        />
        <rect
          x={-bodyW * 0.34}
          y={bodyH / 2 - 0.5}
          width={wheelL * 0.6}
          height={wheelT - 1}
          rx={0.5}
          fill="#94a3b8"
        />

        {/* Bottom-Right Wheel */}
        <rect
          x={bodyW * 0.08}
          y={bodyH / 2 - 1}
          width={wheelL}
          height={wheelT}
          rx={1}
          fill="#0f172a"
        />
        <rect
          x={bodyW * 0.14}
          y={bodyH / 2 - 0.5}
          width={wheelL * 0.6}
          height={wheelT - 1}
          rx={0.5}
          fill="#94a3b8"
        />

        {/* Main Industrial Chassis (Graphite Steel) */}
        <rect
          x={-bodyW / 2}
          y={-bodyH / 2}
          width={bodyW}
          height={bodyH}
          rx={4}
          fill="#1e293b"
          stroke="#0f172a"
          strokeWidth="1.2"
        />

        {/* Inner Metallic Payload Deck Plate */}
        <rect
          x={-bodyW * 0.42}
          y={-bodyH * 0.38}
          width={bodyW * 0.84}
          height={bodyH * 0.76}
          rx={2.5}
          fill="#334155"
          stroke="#475569"
          strokeWidth="0.8"
        />

        {/* Front Directional Optical Headlights (+X front face) */}
        <rect
          x={bodyW / 2 - 2.5}
          y={-bodyH * 0.28}
          width={2.5}
          height={bodyH * 0.56}
          rx={1}
          fill="#f8fafc"
          stroke="#cbd5e1"
          strokeWidth="0.5"
        />
        {/* Forward Heading Arrow Notch */}
        <polygon
          points={`${bodyW * 0.25},0 ${bodyW * 0.08},-${bodyH * 0.18} ${bodyW * 0.08},${bodyH * 0.18}`}
          fill={robot.color_accent}
          opacity="0.85"
        />

        {/* Rear Status LED Strip (-X rear face) */}
        <rect
          x={-bodyW / 2}
          y={-bodyH * 0.24}
          width={2}
          height={bodyH * 0.48}
          rx={1}
          fill={statusColor}
        />

        {/* Center LiDAR Sensor Turret */}
        <circle
          cx={0}
          cy={0}
          r={Math.min(bodyW, bodyH) * 0.22}
          fill="#0f172a"
          stroke="#64748b"
          strokeWidth="1"
        />
        <circle
          cx={0}
          cy={0}
          r={Math.min(bodyW, bodyH) * 0.12}
          fill={robot.color_accent}
        />
        {/* LiDAR optical scanning slit */}
        <rect
          x={0}
          y={-0.5}
          width={Math.min(bodyW, bodyH) * 0.2}
          height={1}
          fill="#ffffff"
          opacity="0.9"
        />
      </g>

      {/* 3. Floating ID Pill Badge (Above the robot, ALWAYS horizontal & legible) */}
      <g style={{ transform: `translate(0px, ${-bodyH / 2 - 8}px)` }}>
        {/* Badge Drop Shadow */}
        <rect
          x={-11}
          y={-6.5}
          width={22}
          height={13}
          rx={3.5}
          fill="rgba(15, 23, 42, 0.18)"
        />
        {/* Badge Background */}
        <rect
          x={-11}
          y={-7}
          width={22}
          height={13}
          rx={3.5}
          fill="#ffffff"
          stroke={robot.color_accent}
          strokeWidth="1.3"
        />
        {/* Badge Label Text */}
        <text
          x={0}
          y={0}
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="'JetBrains Mono', monospace"
          fontSize="8.5px"
          fontWeight="bold"
          fill="#0f172a"
        >
          {robot.robot_id}
        </text>
      </g>

      {/* 4. Real-time Rerouting, Blocked & Yielding Status Floating Badges */}
      {robot.is_yielding && (
        <g style={{ transform: `translate(0px, ${-bodyH / 2 - 24}px)` }} className="animate-pulse">
          <rect
            x={-48}
            y={-7}
            width={96}
            height={14}
            rx={4}
            fill="#d97706"
            stroke="#ffffff"
            strokeWidth="1.2"
            filter="drop-shadow(0 2px 5px rgba(0,0,0,0.3))"
          />
          <text
            x={0}
            y={0}
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="'JetBrains Mono', monospace"
            fontSize="7px"
            fontWeight="bold"
            fill="#ffffff"
          >
            🛑 YIELDING · WAITING
          </text>
        </g>
      )}

      {robot.status === 'REROUTING' && (
        <g style={{ transform: `translate(0px, ${-bodyH / 2 - 24}px)` }} className="animate-bounce">
          <rect
            x={-38}
            y={-7}
            width={76}
            height={14}
            rx={4}
            fill="#06b6d4"
            stroke="#ffffff"
            strokeWidth="1"
          />
          <circle cx={-30} cy={0} r={2.5} fill="#ffffff" className="animate-ping" />
          <text
            x={2}
            y={0}
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="'JetBrains Mono', monospace"
            fontSize="7.5px"
            fontWeight="bold"
            fill="#ffffff"
          >
            REROUTING...
          </text>
        </g>
      )}

      {robot.status === 'SAFE_WAIT' && (
        <g style={{ transform: `translate(0px, ${-bodyH / 2 - 24}px)` }} className="animate-pulse">
          <rect
            x={-42}
            y={-7}
            width={84}
            height={14}
            rx={4}
            fill="#dc2626"
            stroke="#ffffff"
            strokeWidth="1"
          />
          <text
            x={0}
            y={0}
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="'JetBrains Mono', monospace"
            fontSize="7.5px"
            fontWeight="bold"
            fill="#ffffff"
          >
            ROUTE BLOCKED
          </text>
        </g>
      )}

      {robot.status === 'MOVING' && (robot.route_version ?? 1) > 1 && !robot.is_yielding && (
        <g style={{ transform: `translate(0px, ${-bodyH / 2 - 22}px)` }}>
          <rect
            x={-28}
            y={-6}
            width={56}
            height={12}
            rx={3}
            fill="#059669"
            stroke="#ffffff"
            strokeWidth="0.8"
          />
          <text
            x={0}
            y={0}
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="'JetBrains Mono', monospace"
            fontSize="7px"
            fontWeight="bold"
            fill="#ffffff"
          >
            v{robot.route_version} ACTIVE
          </text>
        </g>
      )}
    </g>
  );
};
