import { memo, useCallback, useMemo } from "react";
import { useReactFlow, type NodeProps } from "@xyflow/react";
import {
  deriveLegacyLineEndpoints,
  normalizeLineEndpointDrag,
  type LineHandle,
} from "@/lib/line-geometry";
import { useFlowStore, type ArrowShape, type LineNode } from "@/store/flow-store";

function ArrowMarker({
  id,
  shape,
  color,
  end,
}: {
  id: string;
  shape: ArrowShape;
  color: string;
  end: "start" | "end";
}) {
  if (shape === "none") return null;
  const refX = end === "end" ? 8 : 2;
  const refY = 5;
  const common = {
    id,
    viewBox: "0 0 10 10",
    refX,
    refY,
    markerWidth: 8,
    markerHeight: 8,
    orient: "auto-start-reverse" as const,
  };
  switch (shape) {
    case "triangle":
      return (
        <marker {...common}>
          <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
        </marker>
      );
    case "open":
      return (
        <marker {...common}>
          <path
            d="M 0 0 L 10 5 L 0 10"
            fill="none"
            stroke={color}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </marker>
      );
    case "diamond":
      return (
        <marker {...common}>
          <path d="M 0 5 L 5 0 L 10 5 L 5 10 z" fill={color} />
        </marker>
      );
    case "circle":
      return (
        <marker {...common}>
          <circle cx="5" cy="5" r="3.5" fill={color} />
        </marker>
      );
    case "bar":
      return (
        <marker {...common}>
          <path d="M 5 0 L 5 10" stroke={color} strokeWidth={2} strokeLinecap="round" />
        </marker>
      );
  }
}

function LineNodeComponent({
  data,
  width,
  height,
  selected,
  id,
}: NodeProps<LineNode>) {
  const { screenToFlowPosition } = useReactFlow();
  const updateLineGeometry = useFlowStore((s) => s.updateLineGeometry);
  const w = width ?? 200;
  const h = height ?? 60;
  const curvature = data.curvature ?? 0;
  const stroke = data.strokeColor ?? "#94a3b8";
  const strokeWidth = data.strokeWidth ?? 2;
  const dashed = !!data.dashed;
  const arrowStart = !!data.arrowStart;
  const arrowEnd = !!data.arrowEnd;
  const arrowStartShape: ArrowShape = data.arrowStartShape ?? "triangle";
  const arrowEndShape: ArrowShape = data.arrowEndShape ?? "triangle";

  const endpoints = useMemo(
    () =>
      data.start && data.end
        ? { start: data.start, end: data.end }
        : deriveLegacyLineEndpoints(data.direction, w, h, data.rotation ?? 0),
    [data.direction, data.end, data.rotation, data.start, h, w]
  );
  const { start, end } = endpoints;

  const path = useMemo(() => {
    if (!curvature) return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
    const mx = (start.x + end.x) / 2;
    const my = (start.y + end.y) / 2;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const offset = curvature * (len / 2);
    const cx = mx + nx * offset;
    const cy = my + ny * offset;
    return `M ${start.x} ${start.y} Q ${cx} ${cy} ${end.x} ${end.y}`;
  }, [curvature, end, start]);

  const beginEndpointDrag = useCallback(
    (handle: LineHandle) => (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const pointerId = event.pointerId;
      event.currentTarget.setPointerCapture(pointerId);

      const move = (moveEvent: PointerEvent) => {
        const current = useFlowStore
          .getState()
          .nodes.find((n): n is LineNode => n.id === id && n.type === "line");
        if (!current) return;

        const currentWidth =
          current.measured?.width ??
          (typeof current.width === "number" ? current.width : undefined) ??
          (typeof current.style?.width === "number" ? current.style.width : undefined) ??
          w;
        const currentHeight =
          current.measured?.height ??
          (typeof current.height === "number" ? current.height : undefined) ??
          (typeof current.style?.height === "number" ? current.style.height : undefined) ??
          h;
        const currentEndpoints =
          current.data.start && current.data.end
            ? { start: current.data.start, end: current.data.end }
            : deriveLegacyLineEndpoints(
                current.data.direction,
                currentWidth,
                currentHeight,
                current.data.rotation ?? 0
              );
        const flowPoint = screenToFlowPosition({
          x: moveEvent.clientX,
          y: moveEvent.clientY,
        });
        const geometry = normalizeLineEndpointDrag({
          position: current.position,
          width: currentWidth,
          height: currentHeight,
          start: currentEndpoints.start,
          end: currentEndpoints.end,
          handle,
          point: {
            x: flowPoint.x - current.position.x,
            y: flowPoint.y - current.position.y,
          },
        });
        updateLineGeometry(id, geometry);
      };

      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };

      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up, { once: true });
    },
    [h, id, screenToFlowPosition, updateLineGeometry, w]
  );

  const markerEndId = `line-arrow-end-${id}`;
  const markerStartId = `line-arrow-start-${id}`;

  return (
    <div className="relative h-full w-full select-none">
      <svg
        className="h-full w-full overflow-visible"
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
      >
        <defs>
          <ArrowMarker id={markerEndId} shape={arrowEndShape} color={stroke} end="end" />
          <ArrowMarker id={markerStartId} shape={arrowStartShape} color={stroke} end="start" />
        </defs>
        <path
          d={path}
          stroke={stroke}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={dashed ? "6 4" : undefined}
          strokeLinecap="round"
          markerStart={arrowStart && arrowStartShape !== "none" ? `url(#${markerStartId})` : undefined}
          markerEnd={arrowEnd && arrowEndShape !== "none" ? `url(#${markerEndId})` : undefined}
        />
      </svg>
      {selected && (
        <>
          <EndpointHandle
            point={start}
            label="Start"
            onPointerDown={beginEndpointDrag("start")}
          />
          <EndpointHandle
            point={end}
            label="End"
            onPointerDown={beginEndpointDrag("end")}
          />
        </>
      )}
    </div>
  );
}

export const LineNodeView = memo(LineNodeComponent);

function EndpointHandle({
  point,
  label,
  onPointerDown,
}: {
  point: { x: number; y: number };
  label: string;
  onPointerDown: React.PointerEventHandler<HTMLButtonElement>;
}) {
  return (
    <button
      type="button"
      aria-label={`${label} endpoint`}
      title={`${label} endpoint`}
      className="nodrag nopan absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ring bg-background shadow-sm transition-transform hover:scale-110"
      style={{ left: point.x, top: point.y }}
      onPointerDown={onPointerDown}
    />
  );
}
