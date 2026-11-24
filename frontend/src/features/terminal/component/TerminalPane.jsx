import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Button, IconButton, Paper, Stack, Tooltip, Typography } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import { Terminal } from "xterm";
import { FitAddon } from "@xterm/addon-fit";
import "xterm/css/xterm.css";

const MAX_AUTO_RETRIES = 5;

const HIGH_CONTRAST_DARK_THEME = {
    background: "#0B0F17",
    foreground: "#F1F5F9",
    cursor: "#4C9AFF",
    cursorAccent: "#0B0F17",
    selectionBackground: "rgba(76, 154, 255, 0.28)",
    black: "#1E293B",
    red: "#FF5630",
    green: "#36B37E",
    yellow: "#FFAB00",
    blue: "#4C9AFF",
    magenta: "#C084FC",
    cyan: "#22D3EE",
    white: "#E2E8F0",
    brightBlack: "#64748B",
    brightRed: "#FCA5A5",
    brightGreen: "#6EE7B7",
    brightYellow: "#FDE68A",
    brightBlue: "#93C5FD",
    brightMagenta: "#D8B4FE",
    brightCyan: "#67E8F9",
    brightWhite: "#FFFFFF",
};

const buildWsUrl = (machineId) => {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}/ws/machines/${encodeURIComponent(String(machineId))}/terminal`;
};

const formatDelayLabel = (ms) => {
    const n = Math.max(0, Number(ms) || 0);
    if (n < 1000) return `${n}ms`;
    const secs = n / 1000;
    return `${Number.isInteger(secs) ? secs : secs.toFixed(1)}s`;
};

const STATUS_META = {
    CONNECTED: {
        dot: "#36B37E",
        text: "#6EE7B7",
        bg: "rgba(54, 179, 126, 0.14)",
        border: "rgba(54, 179, 126, 0.35)",
        label: "CONNECTED",
    },
    CONNECTING: {
        dot: "#FFAB00",
        text: "#FDE68A",
        bg: "rgba(255, 171, 0, 0.14)",
        border: "rgba(255, 171, 0, 0.35)",
        label: "CONNECTING",
    },
    RECONNECTING: {
        dot: "#FFAB00",
        text: "#FDE68A",
        bg: "rgba(255, 171, 0, 0.14)",
        border: "rgba(255, 171, 0, 0.35)",
        label: "RETRYING",
    },
    DISCONNECTED: {
        dot: "#FF5630",
        text: "#FCA5A5",
        bg: "rgba(255, 86, 48, 0.14)",
        border: "rgba(255, 86, 48, 0.35)",
        label: "DISCONNECTED",
    },
    CLOSED: {
        dot: "#8993A4",
        text: "#CBD5E1",
        bg: "rgba(137, 147, 164, 0.14)",
        border: "rgba(137, 147, 164, 0.35)",
        label: "CLOSED",
    },
};

const dotButtonSx = (color) => ({
    width: 12,
    height: 12,
    borderRadius: "50%",
    bgcolor: color,
    border: "none",
    p: 0,
    cursor: "pointer",
    "&:hover": { filter: "brightness(1.15)" },
});

const TerminalPane = memo(function TerminalPane({
    machine,
    fontSize = 13,
    height = 420,
    connectTimeoutMs = 10000,
    retryDelayMs = 3000,
    hidden = false,
    isMaximized = false,
    isTargetedForBroadcast = false,
    onToggleBroadcastTarget,
    onClosePane,
    onMinimizePane,
    onToggleMaximizePane,
    onOpenMachinePage,
    onRegister,
    onStatusChange,
    onNotify,
}) {
    const machineId = String(machine?.machineId ?? machine?.id ?? "");
    const label = machine?.name || machine?.hostname || machineId;

    const containerRef = useRef(null);
    const termRef = useRef(null);
    const fitRef = useRef(null);
    const socketRef = useRef(null);
    const retryTimerRef = useRef(null);
    const connectTimerRef = useRef(null);
    const attemptRef = useRef(0);
    const closedByUserRef = useRef(false);
    const mountedRef = useRef(false);
    const statusRef = useRef("CONNECTING");
    const connectRef = useRef(() => {});

    const labelRef = useRef(label);
    const fontSizeRef = useRef(fontSize);
    const connectTimeoutRef = useRef(connectTimeoutMs);
    const retryDelayRef = useRef(retryDelayMs);
    const onNotifyRef = useRef(onNotify);
    const onStatusRef = useRef(onStatusChange);
    labelRef.current = label;
    fontSizeRef.current = fontSize;
    connectTimeoutRef.current = connectTimeoutMs;
    retryDelayRef.current = retryDelayMs;
    onNotifyRef.current = onNotify;
    onStatusRef.current = onStatusChange;

    const [status, setStatus] = useState("CONNECTING");

    const updateStatus = useCallback(
        (next) => {
            if (statusRef.current === next) return;
            statusRef.current = next;
            if (!mountedRef.current) return;
            setStatus(next);
            onStatusRef.current?.(machineId, next);
        },
        [machineId]
    );

    const clearRetryTimer = () => {
        if (retryTimerRef.current) {
            clearTimeout(retryTimerRef.current);
            retryTimerRef.current = null;
        }
    };

    const clearConnectTimer = () => {
        if (connectTimerRef.current) {
            clearTimeout(connectTimerRef.current);
            connectTimerRef.current = null;
        }
    };

    const sendInput = useCallback((data) => {
        if (!data) return false;
        const ws = socketRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "INPUT", data }));
            return true;
        }
        return false;
    }, []);

    const sendResize = useCallback(() => {
        const ws = socketRef.current;
        const term = termRef.current;
        const el = containerRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN || !term || !el) return;
        const rect = el.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        ws.send(
            JSON.stringify({
                type: "RESIZE",
                cols: term.cols,
                rows: term.rows,
                width: Math.max(200, Math.round(rect.width)),
                height: Math.max(100, Math.round(rect.height)),
            })
        );
    }, []);

    const fitPane = useCallback(() => {
        const el = containerRef.current;
        if (!fitRef.current || !termRef.current || !el) return;
        const rect = el.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        try {
            fitRef.current.fit();
        } catch {
            // ignore disposed terminal
        }
    }, []);

    const detachSocket = () => {
        clearConnectTimer();
        const ws = socketRef.current;
        socketRef.current = null;
        if (!ws) return;
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        try {
            ws.close();
        } catch {
            // ignore
        }
    };

    const scheduleRetry = () => {
        clearConnectTimer();
        const term = termRef.current;
        const attempt = attemptRef.current;
        if (attempt >= MAX_AUTO_RETRIES) {
            updateStatus("DISCONNECTED");
            term?.write(
                "\r\n\x1b[1;31m[connection lost - auto-retry stopped. Use Reconnect.]\x1b[0m\r\n"
            );
            onNotifyRef.current?.error?.(`Terminal connection lost for ${labelRef.current}.`);
            return;
        }
        attemptRef.current = attempt + 1;
        const delay = Math.max(0, Number(retryDelayRef.current) || 0);
        updateStatus("RECONNECTING");
        term?.write(
            `\r\n\x1b[33m[connection lost - retry ${attempt + 1}/${MAX_AUTO_RETRIES} in ${formatDelayLabel(delay)}]\x1b[0m\r\n`
        );
        clearRetryTimer();
        retryTimerRef.current = setTimeout(() => connectRef.current(true), delay);
    };

    const connect = useCallback(
        (isRetry = false) => {
            const term = termRef.current;
            if (!machineId || !term || !mountedRef.current) return;

            clearRetryTimer();
            detachSocket();
            closedByUserRef.current = false;
            updateStatus(isRetry ? "RECONNECTING" : "CONNECTING");

            let ws;
            try {
                ws = new WebSocket(buildWsUrl(machineId));
            } catch {
                scheduleRetry();
                return;
            }
            socketRef.current = ws;

            if (connectTimeoutRef.current > 0) {
                connectTimerRef.current = setTimeout(() => {
                    if (socketRef.current !== ws || statusRef.current === "CONNECTED") return;
                    detachSocket();
                    updateStatus("DISCONNECTED");
                    term.write(
                        `\r\n\x1b[1;31m[connection timed out after ${formatDelayLabel(connectTimeoutRef.current)}]\x1b[0m\r\n`
                    );
                }, connectTimeoutRef.current);
            }

            ws.onopen = () => {
                if (socketRef.current !== ws) return;
                clearConnectTimer();
                attemptRef.current = 0;
                updateStatus("CONNECTED");
                requestAnimationFrame(() => {
                    fitPane();
                    sendResize();
                });
            };

            ws.onmessage = (event) => {
                if (socketRef.current !== ws || !termRef.current) return;
                try {
                    const msg = JSON.parse(event.data);
                    if (msg.type === "OUTPUT" && typeof msg.data === "string") {
                        termRef.current.write(msg.data);
                    } else if (msg.type === "ERROR") {
                        termRef.current.write(`\r\n\x1b[1;31m[Error]\x1b[0m ${msg.data}\r\n`);
                    }
                } catch {
                    termRef.current.write(String(event.data));
                }
            };

            ws.onerror = () => {};

            ws.onclose = () => {
                if (socketRef.current !== ws) return;
                clearConnectTimer();
                socketRef.current = null;
                if (!mountedRef.current) return;
                if (closedByUserRef.current) {
                    updateStatus("CLOSED");
                    return;
                }
                scheduleRetry();
            };
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [machineId, fitPane, sendResize, updateStatus]
    );
    connectRef.current = connect;

    const handleClose = useCallback(() => {
        closedByUserRef.current = true;
        clearRetryTimer();
        detachSocket();
        updateStatus("CLOSED");
        onClosePane?.(machineId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [machineId, onClosePane, updateStatus]);

    const reconnect = useCallback(() => {
        attemptRef.current = 0;
        termRef.current?.write("\r\n\x1b[36m[reconnecting...]\x1b[0m\r\n");
        connectRef.current(false);
        setTimeout(fitPane, 80);
    }, [fitPane]);

    const clear = useCallback(() => termRef.current?.clear(), []);

    const getText = useCallback(() => {
        const term = termRef.current;
        if (!term) return "";
        const buf = term.buffer.active;
        const lines = [];
        for (let i = 0; i < buf.length; i += 1) {
            const line = buf.getLine(i);
            if (line) lines.push(line.translateToString(true));
        }
        return lines.join("\n").replace(/\s+$/, "");
    }, []);

    const handle = useMemo(
        () => ({
            sendInput,
            focus: () => termRef.current?.focus(),
            fit: fitPane,
            reconnect,
            clear,
            getText,
            isConnected: () => statusRef.current === "CONNECTED",
            getStatus: () => statusRef.current,
        }),
        [sendInput, fitPane, reconnect, clear, getText]
    );

    useEffect(() => {
        mountedRef.current = true;
        const host = containerRef.current;
        if (!host || !machineId) return undefined;

        const term = new Terminal({
            cursorBlink: true,
            cursorStyle: "block",
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Ubuntu Mono', monospace",
            fontSize: fontSizeRef.current,
            lineHeight: 1.2,
            scrollback: 5000,
            theme: HIGH_CONTRAST_DARK_THEME,
        });
        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(host);

        const dataSub = term.onData((data) => sendInput(data));
        const resizeSub = term.onResize(() => sendResize());

        termRef.current = term;
        fitRef.current = fitAddon;

        let rafId = 0;
        const ro = new ResizeObserver(() => {
            cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(fitPane);
        });
        ro.observe(host);

        connect(false);

        return () => {
            mountedRef.current = false;
            cancelAnimationFrame(rafId);
            ro.disconnect();
            clearRetryTimer();
            detachSocket();
            dataSub.dispose();
            resizeSub.dispose();
            term.dispose();
            termRef.current = null;
            fitRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [machineId]);

    useEffect(() => {
        onRegister?.(machineId, handle);
        return () => onRegister?.(machineId, null);
    }, [machineId, handle, onRegister]);

    useEffect(() => {
        const term = termRef.current;
        if (!term) return;
        try {
            if (term.options.fontSize !== fontSize) term.options.fontSize = fontSize;
        } catch {
            term.setOption?.("fontSize", fontSize);
        }
        const t = setTimeout(fitPane, 30);
        return () => clearTimeout(t);
    }, [fontSize, fitPane]);

    useEffect(() => {
        const t = setTimeout(fitPane, 60);
        return () => clearTimeout(t);
    }, [height, hidden, isMaximized, fitPane]);

    const meta = STATUS_META[status] || STATUS_META.DISCONNECTED;
    const showOverlay = status === "CLOSED" || status === "DISCONNECTED";

    return (
        <Paper
            elevation={0}
            sx={{
                display: hidden ? "none" : "flex",
                flexDirection: "column",
                width: "100%",
                minWidth: 0,
                borderRadius: "6px",
                border: isTargetedForBroadcast ? "1px dashed #4C9AFF" : "1px solid #2A3341",
                overflow: "hidden",
                bgcolor: "#0B0F17",
                boxShadow: "0 8px 24px rgba(2, 6, 23, 0.45)",
            }}
        >
            <Box
                sx={{
                    width: "100%",
                    px: 1.25,
                    py: 0.65,
                    bgcolor: "#111827",
                    borderBottom: "1px solid #1E293B",
                    display: "grid",
                    gridTemplateColumns: "1fr auto 1fr",
                    alignItems: "center",
                    gap: 1,
                    flexShrink: 0,
                    boxSizing: "border-box",
                }}
            >
                <Stack direction="row" spacing={0.75} alignItems="center" sx={{ justifySelf: "start" }}>
                    <Tooltip title="Close terminal session">
                        <Box
                            component="button"
                            type="button"
                            onClick={handleClose}
                            aria-label="Close terminal"
                            sx={dotButtonSx("#FF5630")}
                        />
                    </Tooltip>
                    <Tooltip title="Minimize pane (session stays alive)">
                        <Box
                            component="button"
                            type="button"
                            onClick={() => onMinimizePane?.(machineId)}
                            aria-label="Minimize terminal"
                            sx={dotButtonSx("#FFAB00")}
                        />
                    </Tooltip>
                    <Tooltip title={isMaximized ? "Restore grid size" : "Maximize terminal pane"}>
                        <Box
                            component="button"
                            type="button"
                            onClick={() => onToggleMaximizePane?.(machineId)}
                            aria-label="Maximize terminal"
                            sx={dotButtonSx("#36B37E")}
                        />
                    </Tooltip>
                </Stack>

                <Stack
                    direction="row"
                    spacing={0.85}
                    alignItems="center"
                    justifyContent="center"
                    sx={{ minWidth: 0 }}
                >
                    <Typography
                        noWrap
                        variant="caption"
                        title={`${label} (${machineId})`}
                        sx={{
                            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                            color: "#F1F5F9",
                            fontWeight: 700,
                            fontSize: "0.75rem",
                            minWidth: 0,
                        }}
                    >
                        {label}
                    </Typography>
                    <Box
                        sx={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 0.5,
                            px: 0.75,
                            py: 0.15,
                            borderRadius: "999px",
                            bgcolor: meta.bg,
                            border: `1px solid ${meta.border}`,
                            flexShrink: 0,
                        }}
                    >
                        <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: meta.dot }} />
                        <Typography
                            variant="caption"
                            sx={{
                                fontFamily: "'JetBrains Mono', monospace",
                                color: meta.text,
                                fontWeight: 700,
                                fontSize: "0.64rem",
                                letterSpacing: "0.03em",
                                lineHeight: 1.2,
                            }}
                        >
                            {meta.label}
                        </Typography>
                    </Box>
                </Stack>

                <Stack direction="row" spacing={0.25} alignItems="center" sx={{ justifySelf: "end" }}>
                    <Tooltip title="Include in broadcast / live sync">
                        <IconButton
                            size="small"
                            onClick={() => onToggleBroadcastTarget?.(machineId)}
                            sx={{ p: 0.3, color: isTargetedForBroadcast ? "#4C9AFF" : "#64748B" }}
                        >
                            {isTargetedForBroadcast ? (
                                <CheckBoxIcon sx={{ fontSize: 15 }} />
                            ) : (
                                <CheckBoxOutlineBlankIcon sx={{ fontSize: 15 }} />
                            )}
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Reconnect session">
                        <IconButton
                            size="small"
                            onClick={reconnect}
                            sx={{ p: 0.3, color: "#94A3B8", "&:hover": { color: "#F1F5F9" } }}
                        >
                            <RefreshIcon sx={{ fontSize: 15 }} />
                        </IconButton>
                    </Tooltip>
                    {onOpenMachinePage && (
                        <Tooltip title="Open VM management page">
                            <IconButton
                                size="small"
                                onClick={() => onOpenMachinePage(machineId)}
                                sx={{ p: 0.3, color: "#94A3B8", "&:hover": { color: "#F1F5F9" } }}
                            >
                                <OpenInNewIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                        </Tooltip>
                    )}
                </Stack>
            </Box>

            <Box
                sx={{
                    position: "relative",
                    width: "100%",
                    height,
                    bgcolor: "#0B0F17",
                    p: 0.75,
                    boxSizing: "border-box",
                }}
            >
                <Box
                    ref={containerRef}
                    onClick={() => termRef.current?.focus()}
                    sx={{ width: "100%", height: "100%", overflow: "hidden" }}
                />

                {showOverlay && (
                    <Stack
                        alignItems="center"
                        justifyContent="center"
                        spacing={1}
                        sx={{
                            position: "absolute",
                            inset: 0,
                            bgcolor: "rgba(11, 15, 23, 0.9)",
                            backdropFilter: "blur(2px)",
                        }}
                    >
                        <Typography
                            variant="body2"
                            sx={{
                                color: "#E2E8F0",
                                fontFamily: "'JetBrains Mono', monospace",
                                fontWeight: 600,
                                textAlign: "center",
                                px: 2,
                            }}
                        >
                            {status === "CLOSED"
                                ? `Terminal closed for ${label}`
                                : `Connection lost for ${label}`}
                        </Typography>
                        <Button
                            size="small"
                            variant="contained"
                            disableElevation
                            startIcon={<RefreshIcon fontSize="small" />}
                            onClick={reconnect}
                            sx={{
                                textTransform: "none",
                                fontWeight: 600,
                                bgcolor: "#0052CC",
                                "&:hover": { bgcolor: "#0747A6" },
                            }}
                        >
                            Reconnect Session
                        </Button>
                    </Stack>
                )}
            </Box>
        </Paper>
    );
});

export default TerminalPane;