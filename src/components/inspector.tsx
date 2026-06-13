import { useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  ChevronsDown,
  ChevronsUp,
  ChevronUp,
  Search,
  Upload,
  X,
} from "lucide-react";
import {
  resolveBlock,
  useFlowStore,
  type AppNode,
  type ArrowShape,
  type BorderStyle,
  type CodeLanguage,
  type CodeNode,
  type IconPosition,
  type ImageNode,
  type InfraNode,
  type LineNode,
  type ShapeNode,
  type StepNode,
  type TextAlign,
  type TextNode,
} from "@/store/flow-store";
import {
  ACCENT_CLASSES,
  COLOR_PRESETS,
  type Accent,
} from "@/blocks/registry";
import { LUCIDE_ICON_NAMES, resolveIcon } from "@/blocks/icons";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { cn } from "@/lib/utils";
import {
  deriveLegacyLineEndpoints,
  lineAngleDegrees,
  rotateLineToAngle,
} from "@/lib/line-geometry";

const ACCENTS: Accent[] = [
  "indigo",
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "emerald",
  "teal",
  "cyan",
  "sky",
  "blue",
  "violet",
  "fuchsia",
  "pink",
  "slate",
];

export function Inspector() {
  const selectedProjection = useFlowStore(
    useShallow((s) => {
      const n = s.nodes.find((x) => x.selected);
      if (!n) return null;
      return n;
    })
  );
  if (!selectedProjection) return null;
  const selectedNode = selectedProjection as unknown as AppNode;

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-l border-border bg-card/40">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Inspector
        </p>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        <NodeEditor node={selectedNode} />
      </div>
    </aside>
  );
}

function LayerControls({ id }: { id: string }) {
  const bringToFront = useFlowStore((s) => s.bringToFront);
  const bringForward = useFlowStore((s) => s.bringForward);
  const sendBackward = useFlowStore((s) => s.sendBackward);
  const sendToBack = useFlowStore((s) => s.sendToBack);
  return (
    <div className="grid gap-1.5">
      <Label>Layer</Label>
      <div className="flex gap-1">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => bringToFront(id)} title="Bring to front">
          <ChevronsUp className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => bringForward(id)} title="Bring forward">
          <ChevronUp className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => sendBackward(id)} title="Send backward">
          <ChevronDown className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => sendToBack(id)} title="Send to back">
          <ChevronsDown className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function NodeEditor({ node }: { node: AppNode }) {
  if (node.type === "infra") return <InfraEditor node={node as InfraNode} />;
  if (node.type === "shape") return <ShapeEditor node={node as ShapeNode} />;
  if (node.type === "step") return <StepEditor node={node as StepNode} />;
  if (node.type === "line") return <LineEditor node={node as LineNode} />;
  if (node.type === "image") return <ImageEditor node={node as ImageNode} />;
  if (node.type === "code") return <CodeEditor node={node as CodeNode} />;
  return <TextEditor node={node as TextNode} />;
}

const CODE_LANGUAGES: CodeLanguage[] = [
  "plaintext",
  "bash",
  "javascript",
  "typescript",
  "tsx",
  "jsx",
  "json",
  "yaml",
  "python",
  "go",
  "sql",
  "html",
  "css",
  "markdown",
];

function CodeEditor({ node }: { node: CodeNode }) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  return (
    <>
      <div className="grid gap-1.5">
        <Label htmlFor={`${node.id}-label`}>Title</Label>
        <Input
          id={`${node.id}-label`}
          value={node.data.label ?? ""}
          onChange={(e) => updateNodeData(node.id, { label: e.target.value })}
          placeholder="Optional"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${node.id}-lang`}>Language</Label>
        <select
          id={`${node.id}-lang`}
          value={node.data.language}
          onChange={(e) =>
            updateNodeData(node.id, {
              language: e.target.value as CodeLanguage,
            })
          }
          className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {CODE_LANGUAGES.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${node.id}-code`}>Code</Label>
        <textarea
          id={`${node.id}-code`}
          value={node.data.code}
          onChange={(e) => updateNodeData(node.id, { code: e.target.value })}
          spellCheck={false}
          className="flex min-h-[180px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs leading-relaxed ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <RadiusSlider
        id={`${node.id}-radius`}
        value={node.data.borderRadius}
        fallback={8}
        onChange={(v) => updateNodeData(node.id, { borderRadius: v })}
      />
      <LayerControls id={node.id} />
      <ColorsSection
        targets={[
          {
            key: "bg",
            label: "Background",
            value: node.data.bgColor,
            onChange: (v) => updateNodeData(node.id, { bgColor: v }),
          },
          {
            key: "title",
            label: "Title",
            value: node.data.titleColor,
            onChange: (v) => updateNodeData(node.id, { titleColor: v }),
          },
          {
            key: "border",
            label: "Border",
            value: node.data.borderColor,
            onChange: (v) => updateNodeData(node.id, { borderColor: v }),
          },
        ]}
      />
    </>
  );
}

function ImageEditor({ node }: { node: ImageNode }) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  return (
    <>
      <div className="grid gap-1.5">
        <Label htmlFor={`${node.id}-alt`}>Alt text</Label>
        <Input
          id={`${node.id}-alt`}
          value={node.data.alt ?? ""}
          onChange={(e) => updateNodeData(node.id, { alt: e.target.value })}
          placeholder="Optional"
        />
      </div>
      <RadiusSlider
        id={`${node.id}-radius`}
        value={node.data.borderRadius}
        fallback={6}
        onChange={(v) => updateNodeData(node.id, { borderRadius: v })}
      />
      <LayerControls id={node.id} />
      <ColorsSection
        targets={[
          { key: "bg", label: "Background", value: node.data.bgColor, onChange: (v) => updateNodeData(node.id, { bgColor: v }) },
          { key: "border", label: "Border", value: node.data.borderColor, onChange: (v) => updateNodeData(node.id, { borderColor: v }) },
        ]}
      />
    </>
  );
}

function AccentPicker({ value, onChange, label = "Icon color" }: { value: Accent; onChange: (a: Accent) => void; label?: string }) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {ACCENTS.map((a) => {
          const c = ACCENT_CLASSES[a];
          return (
            <button
              key={a}
              type="button"
              onClick={() => onChange(a)}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md border border-border transition-colors",
                c.tile,
                value === a && "ring-1 ring-ring"
              )}
              aria-label={a}
              title={a}
            >
              <span className={cn("h-2.5 w-2.5 rounded-full", c.dot)} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

const TRANSPARENT_BG =
  "conic-gradient(hsl(var(--muted-foreground) / 0.5) 25%, transparent 25% 50%, hsl(var(--muted-foreground) / 0.5) 50% 75%, transparent 75%)";

function PresetButton({
  p,
  active,
  onClick,
}: {
  p: { id: string; hex: string | null; label: string };
  active: boolean;
  onClick: () => void;
}) {
  const isNone = p.hex === null;
  const isTransparent = p.hex === "transparent";
  const style: React.CSSProperties = {};
  if (isTransparent) {
    style.backgroundImage = TRANSPARENT_BG;
    style.backgroundSize = "8px 8px";
  } else if (!isNone) {
    style.backgroundColor = p.hex ?? undefined;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      title={p.label}
      aria-label={p.label}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-md border border-border transition-colors",
        active && "ring-1 ring-ring"
      )}
      style={style}
    >
      {isNone ? <X className="h-3.5 w-3.5 text-muted-foreground" /> : null}
    </button>
  );
}

function SwatchPicker({
  label,
  presets,
  value,
  onChange,
}: {
  label: string;
  presets: { id: string; hex: string | null; label: string }[];
  value: string | undefined;
  onChange: (v: string | undefined) => void;
}) {
  const current = value ?? null;
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <PresetButton
            key={p.id}
            p={p}
            active={(current ?? null) === p.hex}
            onClick={() => onChange(p.hex ?? undefined)}
          />
        ))}
      </div>
    </div>
  );
}

type ColorTarget = {
  key: string;
  label: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
};

function ColorsSection({ targets }: { targets: ColorTarget[] }) {
  const [activeKey, setActiveKey] = useState(targets[0]?.key ?? "");
  const active = targets.find((t) => t.key === activeKey) ?? targets[0];
  if (!active) return null;
  return (
    <div className="grid gap-2">
      <Label>Colors</Label>
      <div className="flex flex-wrap gap-1">
        {targets.map((t) => {
          const selected = t.key === active.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveKey(t.key)}
              className={cn(
                "flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs transition-colors",
                selected
                  ? "bg-accent text-accent-foreground ring-1 ring-ring"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span
                className="h-3 w-3 rounded-sm border border-border"
                style={t.value ? { backgroundColor: t.value } : undefined}
              />
              {t.label}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {COLOR_PRESETS.map((p) => (
          <PresetButton
            key={p.id}
            p={p}
            active={(active.value ?? null) === p.hex}
            onClick={() => active.onChange(p.hex ?? undefined)}
          />
        ))}
      </div>
    </div>
  );
}

function IconPicker({ value, onChange }: { value: string; onChange: (name: string) => void }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return LUCIDE_ICON_NAMES;
    return LUCIDE_ICON_NAMES.filter((n) => n.toLowerCase().includes(q));
  }, [query]);

  return (
    <div className="grid gap-2">
      <Label>Icon</Label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search icons…"
          className="h-8 pl-7 text-xs"
        />
      </div>
      <div className="grid max-h-44 grid-cols-8 gap-1 overflow-y-auto rounded-md border border-border bg-background/40 p-1.5">
        <button
          type="button"
          onClick={() => onChange("")}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
            value === "" && "bg-accent text-foreground ring-1 ring-ring"
          )}
          title="None"
          aria-label="No icon"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        {filtered.map((name) => {
          const Ic = resolveIcon(name);
          const active = value === name;
          return (
            <button
              key={name}
              type="button"
              onClick={() => onChange(name)}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                active && "bg-accent text-foreground ring-1 ring-ring"
              )}
              title={name}
              aria-label={name}
            >
              <Ic className="h-3.5 w-3.5" />
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="col-span-8 px-2 py-4 text-center text-xs text-muted-foreground">
            No icons match.
          </p>
        )}
      </div>
    </div>
  );
}

function CustomIconUpload({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (v: string | undefined) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") onChange(reader.result);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="grid gap-2">
      <Label>Custom icon</Label>
      <div className="flex items-center gap-2">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-background/40"
        >
          {value ? (
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <Upload className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 flex-1"
          onClick={() => inputRef.current?.click()}
        >
          {value ? "Replace" : "Upload"}
        </Button>
        {value ? (
          <button
            onClick={() => onChange(undefined)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:text-foreground"
            title="Remove custom icon"
            aria-label="Remove custom icon"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

const ICON_POSITIONS: { id: IconPosition; icon: typeof ArrowLeft; label: string }[] = [
  { id: "left", icon: ArrowLeft, label: "Left" },
  { id: "right", icon: ArrowRight, label: "Right" },
  { id: "top", icon: ArrowUp, label: "Top" },
  { id: "bottom", icon: ArrowDown, label: "Bottom" },
];

function IconPositionPicker({
  value,
  onChange,
}: {
  value: IconPosition;
  onChange: (v: IconPosition) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label>Icon position</Label>
      <div className="flex gap-1">
        {ICON_POSITIONS.map((p) => {
          const Ic = p.icon;
          return (
            <button
              key={p.id}
              type="button"
              aria-label={p.label}
              title={p.label}
              onClick={() => onChange(p.id)}
              className={cn(
                "flex flex-1 items-center justify-center rounded-md border border-border px-2 py-1.5 transition-colors",
                value === p.id
                  ? "bg-accent text-accent-foreground ring-1 ring-ring"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Ic className="h-3.5 w-3.5" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

const TEXT_ALIGNS: { id: TextAlign; icon: typeof AlignLeft }[] = [
  { id: "left", icon: AlignLeft },
  { id: "center", icon: AlignCenter },
  { id: "right", icon: AlignRight },
];

function TextAlignPicker({
  value,
  onChange,
}: {
  value: TextAlign;
  onChange: (v: TextAlign) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label>Content align</Label>
      <div className="flex gap-1">
        {TEXT_ALIGNS.map((a) => {
          const Ic = a.icon;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => onChange(a.id)}
              className={cn(
                "flex h-8 flex-1 items-center justify-center rounded-md border border-border transition-colors",
                value === a.id
                  ? "bg-accent text-accent-foreground ring-1 ring-ring"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title={a.id}
            >
              <Ic className="h-4 w-4" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function InfraEditor({ node }: { node: InfraNode }) {
  const customBlocks = useFlowStore((s) => s.customBlocks);
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  const block = resolveBlock(node.data.blockId, customBlocks);
  const iconName = node.data.iconName ?? block?.iconName ?? "box";
  const accent = node.data.accent ?? block?.accent ?? "slate";
  const iconPosition =
    node.data.iconPosition ??
    (block?.variant === "card" ? "top" : "left");
  const textAlign =
    node.data.textAlign ?? (block?.variant === "card" ? "center" : "left");

  return (
    <>
      <div className="grid gap-1.5">
        <Label htmlFor={`${node.id}-title`}>Title</Label>
        <Input
          id={`${node.id}-title`}
          value={node.data.label}
          onChange={(e) => updateNodeData(node.id, { label: e.target.value })}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${node.id}-desc`}>Description</Label>
        <Input
          id={`${node.id}-desc`}
          value={node.data.subtitle ?? ""}
          onChange={(e) => updateNodeData(node.id, { subtitle: e.target.value })}
          placeholder="Optional"
        />
      </div>
      <IconPicker value={iconName} onChange={(name) => updateNodeData(node.id, { iconName: name })} />
      <CustomIconUpload
        value={node.data.customIcon}
        onChange={(v) => updateNodeData(node.id, { customIcon: v })}
      />
      <IconPositionPicker
        value={iconPosition}
        onChange={(v) => updateNodeData(node.id, { iconPosition: v })}
      />
      <TextAlignPicker
        value={textAlign}
        onChange={(v) => updateNodeData(node.id, { textAlign: v })}
      />
      <AccentPicker value={accent} onChange={(a) => updateNodeData(node.id, { accent: a })} />
      <RadiusSlider
        id={`${node.id}-radius`}
        value={node.data.borderRadius}
        fallback={12}
        onChange={(v) => updateNodeData(node.id, { borderRadius: v })}
      />
      <WidthSlider
        id={`${node.id}-bw`}
        value={node.data.borderWidth}
        fallback={1}
        onChange={(v) => updateNodeData(node.id, { borderWidth: v })}
      />
      <LayerControls id={node.id} />
      <ColorsSection
        targets={[
          { key: "bg", label: "Background", value: node.data.bgColor, onChange: (v) => updateNodeData(node.id, { bgColor: v }) },
          { key: "title", label: "Title", value: node.data.titleColor, onChange: (v) => updateNodeData(node.id, { titleColor: v }) },
          { key: "desc", label: "Description", value: node.data.subtitleColor, onChange: (v) => updateNodeData(node.id, { subtitleColor: v }) },
          { key: "border", label: "Border", value: node.data.borderColor, onChange: (v) => updateNodeData(node.id, { borderColor: v }) },
        ]}
      />
    </>
  );
}

function RadiusSlider({
  id,
  value,
  fallback,
  max = 48,
  onChange,
}: {
  id: string;
  value: number | undefined;
  fallback: number;
  max?: number;
  onChange: (v: number) => void;
}) {
  const current = value ?? fallback;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>Border radius ({current}px)</Label>
      <input
        id={id}
        type="range"
        min={0}
        max={max}
        step={1}
        value={current}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary"
      />
    </div>
  );
}

function WidthSlider({
  id,
  value,
  fallback,
  max = 8,
  onChange,
}: {
  id: string;
  value: number | undefined;
  fallback: number;
  max?: number;
  onChange: (v: number) => void;
}) {
  const current = value ?? fallback;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>Border width ({current}px)</Label>
      <input
        id={id}
        type="range"
        min={0}
        max={max}
        step={1}
        value={current}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary"
      />
    </div>
  );
}

const BORDER_STYLES: BorderStyle[] = ["solid", "dashed", "dotted"];

function BorderStylePreview({ kind }: { kind: BorderStyle }) {
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

function BorderStylePicker({
  value,
  onChange,
}: {
  value: BorderStyle;
  onChange: (v: BorderStyle) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label>Border style</Label>
      <div className="flex gap-1">
        {BORDER_STYLES.map((k) => {
          const active = value === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => onChange(k)}
              className={cn(
                "flex-1 rounded-md border border-border px-2 py-1.5 text-[11px] capitalize transition-colors",
                active
                  ? "bg-accent text-accent-foreground ring-1 ring-ring"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <BorderStylePreview kind={k} />
              <span className="block pt-0.5">{k}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ShapeEditor({ node }: { node: ShapeNode }) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  const isRectangle = node.data.shape === "rectangle";
  return (
    <>
      <div className="grid gap-1.5">
        <Label htmlFor={`${node.id}-label`}>Label</Label>
        <Input
          id={`${node.id}-label`}
          value={node.data.label ?? ""}
          onChange={(e) => updateNodeData(node.id, { label: e.target.value })}
          placeholder="Optional"
        />
      </div>
      {isRectangle && (
        <BorderStylePicker
          value={node.data.borderStyle ?? "dashed"}
          onChange={(v) => updateNodeData(node.id, { borderStyle: v })}
        />
      )}
      <AccentPicker value={node.data.accent ?? "slate"} onChange={(a) => updateNodeData(node.id, { accent: a })} />
      {isRectangle && (
        <RadiusSlider
          id={`${node.id}-radius`}
          value={node.data.borderRadius}
          fallback={12}
          onChange={(v) => updateNodeData(node.id, { borderRadius: v })}
        />
      )}
      <LayerControls id={node.id} />
      <ColorsSection
        targets={[
          { key: "bg", label: "Background", value: node.data.bgColor, onChange: (v) => updateNodeData(node.id, { bgColor: v }) },
          { key: "label", label: "Label", value: node.data.titleColor, onChange: (v) => updateNodeData(node.id, { titleColor: v }) },
          { key: "border", label: "Border", value: node.data.borderColor, onChange: (v) => updateNodeData(node.id, { borderColor: v }) },
        ]}
      />
    </>
  );
}

function StepEditor({ node }: { node: StepNode }) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  return (
    <>
      <div className="grid gap-1.5">
        <Label htmlFor={`${node.id}-step`}>Number</Label>
        <Input
          id={`${node.id}-step`}
          type="number"
          value={node.data.step}
          onChange={(e) =>
            updateNodeData(node.id, { step: Math.max(0, Number(e.target.value) || 0) })
          }
        />
      </div>
      <AccentPicker value={node.data.accent ?? "indigo"} onChange={(a) => updateNodeData(node.id, { accent: a })} />
      <LayerControls id={node.id} />
      <ColorsSection
        targets={[
          { key: "bg", label: "Background", value: node.data.bgColor, onChange: (v) => updateNodeData(node.id, { bgColor: v }) },
          { key: "number", label: "Number", value: node.data.titleColor, onChange: (v) => updateNodeData(node.id, { titleColor: v }) },
          { key: "border", label: "Border", value: node.data.borderColor, onChange: (v) => updateNodeData(node.id, { borderColor: v }) },
        ]}
      />
    </>
  );
}

function TextEditor({ node }: { node: TextNode }) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  return (
    <>
      <div className="grid gap-1.5">
        <Label htmlFor={`${node.id}-text`}>Text</Label>
        <textarea
          id={`${node.id}-text`}
          value={node.data.text}
          onChange={(e) => updateNodeData(node.id, { text: e.target.value })}
          rows={3}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${node.id}-fs`}>
          Font size ({node.data.fontSize ?? 14}px)
        </Label>
        <input
          id={`${node.id}-fs`}
          type="range"
          min={10}
          max={64}
          step={1}
          value={node.data.fontSize ?? 14}
          onChange={(e) =>
            updateNodeData(node.id, { fontSize: Number(e.target.value) })
          }
          className="w-full accent-primary"
        />
      </div>
      <AccentPicker value={node.data.accent ?? "slate"} onChange={(a) => updateNodeData(node.id, { accent: a })} label="Color" />
      <div className="flex items-center justify-between">
        <Label>Background</Label>
        <button
          type="button"
          onClick={() =>
            updateNodeData(node.id, {
              bgColor: node.data.bgColor === "transparent" ? undefined : "transparent",
            })
          }
          className={cn(
            "rounded-md border border-border px-2 py-1 text-xs transition-colors",
            node.data.bgColor !== "transparent"
              ? "bg-accent text-accent-foreground ring-1 ring-ring"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {node.data.bgColor !== "transparent" ? "On" : "Off"}
        </button>
      </div>
      <RadiusSlider
        id={`${node.id}-radius`}
        value={node.data.borderRadius}
        fallback={6}
        onChange={(v) => updateNodeData(node.id, { borderRadius: v })}
      />
      <LayerControls id={node.id} />
      <ColorsSection
        targets={[
          { key: "bg", label: "Background", value: node.data.bgColor, onChange: (v) => updateNodeData(node.id, { bgColor: v }) },
          { key: "text", label: "Text", value: node.data.titleColor, onChange: (v) => updateNodeData(node.id, { titleColor: v }) },
        ]}
      />
    </>
  );
}

const ARROW_SHAPES: { id: ArrowShape; label: string; svg: React.ReactNode }[] = [
  { id: "none", label: "None", svg: <line x1="0" y1="5" x2="10" y2="5" stroke="currentColor" strokeWidth="1.5" /> },
  { id: "triangle", label: "Triangle", svg: <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" /> },
  { id: "open", label: "Open", svg: <path d="M 0 0 L 10 5 L 0 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /> },
  { id: "diamond", label: "Diamond", svg: <path d="M 0 5 L 5 0 L 10 5 L 5 10 z" fill="currentColor" /> },
  { id: "circle", label: "Circle", svg: <circle cx="5" cy="5" r="3.5" fill="currentColor" /> },
  { id: "bar", label: "Bar", svg: <path d="M 5 0 L 5 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /> },
];

function ArrowShapePicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: ArrowShape;
  onChange: (v: ArrowShape) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-1">
        {ARROW_SHAPES.map((s) => {
          const active = value === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onChange(s.id)}
              title={s.label}
              aria-label={s.label}
              className={cn(
                "flex h-8 w-10 items-center justify-center rounded-md border border-border transition-colors",
                active
                  ? "bg-accent text-accent-foreground ring-1 ring-ring"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <svg viewBox="0 0 10 10" className="h-4 w-4">
                {s.svg}
              </svg>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const LINE_STROKE_PRESETS: { id: string; hex: string | null; label: string }[] = [
  { id: "default", hex: "#94a3b8", label: "Default" },
  { id: "white", hex: "#ffffff", label: "White" },
  { id: "black", hex: "#0f172a", label: "Black" },
  { id: "red", hex: "#ef4444", label: "Red" },
  { id: "orange", hex: "#f97316", label: "Orange" },
  { id: "amber", hex: "#f59e0b", label: "Amber" },
  { id: "yellow", hex: "#eab308", label: "Yellow" },
  { id: "lime", hex: "#65a30d", label: "Lime" },
  { id: "emerald", hex: "#10b981", label: "Emerald" },
  { id: "teal", hex: "#14b8a6", label: "Teal" },
  { id: "cyan", hex: "#06b6d4", label: "Cyan" },
  { id: "sky", hex: "#0ea5e9", label: "Sky" },
  { id: "blue", hex: "#3b82f6", label: "Blue" },
  { id: "indigo", hex: "#6366f1", label: "Indigo" },
  { id: "violet", hex: "#8b5cf6", label: "Violet" },
  { id: "fuchsia", hex: "#d946ef", label: "Fuchsia" },
  { id: "pink", hex: "#ec4899", label: "Pink" },
];

function LineEditor({ node }: { node: LineNode }) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  const updateLineGeometry = useFlowStore((s) => s.updateLineGeometry);
  const width =
    node.measured?.width ??
    (typeof node.width === "number" ? node.width : undefined) ??
    (typeof node.style?.width === "number" ? node.style.width : undefined) ??
    200;
  const height =
    node.measured?.height ??
    (typeof node.height === "number" ? node.height : undefined) ??
    (typeof node.style?.height === "number" ? node.style.height : undefined) ??
    60;
  const endpoints =
    node.data.start && node.data.end
      ? { start: node.data.start, end: node.data.end }
      : deriveLegacyLineEndpoints(
          node.data.direction,
          width,
          height,
          node.data.rotation ?? 0
        );
  const rotation = lineAngleDegrees(endpoints.start, endpoints.end);
  const curvature = node.data.curvature ?? 0;
  const strokeColor = node.data.strokeColor ?? "#94a3b8";
  const strokeWidth = node.data.strokeWidth ?? 2;
  const dashed = !!node.data.dashed;
  const arrowStart = !!node.data.arrowStart;
  const arrowEnd = !!node.data.arrowEnd;
  const arrowStartShape: ArrowShape = node.data.arrowStartShape ?? "triangle";
  const arrowEndShape: ArrowShape = node.data.arrowEndShape ?? "triangle";

  return (
    <>
      <LayerControls id={node.id} />
      <div className="grid gap-1.5">
        <Label htmlFor={`${node.id}-rot`}>Rotation ({rotation}°)</Label>
        <input
          id={`${node.id}-rot`}
          type="range"
          min={0}
          max={359}
          step={1}
          value={rotation}
          onChange={(e) => {
            const geometry = rotateLineToAngle({
              position: node.position,
              width,
              height,
              start: endpoints.start,
              end: endpoints.end,
              angle: Number(e.target.value),
            });
            updateLineGeometry(node.id, geometry);
          }}
          className="w-full"
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor={`${node.id}-curv`}>Curvature ({curvature.toFixed(2)})</Label>
        <input
          id={`${node.id}-curv`}
          type="range"
          min={-1}
          max={1}
          step={0.05}
          value={curvature}
          onChange={(e) =>
            updateNodeData(node.id, { curvature: Number(e.target.value) })
          }
          className="w-full"
        />
      </div>

      <div className="grid gap-2">
        <Label>Arrow ends</Label>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => updateNodeData(node.id, { arrowStart: !arrowStart })}
            className={cn(
              "flex-1 rounded-md border border-border px-2 py-1 text-xs transition-colors",
              arrowStart
                ? "bg-accent text-accent-foreground ring-1 ring-ring"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Start
          </button>
          <button
            type="button"
            onClick={() => updateNodeData(node.id, { arrowEnd: !arrowEnd })}
            className={cn(
              "flex-1 rounded-md border border-border px-2 py-1 text-xs transition-colors",
              arrowEnd
                ? "bg-accent text-accent-foreground ring-1 ring-ring"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            End
          </button>
        </div>
      </div>

      {arrowStart && (
        <ArrowShapePicker
          label="Start shape"
          value={arrowStartShape}
          onChange={(v) => updateNodeData(node.id, { arrowStartShape: v })}
        />
      )}
      {arrowEnd && (
        <ArrowShapePicker
          label="End shape"
          value={arrowEndShape}
          onChange={(v) => updateNodeData(node.id, { arrowEndShape: v })}
        />
      )}

      <div className="grid gap-2">
        <Label>Style</Label>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => updateNodeData(node.id, { dashed: false })}
            className={cn(
              "flex-1 rounded-md border border-border px-2 py-1 text-xs transition-colors",
              !dashed
                ? "bg-accent text-accent-foreground ring-1 ring-ring"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Solid
          </button>
          <button
            type="button"
            onClick={() => updateNodeData(node.id, { dashed: true })}
            className={cn(
              "flex-1 rounded-md border border-border px-2 py-1 text-xs transition-colors",
              dashed
                ? "bg-accent text-accent-foreground ring-1 ring-ring"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Dashed
          </button>
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor={`${node.id}-sw`}>Stroke width</Label>
        <Input
          id={`${node.id}-sw`}
          type="number"
          min={1}
          max={12}
          value={strokeWidth}
          onChange={(e) =>
            updateNodeData(node.id, {
              strokeWidth: Math.max(1, Number(e.target.value) || 1),
            })
          }
        />
      </div>

      <SwatchPicker
        label="Stroke color"
        presets={LINE_STROKE_PRESETS}
        value={strokeColor}
        onChange={(v) =>
          updateNodeData(node.id, { strokeColor: v ?? "#94a3b8" })
        }
      />
    </>
  );
}
