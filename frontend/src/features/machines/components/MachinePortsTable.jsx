import { useState } from "react";
import {
    Box,
    Button,
    IconButton,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import LockIcon from "@mui/icons-material/Lock";
import PublicIcon from "@mui/icons-material/Public";
import DeleteIcon from "@mui/icons-material/Delete";

export default function MachinePortsTable({
    ports,
    machineId,
    onAddPort,
    onDeletePort,
    onCopy,
    tokens,
    inputSx,
    primaryBtnSx,
}) {
    const [portNum, setPortNum] = useState("");
    const [portLabel, setPortLabel] = useState("");

    const handleSubmit = (e) => {
        e.preventDefault();
        const added = onAddPort({ portNum, portLabel });
        if (added) {
            setPortNum("");
            setPortLabel("");
        }
    };

    const list = Array.isArray(ports) ? ports : [];

    return (
        <Stack spacing={2}>
            <Box component="form" onSubmit={handleSubmit}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems="center">
                    <TextField
                        size="small"
                        label="Port"
                        value={portNum}
                        onChange={(e) => setPortNum(e.target.value)}
                        sx={{ width: 120, ...inputSx }}
                    />
                    <TextField
                        size="small"
                        label="Name"
                        value={portLabel}
                        onChange={(e) => setPortLabel(e.target.value)}
                        sx={{ flexGrow: 1, ...inputSx }}
                    />
                    <Button
                        type="submit"
                        variant="contained"
                        disableElevation
                        startIcon={<AddIcon fontSize="small" />}
                        sx={primaryBtnSx}
                    >
                        Publish
                    </Button>
                </Stack>
            </Box>

            <TableContainer
                variant="outlined"
                component={Paper}
                elevation={0}
                sx={{ borderRadius: "4px", bgcolor: tokens.cardBg, borderColor: tokens.border }}
            >
                <Table size="small">
                    <TableHead>
                        <TableRow sx={{ bgcolor: tokens.subtleSurface }}>
                            {["Port", "Name", "Access", "URL", "Actions"].map((h) => (
                                <TableCell
                                    key={h}
                                    sx={{ fontWeight: 700, color: tokens.textSecondary, borderColor: tokens.border }}
                                >
                                    {h}
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {list.map((p) => {
                            const accessStyle = p.private ? tokens.amber : tokens.green;
                            const accessLabel = p.private ? "private" : "public";
                            const targetUrl = p.url || `https://${p.port}-${machineId || "m_unknown"}.instabox.tech`;
                            return (
                                <TableRow key={p.id} hover sx={{ "&:hover": { bgcolor: tokens.hoverSurface } }}>
                                    <TableCell
                                        sx={{
                                            fontFamily: "monospace",
                                            fontWeight: 700,
                                            color: tokens.textPrimary,
                                            borderColor: tokens.border,
                                        }}
                                    >
                                        {p.port} ({p.protocol || "http"})
                                    </TableCell>
                                    <TableCell sx={{ color: tokens.textPrimary, borderColor: tokens.border }}>
                                        {p.name}
                                    </TableCell>
                                    <TableCell sx={{ borderColor: tokens.border }}>
                                        <Box
                                            component="span"
                                            sx={{
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: 0.5,
                                                px: 0.75,
                                                py: 0.2,
                                                borderRadius: "3px",
                                                fontSize: "0.7rem",
                                                fontWeight: 700,
                                                bgcolor: accessStyle.bg,
                                                color: accessStyle.text,
                                            }}
                                        >
                                            {p.private ? <LockIcon sx={{ fontSize: 12 }} /> : <PublicIcon sx={{ fontSize: 12 }} />}
                                            {accessLabel}
                                        </Box>
                                    </TableCell>
                                    <TableCell
                                        sx={{
                                            fontFamily: "monospace",
                                            fontSize: "0.78rem",
                                            color: tokens.textSecondary,
                                            borderColor: tokens.border,
                                        }}
                                    >
                                        <Typography noWrap variant="caption" sx={{ maxWidth: 420, display: "block" }}>
                                            {targetUrl}
                                        </Typography>
                                    </TableCell>
                                    <TableCell align="right" sx={{ borderColor: tokens.border }}>
                                        <IconButton
                                            size="small"
                                            onClick={() => void onCopy(targetUrl, "Port URL")}
                                            sx={{ color: tokens.textSecondary }}
                                        >
                                            <ContentCopyIcon fontSize="small" />
                                        </IconButton>
                                        <IconButton
                                            size="small"
                                            component="a"
                                            href={targetUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            sx={{ color: tokens.textSecondary }}
                                        >
                                            <OpenInNewIcon fontSize="small" />
                                        </IconButton>
                                        <IconButton
                                            size="small"
                                            onClick={() => onDeletePort(p.id)}
                                            sx={{ color: tokens.textSecondary }}
                                        >
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>
        </Stack>
    );
}