import { useState } from "react";
import {
  Activity,
  Circle,
  Code2,
  Hash,
  Minus,
  Plus,
  Sparkles,
  Square,
  Trash2,
  Type,
} from "lucide-react";
import { useFlowStore, type EdgeLineStyle, type ShapeKind } from "@/store/flow-store";
import {
  ACCENT_CLASSES,
  COLOR_PRESETS,
  CORE_BLOCKS,
  type Accent,
  type BlockDef,
} from "@/blocks/registry";
import { X } from "lucide-react";
import { resolveIcon } from "@/blocks/icons";
import { Button } from "@/ui/button";
import { cn } from "@/lib/utils";
import { CustomBlockDialog } from "./custom-block-dialog";
import { LayersPanel } from "./layers-panel";
import type { LucideIcon } from "lucide-react";

const DRAG_MIME = "application/x-netviz";

function DragChip({
  payload,
  children,
}: {
  payload: object;
  children: React.ReactNode;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload));
        e.dataTransfer.effectAllowed = "move";
      }}
      className="group flex cursor-grab items-center gap-2.5 rounded-lg border border-border bg-card px-2.5 py-2 text-sm text-foreground transition-colors hover:bg-accent active:cursor-grabbing"
    >
      {children}
    </div>
  );
}

function AccentTile({
  icon: Icon,
  accent,
  customIcon,
  hasIcon,
}: {
  icon: LucideIcon;
  accent: Accent;
  customIcon?: string;
  hasIcon?: boolean;
}) {
  const c = ACCENT_CLASSES[accent];
  return (
    <div
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-md",
        c.tile
      )}
    >
      {customIcon ? (
        <img src={customIcon} alt="" className="h-4 w-4 object-contain" />
      ) : hasIcon === false ? (
        <span className={cn("h-2.5 w-2.5 rounded-full", c.dot)} />
      ) : (
        <Icon className={cn("h-4 w-4", c.icon)} />
      )}
    </div>
  );
}

function BlockChip({
  block,
  onDelete,
}: {
  block: BlockDef;
  onDelete?: () => void;
}) {
  const Icon = resolveIcon(block.iconName);
  return (
    <DragChip payload={{ kind: "infra", blockId: block.id }}>
      <AccentTile
        icon={Icon}
        accent={block.accent}
        customIcon={block.customIcon}
        hasIcon={!!block.iconName}
      />
      <span className="flex-1 truncate">{block.label}</span>
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
          aria-label="Delete custom block"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </DragChip>
  );
}

function ShapeChip({
  shape,
  label,
  accent,
}: {
  shape: ShapeKind;
  label: string;
  accent: Accent;
}) {
  const Icon = shape === "circle" ? Circle : Square;
  return (
    <DragChip payload={{ kind: "shape", shape }}>
      <AccentTile icon={Icon} accent={accent} />
      <span className="flex-1 truncate">{label}</span>
    </DragChip>
  );
}

function TextChip() {
  return (
    <DragChip payload={{ kind: "text" }}>
      <AccentTile icon={Type} accent="amber" />
      <span className="flex-1 truncate">Text</span>
    </DragChip>
  );
}

function StepChip() {
  return (
    <DragChip payload={{ kind: "step" }}>
      <AccentTile icon={Hash} accent="indigo" />
      <span className="flex-1 truncate">Step</span>
    </DragChip>
  );
}

function LineChip() {
  return (
    <DragChip payload={{ kind: "line" }}>
      <AccentTile icon={Minus} accent="teal" />
      <span className="flex-1 truncate">Line</span>
    </DragChip>
  );
}

function CodeChip() {
  return (
    <DragChip payload={{ kind: "code" }}>
      <AccentTile icon={Code2} accent="violet" />
      <span className="flex-1 truncate">Code</span>
    </DragChip>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-1 pb-2 pt-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
      {children}
    </p>
  );
}

type Tab = "blocks" | "layers" | "options";

export function Sidebar() {
  const customBlocks = useFlowStore((s) => s.customBlocks);
  const deleteCustomBlock = useFlowStore((s) => s.deleteCustomBlock);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("blocks");

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-card/40">
      <div className="flex h-12 shrink-0 items-center border-b border-border px-3">
        <div className="flex w-full items-center rounded-md border border-border bg-card p-0.5">
          <TabButton active={tab === "blocks"} onClick={() => setTab("blocks")}>
            Blocks
          </TabButton>
          <TabButton active={tab === "layers"} onClick={() => setTab("layers")}>
            Layers
          </TabButton>
          <TabButton
            active={tab === "options"}
            onClick={() => setTab("options")}
          >
            Options
          </TabButton>
        </div>
      </div>
      {tab === "blocks" ? (
        <>
          <div className="flex-1 overflow-y-auto px-3 pb-3 pt-2">
            <p className="px-1 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              Core
            </p>
            <div className="flex flex-col gap-1.5">
              {CORE_BLOCKS.map((b) => (
                <BlockChip key={b.id} block={b} />
              ))}
            </div>

            <SectionLabel>Shapes</SectionLabel>
            <div className="flex flex-col gap-1.5">
              <ShapeChip shape="rectangle" label="Rectangle" accent="violet" />
              <ShapeChip shape="circle" label="Circle" accent="emerald" />
            </div>

            <SectionLabel>Annotations</SectionLabel>
            <div className="flex flex-col gap-1.5">
              <TextChip />
              <StepChip />
              <LineChip />
              <CodeChip />
            </div>

            {customBlocks.length > 0 && (
              <>
                <SectionLabel>Custom</SectionLabel>
                <div className="flex flex-col gap-1.5">
                  {customBlocks.map((b) => (
                    <BlockChip
                      key={b.id}
                      block={b}
                      onDelete={() => deleteCustomBlock(b.id)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="border-t border-border p-3">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" /> New custom block
            </Button>
          </div>
        </>
      ) : tab === "layers" ? (
        <LayersPanel />
      ) : (
        <OptionsPanel />
      )}
      <CustomBlockDialog open={open} onOpenChange={setOpen} />
    </aside>
  );
}

function OptionsPanel() {
  const turboColors = useFlowStore((s) => s.turboColors);
  const animationSpeed = useFlowStore((s) => s.animationSpeed);
  const toggleTurbo = useFlowStore((s) => s.toggleTurbo);
  const toggleAnimateEdges = useFlowStore((s) => s.toggleAnimateEdges);
  const setAnimationSpeed = useFlowStore((s) => s.setAnimationSpeed);
  const setTurboColor = useFlowStore((s) => s.setTurboColor);
  const setEdgeColor = useFlowStore((s) => s.setEdgeColor);
  const setEdgeLineStyle = useFlowStore((s) => s.setEdgeLineStyle);
  const setEdgeDashGap = useFlowStore((s) => s.setEdgeDashGap);
  const setEdgeLabelColor = useFlowStore((s) => s.setEdgeLabelColor);
  const labelTextColor = useFlowStore((s) => {
    const sel = s.edges.filter((e) => e.selected);
    if (sel.length === 0) return undefined;
    const first = sel[0].data?.labelTextColor;
    return sel.every((e) => e.data?.labelTextColor === first) ? first : undefined;
  });
  const labelBgColor = useFlowStore((s) => {
    const sel = s.edges.filter((e) => e.selected);
    if (sel.length === 0) return undefined;
    const first = sel[0].data?.labelBgColor;
    return sel.every((e) => e.data?.labelBgColor === first) ? first : undefined;
  });
  const labelBorderColor = useFlowStore((s) => {
    const sel = s.edges.filter((e) => e.selected);
    if (sel.length === 0) return undefined;
    const first = sel[0].data?.labelBorderColor;
    return sel.every((e) => e.data?.labelBorderColor === first)
      ? first
      : undefined;
  });
  const labelColors = {
    text: labelTextColor,
    bg: labelBgColor,
    border: labelBorderColor,
  };
  const [labelKey, setLabelKey] = useState<"text" | "bg" | "border">("text");
  const edgeDashGap = useFlowStore((s) => {
    const sel = s.edges.filter((e) => e.selected);
    if (sel.length === 0) return s.edgeDashGap;
    const first = sel[0].data?.dashGap ?? s.edgeDashGap;
    return sel.every((e) => (e.data?.dashGap ?? s.edgeDashGap) === first)
      ? first
      : s.edgeDashGap;
  });
  const edgeColor = useFlowStore((s) => {
    const sel = s.edges.filter((e) => e.selected);
    if (sel.length === 0) return s.edgeColor;
    const first = sel[0].data?.color;
    return sel.every((e) => e.data?.color === first) ? first : undefined;
  });
  const edgeLineStyle = useFlowStore((s) => {
    const sel = s.edges.filter((e) => e.selected);
    if (sel.length === 0) return s.edgeLineStyle;
    const first = sel[0].data?.lineStyle ?? "solid";
    return sel.every((e) => (e.data?.lineStyle ?? "solid") === first)
      ? first
      : undefined;
  });
  const animateActive = useFlowStore((s) => {
    const sel = s.edges.filter((e) => e.selected);
    if (sel.length === 0 && !s.nodes.some((n) => n.selected))
      return s.animateEdges;
    return sel.length > 0 && sel.every((e) => e.animated);
  });
  const turboActive = useFlowStore((s) => {
    const edgeSel = s.edges.filter((e) => e.selected);
    const nodeSel = s.nodes.filter((n) => n.selected);
    if (edgeSel.length + nodeSel.length === 0) return s.turbo;
    return (
      edgeSel.every((e) => e.data?.turbo) &&
      nodeSel.every((n) => (n.data as { turbo?: boolean }).turbo)
    );
  });
  return (
    <div className="flex-1 overflow-y-auto px-3 pb-3 pt-2">
      <p className="px-1 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
        Edges
      </p>
      <div className="flex flex-col gap-1.5">
        <ModeToggle
          icon={Activity}
          label="Animate edges"
          active={animateActive}
          onToggle={toggleAnimateEdges}
        />
        {animateActive && (
          <div className="flex items-center gap-2 px-2 py-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Speed
            </span>
            <input
              type="range"
              min={0.05}
              max={3}
              step={0.05}
              value={3.05 - animationSpeed}
              onChange={(e) =>
                setAnimationSpeed(3.05 - Number(e.target.value))
              }
              className="flex-1 accent-primary"
              aria-label="Animation speed"
            />
            <span className="w-8 text-right text-[10px] tabular-nums text-muted-foreground">
              {animationSpeed.toFixed(2)}s
            </span>
          </div>
        )}
        <div
          className={cn(
            "px-1 pt-2",
            turboActive && "pointer-events-none opacity-40"
          )}
          title={turboActive ? "Turbo overrides edge color" : undefined}
        >
          <p className="pb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            Color{turboActive ? " (overridden by turbo)" : ""}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {COLOR_PRESETS.filter((p) => p.hex !== "transparent").map((p) => {
              const selected = (edgeColor ?? null) === p.hex;
              const isNone = p.hex === null;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setEdgeColor(p.hex ?? undefined)}
                  title={p.label}
                  aria-label={p.label}
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-md border border-border transition-colors",
                    selected && "ring-1 ring-ring"
                  )}
                  style={
                    isNone ? undefined : { backgroundColor: p.hex ?? undefined }
                  }
                >
                  {isNone ? (
                    <X className="h-3 w-3 text-muted-foreground" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
        <div className="px-1 pt-2">
          <p className="pb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            Line style
          </p>
          <div className="flex gap-1">
            {(["solid", "dashed", "dotted"] as EdgeLineStyle[]).map((k) => {
              const active = edgeLineStyle === k;
              const disabled = k === "solid" && animateActive;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => !disabled && setEdgeLineStyle(k)}
                  disabled={disabled}
                  title={
                    disabled
                      ? "Solid unavailable while Animate edges is on"
                      : undefined
                  }
                  className={cn(
                    "flex-1 rounded-md border border-border px-2 py-1.5 text-[11px] capitalize transition-colors",
                    disabled && "cursor-not-allowed opacity-40",
                    !disabled && active
                      ? "bg-accent text-accent-foreground ring-1 ring-ring"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <LineStylePreview kind={k} />
                  <span className="block pt-0.5">{k}</span>
                </button>
              );
            })}
          </div>
        </div>
        {(edgeLineStyle === "dashed" || edgeLineStyle === "dotted") && (
          <div className="flex items-center gap-2 px-2 pt-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Spacing
            </span>
            <input
              type="range"
              min={2}
              max={20}
              step={1}
              value={edgeDashGap}
              onChange={(e) => setEdgeDashGap(Number(e.target.value))}
              className="flex-1 accent-primary"
              aria-label="Edge dash spacing"
            />
            <span className="w-6 text-right text-[10px] tabular-nums text-muted-foreground">
              {edgeDashGap}
            </span>
          </div>
        )}
        <div className="px-1 pt-2">
          <p className="pb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            Label
          </p>
          <div className="flex flex-wrap gap-1 pb-1.5">
            {(
              [
                { k: "text", label: "Text" },
                { k: "bg", label: "Background" },
                { k: "border", label: "Border" },
              ] as { k: "text" | "bg" | "border"; label: string }[]
            ).map((t) => {
              const selected = labelKey === t.k;
              const val = labelColors[t.k];
              return (
                <button
                  key={t.k}
                  type="button"
                  onClick={() => setLabelKey(t.k)}
                  className={cn(
                    "flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[10px] transition-colors",
                    selected
                      ? "bg-accent text-accent-foreground ring-1 ring-ring"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-sm border border-border"
                    style={val ? { backgroundColor: val } : undefined}
                  />
                  {t.label}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {COLOR_PRESETS.map((p) => {
              const current = labelColors[labelKey] ?? null;
              const selected = (current ?? null) === p.hex;
              const isNone = p.hex === null;
              const isTransparent = p.hex === "transparent";
              const style: React.CSSProperties = {};
              if (isTransparent) {
                style.backgroundImage =
                  "conic-gradient(hsl(var(--muted-foreground) / 0.5) 25%, transparent 25% 50%, hsl(var(--muted-foreground) / 0.5) 50% 75%, transparent 75%)";
                style.backgroundSize = "6px 6px";
              } else if (!isNone) {
                style.backgroundColor = p.hex ?? undefined;
              }
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() =>
                    setEdgeLabelColor(labelKey, p.hex ?? undefined)
                  }
                  title={p.label}
                  aria-label={p.label}
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-md border border-border transition-colors",
                    selected && "ring-1 ring-ring"
                  )}
                  style={style}
                >
                  {isNone ? (
                    <X className="h-3 w-3 text-muted-foreground" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <p className="px-1 pb-2 pt-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
        Blocks
      </p>
      <div className="flex flex-col gap-1.5">
        <ModeToggle
          icon={Sparkles}
          label="Turbo"
          active={turboActive}
          onToggle={toggleTurbo}
        />
      </div>
      {turboActive && (
        <>
          <p className="px-1 pb-2 pt-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            Turbo colors
          </p>
          <div className="flex items-center gap-2 px-1">
            <ColorSwatch
              value={turboColors[0]}
              onChange={(v) => setTurboColor(0, v)}
              label="Turbo start color"
            />
            <span className="text-xs text-muted-foreground">→</span>
            <ColorSwatch
              value={turboColors[1]}
              onChange={(v) => setTurboColor(1, v)}
              label="Turbo end color"
            />
          </div>
        </>
      )}
    </div>
  );
}

function LineStylePreview({ kind }: { kind: EdgeLineStyle }) {
  const dash =
    kind === "dashed" ? "6 4" : kind === "dotted" ? "1 4" : undefined;
  const cap = kind === "dotted" ? "round" : undefined;
  return (
    <svg viewBox="0 0 40 6" className="h-1.5 w-full">
      <line
        x1="2"
        y1="3"
        x2="38"
        y2="3"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray={dash}
        strokeLinecap={cap}
      />
    </svg>
  );
}

function ModeToggle({
  icon: Ic,
  label,
  active,
  onToggle,
}: {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-accent",
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground"
      )}
    >
      <Ic className="h-3.5 w-3.5" />
      <span className="flex-1 text-left">{label}</span>
      <span
        className={cn(
          "flex h-3.5 w-6 items-center rounded-full border border-border p-0.5 transition-colors",
          active ? "bg-primary" : "bg-muted"
        )}
      >
        <span
          className={cn(
            "h-2 w-2 rounded-full bg-background transition-transform",
            active ? "translate-x-2.5" : "translate-x-0"
          )}
        />
      </span>
    </button>
  );
}

function ColorSwatch({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <label
      className="relative block h-6 w-6 cursor-pointer overflow-hidden rounded-sm border border-border"
      style={{ backgroundColor: value }}
      aria-label={label}
      title={label}
    >
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </label>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 rounded px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
