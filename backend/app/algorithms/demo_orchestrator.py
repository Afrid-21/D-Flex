from typing import Dict, List, Optional, Any
from app.schemas.warehouse import DemoStageInfo, DemoOrchestratorMetrics


class DemoOrchestrator:
    """
    Automated Continuous Mission Orchestrator for SIH 2026 Evaluation.
    """

    def __init__(self):
        self.is_active: bool = False
        self.current_stage: int = 1
        self.stage_tick: int = 0
        self.stages: List[DemoStageInfo] = [
            DemoStageInfo(
                stage_number=1,
                title="Decentralized Task Allocation",
                subsystem="Phase 10 (Contract Net Protocol)",
                description="AMR fleet receives pick/drop tasks, computes independent cost bids, and elects winners without central server.",
                status="PENDING",
            ),
            DemoStageInfo(
                stage_number=2,
                title="Spatio-Temporal Path Planning",
                subsystem="Phase 3 & 5 (4D Reservations)",
                description="AMRs plan optimal routes and lock spatio-temporal interval reservations in distributed cell/edge tables.",
                status="PENDING",
            ),
            DemoStageInfo(
                stage_number=3,
                title="Distributed Conflict Negotiation",
                subsystem="Phase 4 & 7 (P2P Negotiation)",
                description="Spatio-temporal intersection conflict detected; R1 & R2 negotiate priority via P2P messages and adjust reservation.",
                status="PENDING",
            ),
            DemoStageInfo(
                stage_number=4,
                title="Dynamic Blockage Rerouting",
                subsystem="Phase 9 (Dynamic A* Rerouting)",
                description="Dynamic obstacle placed in active corridor; affected AMR safely invalidates old route and replans around obstacle.",
                status="PENDING",
            ),
            DemoStageInfo(
                stage_number=5,
                title="Edge AI Velocity Modulation",
                subsystem="Phase 12 (Traffic Density AI)",
                description="High-density junction hotspot forecasted; AMR proactively modulates velocity from 1.0 m/s to 0.5 m/s.",
                status="PENDING",
            ),
            DemoStageInfo(
                stage_number=6,
                title="Dynamic Task Reassignment & Delivery",
                subsystem="Phase 11 (Mid-Mission Takeover)",
                description="Low battery condition detected; peer AMR bids and seamlessly assumes transport mission to target rack.",
                status="PENDING",
            ),
        ]

    def start_demo(self):
        """Starts or restarts the full E2E demonstration."""
        self.is_active = True
        self.current_stage = 1
        self.stage_tick = 0
        for i, s in enumerate(self.stages):
            s.status = "ACTIVE" if i == 0 else "PENDING"

    def reset_demo(self):
        """Resets the demo state."""
        self.is_active = False
        self.current_stage = 1
        self.stage_tick = 0
        for s in self.stages:
            s.status = "PENDING"

    def step_demo(self, tick: int):
        """Advances through demonstration stages automatically."""
        if not self.is_active:
            return

        self.stage_tick += 1
        # Advance stage every 25 ticks in continuous demo mode
        if self.stage_tick >= 25 and self.current_stage < len(self.stages):
            self.stages[self.current_stage - 1].status = "COMPLETED"
            self.current_stage += 1
            self.stages[self.current_stage - 1].status = "ACTIVE"
            self.stage_tick = 0
        elif self.current_stage == len(self.stages) and self.stage_tick >= 25:
            self.stages[self.current_stage - 1].status = "COMPLETED"

    def get_metrics(self) -> DemoOrchestratorMetrics:
        """Returns live orchestrator status."""
        completed = sum(1 for s in self.stages if s.status == "COMPLETED")
        progress = round((completed / len(self.stages)) * 100, 1)
        active_title = self.stages[self.current_stage - 1].title if self.is_active and self.current_stage <= len(self.stages) else ("Completed" if progress == 100 else "Ready")
        
        return DemoOrchestratorMetrics(
            is_active=self.is_active,
            current_stage=self.current_stage,
            total_stages=len(self.stages),
            progress_pct=progress,
            active_stage_title=active_title,
            stages=self.stages,
        )
