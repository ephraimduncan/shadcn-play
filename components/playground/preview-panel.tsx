"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  IconDeviceDesktop,
  IconDeviceTablet,
  IconDeviceMobile,
  IconReload,
  IconTerminal2,
  IconRuler,
  IconAlertTriangle,
} from "@tabler/icons-react";
import {
  PreviewIframe,
  type PreviewStatus,
  type ConsoleEntry,
} from "./preview-iframe";
import { ConsolePanel } from "./console-panel";
import type {
  TranspileResult,
  TranspileError,
} from "@/lib/playground/transpile";
import { cn } from "@/lib/utils";

type Viewport = "desktop" | "tablet" | "mobile" | "custom";

type ViewportConfig = {
  width?: number;
  height?: number;
  showBoundary: boolean;
  contentPadding: string;
};

const statusLabels: Record<PreviewStatus, string> = {
  idle: "Idle",
  compiling: "Compiling…",
  ready: "Ready",
  error: "Error",
};

interface PreviewPanelProps {
  compilationResult: TranspileResult | null;
  tailwindCSS: string | null;
  transpileError?: TranspileError | null;
  theme: string;
  runtimeError: string;
  onRuntimeError: (message: string) => void;
  consoleLogs: ConsoleEntry[];
  onClearConsole: () => void;
  onConsoleMessage: (entry: ConsoleEntry) => void;
  consoleOpen: boolean;
  onConsoleOpenChange: (open: boolean) => void;
  registerReloadTrigger?: (trigger: (() => void) | null) => void;
}

export function PreviewPanel({
  compilationResult,
  tailwindCSS,
  transpileError,
  theme,
  runtimeError,
  onRuntimeError,
  consoleLogs,
  onClearConsole,
  onConsoleMessage,
  consoleOpen,
  onConsoleOpenChange,
  registerReloadTrigger,
}: PreviewPanelProps) {
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [customSize, setCustomSize] = useState({ width: 1024, height: 768 });
  const [refreshKey, setRefreshKey] = useState(0);
  const [status, setStatus] = useState<PreviewStatus>("idle");
  const [availableSize, setAvailableSize] = useState({ width: 0, height: 0 });
  const [lastSeenCount, setLastSeenCount] = useState(0);

  const handleConsoleToggle = useCallback(
    (next: boolean) => {
      setLastSeenCount(consoleLogs.length);
      onConsoleOpenChange(next);
    },
    [consoleLogs.length, onConsoleOpenChange],
  );

  const unreadCount = consoleOpen
    ? 0
    : Math.max(consoleLogs.length - lastSeenCount, 0);
  const hasUnreadErrors =
    !consoleOpen &&
    consoleLogs.slice(lastSeenCount).some((e) => e.method === "error");

  const handleStatusChange = useCallback(
    (nextStatus: PreviewStatus) => {
      setStatus(nextStatus);
      if (nextStatus === "compiling") onClearConsole();
    },
    [onClearConsole],
  );

  const viewportConfigs: Record<Viewport, ViewportConfig> = useMemo(
    () => ({
      desktop: {
        showBoundary: false,
        contentPadding: "0px",
      },
      tablet: {
        width: 834,
        height: 1194,
        showBoundary: true,
        contentPadding: "32px",
      },
      mobile: {
        width: 390,
        height: 844,
        showBoundary: true,
        contentPadding: "16px",
      },
      custom: {
        width: customSize.width,
        height: customSize.height,
        showBoundary: true,
        contentPadding: "16px",
      },
    }),
    [customSize.width, customSize.height],
  );

  const activeViewportConfig = viewportConfigs[viewport];
  const shouldScaleToFit = viewport === "tablet" || viewport === "custom";
  const viewportContainerRef = useRef<HTMLDivElement | null>(null);

  const handleRefresh = useCallback(() => {
    onRuntimeError("");
    onClearConsole();
    setStatus("idle");
    setRefreshKey((k) => k + 1);
  }, [onRuntimeError, onClearConsole]);

  useEffect(() => {
    registerReloadTrigger?.(handleRefresh);
    return () => registerReloadTrigger?.(null);
  }, [handleRefresh, registerReloadTrigger]);

  const displayError = runtimeError || transpileError?.message || "";
  const errorType = transpileError ? "Transpile error" : "Runtime error";

  useEffect(() => {
    const container = viewportContainerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;

    const resizeObserver = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setAvailableSize({ width, height });
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const frameScale = useMemo(() => {
    if (!shouldScaleToFit) return 1;
    if (!activeViewportConfig.width || !activeViewportConfig.height) return 1;
    if (!availableSize.width || !availableSize.height) return 1;

    const edgeAllowance = 8;
    const availableWidth = Math.max(availableSize.width - edgeAllowance, 0);
    const availableHeight = Math.max(availableSize.height - edgeAllowance, 0);

    return Math.min(
      availableWidth / activeViewportConfig.width,
      availableHeight / activeViewportConfig.height,
      1,
    );
  }, [
    shouldScaleToFit,
    activeViewportConfig.width,
    activeViewportConfig.height,
    availableSize,
  ]);

  const statusLabel = statusLabels[status];
  const statusDotClass =
    status === "ready"
      ? "bg-success"
      : status === "error"
        ? "bg-destructive"
        : status === "compiling"
          ? "bg-warning animate-pulse"
          : "bg-muted-foreground/40";

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            Preview
          </span>
          <span
            role="status"
            aria-live="polite"
            className="flex items-center gap-1.5"
          >
            <span
              className={cn("size-1.5 rounded-full", statusDotClass)}
              aria-hidden="true"
            />
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {statusLabel}
            </span>
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={consoleOpen ? "secondary" : "ghost"}
                size="icon-sm"
                aria-label="Toggle console"
                onClick={() => handleConsoleToggle(!consoleOpen)}
                className="relative"
              >
                <IconTerminal2 className="size-3.5" />
                {unreadCount > 0 && (
                  <span
                    aria-label={`${unreadCount} new`}
                    className={cn(
                      "absolute -top-0.5 -right-0.5 size-1.5 rounded-full",
                      hasUnreadErrors ? "bg-destructive" : "bg-primary",
                    )}
                  />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Console</TooltipContent>
          </Tooltip>

          <ToggleGroup
            type="single"
            variant="outline"
            value={viewport === "custom" ? "" : viewport}
            onValueChange={(value) => {
              if (value) setViewport(value as Viewport);
            }}
            size="sm"
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <ToggleGroupItem value="desktop" aria-label="Desktop">
                  <IconDeviceDesktop className="size-3.5" />
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent>Desktop · responsive</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <ToggleGroupItem value="tablet" aria-label="Tablet">
                  <IconDeviceTablet className="size-3.5" />
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent>Tablet · 834 × 1194</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <ToggleGroupItem value="mobile" aria-label="Mobile">
                  <IconDeviceMobile className="size-3.5" />
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent>Mobile · 390 × 844</TooltipContent>
            </Tooltip>
          </ToggleGroup>

          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    variant={viewport === "custom" ? "secondary" : "ghost"}
                    size="icon-sm"
                    aria-label="Custom viewport size"
                  >
                    <IconRuler className="size-3.5" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>
                Custom ·{" "}
                <span className="tabular-nums">
                  {customSize.width} × {customSize.height}
                </span>
              </TooltipContent>
            </Tooltip>
            <PopoverContent align="end" className="w-56 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-1">
                  <Label htmlFor="vp-w" className="text-xs">
                    Width
                  </Label>
                  <Input
                    id="vp-w"
                    type="number"
                    min={200}
                    max={4000}
                    value={customSize.width}
                    onChange={(e) =>
                      setCustomSize((s) => ({
                        ...s,
                        width: Number(e.target.value) || s.width,
                      }))
                    }
                    className="h-8 tabular-nums"
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="vp-h" className="text-xs">
                    Height
                  </Label>
                  <Input
                    id="vp-h"
                    type="number"
                    min={200}
                    max={4000}
                    value={customSize.height}
                    onChange={(e) =>
                      setCustomSize((s) => ({
                        ...s,
                        height: Number(e.target.value) || s.height,
                      }))
                    }
                    className="h-8 tabular-nums"
                  />
                </div>
              </div>
              <Button
                size="sm"
                className="w-full"
                onClick={() => setViewport("custom")}
              >
                Apply
              </Button>
            </PopoverContent>
          </Popover>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Reload preview"
                onClick={handleRefresh}
              >
                <IconReload className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reload</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 min-h-0 overflow-hidden">
          <div
            ref={viewportContainerRef}
            className={cn(
              "flex h-full w-full justify-center",
              viewport === "mobile"
                ? "items-start overflow-auto p-4"
                : "items-center overflow-hidden",
              activeViewportConfig.showBoundary &&
                viewport !== "mobile" &&
                "p-4",
            )}
          >
            <div
              className="origin-center transition-[width,height,transform] duration-150"
              style={{
                width: activeViewportConfig.width
                  ? `${activeViewportConfig.width}px`
                  : "100%",
                height: activeViewportConfig.height
                  ? `${activeViewportConfig.height}px`
                  : "100%",
                transform: shouldScaleToFit
                  ? `scale(${frameScale})`
                  : undefined,
              }}
            >
              <div
                className={cn(
                  "relative flex h-full items-center justify-center overflow-hidden",
                  activeViewportConfig.showBoundary &&
                    "rounded-xl border border-border bg-background shadow-sm",
                )}
                style={{
                  padding: activeViewportConfig.showBoundary
                    ? undefined
                    : activeViewportConfig.contentPadding,
                }}
              >
                <PreviewIframe
                  key={refreshKey}
                  viewport={viewport === "custom" ? "desktop" : viewport}
                  compilationResult={compilationResult}
                  tailwindCSS={tailwindCSS}
                  theme={theme}
                  onRuntimeError={onRuntimeError}
                  onStatusChange={handleStatusChange}
                  onConsoleMessage={onConsoleMessage}
                />
                {displayError && (
                  <div
                    role="alert"
                    className="absolute inset-x-0 bottom-0 z-10 max-h-[40%] overflow-auto bg-background/95 backdrop-blur-sm border-t border-border"
                  >
                    <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-border">
                      <span className="flex items-center gap-1.5 text-xs font-medium text-destructive">
                        <IconAlertTriangle className="size-3.5" />
                        {errorType}
                      </span>
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={handleRefresh}
                      >
                        <IconReload className="size-3" />
                        Reload
                      </Button>
                    </div>
                    <pre className="px-3 py-2 text-xs text-destructive whitespace-pre-wrap wrap-break-word font-mono leading-relaxed">
                      {displayError}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {consoleOpen && (
          <div className="h-50 shrink-0 border-t border-border">
            <ConsolePanel logs={consoleLogs} onClear={onClearConsole} />
          </div>
        )}
      </div>
    </div>
  );
}
