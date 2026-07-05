"use client";

import React from "react";
import { Accordion as AccordionPrimitive } from "radix-ui";
import { ChevronRight, Folder, FolderOpen, File } from "lucide-react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const treeVariants = cva(
  // Temakompatibel, minimalistisk hover-highlight (kompakt)
  "group hover:before:opacity-100 before:absolute before:rounded-lg before:left-0 px-1.5 before:w-full before:opacity-0 before:bg-accent/20 before:h-[1.75rem] before:-z-10 focus-visible:outline-[--focus-ring-width] focus-visible:outline-[--focus-ring-color] focus-visible:outline-offset-[--focus-ring-offset] rounded-md",
);

const selectedTreeVariants = cva(
  // Minimal markering: kun venstre border + litt mer vekt
  "text-foreground border-l-2 border-primary/50 font-medium",
);

const dragOverVariants = cva(
  "before:opacity-100 before:bg-primary/20 text-foreground",
);

interface TreeDataItem {
  id: string;
  name: string;
  icon?: React.ComponentType<{ className?: string }>;
  selectedIcon?: React.ComponentType<{ className?: string }>;
  openIcon?: React.ComponentType<{ className?: string }>;
  children?: TreeDataItem[];
  actions?: React.ReactNode;
  rightAdornment?: React.ReactNode; // always-visible, e.g. counters
  onClick?: () => void;
  draggable?: boolean;
  droppable?: boolean;
  disabled?: boolean;
}

type TreeProps = React.ComponentProps<"div"> & {
  data: TreeDataItem[] | TreeDataItem;
  initialSelectedItemId?: string;
  onSelectChange?: (item: TreeDataItem | undefined) => void;
  expandAll?: boolean;
  defaultNodeIcon?: React.ComponentType<{ className?: string }>;
  defaultLeafIcon?: React.ComponentType<{ className?: string }>;
  onDocumentDrag?: (sourceItem: TreeDataItem, targetItem: TreeDataItem) => void;
  onExternalDrop?: (externalId: string, targetItem: TreeDataItem) => void;
};

function TreeView({
  ref,
  data,
  initialSelectedItemId,
  onSelectChange,
  expandAll,
  defaultLeafIcon,
  defaultNodeIcon,
  className,
  onDocumentDrag,
  onExternalDrop,
  ...props
}: TreeProps) {
    const [selectedItemId, setSelectedItemId] = React.useState<
      string | undefined
    >(initialSelectedItemId);

    const [draggedItem, setDraggedItem] = React.useState<TreeDataItem | null>(
      null,
    );

    const handleSelectChange = React.useCallback(
      (item: TreeDataItem | undefined) => {
        setSelectedItemId(item?.id);
        if (onSelectChange) {
          onSelectChange(item);
        }
      },
      [onSelectChange],
    );

    const handleDragStart = React.useCallback((item: TreeDataItem) => {
      setDraggedItem(item);
    }, []);

    const handleDrop = React.useCallback(
      (targetItem: TreeDataItem) => {
        if (draggedItem && onDocumentDrag && draggedItem.id !== targetItem.id) {
          onDocumentDrag(draggedItem, targetItem);
        }
        setDraggedItem(null);
      },
      [draggedItem, onDocumentDrag],
    );

    const expandedItemIds = React.useMemo(() => {
      if (!initialSelectedItemId) {
        return [] as string[];
      }

      const ids: string[] = [];

      function walkTreeItems(
        items: TreeDataItem[] | TreeDataItem,
        targetId: string,
      ) {
        if (items instanceof Array) {
          for (let i = 0; i < items.length; i++) {
            ids.push(items[i]!.id);
            if (walkTreeItems(items[i]!, targetId) && !expandAll) {
              return true;
            }
            if (!expandAll) ids.pop();
          }
        } else if (!expandAll && items.id === targetId) {
          return true;
        } else if (items.children) {
          return walkTreeItems(items.children, targetId);
        }
      }

      walkTreeItems(data, initialSelectedItemId);
      return ids;
    }, [data, expandAll, initialSelectedItemId]);

    return (
      <div className={cn("overflow-hidden relative p-1.5 md:p-2", className)}>
        <TreeItem
          data={data}
          ref={ref}
          selectedItemId={selectedItemId}
          handleSelectChange={handleSelectChange}
          expandedItemIds={expandedItemIds}
          defaultLeafIcon={defaultLeafIcon}
          defaultNodeIcon={defaultNodeIcon}
          handleDragStart={handleDragStart}
          handleDrop={handleDrop}
          draggedItem={draggedItem}
          onExternalDrop={onExternalDrop}
          {...props}
        />
        <div className="w-full h-[48px]"></div>
      </div>
    );
}

type TreeItemProps = TreeProps & {
  selectedItemId?: string;
  handleSelectChange: (item: TreeDataItem | undefined) => void;
  expandedItemIds: string[];
  defaultNodeIcon?: React.ComponentType<{ className?: string }>;
  defaultLeafIcon?: React.ComponentType<{ className?: string }>;
  handleDragStart?: (item: TreeDataItem) => void;
  handleDrop?: (item: TreeDataItem) => void;
  draggedItem: TreeDataItem | null;
  onExternalDrop?: (externalId: string, targetItem: TreeDataItem) => void;
};

function TreeItem({
  ref,
  className,
  data,
  selectedItemId,
  handleSelectChange,
  expandedItemIds,
  defaultNodeIcon,
  defaultLeafIcon,
  handleDragStart,
  handleDrop,
  draggedItem,
  onExternalDrop,
  ...props
}: TreeItemProps) {
    const treeData: TreeDataItem[] = data instanceof Array ? data : [data];
    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      // Basic ARIA-friendly keyboard interaction
      const key = e.key;
      if (!selectedItemId) return;
      const flat: TreeDataItem[] = [];
      const walk = (items: TreeDataItem[] | TreeDataItem) => {
        if (items instanceof Array) items.forEach(walk);
        else {
          flat.push(items);
          if (items.children) walk(items.children);
        }
      };
      walk(treeData);
      const idx = flat.findIndex((i) => i.id === selectedItemId);
      if (idx === -1) return;
      if (key === "ArrowDown" && idx < flat.length - 1) {
        handleSelectChange(flat[idx + 1]);
        e.preventDefault();
      } else if (key === "ArrowUp" && idx > 0) {
        handleSelectChange(flat[idx - 1]);
        e.preventDefault();
      }
    };

    return (
      <div
        ref={ref}
        role="tree"
        tabIndex={0}
        aria-label="Mappetree"
        onKeyDown={handleKeyDown}
        className={className}
        {...props}
      >
        <ul className="space-y-0.5">
          {treeData.map((item) => (
            <li key={item.id}>
              {item.children ? (
                <TreeNode
                  item={item}
                  selectedItemId={selectedItemId}
                  expandedItemIds={expandedItemIds}
                  handleSelectChange={handleSelectChange}
                  defaultNodeIcon={defaultNodeIcon}
                  defaultLeafIcon={defaultLeafIcon}
                  handleDragStart={handleDragStart}
                  handleDrop={handleDrop}
                  draggedItem={draggedItem}
                  onExternalDrop={onExternalDrop}
                />
              ) : (
                <TreeLeaf
                  item={item}
                  selectedItemId={selectedItemId}
                  handleSelectChange={handleSelectChange}
                  defaultLeafIcon={defaultLeafIcon}
                  handleDragStart={handleDragStart}
                  handleDrop={handleDrop}
                  draggedItem={draggedItem}
                  onExternalDrop={onExternalDrop}
                />
              )}
            </li>
          ))}
        </ul>
      </div>
    );
}

const TreeNode = ({
  item,
  handleSelectChange,
  expandedItemIds,
  selectedItemId,
  defaultNodeIcon,
  defaultLeafIcon,
  handleDragStart,
  handleDrop,
  draggedItem,
  onExternalDrop,
}: {
  item: TreeDataItem;
  handleSelectChange: (item: TreeDataItem | undefined) => void;
  expandedItemIds: string[];
  selectedItemId?: string;
  defaultNodeIcon?: React.ComponentType<{ className?: string }>;
  defaultLeafIcon?: React.ComponentType<{ className?: string }>;
  handleDragStart?: (item: TreeDataItem) => void;
  handleDrop?: (item: TreeDataItem) => void;
  draggedItem: TreeDataItem | null;
  onExternalDrop?: (externalId: string, targetItem: TreeDataItem) => void;
}) => {
  const [value, setValue] = React.useState(
    expandedItemIds.includes(item.id) ? [item.id] : [],
  );
  const [isDragOver, setIsDragOver] = React.useState(false);

  const onDragStart = (e: React.DragEvent) => {
    if (!item.draggable) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData("text/plain", item.id);
    handleDragStart?.(item);
  };

  const onDragOver = (e: React.DragEvent) => {
    if (item.droppable !== false && draggedItem && draggedItem.id !== item.id) {
      e.preventDefault();
      setIsDragOver(true);
    }
  };

  const onDragLeave = () => {
    setIsDragOver(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const externalId = e.dataTransfer.getData("text/plain");
    if (externalId && (!draggedItem || externalId !== draggedItem.id)) {
      onExternalDrop?.(externalId, item);
      return;
    }
    handleDrop?.(item);
  };

  return (
    <AccordionPrimitive.Root
      type="multiple"
      value={value}
      onValueChange={(s) => setValue(s)}
    >
      <AccordionPrimitive.Item value={item.id}>
        <AccordionTrigger
          className={cn(
            treeVariants(),
            selectedItemId === item.id && selectedTreeVariants(),
            isDragOver && dragOverVariants(),
          )}
          role="treeitem"
          aria-selected={selectedItemId === item.id}
          onClick={() => {
            handleSelectChange(item);
            item.onClick?.();
          }}
          draggable={!!item.draggable}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <TreeIcon
            item={item}
            isSelected={selectedItemId === item.id}
            isOpen={value.includes(item.id)}
            default={defaultNodeIcon || Folder}
            defaultOpen={FolderOpen}
          />
          <span className="text-[13px] truncate" title={item.name}>
            {item.name}
          </span>
          {item.rightAdornment ? (
            <span className="ml-auto mr-6">{item.rightAdornment}</span>
          ) : null}
          <TreeActions isSelected={selectedItemId === item.id}>
            {item.actions}
          </TreeActions>
        </AccordionTrigger>
        <AccordionContent className="ml-3 pl-2 border-l border-border/50">
          <TreeItem
            data={item.children ? item.children : item}
            selectedItemId={selectedItemId}
            handleSelectChange={handleSelectChange}
            expandedItemIds={expandedItemIds}
            defaultLeafIcon={defaultLeafIcon}
            defaultNodeIcon={defaultNodeIcon}
            handleDragStart={handleDragStart}
            handleDrop={handleDrop}
            draggedItem={draggedItem}
            onExternalDrop={onExternalDrop}
          />
        </AccordionContent>
      </AccordionPrimitive.Item>
    </AccordionPrimitive.Root>
  );
};

type TreeLeafProps = React.ComponentProps<"div"> & {
  item: TreeDataItem;
  selectedItemId?: string;
  handleSelectChange: (item: TreeDataItem | undefined) => void;
  defaultLeafIcon?: React.ComponentType<{ className?: string }>;
  handleDragStart?: (item: TreeDataItem) => void;
  handleDrop?: (item: TreeDataItem) => void;
  draggedItem: TreeDataItem | null;
  onExternalDrop?: (externalId: string, targetItem: TreeDataItem) => void;
};

function TreeLeaf({
  ref,
  className,
  item,
  selectedItemId,
  handleSelectChange,
  defaultLeafIcon,
  handleDragStart,
  handleDrop,
  draggedItem,
  onExternalDrop,
  ...props
}: TreeLeafProps) {
    const [isDragOver, setIsDragOver] = React.useState(false);

    const onDragStart = (e: React.DragEvent) => {
      if (!item.draggable || item.disabled) {
        e.preventDefault();
        return;
      }
      e.dataTransfer.setData("text/plain", item.id);
      handleDragStart?.(item);
    };

    const onDragOver = (e: React.DragEvent) => {
      if (
        item.droppable !== false &&
        !item.disabled &&
        draggedItem &&
        draggedItem.id !== item.id
      ) {
        e.preventDefault();
        setIsDragOver(true);
      }
    };

    const onDragLeave = () => {
      setIsDragOver(false);
    };

    const onDrop = (e: React.DragEvent) => {
      if (item.disabled) return;
      e.preventDefault();
      setIsDragOver(false);
      const externalId = e.dataTransfer.getData("text/plain");
      if (externalId && (!draggedItem || externalId !== draggedItem.id)) {
        onExternalDrop?.(externalId, item);
        return;
      }
      handleDrop?.(item);
    };

    return (
      <div
        ref={ref}
        className={cn(
          "ml-4 flex items-center before:right-1",
          isDragOver && dragOverVariants(),
          item.disabled && "opacity-50 pointer-events-none",
        )}
        draggable={!!item.draggable && !item.disabled}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        {...props}
      >
        <button
          type="button"
          disabled={item.disabled}
          className={cn(
            "flex min-w-0 flex-1 cursor-pointer items-center border-0 bg-transparent py-1.5 text-left sm:py-1",
            treeVariants(),
            className,
            selectedItemId === item.id && selectedTreeVariants(),
            item.disabled && "cursor-not-allowed",
          )}
          onClick={() => {
            if (item.disabled) return;
            handleSelectChange(item);
            item.onClick?.();
          }}
        >
          <TreeIcon
            item={item}
            isSelected={selectedItemId === item.id}
            default={defaultLeafIcon || File}
          />
          <span className="grow truncate text-[13px]" title={item.name}>
            {item.name}
          </span>
        </button>
        {item.rightAdornment ? (
          <span className="ml-2 mr-6">{item.rightAdornment}</span>
        ) : null}
        <TreeActions isSelected={selectedItemId === item.id && !item.disabled}>
          {item.actions}
        </TreeActions>
      </div>
    );
}

function AccordionTrigger({
  className,
  children,
  ref,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Trigger>) {
  return (
    <AccordionPrimitive.Header>
      <AccordionPrimitive.Trigger
        ref={ref}
        className={cn(
          "flex flex-1 w-full items-center py-1.5 sm:py-1 transition-all first:[&[data-state=open]>svg]:first-of-type:rotate-90",
          className,
        )}
        {...props}
      >
        <ChevronRight
          aria-hidden
          strokeWidth={2.5}
          className={cn(
            "size-4 shrink-0 transition-transform duration-200 mr-1 stroke-current text-muted-foreground",
            "group-data-[state=open]:text-foreground",
          )}
        />
        {children}
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

function AccordionContent({
  className,
  children,
  ref,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content
      ref={ref}
      className={cn(
        "overflow-hidden text-sm transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down",
        className,
      )}
      {...props}
    >
      <div className="pb-1 pt-0">{children}</div>
    </AccordionPrimitive.Content>
  );
}

const TreeIcon = ({
  item,
  isOpen,
  isSelected,
  default: defaultIcon,
  defaultOpen,
}: {
  item: TreeDataItem;
  isOpen?: boolean;
  isSelected?: boolean;
  default?: React.ComponentType<{ className?: string }>;
  defaultOpen?: React.ComponentType<{ className?: string }>;
}) => {
  // Prioriter eksplisitte ikoner fra item før default-ikoner
  let Icon: React.ComponentType<{ className?: string }> | undefined;

  if (isSelected && item.selectedIcon) {
    Icon = item.selectedIcon;
  } else if (isOpen && item.openIcon) {
    Icon = item.openIcon;
  } else if (item.icon) {
    Icon = item.icon;
  } else if (isOpen && defaultOpen) {
    Icon = defaultOpen;
  } else if (defaultIcon) {
    Icon = defaultIcon;
  }

  return Icon ? <Icon className="size-4 shrink-0 mr-2" /> : <></>;
};

const TreeActions = ({
  children,
  isSelected,
}: {
  children: React.ReactNode;
  isSelected: boolean;
}) => {
  return (
    <div
      className={cn(
        isSelected ? "block" : "hidden",
        "absolute right-3 group-hover:block",
      )}
    >
      {children}
    </div>
  );
};

export { TreeView, type TreeDataItem };
