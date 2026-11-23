import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Box, Button, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import OpenInFullIcon from "@mui/icons-material/OpenInFull";
import CloseFullscreenIcon from "@mui/icons-material/CloseFullscreen";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { Terminal } from "xterm";
import { FitAddon } from "@xterm/addon-fit";
import "xterm/css/xterm.css";

const HIGH_CONTRAST_DARK_THEME = {
    background: "#0B0F17",
    foreground: "#F1F5F9",
    cursor: "#38BDF8",
    cursorAccent: "#0B0F17",
    selectionBackground: "rgba(56, 189, 248, 0.28)",
    black: "#1E293B",
    red: "#F87171",
    green: "#34D399",
    yellow: "#FBBF24",
    blue: "#60A5FA",
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
    const host = window.location.host;
    return `${proto}//${host}/ws/machines/${encodeURIComponent(String(machineId))}/terminal`;
};

const buildStandaloneTerminalUrl = (machineId) => {
    const base = window.location.origin;
    return `${base}/terminal/${encodeURIComponent(String(machineId))}`;
};

function MachineTerminalTabComponent({
    machineId,
    tokens,
    outlineBtnSx,
    onNotify,
    terminalHeight = 630,
}) {
    const wrapperRef = useRef(null);
    const containerRef = useRef(null);
    const termRef = useRef(null);
    const fitRef = useRef(null);
    const socketRef = useRef(null);

    const [status, setStatus] = useState("DISCONNECTED"); // CONNECTING | CONNECTED | DISCONNECTED
    const [expanded, setExpanded] = useState(false);

    const sendResize = useCallback((cols, rows) => {
        if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
        const rect = containerRef.current?.getBoundingClientRect();
        socketRef.current.send(
            JSON.stringify({
                type: "RESIZE",
                cols,
                rows,
                width: rect ? Math.max(200, Math.round(rect.width)) : cols * 8,
                height: rect ? Math.max(100, Math.round(rect.height)) : terminalHeight,
            })
        );
    }, [terminalHeight]);

    const fitTerminal = useCallback(() => {
        if (!fitRef.current || !termRef.current || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;

        try {
            fitRef.current.fit();
            sendResize(termRef.current.cols, termRef.current.rows);
        } catch {
            // ignore fit errors when hidden/unmounted
        }
    }, [sendResize]);

    const connectTerminal = useCallback(() => {
        if (!machineId || !containerRef.current) return;

        if (socketRef.current) {
            try {
                socketRef.current.close();
            } catch {
                // ignore
            }
            socketRef.current = null;
        }

        if (!termRef.current) {
            const term = new Terminal({
                cursorBlink: true,
                cursorStyle: "block",
                fontFamily: "'JetBrains Mono', 'Fira Code', 'Ubuntu Mono', monospace",
                fontSize: 13.5,
                lineHeight: 1.2,
                scrollback: 3000,
                theme: HIGH_CONTRAST_DARK_THEME,
            });
            const fitAddon = new FitAddon();
            term.loadAddon(fitAddon);
            term.open(containerRef.current);

            term.onData((data) => {
                if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
                    socketRef.current.send(JSON.stringify({ type: "INPUT", data }));
                }
            });

            term.onResize(({ cols, rows }) => {
                sendResize(cols, rows);
            });

            termRef.current = term;
            fitRef.current = fitAddon;
        }

        termRef.current.reset();
        setStatus("CONNECTING");

        const ws = new WebSocket(buildWsUrl(machineId));
        socketRef.current = ws;

        ws.onopen = () => {
            setStatus("CONNECTED");
            requestAnimationFrame(() => {
                fitTerminal();
                termRef.current?.focus();
            });
        };

        ws.onmessage = (event) => {
            if (!termRef.current) return;
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

        ws.onclose = () => {
            setStatus("DISCONNECTED");
        };

        ws.onerror = () => {
            setStatus("DISCONNECTED");
            onNotify?.error("Terminal WebSocket connection failed.");
        };
    }, [machineId, onNotify, fitTerminal, sendResize]);

    useEffect(() => {
        connectTerminal();

        const resizeObserver = new ResizeObserver(() => {
            requestAnimationFrame(() => fitTerminal());
        });
        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        const handleWindowResize = () => {
            requestAnimationFrame(() => fitTerminal());
        };
        window.addEventListener("resize", handleWindowResize);

        return () => {
            resizeObserver.disconnect();
            window.removeEventListener("resize", handleWindowResize);
            if (socketRef.current) {
                try {
                    socketRef.current.close();
                } catch {
                    // ignore
                }
            }
            if (termRef.current) {
                termRef.current.dispose();
                termRef.current = null;
            }
        };
    }, [connectTerminal, fitTerminal]);

    useEffect(() => {
        const timer = window.setTimeout(() => fitTerminal(), 60);
        return () => window.clearTimeout(timer);
    }, [expanded, fitTerminal]);

    useEffect(() => {
        if (!expanded) return;
        const onKeyDown = (e) => {
            if (e.key === "Escape") {
                setExpanded(false);
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [expanded]);

    const handleOpenInNewTab = () => {
        const url = buildStandaloneTerminalUrl(machineId);
        window.open(url, "_blank", "noopener,noreferrer");
    };

    const handleToggleExpand = () => {
        setExpanded((prev) => !prev);
    };

    return (
        <Stack spacing={1.25} sx={{ width: "100%" }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                <Typography
                    variant="caption"
                    sx={{
                        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                        color: status === "CONNECTED" ? tokens.green.text : tokens.textSecondary,
                        fontWeight: 700,
                    }}
                >
                    SSH PTY: {status}
                </Typography>

                <Stack direction="row" spacing={0.75} alignItems="center">
                    <Tooltip title="Open terminal in new browser tab">
                        <Button
                            size="small"
                            variant="outlined"
                            startIcon={<OpenInNewIcon fontSize="small" />}
                            onClick={handleOpenInNewTab}
                            sx={outlineBtnSx}
                        >
                            New Tab
                        </Button>
                    </Tooltip>

                    <Tooltip title={expanded ? "Exit full browser screen (Esc)" : "Expand to full browser screen"}>
                        <Button
                            size="small"
                            variant="outlined"
                            startIcon={
                                expanded ? (
                                    <CloseFullscreenIcon fontSize="small" />
                                ) : (
                                    <OpenInFullIcon fontSize="small" />
                                )
                            }
                            onClick={handleToggleExpand}
                            sx={outlineBtnSx}
                        >
                            {expanded ? "Exit Full Screen" : "Full Screen"}
                        </Button>
                    </Tooltip>

                    <Button
                        size="small"
                        variant="outlined"
                        startIcon={<RefreshIcon fontSize="small" />}
                        onClick={connectTerminal}
                        sx={outlineBtnSx}
                    >
                        Reconnect
                    </Button>
                </Stack>
            </Stack>

            <Box
                ref={wrapperRef}
                sx={
                    expanded
                        ? {
                              position: "fixed",
                              inset: 0,
                              zIndex: 1400,
                              width: "100vw",
                              height: "100vh",
                              bgcolor: "#0B0F17",
                              display: "flex",
                              flexDirection: "column",
                          }
                        : {
                              width: "100%",
                              borderRadius: "6px",
                              border: "1px solid #1E293B",
                              overflow: "hidden",
                              boxShadow: "0 10px 28px rgba(2, 6, 23, 0.55)",
                              display: "flex",
                              flexDirection: "column",
                          }
                }
            >
                <Box
                    sx={{
                        px: 1.5,
                        py: 0.75,
                        bgcolor: "#111827",
                        borderBottom: "1px solid #1E293B",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexShrink: 0,
                    }}
                >
                    <Stack direction="row" spacing={0.85} alignItems="center">
                        <Box sx={{ width: 11, height: 11, borderRadius: "50%", bgcolor: "#F87171" }} />
                        <Box sx={{ width: 11, height: 11, borderRadius: "50%", bgcolor: "#FBBF24" }} />
                        <Box sx={{ width: 11, height: 11, borderRadius: "50%", bgcolor: "#34D399" }} />
                    </Stack>

                    <Typography
                        variant="caption"
                        sx={{
                            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                            color: "#38BDF8",
                            fontWeight: 600,
                            fontSize: "0.75rem",
                        }}
                    >
                        instabox@{machineId}: ~
                    </Typography>

                    <Stack direction="row" spacing={0.5} alignItems="center">
                        <IconButton
                            size="small"
                            onClick={handleOpenInNewTab}
                            title="Open in new tab"
                            sx={{ color: "#94A3B8", p: 0.35 }}
                        >
                            <OpenInNewIcon sx={{ fontSize: 15 }} />
                        </IconButton>
                        <IconButton
                            size="small"
                            onClick={handleToggleExpand}
                            title={expanded ? "Exit full screen (Esc)" : "Full browser screen"}
                            sx={{ color: "#94A3B8", p: 0.35 }}
                        >
                            {expanded ? (
                                <CloseFullscreenIcon sx={{ fontSize: 15 }} />
                            ) : (
                                <OpenInFullIcon sx={{ fontSize: 15 }} />
                            )}
                        </IconButton>
                    </Stack>
                </Box>

                <Box
                    ref={containerRef}
                    onClick={() => termRef.current?.focus()}
                    sx={{
                        width: "100%",
                        flex: expanded ? 1 : "none",
                        height: expanded ? "auto" : terminalHeight,
                        minHeight: expanded ? 0 : 480,
                        bgcolor: "#0B0F17",
                        p: 1,
                        overflow: "hidden",
                    }}
                />
            </Box>
        </Stack>
    );
}

function areTerminalPropsEqual(prev, next) {
    return (
        prev.machineId === next.machineId &&
        prev.terminalHeight === next.terminalHeight &&
        prev.onNotify === next.onNotify &&
        prev.tokens?.green?.text === next.tokens?.green?.text &&
        prev.tokens?.textSecondary === next.tokens?.textSecondary &&
        prev.outlineBtnSx === next.outlineBtnSx
    );
}

const MachineTerminalTab = memo(MachineTerminalTabComponent, areTerminalPropsEqual);

export default MachineTerminalTab;