import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MiniMap,
  Position,
  ReactFlow,
  SelectionMode,
  getBezierPath,
  useReactFlow,
  useViewport,
  type EdgeTypes,
  type FinalConnectionState,
  type NodeChange,
  type NodeTypes,
} from "@xyflow/react";
import { resolveIcon } from "@/blocks/icons";
import "@xyflow/react/dist/style.css";
import {
  DEFAULT_MARKER,
  useFlowStore,
  type AppNode,
  type ShapeKind,
} from "@/store/flow-store";
import { ACCENT_CLASSES, CORE_BLOCKS } from "@/blocks/registry";
import { InfraNodeView } from "./nodes/infra-node";
import { ShapeNodeView } from "./nodes/shape-node";
import { TextNodeView } from "./nodes/text-node";
import { StepNodeView } from "./nodes/step-node";
import { LineNodeView } from "./nodes/line-node";
import { ImageNodeView } from "./nodes/image-node";
import { CodeNodeView } from "./nodes/code-node";
import { LabeledEdge } from "./edges/labeled-edge";
import { cn } from "@/lib/utils";
import {
  computeSnap,
  nodeDims,
  resolveSnapPosition,
  type ActiveSnap,
  type Guide,
} from "@/lib/snapping";

const nodeTypes: NodeTypes = {
  infra: InfraNodeView,
  shape: ShapeNodeView,
  text: TextNodeView,
  step: StepNodeView,
  line: LineNodeView,
  image: ImageNodeView,
  code: CodeNodeView,
};
const edgeTypes: EdgeTypes = { labeled: LabeledEdge };

const DRAG_MIME = "application/x-netviz";

type DimSeg = { from: number; to: number; along: number; value: number };

function computeDimsToTarget(sel: AppNode, target: AppNode) {
  const { w: sw, h: sh } = nodeDims(sel);
  const { w: tw, h: th } = nodeDims(target);
  if (sw === 0 || sh === 0 || tw === 0 || th === 0) return null;
  const sL = sel.position.x, sR = sL + sw, sT = sel.position.y, sB = sT + sh;
  const tL = target.position.x, tR = tL + tw, tT = target.position.y, tB = tT + th;

  const vOverlap = Math.max(sT, tT) < Math.min(sB, tB);
  const hOverlap = Math.max(sL, tL) < Math.min(sR, tR);

  const out: {
    sL: number; sR: number; sT: number; sB: number; sw: number; sh: number;
    left?: DimSeg; right?: DimSeg; top?: DimSeg; bottom?: DimSeg;
    gapH?: DimSeg; gapV?: DimSeg;
  } = { sL, sR, sT, sB, sw, sh };

  if (vOverlap && hOverlap) {
    const vMid = (Math.max(sT, tT) + Math.min(sB, tB)) / 2;
    const hMid = (Math.max(sL, tL) + Math.min(sR, tR)) / 2;
    out.left = { from: Math.min(sL, tL), to: Math.max(sL, tL), along: vMid, value: Math.abs(sL - tL) };
    out.right = { from: Math.min(sR, tR), to: Math.max(sR, tR), along: vMid, value: Math.abs(sR - tR) };
    out.top = { from: Math.min(sT, tT), to: Math.max(sT, tT), along: hMid, value: Math.abs(sT - tT) };
    out.bottom = { from: Math.min(sB, tB), to: Math.max(sB, tB), along: hMid, value: Math.abs(sB - tB) };
  } else if (vOverlap) {
    const along = (Math.max(sT, tT) + Math.min(sB, tB)) / 2;
    if (tR <= sL) out.gapH = { from: tR, to: sL, along, value: sL - tR };
    else if (tL >= sR) out.gapH = { from: sR, to: tL, along, value: tL - sR };
  } else if (hOverlap) {
    const along = (Math.max(sL, tL) + Math.min(sR, tR)) / 2;
    if (tB <= sT) out.gapV = { from: tB, to: sT, along, value: sT - tB };
    else if (tT >= sB) out.gapV = { from: sB, to: tT, along, value: tT - sB };
  } else {
    const cy = (sT + sB) / 2;
    const cx = (sL + sR) / 2;
    if (tR <= sL) out.gapH = { from: tR, to: sL, along: cy, value: sL - tR };
    else if (tL >= sR) out.gapH = { from: sR, to: tL, along: cy, value: tL - sR };
    if (tB <= sT) out.gapV = { from: tB, to: sT, along: cx, value: sT - tB };
    else if (tT >= sB) out.gapV = { from: sB, to: tT, along: cx, value: tT - sB };
  }
  return out;
}

type DragPayload =
  | { kind: "infra"; blockId: string }
  | { kind: "shape"; shape: ShapeKind }
  | { kind: "text" }
  | { kind: "step" }
  | { kind: "line" }
  | { kind: "code" };

function TurboDefs({ colors }: { colors: [string, string] }) {
  return (
    <svg className="pointer-events-none absolute h-0 w-0">
      <defs>
        <linearGradient id="turbo-edge" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={colors[0]} />
          <stop offset="100%" stopColor={colors[1]} />
        </linearGradient>
      </defs>
    </svg>
  );
}

function CanvasInner() {
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const onNodesChange = useFlowStore((s) => s.onNodesChange);
  const onEdgesChange = useFlowStore((s) => s.onEdgesChange);
  const onConnect = useFlowStore((s) => s.onConnect);
  const addInfraNode = useFlowStore((s) => s.addInfraNode);
  const addShapeNode = useFlowStore((s) => s.addShapeNode);
  const addTextNode = useFlowStore((s) => s.addTextNode);
  const addStepNode = useFlowStore((s) => s.addStepNode);
  const addLineNode = useFlowStore((s) => s.addLineNode);
  const addCodeNode = useFlowStore((s) => s.addCodeNode);
  const customBlocks = useFlowStore((s) => s.customBlocks);
  const turbo = useFlowStore((s) => s.turbo);
  const animateEdges = useFlowStore((s) => s.animateEdges);
  const animationSpeed = useFlowStore((s) => s.animationSpeed);
  const turboColors = useFlowStore((s) => s.turboColors);
  const showMinimap = useFlowStore((s) => s.showMinimap);
  const showControls = useFlowStore((s) => s.showControls);
  const showGrid = useFlowStore((s) => s.showGrid);
  const showSmartGuides = useFlowStore((s) => s.showSmartGuides);
  const renderAll = useFlowStore((s) => s.renderAllElements);
  const selectedSingle = useFlowStore((s) => {
    const sel = s.nodes.filter((n) => n.selected);
    return sel.length === 1 ? sel[0] : null;
  });
  const allNodes = useFlowStore((s) => s.nodes);
  const workMode = useFlowStore((s) => s.workMode);
  const isPreview = workMode === "preview";
  const { screenToFlowPosition } = useReactFlow();
  const { x: vpX, y: vpY, zoom } = useViewport();

  const [guides, setGuides] = useState<Guide[]>([]);
  const [altDown, setAltDown] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const activeSnaps = useRef<Map<string, ActiveSnap>>(new Map());

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.altKey) setAltDown(true);
    };
    const up = (e: KeyboardEvent) => {
      if (!e.altKey) setAltDown(false);
    };
    const blur = () => setAltDown(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  const handleNodesChange = useCallback(
    (changes: NodeChange<AppNode>[]) => {
      if (!showSmartGuides) {
        activeSnaps.current.clear();
        onNodesChange(changes);
        return;
      }
      const current = useFlowStore.getState().nodes;
      const positionChanges = changes.filter(
        (c) => c.type === "position" && c.position
      );
      let patched = changes;
      const nextGuides: Guide[] = [];
      if (positionChanges.length === 1) {
        const c = positionChanges[0] as Extract<
          NodeChange<AppNode>,
          { type: "position" }
        >;
        const drag = current.find((n) => n.id === c.id);
        if (drag && c.position) {
          const others = current.filter(
            (n) => n.id !== drag.id && !n.hidden
          );
          const activeSnap = activeSnaps.current.get(drag.id);
          const snap = computeSnap(drag, c.position, others, zoom, activeSnap);
          if (c.dragging) {
            activeSnaps.current.set(drag.id, snap.activeSnap);
            nextGuides.push(...snap.guides);
          } else {
            activeSnaps.current.delete(drag.id);
          }
          patched = changes.map((ch) =>
            ch === c
              ? {
                  ...c,
                  position: resolveSnapPosition(
                    c.position!,
                    snap.position,
                    c.dragging !== false
                  ),
                }
              : ch
          );
        }
      }
      const dragEnd = changes.some(
        (c) => c.type === "position" && c.dragging === false
      );
      if (dragEnd) {
        for (const c of changes) {
          if (c.type === "position") {
            activeSnaps.current.delete(c.id);
          }
        }
      }
      if (nextGuides.length === 0 && !dragEnd) {
        if (guides.length > 0 && positionChanges.length === 0) setGuides([]);
      } else if (dragEnd) {
        setGuides([]);
      } else {
        setGuides(nextGuides);
      }
      onNodesChange(patched);
    },
    [onNodesChange, guides.length, showSmartGuides, zoom]
  );

  const registry = useMemo(
    () => [...CORE_BLOCKS, ...customBlocks],
    [customBlocks]
  );

  const displayNodes = useMemo(() => {
    if (!nodes.some((n) => (n.data as { turbo?: boolean }).turbo)) return nodes;
    return nodes.map((n) =>
      (n.data as { turbo?: boolean }).turbo
        ? { ...n, className: cn(n.className, "turbo-on") }
        : n
    );
  }, [nodes]);

  const displayEdges = useMemo(() => {
    if (!edges.some((e) => e.data?.turbo)) return edges;
    return edges.map((e) =>
      e.data?.turbo ? { ...e, className: cn(e.className, "turbo-on") } : e
    );
  }, [edges]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const raw = e.dataTransfer.getData(DRAG_MIME);
      if (!raw) return;
      let payload: DragPayload;
      try {
        payload = JSON.parse(raw) as DragPayload;
      } catch {
        return;
      }
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      if (payload.kind === "infra") {
        const block = registry.find((b) => b.id === payload.blockId);
        if (!block) return;
        addInfraNode(block, position);
      } else if (payload.kind === "shape") {
        addShapeNode(payload.shape, position);
      } else if (payload.kind === "text") {
        addTextNode(position);
      } else if (payload.kind === "step") {
        addStepNode(position);
      } else if (payload.kind === "line") {
        addLineNode(position);
      } else if (payload.kind === "code") {
        addCodeNode(position);
      }
    },
    [
      registry,
      screenToFlowPosition,
      addInfraNode,
      addShapeNode,
      addTextNode,
      addStepNode,
      addLineNode,
      addCodeNode,
    ]
  );

  const defaultEdgeOptions = useMemo(
    () => ({
      type: "labeled",
      animated: animateEdges,
      markerEnd: turbo ? undefined : DEFAULT_MARKER,
    }),
    [animateEdges, turbo]
  );

  const [connectPopover, setConnectPopover] = useState<{
    screenX: number;
    screenY: number;
    flowPos: { x: number; y: number };
    sourceId: string;
    sourceHandle: string | null;
    sourcePosition: Position;
  } | null>(null);

  const onConnectEnd = useCallback(
    (
      event: MouseEvent | TouchEvent,
      connectionState: FinalConnectionState
    ) => {
      if (connectionState.isValid) return;
      if (!connectionState.fromNode) return;
      const e = event as MouseEvent;
      const clientX = "clientX" in e ? e.clientX : 0;
      const clientY = "clientY" in e ? e.clientY : 0;
      const flowPos = screenToFlowPosition({ x: clientX, y: clientY });
      setConnectPopover({
        screenX: clientX,
        screenY: clientY,
        flowPos,
        sourceId: connectionState.fromNode.id,
        sourceHandle: connectionState.fromHandle?.id ?? null,
        sourcePosition:
          (connectionState.fromHandle?.position as Position) ?? Position.Bottom,
      });
    },
    [screenToFlowPosition]
  );

  useEffect(() => {
    if (!connectPopover) return;
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setConnectPopover(null);
    };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [connectPopover]);

  const pickBlock = useCallback(
    (blockId: string) => {
      if (!connectPopover) return;
      const block = registry.find((b) => b.id === blockId);
      if (!block) return;
      const variant = block.variant ?? "row";
      const size =
        variant === "card"
          ? { w: 220, h: 120 }
          : { w: 240, h: 72 };
      const pos = {
        x: connectPopover.flowPos.x,
        y: connectPopover.flowPos.y - size.h / 2,
      };
      const newId = addInfraNode(block, pos);
      onConnect({
        source: connectPopover.sourceId,
        target: newId,
        sourceHandle: connectPopover.sourceHandle,
        targetHandle: "left",
      });
      setConnectPopover(null);
    },
    [connectPopover, registry, addInfraNode, onConnect]
  );

  const sourceHandlePos = useMemo(() => {
    if (!connectPopover) return null;
    const sel = `.react-flow__node[data-id="${connectPopover.sourceId}"] .react-flow__handle${
      connectPopover.sourceHandle
        ? `[data-handleid="${connectPopover.sourceHandle}"]`
        : ""
    }`;
    const el = document.querySelector(sel) as HTMLElement | null;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, [connectPopover]);

  const wrapperStyle = {
    "--turbo-start": turboColors[0],
    "--turbo-end": turboColors[1],
    "--dash-duration": `${animationSpeed}s`,
  } as CSSProperties;

  return (
    <div
      className={cn(
        "relative h-full w-full",
        turbo && "turbo",
        isPreview && "preview-canvas"
      )}
      style={wrapperStyle}
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      <TurboDefs colors={turboColors} />
      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        onNodesChange={handleNodesChange}
        onNodeMouseEnter={(_, n) => setHoveredId(n.id)}
        onNodeMouseLeave={() => setHoveredId(null)}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectEnd={onConnectEnd}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionMode={ConnectionMode.Loose}
        defaultEdgeOptions={defaultEdgeOptions}
        proOptions={{ hideAttribution: true }}
        selectionOnDrag
        panOnDrag={[1]}
        panOnScroll
        selectionMode={SelectionMode.Partial}
        onlyRenderVisibleElements={!renderAll}
        elevateNodesOnSelect={false}
        fitView
        fitViewOptions={{ padding: 0.4 }}
      >
        {showGrid && (
          <Background
            variant={BackgroundVariant.Dots}
            gap={18}
            size={1.4}
            color="hsl(var(--canvas-dot))"
          />
        )}
        {showControls && <Controls showInteractive={false} />}
        {showMinimap && <MiniMap pannable zoomable />}
      </ReactFlow>
      {!isPreview && showSmartGuides && guides.length > 0 && (
        <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full">
          {guides.map((g, i) => {
            if (g.axis === "x") {
              const x = vpX + g.pos * zoom;
              return (
                <line
                  key={i}
                  x1={x}
                  x2={x}
                  y1={vpY + g.from * zoom}
                  y2={vpY + g.to * zoom}
                  stroke="#ef4444"
                  strokeWidth={1}
                  strokeDasharray="4 3"
                />
              );
            }
            const y = vpY + g.pos * zoom;
            return (
              <line
                key={i}
                x1={vpX + g.from * zoom}
                x2={vpX + g.to * zoom}
                y1={y}
                y2={y}
                stroke="#ef4444"
                strokeWidth={1}
                strokeDasharray="4 3"
              />
            );
          })}
        </svg>
      )}
      {!isPreview && showSmartGuides && altDown && selectedSingle && (() => {
        const { w: sw, h: sh } = nodeDims(selectedSingle);
        if (sw === 0 || sh === 0) return null;
        const sx = (fx: number) => vpX + fx * zoom;
        const sy = (fy: number) => vpY + fy * zoom;
        const sL = selectedSingle.position.x;
        const sR = sL + sw;
        const sT = selectedSingle.position.y;
        const sB = sT + sh;
        const cx = sx((sL + sR) / 2);
        const hovered =
          hoveredId && hoveredId !== selectedSingle.id
            ? allNodes.find((n) => n.id === hoveredId) ?? null
            : null;
        const d = hovered ? computeDimsToTarget(selectedSingle, hovered) : null;
        const labelRed =
          "absolute -translate-x-1/2 -translate-y-1/2 rounded-sm bg-red-500 px-1 py-px text-[10px] font-semibold leading-none text-white whitespace-nowrap";
        const hLine = (seg: DimSeg) => (
          <line
            x1={sx(seg.from)}
            x2={sx(seg.to)}
            y1={sy(seg.along)}
            y2={sy(seg.along)}
            stroke="#ef4444"
            strokeWidth={1}
          />
        );
        const vLine = (seg: DimSeg) => (
          <line
            x1={sx(seg.along)}
            x2={sx(seg.along)}
            y1={sy(seg.from)}
            y2={sy(seg.to)}
            stroke="#ef4444"
            strokeWidth={1}
          />
        );
        const hLabel = (seg: DimSeg) => (
          <span
            className={labelRed}
            style={{
              left: (sx(seg.from) + sx(seg.to)) / 2,
              top: sy(seg.along) - 10,
            }}
          >
            {Math.round(seg.value)}
          </span>
        );
        const vLabel = (seg: DimSeg) => (
          <span
            className={labelRed}
            style={{
              left: sx(seg.along) + 14,
              top: (sy(seg.from) + sy(seg.to)) / 2,
            }}
          >
            {Math.round(seg.value)}
          </span>
        );
        return (
          <div className="pointer-events-none absolute inset-0 z-10">
            {d && (
              <svg className="absolute inset-0 h-full w-full">
                {d.left && hLine(d.left)}
                {d.right && hLine(d.right)}
                {d.gapH && hLine(d.gapH)}
                {d.top && vLine(d.top)}
                {d.bottom && vLine(d.bottom)}
                {d.gapV && vLine(d.gapV)}
              </svg>
            )}
            <span
              className="absolute -translate-x-1/2 rounded-sm bg-blue-500 px-1 py-px text-[10px] font-semibold leading-none text-white whitespace-nowrap"
              style={{ left: cx, top: sy(sB) + 6 }}
            >
              {Math.round(sw)} × {Math.round(sh)}
            </span>
            {d?.left && hLabel(d.left)}
            {d?.right && hLabel(d.right)}
            {d?.gapH && hLabel(d.gapH)}
            {d?.top && vLabel(d.top)}
            {d?.bottom && vLabel(d.bottom)}
            {d?.gapV && vLabel(d.gapV)}
          </div>
        );
      })()}
      {connectPopover && (
        <>
          {sourceHandlePos && (
            <svg className="pointer-events-none fixed inset-0 z-40 h-full w-full">
              <defs>
                <linearGradient
                  id="connect-popover-grad"
                  gradientUnits="userSpaceOnUse"
                  x1={sourceHandlePos.x}
                  y1={sourceHandlePos.y}
                  x2={connectPopover.screenX}
                  y2={connectPopover.screenY}
                >
                  <stop offset="0%" stopColor={turboColors[1]} />
                  <stop offset="100%" stopColor={turboColors[0]} />
                </linearGradient>
              </defs>
              <path
                d={(() => {
                  const sx = sourceHandlePos.x;
                  const sy = sourceHandlePos.y;
                  const ex = connectPopover.screenX;
                  const ey = connectPopover.screenY;
                  const opposite: Record<Position, Position> = {
                    [Position.Top]: Position.Bottom,
                    [Position.Bottom]: Position.Top,
                    [Position.Left]: Position.Right,
                    [Position.Right]: Position.Left,
                  };
                  const [d] = getBezierPath({
                    sourceX: sx,
                    sourceY: sy,
                    targetX: ex,
                    targetY: ey,
                    sourcePosition: connectPopover.sourcePosition,
                    targetPosition: opposite[connectPopover.sourcePosition],
                    curvature: 0.4,
                  });
                  return d;
                })()}
                fill="none"
                stroke="url(#connect-popover-grad)"
                strokeWidth={3}
                strokeLinecap="round"
              />
              <circle
                cx={connectPopover.screenX}
                cy={connectPopover.screenY}
                r={4}
                fill={turboColors[0]}
              />
            </svg>
          )}
          <div
            className="fixed inset-0 z-40"
            onMouseDown={() => setConnectPopover(null)}
          />
          <div
            className="fixed z-50 w-56 rounded-md border border-border bg-card p-1.5 shadow-lg"
            style={{ left: connectPopover.screenX, top: connectPopover.screenY }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <p className="px-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Connect to…
            </p>
            <div className="grid max-h-72 grid-cols-1 gap-0.5 overflow-y-auto">
              {registry.map((b) => {
                const Ic = resolveIcon(b.iconName);
                const accent = ACCENT_CLASSES[b.accent];
                const hasIcon = !!(b.customIcon || b.iconName);
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => pickBlock(b.id)}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent"
                  >
                    <span
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded",
                        !b.customIcon && accent.tile
                      )}
                    >
                      {b.customIcon ? (
                        <img
                          src={b.customIcon}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : hasIcon ? (
                        <Ic className={cn("h-3 w-3", accent.icon)} />
                      ) : (
                        <span className={cn("h-2 w-2 rounded-full", accent.dot)} />
                      )}
                    </span>
                    <span className="flex-1 truncate">{b.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function Canvas() {
  return <CanvasInner />;
}
