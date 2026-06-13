import {
  createContext,
  memo,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  type KeyboardEvent,
  type DragEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { useShallow } from "zustand/react/shallow";
import {
  ChevronDown,
  ChevronRight,
  Circle,
  Code2,
  Eye,
  EyeOff,
  Folder,
  FolderOpen,
  FolderPlus,
  Hash,
  Image as ImageIcon,
  Lock,
  LockOpen,
  Minus,
  Pencil,
  Square,
  Trash2,
  Type,
  type LucideIcon,
} from "lucide-react";
import {
  getNodeDisplayName,
  resolveBlock,
  useFlowStore,
  type AppNode,
  type Group,
} from "@/store/flow-store";
import { resolveIcon } from "@/blocks/icons";
import type { BlockDef } from "@/blocks/registry";
import { cn } from "@/lib/utils";

const DRAG_MIME = "application/x-netviz-layer";

type CtxItem = {
  label: string;
  icon?: LucideIcon;
  danger?: boolean;
  onSelect: () => void;
};

type CtxState = { x: number; y: number; items: CtxItem[] } | null;
const CtxMenuContext = createContext<{
  open: (x: number, y: number, items: CtxItem[]) => void;
}>({ open: () => {} });

function useCtxMenu() {
  return useContext(CtxMenuContext);
}

type DragPayload =
  | { kind: "node"; id: string }
  | { kind: "group"; id: string };

type DropZone = "before" | "after" | "into";

function nodeIcon(node: AppNode, customBlocks: BlockDef[]): LucideIcon {
  switch (node.type) {
    case "infra": {
      const block = resolveBlock(node.data.blockId, customBlocks);
      const iconName = node.data.iconName ?? block?.iconName ?? "box";
      return resolveIcon(iconName);
    }
    case "shape":
      return node.data.shape === "circle" ? Circle : Square;
    case "text":
      return Type;
    case "step":
      return Hash;
    case "line":
      return Minus;
    case "image":
      return ImageIcon;
    case "code":
      return Code2;
  }
  return Square;
}

function readPayload(e: DragEvent): DragPayload | null {
  try {
    const raw = e.dataTransfer.getData(DRAG_MIME);
    if (!raw) return null;
    return JSON.parse(raw) as DragPayload;
  } catch {
    return null;
  }
}

export function LayersPanel() {
  const rootGroups = useFlowStore(
    useShallow((s) => s.groups.filter((g) => g.parentGroupId === null))
  );
  const rootNodes = useFlowStore(
    useShallow((s) => s.nodes.filter((n) => !n.data.groupId))
  );
  const createGroup = useFlowStore((s) => s.createGroup);
  const moveNodeBefore = useFlowStore((s) => s.moveNodeBefore);
  const moveGroupBefore = useFlowStore((s) => s.moveGroupBefore);
  const [rootOver, setRootOver] = useState(false);
  const [ctx, setCtx] = useState<CtxState>(null);
  const openCtx = useCallback(
    (x: number, y: number, items: CtxItem[]) => setCtx({ x, y, items }),
    []
  );
  useEffect(() => {
    if (!ctx) return;
    const close = () => setCtx(null);
    const esc = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [ctx]);

  const onEmptyContextMenu = (e: MouseEvent) => {
    if (e.target !== e.currentTarget) return;
    e.preventDefault();
    openCtx(e.clientX, e.clientY, [
      {
        label: "New group",
        icon: FolderPlus,
        onSelect: () => createGroup(null),
      },
    ]);
  };

  const onRootDragOver = (e: DragEvent) => {
    if (e.dataTransfer.types.includes(DRAG_MIME)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setRootOver(true);
    }
  };

  const onRootDrop = (e: DragEvent) => {
    const p = readPayload(e);
    setRootOver(false);
    if (!p) return;
    e.preventDefault();
    if (p.kind === "node") moveNodeBefore(p.id, null, null);
    else moveGroupBefore(p.id, null, null);
  };

  return (
    <CtxMenuContext.Provider value={{ open: openCtx }}>
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Layers
          </p>
          <button
            onClick={() => createGroup(null)}
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="New group"
            aria-label="New group"
          >
            <FolderPlus className="h-3.5 w-3.5" />
          </button>
        </div>
        <div
          className={cn(
            "flex-1 overflow-y-auto px-1 pb-2",
            rootOver && "bg-accent/30"
          )}
          onDragOver={onRootDragOver}
          onDragLeave={() => setRootOver(false)}
          onDrop={onRootDrop}
          onContextMenu={onEmptyContextMenu}
        >
          {rootGroups.length === 0 && rootNodes.length === 0 ? (
            <p
              className="px-3 py-6 text-center text-xs text-muted-foreground/70"
              onContextMenu={onEmptyContextMenu}
            >
              No layers yet. Drop a block on the canvas.
            </p>
          ) : (
            <ul className="flex flex-col">
              {rootGroups.map((g) => (
                <GroupRow key={g.id} group={g} depth={0} />
              ))}
              {rootNodes.map((n) => (
                <NodeRow key={n.id} node={n} depth={0} />
              ))}
            </ul>
          )}
        </div>
        {ctx && (
          <div
            className="fixed z-50 min-w-[160px] rounded-md border border-border bg-card py-1 shadow-lg"
            style={{ left: ctx.x, top: ctx.y }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {ctx.items.map((it, i) => {
              const Ic = it.icon;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    it.onSelect();
                    setCtx(null);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-accent",
                    it.danger && "text-destructive hover:text-destructive"
                  )}
                >
                  {Ic && <Ic className="h-3.5 w-3.5 shrink-0" />}
                  <span className="flex-1">{it.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </CtxMenuContext.Provider>
  );
}

const GroupRow = memo(function GroupRow({
  group,
  depth,
}: {
  group: Group;
  depth: number;
}) {
  const children = useFlowStore(
    useShallow((s) => s.groups.filter((g) => g.parentGroupId === group.id))
  );
  const childNodes = useFlowStore(
    useShallow((s) => s.nodes.filter((n) => n.data.groupId === group.id))
  );
  const groupEffect = useFlowStore(
    useShallow((s) => {
      const targets = new Set<string>([group.id]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const g of s.groups) {
          if (g.parentGroupId && targets.has(g.parentGroupId) && !targets.has(g.id)) {
            targets.add(g.id);
            changed = true;
          }
        }
      }
      let any = false;
      let anyVisible = false;
      let anyUnlocked = false;
      for (const n of s.nodes) {
        const gid = n.data.groupId ?? null;
        if (gid === null || !targets.has(gid)) continue;
        any = true;
        if (!n.hidden) anyVisible = true;
        if (!(n.draggable === false && n.selectable === false)) anyUnlocked = true;
      }
      return { any, anyVisible, anyUnlocked };
    })
  );
  const toggleGroupCollapsed = useFlowStore((s) => s.toggleGroupCollapsed);
  const toggleGroupHidden = useFlowStore((s) => s.toggleGroupHidden);
  const toggleGroupLocked = useFlowStore((s) => s.toggleGroupLocked);
  const renameGroup = useFlowStore((s) => s.renameGroup);
  const deleteGroup = useFlowStore((s) => s.deleteGroup);
  const moveNodeBefore = useFlowStore((s) => s.moveNodeBefore);
  const moveGroupBefore = useFlowStore((s) => s.moveGroupBefore);
  const [editing, setEditing] = useState(false);
  const collapsed = !!group.collapsed;
  const Caret = collapsed ? ChevronRight : ChevronDown;
  const FolderIc = collapsed ? Folder : FolderOpen;

  const onDragStartRow = (e: DragEvent) => {
    const payload: DragPayload = { kind: "group", id: group.id };
    e.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "move";
  };

  const onDropRow = (zone: DropZone, e: DragEvent) => {
    const p = readPayload(e);
    if (!p) return;
    e.preventDefault();
    e.stopPropagation();
    if (zone === "into") {
      if (p.kind === "node") moveNodeBefore(p.id, null, group.id);
      else moveGroupBefore(p.id, null, group.id);
    } else {
      const state = useFlowStore.getState();
      const before =
        zone === "before"
          ? group.id
          : nextSiblingGroupId(state.groups, group);
      if (p.kind === "group") {
        moveGroupBefore(p.id, before, group.parentGroupId);
      } else {
        const nodesAtLevel = state.nodes.filter(
          (n) => (n.data.groupId ?? null) === group.parentGroupId
        );
        const firstNodeId = nodesAtLevel[0]?.id ?? null;
        moveNodeBefore(p.id, firstNodeId, group.parentGroupId);
      }
    }
  };

  const { open: openCtx } = useCtxMenu();
  const onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openCtx(e.clientX, e.clientY, [
      {
        label: "Rename",
        icon: Pencil,
        onSelect: () => setEditing(true),
      },
      {
        label: groupEffect.anyVisible ? "Hide" : "Show",
        icon: groupEffect.anyVisible ? Eye : EyeOff,
        onSelect: () => toggleGroupHidden(group.id),
      },
      {
        label: groupEffect.anyUnlocked ? "Lock" : "Unlock",
        icon: groupEffect.anyUnlocked ? LockOpen : Lock,
        onSelect: () => toggleGroupLocked(group.id),
      },
      {
        label: "Delete",
        icon: Trash2,
        danger: true,
        onSelect: () => deleteGroup(group.id),
      },
    ]);
  };

  return (
    <li>
      <Row
        depth={depth}
        draggable={!editing}
        onDragStart={onDragStartRow}
        onDrop={onDropRow}
        canAcceptInto
        onClick={() => !editing && toggleGroupCollapsed(group.id)}
        onContextMenu={onContextMenu}
        editing={editing}
        leading={
          <>
            <Caret className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <FolderIc className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </>
        }
        name={group.name}
        onRename={(name) => renameGroup(group.id, name)}
        onEditingChange={setEditing}
        trailing={
          <>
            {groupEffect.any && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleGroupHidden(group.id);
                }}
                className={cn(
                  "transition-opacity hover:text-foreground",
                  groupEffect.anyVisible
                    ? "opacity-0 group-hover:opacity-100"
                    : "opacity-100"
                )}
                title={groupEffect.anyVisible ? "Hide" : "Show"}
                aria-label={groupEffect.anyVisible ? "Hide group" : "Show group"}
              >
                {groupEffect.anyVisible ? (
                  <Eye className="h-3 w-3" />
                ) : (
                  <EyeOff className="h-3 w-3" />
                )}
              </button>
            )}
            {groupEffect.any && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleGroupLocked(group.id);
                }}
                className={cn(
                  "transition-opacity hover:text-foreground",
                  groupEffect.anyUnlocked
                    ? "opacity-0 group-hover:opacity-100"
                    : "opacity-100"
                )}
                title={groupEffect.anyUnlocked ? "Lock" : "Unlock"}
                aria-label={groupEffect.anyUnlocked ? "Lock group" : "Unlock group"}
              >
                {groupEffect.anyUnlocked ? (
                  <LockOpen className="h-3 w-3" />
                ) : (
                  <Lock className="h-3 w-3" />
                )}
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditing(true);
              }}
              className="opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
              title="Rename"
              aria-label="Rename group"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteGroup(group.id);
              }}
              className="opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
              title="Delete group (keeps nodes)"
              aria-label="Delete group"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </>
        }
      />
      {!collapsed && (children.length > 0 || childNodes.length > 0) && (
        <ul className="flex flex-col">
          {children.map((g) => (
            <GroupRow key={g.id} group={g} depth={depth + 1} />
          ))}
          {childNodes.map((n) => (
            <NodeRow key={n.id} node={n} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
});

function nextSiblingGroupId(groups: Group[], current: Group): string | null {
  const siblings = groups.filter(
    (g) => g.parentGroupId === current.parentGroupId
  );
  const idx = siblings.findIndex((g) => g.id === current.id);
  return siblings[idx + 1]?.id ?? null;
}

const NodeRow = memo(function NodeRow({
  node,
  depth,
}: {
  node: AppNode;
  depth: number;
}) {
  const selectNodes = useFlowStore((s) => s.selectNodes);
  const toggleNodeSelection = useFlowStore((s) => s.toggleNodeSelection);
  const toggleNodeHidden = useFlowStore((s) => s.toggleNodeHidden);
  const toggleNodeLocked = useFlowStore((s) => s.toggleNodeLocked);
  const renameNode = useFlowStore((s) => s.renameNode);
  const deleteNode = useFlowStore((s) => s.deleteNode);
  const moveNodeBefore = useFlowStore((s) => s.moveNodeBefore);
  const customBlocks = useFlowStore((s) => s.customBlocks);
  const Icon = nodeIcon(node, customBlocks);
  const name = getNodeDisplayName(node);
  const selected = !!node.selected;
  const hidden = !!node.hidden;
  const locked = node.draggable === false && node.selectable === false;
  const [editing, setEditing] = useState(false);
  const canRename = node.type !== "line";

  const onDragStartRow = (e: DragEvent) => {
    const payload: DragPayload = { kind: "node", id: node.id };
    e.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "move";
  };

  const onDropRow = (zone: DropZone, e: DragEvent) => {
    const p = readPayload(e);
    if (!p || p.kind !== "node") return;
    e.preventDefault();
    e.stopPropagation();
    const targetGroupId = node.data.groupId ?? null;
    if (zone === "before") {
      moveNodeBefore(p.id, node.id, targetGroupId);
    } else {
      const siblings = useFlowStore
        .getState()
        .nodes.filter((n) => (n.data.groupId ?? null) === targetGroupId);
      const idx = siblings.findIndex((n) => n.id === node.id);
      const next = siblings[idx + 1]?.id ?? null;
      moveNodeBefore(p.id, next, targetGroupId);
    }
  };

  const { open: openCtx } = useCtxMenu();
  const onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const items: CtxItem[] = [];
    if (canRename) {
      items.push({
        label: "Rename",
        icon: Pencil,
        onSelect: () => setEditing(true),
      });
    }
    items.push({
      label: hidden ? "Show" : "Hide",
      icon: hidden ? EyeOff : Eye,
      onSelect: () => toggleNodeHidden(node.id),
    });
    items.push({
      label: locked ? "Unlock" : "Lock",
      icon: locked ? LockOpen : Lock,
      onSelect: () => toggleNodeLocked(node.id),
    });
    items.push({
      label: "Delete",
      icon: Trash2,
      danger: true,
      onSelect: () => deleteNode(node.id),
    });
    openCtx(e.clientX, e.clientY, items);
  };

  return (
    <li>
      <Row
        depth={depth}
        selected={selected}
        dimmed={hidden}
        draggable={!editing}
        onDragStart={onDragStartRow}
        onDrop={onDropRow}
        onClick={(e) => {
          if (editing) return;
          if (e.shiftKey) toggleNodeSelection(node.id);
          else selectNodes([node.id]);
        }}
        onContextMenu={onContextMenu}
        editing={editing}
        leading={
          <>
            <span className="w-3.5 shrink-0" />
            <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </>
        }
        name={name}
        onRename={(v) => renameNode(node.id, v)}
        onEditingChange={setEditing}
        trailing={
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleNodeHidden(node.id);
              }}
              className={cn(
                "transition-opacity hover:text-foreground",
                hidden ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              )}
              title={hidden ? "Show" : "Hide"}
              aria-label={hidden ? "Show node" : "Hide node"}
            >
              {hidden ? (
                <EyeOff className="h-3 w-3" />
              ) : (
                <Eye className="h-3 w-3" />
              )}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleNodeLocked(node.id);
              }}
              className={cn(
                "transition-opacity hover:text-foreground",
                locked ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              )}
              title={locked ? "Unlock" : "Lock"}
              aria-label={locked ? "Unlock node" : "Lock node"}
            >
              {locked ? (
                <Lock className="h-3 w-3" />
              ) : (
                <LockOpen className="h-3 w-3" />
              )}
            </button>
            {canRename && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditing(true);
                }}
                className="opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                title="Rename"
                aria-label="Rename node"
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteNode(node.id);
              }}
              className="opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
              title="Delete node"
              aria-label="Delete node"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </>
        }
      />
    </li>
  );
});

function Row({
  depth,
  selected,
  dimmed,
  draggable,
  onDragStart,
  onDrop,
  canAcceptInto,
  onClick,
  onContextMenu,
  editing,
  onEditingChange,
  leading,
  name,
  onRename,
  trailing,
}: {
  depth: number;
  selected?: boolean;
  dimmed?: boolean;
  draggable: boolean;
  onDragStart: (e: DragEvent) => void;
  onDrop: (zone: DropZone, e: DragEvent) => void;
  canAcceptInto?: boolean;
  onClick: (e: MouseEvent) => void;
  onContextMenu?: (e: MouseEvent) => void;
  editing: boolean;
  onEditingChange: (v: boolean) => void;
  leading: ReactNode;
  name: string;
  onRename: (v: string) => void;
  trailing?: ReactNode;
}) {
  const [draft, setDraft] = useState(name);
  const [zone, setZone] = useState<DropZone | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editing) setDraft(name);
  }, [name, editing]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = () => {
    const v = draft.trim();
    if (v && v !== name) onRename(v);
    onEditingChange(false);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setDraft(name);
      onEditingChange(false);
    }
  };

  const computeZone = useCallback(
    (e: DragEvent): DropZone => {
      const el = rowRef.current;
      if (!el) return "after";
      const r = el.getBoundingClientRect();
      const y = e.clientY - r.top;
      const h = r.height;
      if (canAcceptInto) {
        if (y < h * 0.25) return "before";
        if (y > h * 0.75) return "after";
        return "into";
      }
      return y < h * 0.5 ? "before" : "after";
    },
    [canAcceptInto]
  );

  const onDragOver = (e: DragEvent) => {
    if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setZone(computeZone(e));
  };

  const onDropRow = (e: DragEvent) => {
    const z = computeZone(e);
    setZone(null);
    onDrop(z, e);
  };

  return (
    <div
      ref={rowRef}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={() => setZone(null)}
      onDrop={onDropRow}
      className={cn(
        "group relative flex h-7 cursor-pointer items-center gap-1.5 rounded px-1.5 text-xs transition-colors",
        selected
          ? "bg-accent text-accent-foreground"
          : "text-foreground hover:bg-accent/50",
        dimmed && "opacity-50",
        zone === "into" && "bg-primary/20 ring-1 ring-primary/60"
      )}
      style={{ paddingLeft: 6 + depth * 14 }}
      onClick={editing ? undefined : onClick}
      onContextMenu={onContextMenu}
    >
      {zone === "before" && (
        <span className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-primary" />
      )}
      {zone === "after" && (
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-primary" />
      )}
      {leading}
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={onKey}
          onClick={(e) => e.stopPropagation()}
          className="min-w-0 flex-1 rounded border border-input bg-background px-1 py-0.5 text-xs outline-none focus:ring-1 focus:ring-ring"
        />
      ) : (
        <span
          className="min-w-0 flex-1 truncate"
          onDoubleClick={(e) => {
            if (!canAcceptInto) {
              e.stopPropagation();
              onEditingChange(true);
            }
          }}
        >
          {name}
        </span>
      )}
      {trailing ? (
        <div className="flex shrink-0 items-center gap-1 text-muted-foreground">
          {trailing}
        </div>
      ) : null}
    </div>
  );
}
