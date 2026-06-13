import { describe, expect, test } from "bun:test";
import {
  computeSnap,
  getRawDragPosition,
  resolveSnapPosition,
} from "../src/lib/snapping";

const drag = {
  id: "drag",
  position: { x: 95, y: 10 },
  style: { width: 100, height: 60 },
};

const target = {
  id: "target",
  position: { x: 200, y: 200 },
  style: { width: 100, height: 60 },
};

describe("snapping", () => {
  test("removes the previous snap delta before calculating the next raw drag position", () => {
    expect(
      getRawDragPosition(
        { x: 104, y: 12 },
        { x: 5, y: 0 }
      )
    ).toEqual({ x: 99, y: 12 });
  });

  test("keeps snap output stable across consecutive drag frames", () => {
    const first = computeSnap(drag, { x: 95, y: 10 }, [target], 1);
    expect(first.position).toEqual({ x: 100, y: 10 });
    expect(first.delta).toEqual({ x: 5, y: 0 });

    const rawSecond = getRawDragPosition({ x: 104, y: 12 }, first.delta);
    const second = computeSnap(drag, rawSecond, [target], 1);

    expect(rawSecond).toEqual({ x: 99, y: 12 });
    expect(second.position).toEqual({ x: 100, y: 12 });
    expect(second.delta).toEqual({ x: 1, y: 0 });
  });

  test("keeps live drag movement raw and applies snapping only on release", () => {
    const snap = computeSnap(drag, { x: 95, y: 10 }, [target], 1);

    expect(resolveSnapPosition({ x: 95, y: 10 }, snap.position, true)).toEqual({
      x: 95,
      y: 10,
    });
    expect(resolveSnapPosition({ x: 95, y: 10 }, snap.position, false)).toEqual({
      x: 100,
      y: 10,
    });
  });

  test("does not snap borders to centers or centers to borders", () => {
    const narrowDrag = {
      id: "narrow",
      position: { x: 0, y: 0 },
      style: { width: 60, height: 60 },
    };

    const borderToCenter = computeSnap(
      narrowDrag,
      { x: 187, y: 0 },
      [target],
      1
    );
    expect(borderToCenter.position).toEqual({ x: 187, y: 0 });
    expect(borderToCenter.guides).toHaveLength(0);

    const centerToBorder = computeSnap(
      narrowDrag,
      { x: 167, y: 0 },
      [target],
      1
    );
    expect(centerToBorder.position).toEqual({ x: 167, y: 0 });
    expect(centerToBorder.guides).toHaveLength(0);
  });

  test("still snaps borders to borders", () => {
    const narrowDrag = {
      id: "narrow",
      position: { x: 0, y: 0 },
      style: { width: 60, height: 60 },
    };

    const snap = computeSnap(narrowDrag, { x: 137, y: 0 }, [target], 1);

    expect(snap.position).toEqual({ x: 140, y: 0 });
    expect(snap.guides).toEqual([
      { axis: "x", pos: 200, from: 0, to: 260 },
    ]);
  });

  test("retains active guides briefly past the snap threshold to avoid flicker", () => {
    const alignedTarget = {
      id: "aligned",
      position: { x: 200, y: 70 },
      style: { width: 100, height: 60 },
    };
    const first = computeSnap(drag, { x: 95, y: 5 }, [alignedTarget], 1);
    expect(first.position).toEqual({ x: 100, y: 10 });
    expect(first.activeSnap).toEqual({
      x: { value: 200, kind: "border" },
      y: { value: 70, kind: "border" },
    });

    const second = computeSnap(
      drag,
      { x: 107, y: 17 },
      [alignedTarget],
      1,
      first.activeSnap
    );

    expect(second.position).toEqual({ x: 100, y: 10 });
    expect(second.guides).toHaveLength(2);
  });
});
