import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  Check,
  ChevronRight,
  MoreVertical,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useReactFlow, getNodesBounds, getViewportForBounds } from "@xyflow/react";
import { toPng, toSvg } from "html-to-image";
import { useStore } from "zustand";
import { useFlowStore } from "@/store/flow-store";
import { downloadSnapshot, readSnapshotFromFile } from "@/lib/storage";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";

import type { WorkMode } from "@/store/flow-store";
const WORK_MODES: { id: WorkMode; label: string }[] = [
  { id: "design", label: "Design" },
  { id: "preview", label: "Preview" },
];

export function Toolbar() {
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const customBlocks = useFlowStore((s) => s.customBlocks);
  const groups = useFlowStore((s) => s.groups);
  const turbo = useFlowStore((s) => s.turbo);
  const animateEdges = useFlowStore((s) => s.animateEdges);
  const animationSpeed = useFlowStore((s) => s.animationSpeed);
  const turboColors = useFlowStore((s) => s.turboColors);
  const replace = useFlowStore((s) => s.replace);
  const clear = useFlowStore((s) => s.clear);
  const resetWorkspace = useFlowStore((s) => s.resetWorkspace);
  const selectAll = useFlowStore((s) => s.selectAll);
  const deleteSelected = useFlowStore((s) => s.deleteSelected);
  const addImageNode = useFlowStore((s) => s.addImageNode);
  const { zoomIn, zoomOut, fitView, setViewport, screenToFlowPosition } =
    useReactFlow();
  const workMode = useFlowStore((s) => s.workMode);
  const setWorkMode = useFlowStore((s) => s.setWorkMode);
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [exportDialog, setExportDialog] = useState<{
    format: "png" | "svg";
    name: string;
    bounds?: { x: number; y: number; width: number; height: number };
  } | null>(null);
  const [cropMode, setCropMode] = useState<{
    format: "png" | "svg";
  } | null>(null);

  const canUndo = useStore(useFlowStore.temporal, (s) => s.pastStates.length > 0);
  const canRedo = useStore(
    useFlowStore.temporal,
    (s) => s.futureStates.length > 0
  );
  const undo = () => useFlowStore.temporal.getState().undo();
  const redo = () => useFlowStore.temporal.getState().redo();

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /input|textarea/i.test(target.tagName)) return;
      if (target?.isContentEditable) return;
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        useFlowStore.temporal.getState().undo();
      } else if ((k === "z" && e.shiftKey) || k === "y") {
        e.preventDefault();
        useFlowStore.temporal.getState().redo();
      } else if (k === "a") {
        e.preventDefault();
        selectAll();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [selectAll]);

  const uploadImage = (f: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result);
      const img = new Image();
      img.onload = () => {
        const max = 400;
        const ratio = img.width / img.height || 1;
        const width = Math.min(max, img.width);
        const height = width / ratio;
        const pos = screenToFlowPosition({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        });
        addImageNode(
          src,
          { x: pos.x - width / 2, y: pos.y - height / 2 },
          { width, height }
        );
      };
      img.src = src;
    };
    reader.readAsDataURL(f);
  };

  const defaultExportName = () =>
    `netviz-${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:T]/g, "-")}`;

  const openExportDialog = (format: "png" | "svg") => {
    if (nodes.length === 0) return;
    setCropMode({ format });
  };

  const onCropComplete = useCallback(
    (screenRect: { x: number; y: number; width: number; height: number }) => {
      if (!cropMode) return;
      const tl = screenToFlowPosition({ x: screenRect.x, y: screenRect.y });
      const br = screenToFlowPosition({
        x: screenRect.x + screenRect.width,
        y: screenRect.y + screenRect.height,
      });
      setCropMode(null);
      setExportDialog({
        format: cropMode.format,
        name: defaultExportName(),
        bounds: {
          x: tl.x,
          y: tl.y,
          width: br.x - tl.x,
          height: br.y - tl.y,
        },
      });
    },
    [cropMode, screenToFlowPosition]
  );

  const onCropExportAll = useCallback(() => {
    if (!cropMode) return;
    setCropMode(null);
    setExportDialog({ format: cropMode.format, name: defaultExportName() });
  }, [cropMode]);

  const onCropCancel = useCallback(() => setCropMode(null), []);

  const exportImage = async (
    format: "png" | "svg",
    filename: string,
    customBounds?: { x: number; y: number; width: number; height: number }
  ) => {
    const viewport = document.querySelector(
      ".react-flow__viewport"
    ) as HTMLElement | null;
    if (!viewport || nodes.length === 0) return;
    const bounds = customBounds ?? getNodesBounds(nodes);
    if (bounds.width === 0 || bounds.height === 0) return;
    const padding = 80;
    const width = Math.round(bounds.width + padding * 2);
    const height = Math.round(bounds.height + padding * 2);
    const vp = getViewportForBounds(bounds, width, height, 1, 1, padding);
    const bg = getComputedStyle(document.body)
      .getPropertyValue("--canvas-bg")
      .trim();
    const bgColor = bg ? `hsl(${bg})` : "#ffffff";

    const edgeSvgs = Array.from(
      viewport.querySelectorAll(".react-flow__edges svg, .react-flow__edges > svg")
    ) as SVGSVGElement[];
    const saved = edgeSvgs.map((svg) => ({
      el: svg,
      w: svg.getAttribute("width"),
      h: svg.getAttribute("height"),
      style: svg.getAttribute("style"),
    }));
    const maxX = Math.ceil(bounds.x + bounds.width + padding * 2);
    const maxY = Math.ceil(bounds.y + bounds.height + padding * 2);
    const svgW = Math.max(maxX, Math.round(width / vp.zoom), 1);
    const svgH = Math.max(maxY, Math.round(height / vp.zoom), 1);
    edgeSvgs.forEach((svg) => {
      svg.setAttribute("width", String(svgW));
      svg.setAttribute("height", String(svgH));
      svg.style.width = `${svgW}px`;
      svg.style.height = `${svgH}px`;
      svg.style.overflow = "visible";
    });
    const edgesContainer = viewport.querySelector(
      ".react-flow__edges"
    ) as HTMLElement | null;
    const savedEdgesStyle = edgesContainer?.getAttribute("style") ?? null;
    if (edgesContainer) {
      edgesContainer.style.width = `${svgW}px`;
      edgesContainer.style.height = `${svgH}px`;
      edgesContainer.style.position = "absolute";
      edgesContainer.style.top = "0";
      edgesContainer.style.left = "0";
      edgesContainer.style.overflow = "visible";
    }

    const overriddenPaths: {
      el: SVGPathElement;
      stroke: string | null;
      style: string | null;
    }[] = [];
    const [c0, c1] = turboColors ?? ["#ec4899", "#3b82f6"];
    const SVG_NS = "http://www.w3.org/2000/svg";

    // html-to-image deep-clones SVGs but skips style inlining on SVG children.
    // Inline computed stroke/fill on all edge paths so they survive the clone.
    const allEdgePaths = Array.from(
      viewport.querySelectorAll(
        ".react-flow__edge-path, .react-flow__edge-interaction"
      )
    ) as SVGElement[];
    const savedEdgePathStyles = allEdgePaths.map((el) => ({
      el,
      style: el.getAttribute("style"),
    }));
    allEdgePaths.forEach((el) => {
      const cs = window.getComputedStyle(el);
      el.style.setProperty("stroke", cs.stroke);
      el.style.setProperty("stroke-width", cs.strokeWidth);
      el.style.setProperty("fill", cs.fill);
      if (cs.strokeDasharray && cs.strokeDasharray !== "none")
        el.style.setProperty("stroke-dasharray", cs.strokeDasharray);
      if (cs.strokeLinecap && cs.strokeLinecap !== "butt")
        el.style.setProperty("stroke-linecap", cs.strokeLinecap);
    });

    // Clone marker <defs> into each edge SVG so url(#marker) refs resolve
    // within the same SVG (html-to-image isolates each SVG).
    const defsSource = edgesContainer?.querySelector("svg > defs");
    const injectedDefs: SVGDefsElement[] = [];
    if (defsSource) {
      edgeSvgs.forEach((svg) => {
        if (svg.contains(defsSource)) return;
        const clone = defsSource.cloneNode(true) as SVGDefsElement;
        svg.insertBefore(clone, svg.firstChild);
        injectedDefs.push(clone);
      });
    }

    edgeSvgs.forEach((svg) => {
      const turboPaths = svg.querySelectorAll(
        ".react-flow__edge.turbo-on .react-flow__edge-path"
      );
      if (turboPaths.length === 0) return;
      const gradId = `turbo-edge-export-${Math.random().toString(36).slice(2, 9)}`;
      let defs = svg.querySelector("defs");
      if (!defs) {
        defs = document.createElementNS(SVG_NS, "defs");
        svg.insertBefore(defs, svg.firstChild);
      }
      const grad = document.createElementNS(SVG_NS, "linearGradient");
      grad.setAttribute("id", gradId);
      grad.setAttribute("x1", "0%");
      grad.setAttribute("y1", "0%");
      grad.setAttribute("x2", "100%");
      grad.setAttribute("y2", "0%");
      const s0 = document.createElementNS(SVG_NS, "stop");
      s0.setAttribute("offset", "0%");
      s0.setAttribute("stop-color", c0);
      const s1 = document.createElementNS(SVG_NS, "stop");
      s1.setAttribute("offset", "100%");
      s1.setAttribute("stop-color", c1);
      grad.appendChild(s0);
      grad.appendChild(s1);
      defs.appendChild(grad);
      turboPaths.forEach((p) => {
        const path = p as SVGPathElement;
        overriddenPaths.push({
          el: path,
          stroke: path.getAttribute("stroke"),
          style: path.getAttribute("style"),
        });
        path.setAttribute("stroke", `url(#${gradId})`);
        path.style.stroke = `url(#${gradId})`;
      });
    });

    try {
      const opts = {
        backgroundColor: bgColor,
        width,
        height,
        pixelRatio: format === "png" ? 4 : 1,
        cacheBust: true,
        style: {
          width: `${width}px`,
          height: `${height}px`,
          transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})`,
        },
      };
      const dataUrl =
        format === "png"
          ? await toPng(viewport, opts)
          : await toSvg(viewport, opts);
      const cleaned =
        filename.trim().replace(/[\\/:*?"<>|]/g, "_") || defaultExportName();
      const stripped = cleaned.replace(
        new RegExp(`\\.${format}$`, "i"),
        ""
      );
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${stripped}.${format}`;
      a.click();
    } finally {
      saved.forEach(({ el, w, h, style }) => {
        if (w === null) el.removeAttribute("width"); else el.setAttribute("width", w);
        if (h === null) el.removeAttribute("height"); else el.setAttribute("height", h);
        if (style === null) el.removeAttribute("style"); else el.setAttribute("style", style);
      });
      if (edgesContainer) {
        if (savedEdgesStyle === null) edgesContainer.removeAttribute("style");
        else edgesContainer.setAttribute("style", savedEdgesStyle);
      }
      injectedDefs.forEach((d) => d.parentNode?.removeChild(d));
      overriddenPaths.forEach(({ el, stroke }) => {
        if (stroke === null) el.removeAttribute("stroke");
        else el.setAttribute("stroke", stroke);
      });
      edgeSvgs.forEach((svg) => {
        svg
          .querySelectorAll("linearGradient[id^='turbo-edge-export-']")
          .forEach((g) => g.parentNode?.removeChild(g));
      });
      savedEdgePathStyles.forEach(({ el, style }) => {
        if (style === null) el.removeAttribute("style");
        else el.setAttribute("style", style);
      });
    }
  };

  const save = () => {
    const suggested = `netviz-${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:T]/g, "-")}`;
    const name = window.prompt("Save as:", suggested);
    if (name === null) return;
    downloadSnapshot(
      {
        version: 1,
        nodes,
        edges,
        customBlocks,
        groups,
        turbo,
        animateEdges,
        animationSpeed,
        turboColors,
      },
      name
    );
  };

  const load = async (f: File) => {
    try {
      const snap = await readSnapshotFromFile(f);
      replace({
        nodes: snap.nodes,
        edges: snap.edges,
        customBlocks: snap.customBlocks ?? [],
        groups: snap.groups ?? [],
        turbo: snap.turbo ?? false,
        animateEdges: snap.animateEdges ?? false,
        animationSpeed: snap.animationSpeed ?? 0.8,
        turboColors: snap.turboColors ?? undefined,
      });
    } catch (e) {
      console.error(e);
      alert("Could not load file. See console for details.");
    }
  };

  return (
    <header className="relative flex h-12 shrink-0 items-center border-b border-border bg-card/40 px-2">
      <div className="flex items-center justify-start gap-0.5">
        <Menu icon={MoreVertical} label="More" align="left">
          <MenuSubmenu label="Edit">
            <MenuItem
              shortcut="⌘Z"
              disabled={!canUndo}
              onSelect={(close) => {
                undo();
                close();
              }}
            >
              Undo
            </MenuItem>
            <MenuItem
              shortcut="⌘⇧Z"
              disabled={!canRedo}
              onSelect={(close) => {
                redo();
                close();
              }}
            >
              Redo
            </MenuItem>
            <MenuSeparator />
            <MenuItem
              shortcut="⌘A"
              onSelect={(close) => {
                selectAll();
                close();
              }}
            >
              Select all
            </MenuItem>
            <MenuItem
              shortcut="⌫"
              onSelect={(close) => {
                setConfirmDeleteOpen(true);
                close();
              }}
            >
              Delete selection
            </MenuItem>
          </MenuSubmenu>
          <MenuSubmenu label="View">
            <MenuItem
              onSelect={(close) => {
                zoomIn();
                close();
              }}
            >
              Zoom in
            </MenuItem>
            <MenuItem
              onSelect={(close) => {
                zoomOut();
                close();
              }}
            >
              Zoom out
            </MenuItem>
            <MenuItem
              onSelect={(close) => {
                fitView({ padding: 0.4 });
                close();
              }}
            >
              Fit view
            </MenuItem>
            <MenuItem
              onSelect={(close) => {
                setViewport({ x: 0, y: 0, zoom: 1 });
                close();
              }}
            >
              Reset zoom
            </MenuItem>
          </MenuSubmenu>
          <MenuSubmenu label="Export">
            <MenuItem
              onSelect={(close) => {
                save();
                close();
              }}
            >
              Save File
            </MenuItem>
            <MenuItem
              onSelect={(close) => {
                openExportDialog("png");
                close();
              }}
            >
              Export PNG
            </MenuItem>
            <MenuItem
              onSelect={(close) => {
                openExportDialog("svg");
                close();
              }}
            >
              Export SVG
            </MenuItem>
          </MenuSubmenu>
          <MenuItem
            onSelect={(close) => {
              fileRef.current?.click();
              close();
            }}
          >
            Import
          </MenuItem>
          <MenuItem
            onSelect={(close) => {
              imageRef.current?.click();
              close();
            }}
          >
            Upload image
          </MenuItem>
          <MenuSeparator />
          <PreferencesSubmenu />
          <MenuSeparator />
          <MenuItem
            danger
            onSelect={(close) => {
              setConfirmClearOpen(true);
              close();
            }}
          >
            Clear canvas
          </MenuItem>
          <MenuItem
            danger
            onSelect={(close) => {
              setConfirmResetOpen(true);
              close();
            }}
          >
            Reset workspace
          </MenuItem>
        </Menu>
      </div>
      <div className="pointer-events-none fixed left-1/2 top-0 z-40 flex h-12 -translate-x-1/2 items-center">
        <div className="pointer-events-auto flex items-center rounded-md border border-border bg-card p-0.5">
          {WORK_MODES.map((m) => {
            const active = workMode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setWorkMode(m.id)}
                className={cn(
                  "rounded px-3 py-1 text-xs font-medium transition-colors",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="ml-auto" />

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) load(f);
          e.target.value = "";
        }}
      />
      <input
        ref={imageRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) uploadImage(f);
          e.target.value = "";
        }}
      />
      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete selection?</DialogTitle>
            <DialogDescription>
              Removes selected nodes and edges. Cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                deleteSelected();
                setConfirmDeleteOpen(false);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={confirmResetOpen} onOpenChange={setConfirmResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset workspace?</DialogTitle>
            <DialogDescription>
              Wipes all nodes, edges, groups, custom blocks, and preferences.
              App reloads as brand new. Cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmResetOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmResetOpen(false);
                void resetWorkspace();
              }}
            >
              Reset workspace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!exportDialog}
        onOpenChange={(o) => {
          if (!o) setExportDialog(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Export {exportDialog?.format.toUpperCase() ?? ""}
            </DialogTitle>
            <DialogDescription>Choose a file name.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5 py-1">
            <Label htmlFor="export-filename">File name</Label>
            <div className="flex items-center gap-1">
              <Input
                id="export-filename"
                autoFocus
                value={exportDialog?.name ?? ""}
                onChange={(e) =>
                  setExportDialog((d) =>
                    d ? { ...d, name: e.target.value } : d
                  )
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" && exportDialog) {
                    e.preventDefault();
                    const { format, name, bounds } = exportDialog;
                    setExportDialog(null);
                    void exportImage(format, name, bounds);
                  }
                }}
              />
              <span className="shrink-0 text-sm text-muted-foreground">
                .{exportDialog?.format}
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportDialog(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!exportDialog) return;
                const { format, name, bounds } = exportDialog;
                setExportDialog(null);
                void exportImage(format, name, bounds);
              }}
            >
              Export
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={confirmClearOpen} onOpenChange={setConfirmClearOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear canvas?</DialogTitle>
            <DialogDescription>
              This removes all nodes, edges, and groups. Cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmClearOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                clear();
                setConfirmClearOpen(false);
              }}
            >
              Clear canvas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {cropMode && (
        <CropOverlay
          onComplete={onCropComplete}
          onExportAll={onCropExportAll}
          onCancel={onCropCancel}
        />
      )}
    </header>
  );
}

function CropOverlay({
  onComplete,
  onExportAll,
  onCancel,
}: {
  onComplete: (rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => void;
  onExportAll: () => void;
  onCancel: () => void;
}) {
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [end, setEnd] = useState<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onCancel]);

  const rect =
    start && end
      ? {
          x: Math.min(start.x, end.x),
          y: Math.min(start.y, end.y),
          width: Math.abs(end.x - start.x),
          height: Math.abs(end.y - start.y),
        }
      : null;

  const handleDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    dragging.current = true;
    setStart({ x: e.clientX, y: e.clientY });
    setEnd({ x: e.clientX, y: e.clientY });
  };

  const handleMove = (e: React.MouseEvent) => {
    if (!dragging.current) return;
    setEnd({ x: e.clientX, y: e.clientY });
  };

  const handleUp = () => {
    if (!dragging.current || !rect) return;
    dragging.current = false;
    if (rect.width < 10 || rect.height < 10) {
      setStart(null);
      setEnd(null);
      return;
    }
    onComplete(rect);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 cursor-crosshair select-none"
      onMouseDown={handleDown}
      onMouseMove={handleMove}
      onMouseUp={handleUp}
    >
      {/* dark overlay */}
      {rect && rect.width > 2 ? (
        <div
          className="absolute border-2 border-dashed border-ring"
          style={{
            left: rect.x,
            top: rect.y,
            width: rect.width,
            height: rect.height,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/30" />
      )}
      {/* hint bar */}
      <div className="fixed left-1/2 top-4 z-[51] -translate-x-1/2">
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-2 shadow-lg">
          <span className="text-sm text-foreground">
            Draw to select area
          </span>
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onExportAll();
            }}
            className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground transition-colors hover:bg-accent/80"
          >
            Export all
          </button>
          <span className="text-xs text-muted-foreground">
            ESC to cancel
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}

function PreferencesSubmenu() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const current = mounted ? theme : undefined;
  const showMinimap = useFlowStore((s) => s.showMinimap);
  const showControls = useFlowStore((s) => s.showControls);
  const showGrid = useFlowStore((s) => s.showGrid);
  const showSmartGuides = useFlowStore((s) => s.showSmartGuides);
  const toggleMinimap = useFlowStore((s) => s.toggleMinimap);
  const toggleControls = useFlowStore((s) => s.toggleControls);
  const toggleGrid = useFlowStore((s) => s.toggleGrid);
  const toggleSmartGuides = useFlowStore((s) => s.toggleSmartGuides);
  return (
    <MenuSubmenu label="Preferences">
      <MenuSubmenu label="Theme">
        <MenuItem
          active={current === "light"}
          onSelect={(close) => {
            setTheme("light");
            close();
          }}
        >
          Light
        </MenuItem>
        <MenuItem
          active={current === "dark"}
          onSelect={(close) => {
            setTheme("dark");
            close();
          }}
        >
          Dark
        </MenuItem>
        <MenuItem
          active={current === "system"}
          onSelect={(close) => {
            setTheme("system");
            close();
          }}
        >
          System
        </MenuItem>
      </MenuSubmenu>
      <MenuItem active={showMinimap} onSelect={() => toggleMinimap()}>
        Minimap
      </MenuItem>
      <MenuItem active={showControls} onSelect={() => toggleControls()}>
        Zoom controls
      </MenuItem>
      <MenuItem active={showGrid} onSelect={() => toggleGrid()}>
        Grid
      </MenuItem>
      <MenuItem active={showSmartGuides} onSelect={() => toggleSmartGuides()}>
        Smart guides
      </MenuItem>
    </MenuSubmenu>
  );
}

type MenuCtx = {
  close: () => void;
  activeSubmenu: string | null;
  setActiveSubmenu: (id: string | null) => void;
};

const MenuContext = createContext<MenuCtx>({
  close: () => {},
  activeSubmenu: null,
  setActiveSubmenu: () => {},
});

function Menu({
  label,
  icon: Ic,
  align = "left",
  children,
}: {
  label?: string;
  icon?: LucideIcon;
  align?: "left" | "right";
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  useEffect(() => {
    if (!open) setActiveSubmenu(null);
  }, [open]);
  const isIcon = !!Ic && !label;
  const close = () => setOpen(false);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={label}
        className={cn(
          "rounded-md text-sm transition-colors hover:bg-accent",
          isIcon
            ? "flex h-8 w-8 items-center justify-center"
            : "flex h-8 w-8 items-center justify-center",
          open && "bg-accent text-accent-foreground"
        )}
      >
        {Ic ? <Ic className="h-4 w-4" /> : label}
      </button>
      {open && (
        <div
          className={cn(
            "absolute top-full z-50 mt-1 min-w-[200px] rounded-md border border-border bg-card py-1 shadow-lg",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          <MenuContext.Provider
            value={{ close, activeSubmenu, setActiveSubmenu }}
          >
            {children}
          </MenuContext.Provider>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon: Ic,
  children,
  onSelect,
  active,
  danger,
  shortcut,
  disabled,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  children: ReactNode;
  onSelect: (close: () => void) => void;
  active?: boolean;
  danger?: boolean;
  shortcut?: string;
  disabled?: boolean;
}) {
  const { close, setActiveSubmenu } = useContext(MenuContext);
  return (
    <button
      type="button"
      disabled={disabled}
      onMouseEnter={() => setActiveSubmenu(null)}
      onClick={() => !disabled && onSelect(close)}
      className={cn(
        "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-accent",
        active && "text-foreground",
        danger && "text-destructive hover:text-destructive",
        disabled && "cursor-not-allowed opacity-40 hover:bg-transparent"
      )}
    >
      {Ic && <Ic className="h-3.5 w-3.5 shrink-0" />}
      <span className="flex-1">{children}</span>
      {shortcut && (
        <span className="ml-4 text-xs text-muted-foreground">{shortcut}</span>
      )}
      {active !== undefined && (
        <span className="ml-2 flex h-3.5 w-3.5 shrink-0 items-center justify-center">
          {active && <Check className="h-3.5 w-3.5" />}
        </span>
      )}
    </button>
  );
}

function MenuSubmenu({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const { activeSubmenu, setActiveSubmenu, close } = useContext(MenuContext);
  const [nestedActive, setNestedActive] = useState<string | null>(null);
  const id = label;
  const isOpen = activeSubmenu === id;
  useEffect(() => {
    if (!isOpen) setNestedActive(null);
  }, [isOpen]);
  return (
    <div
      className="relative"
      onMouseEnter={() => setActiveSubmenu(id)}
    >
      <button
        type="button"
        className={cn(
          "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-accent",
          isOpen && "bg-accent"
        )}
      >
        <span className="flex-1">{label}</span>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>
      {isOpen && (
        <div className="absolute left-full top-0 z-50 -mt-1 ml-1 min-w-[180px] rounded-md border border-border bg-card py-1 shadow-lg">
          <MenuContext.Provider
            value={{
              close,
              activeSubmenu: nestedActive,
              setActiveSubmenu: setNestedActive,
            }}
          >
            {children}
          </MenuContext.Provider>
        </div>
      )}
    </div>
  );
}

function MenuSeparator() {
  return <div className="my-1 h-px bg-border" />;
}
