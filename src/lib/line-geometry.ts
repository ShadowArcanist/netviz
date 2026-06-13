import type { LineDirection, LinePoint } from "@/store/flow-store";

export const LINE_HANDLE_PADDING = 12;
export const MIN_LINE_BOX_SIZE = LINE_HANDLE_PADDING * 2;

export type LineHandle = "start" | "end";

export type LineEndpoints = {
  start: LinePoint;
  end: LinePoint;
};

type LineBoundsInput = LineEndpoints & {
  position: LinePoint;
  width: number;
  height: number;
  handle: LineHandle;
  point: LinePoint;
};

export type NormalizedLineGeometry = LineEndpoints & {
  position: LinePoint;
  width: number;
  height: number;
};

export function defaultLineEndpoints(width: number, height: number): LineEndpoints {
  return {
    start: { x: LINE_HANDLE_PADDING, y: height / 2 },
    end: { x: Math.max(LINE_HANDLE_PADDING, width - LINE_HANDLE_PADDING), y: height / 2 },
  };
}

export function deriveLegacyLineEndpoints(
  direction: LineDirection = "l-r",
  width: number,
  height: number,
  rotation = 0
): LineEndpoints {
  const endpoints = endpointsForDirection(direction, width, height);
  if (!rotation) return endpoints;

  const center = { x: width / 2, y: height / 2 };
  return {
    start: rotatePoint(endpoints.start, center, rotation),
    end: rotatePoint(endpoints.end, center, rotation),
  };
}

export function normalizeLineEndpointDrag({
  position,
  start,
  end,
  handle,
  point,
}: LineBoundsInput): NormalizedLineGeometry {
  const nextStart = handle === "start" ? point : start;
  const nextEnd = handle === "end" ? point : end;
  return normalizeLineGeometry(position, nextStart, nextEnd);
}

export function lineAngleDegrees(start: LinePoint, end: LinePoint): number {
  const degrees = (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI;
  return Math.round((degrees + 360) % 360);
}

export function rotateLineToAngle({
  position,
  start,
  end,
  angle,
}: LineEndpoints & {
  position: LinePoint;
  width: number;
  height: number;
  angle: number;
}): NormalizedLineGeometry {
  const center = {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  const radians = (angle * Math.PI) / 180;
  const dx = (Math.cos(radians) * length) / 2;
  const dy = (Math.sin(radians) * length) / 2;
  return normalizeLineGeometry(
    position,
    { x: center.x - dx, y: center.y - dy },
    { x: center.x + dx, y: center.y + dy }
  );
}

function normalizeLineGeometry(
  position: LinePoint,
  nextStart: LinePoint,
  nextEnd: LinePoint
): NormalizedLineGeometry {
  const minX = Math.min(nextStart.x, nextEnd.x);
  const minY = Math.min(nextStart.y, nextEnd.y);
  const maxX = Math.max(nextStart.x, nextEnd.x);
  const maxY = Math.max(nextStart.y, nextEnd.y);
  const offsetX = minX - LINE_HANDLE_PADDING;
  const offsetY = minY - LINE_HANDLE_PADDING;
  const width = Math.max(MIN_LINE_BOX_SIZE, maxX - minX + LINE_HANDLE_PADDING * 2);
  const height = Math.max(MIN_LINE_BOX_SIZE, maxY - minY + LINE_HANDLE_PADDING * 2);

  return {
    position: {
      x: position.x + offsetX,
      y: position.y + offsetY,
    },
    width,
    height,
    start: {
      x: nextStart.x - offsetX,
      y: nextStart.y - offsetY,
    },
    end: {
      x: nextEnd.x - offsetX,
      y: nextEnd.y - offsetY,
    },
  };
}

function endpointsForDirection(
  direction: LineDirection,
  width: number,
  height: number
): LineEndpoints {
  switch (direction) {
    case "tl-br":
      return { start: { x: 0, y: 0 }, end: { x: width, y: height } };
    case "tr-bl":
      return { start: { x: width, y: 0 }, end: { x: 0, y: height } };
    case "t-b":
      return { start: { x: width / 2, y: 0 }, end: { x: width / 2, y: height } };
    case "l-r":
      return { start: { x: 0, y: height / 2 }, end: { x: width, y: height / 2 } };
  }
}

function rotatePoint(point: LinePoint, center: LinePoint, degrees: number): LinePoint {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}
