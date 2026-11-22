import { useCallback, useEffect, useRef, useState } from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
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
    return `${proto}//localhost:8080/ws/machines/${encodeURIComponent(String(machineId))}/terminal`;
};

export default function MachineTerminalTab({
    machineId,
    tokens,
    outlineBtnSx,
    onNotify,
    terminalHeight = 630,
}) {
    const containerRef = useRef(null);
    const termRef = useRef(null);
    const fitRef = useRef(null);
    const socketRef = useRef(null);

    const [status, setStatus] = useState("DISCONNECTED"); // CONNECTING | CONNECTED | DISCONNECTED

    const fitTerminal = useCallback(() => {
        if (!fitRef.current || !termRef.current) return;
        try {
            fitRef.current.fit();
            if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
                socketRef.current.send(
                    JSON.stringify({
                        type: "RESIZE",
                        cols: termRef.current.cols,
                        rows: termRef.current.rows,
                    })
                );
            }
        } catch {
            // ignore fit errors when hidden/unmounted
        }
    }, []);

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
                lineHeight: 1.25,
                scrollback: 2000,
                theme: HIGH_CONTRAST_DARK_THEME,
            });
            const fitAddon = new FitAddon();
            term.loadAddon(fitAddon);
            term.open(containerRef.current);
            fitAddon.fit();

            term.onData((data) => {
                if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
                    socketRef.current.send(JSON.stringify({ type: "INPUT", data }));
                }
            });

            term.onResize(({ cols, rows }) => {
                if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
                    socketRef.current.send(JSON.stringify({ type: "RESIZE", cols, rows }));
                }
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
            fitTerminal();
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
    }, [machineId, onNotify, fitTerminal]);

    useEffect(() => {
        connectTerminal();

        const resizeObserver = new ResizeObserver(() => {
            fitTerminal();
        });
        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        const handleWindowResize = () => {
            fitTerminal();
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
    }, []);

    return (
        <Stack spacing={1.5} sx={{ width: "100%" }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
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

            <Box
                sx={{
                    width: "100%",
                    borderRadius: "6px",
                    border: "1px solid #1E293B",
                    overflow: "hidden",
                    boxShadow: "0 10px 28px rgba(2, 6, 23, 0.55)",
                }}
            >
                {/* Dark Terminal Window Header */}
                <Box
                    sx={{
                        px: 1.5,
                        py: 0.75,
                        bgcolor: "#111827",
                        borderBottom: "1px solid #1E293B",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
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

                    <Box sx={{ width: 42 }} />
                </Box>

                {/* xterm.js High-Contrast Dark Canvas */}
                <Box
                    ref={containerRef}
                    onClick={() => termRef.current?.focus()}
                    sx={{
                        width: "100%",
                        height: terminalHeight,
                        minHeight: 480,
                        // maxHeight: "calc(100vh - 240px)",
                        bgcolor: "#0B0F17",
                        p: 1,
                        overflow: "hidden",
                    }}
                />
            </Box>
        </Stack>
    );
}