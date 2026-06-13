import { describe, expect, test } from "bun:test";
import {
  LINE_HANDLE_PADDING,
  deriveLegacyLineEndpoints,
  lineAngleDegrees,
  normalizeLineEndpointDrag,
  rotateLineToAngle,
} from "../src/lib/line-geometry";

describe("line geometry", () => {
  test("derives rotated legacy endpoints from direction and rotation", () => {
    const endpoints = deriveLegacyLineEndpoints("l-r", 200, 60, 90);

    expect(endpoints.start.x).toBeCloseTo(100);
    expect(endpoints.start.y).toBeCloseTo(-70);
    expect(endpoints.end.x).toBeCloseTo(100);
    expect(endpoints.end.y).toBeCloseTo(130);
  });

  test("normalizes a dragged endpoint into a resized node box", () => {
    const result = normalizeLineEndpointDrag({
      position: { x: 100, y: 100 },
      width: 200,
      height: 60,
      start: { x: LINE_HANDLE_PADDING, y: 30 },
      end: { x: 188, y: 30 },
      handle: "end",
      point: { x: 260, y: 80 },
    });

    expect(result.position).toEqual({ x: 100, y: 118 });
    expect(result.width).toBe(272);
    expect(result.height).toBe(74);
    expect(result.start).toEqual({ x: 12, y: 12 });
    expect(result.end).toEqual({ x: 260, y: 62 });
  });

  test("normalizes negative endpoint drags by moving the node origin", () => {
    const result = normalizeLineEndpointDrag({
      position: { x: 100, y: 100 },
      width: 200,
      height: 60,
      start: { x: LINE_HANDLE_PADDING, y: 30 },
      end: { x: 188, y: 30 },
      handle: "start",
      point: { x: -20, y: 30 },
    });

    expect(result.position).toEqual({ x: 68, y: 118 });
    expect(result.width).toBe(232);
    expect(result.height).toBe(24);
    expect(result.start).toEqual({ x: 12, y: 12 });
    expect(result.end).toEqual({ x: 220, y: 12 });
  });

  test("rotates endpoints around the line midpoint and normalizes the node box", () => {
    const result = rotateLineToAngle({
      position: { x: 100, y: 100 },
      width: 200,
      height: 60,
      start: { x: LINE_HANDLE_PADDING, y: 30 },
      end: { x: 188, y: 30 },
      angle: 90,
    });

    expect(result.position.x).toBeCloseTo(188);
    expect(result.position.y).toBeCloseTo(30);
    expect(result.width).toBeCloseTo(24);
    expect(result.height).toBeCloseTo(200);
    expect(result.start.x).toBeCloseTo(12);
    expect(result.start.y).toBeCloseTo(12);
    expect(result.end.x).toBeCloseTo(12);
    expect(result.end.y).toBeCloseTo(188);
    expect(lineAngleDegrees(result.start, result.end)).toBe(90);
  });
});
