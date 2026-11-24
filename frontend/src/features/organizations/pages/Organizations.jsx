import {
    Button,
    Paper,
    Typography,
    Box,
    Grid,
    Card,
    CardContent,
    CardActions,
    Stack,
    IconButton,
    Tooltip,
    ToggleButton,
    ToggleButtonGroup,
    Divider,
    useTheme,
} from "@mui/material";

import SyncIcon from '@mui/icons-material/Sync';
import AddIcon from "@mui/icons-material/Add";
import BusinessIcon from "@mui/icons-material/Business";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import UpdateIcon from "@mui/icons-material/Update";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { useEffect, useState, useCallback, useMemo } from "react";
import PageHeader from "../../../components/common/PageHeader";
import NewOrginizationModel from "../components/NewOrginizationModel";
import ManageOrganizationModal from "../components/ManageOrganizationModal";
import { getOrginizationList } from "../organizationsApi";
import useNotification from "../../../hooks/useNotification";

const JIRA_ACCENTS = [
    {
        light: { main: "#1868DB", bg: "#E9F2FF", text: "#0055CC" },
        dark: { main: "#579DFF", bg: "#1C2B41", text: "#85B8FF" },
    },
    {
        light: { main: "#22A06B", bg: "#DCFFF1", text: "#216E4E" },
        dark: { main: "#4BCE97", bg: "#163326", text: "#7EE2B8" },
    },
    {
        light: { main: "#8270DB", bg: "#F3F0FF", text: "#5E4DB2" },
        dark: { main: "#9F8FEF", bg: "#2B244D", text: "#B8ACF6" },
    },
    {
        light: { main: "#1D9AAA", bg: "#E7F9FF", text: "#206A83" },
        dark: { main: "#6CC3E0", bg: "#16323B", text: "#9DD9EE" },
    },
    {
        light: { main: "#E56910", bg: "#FFF3EB", text: "#A54800" },
        dark: { main: "#FEA362", bg: "#382516", text: "#FEC195" },
    },
    {
        light: { main: "#CD519D", bg: "#FFECF8", text: "#943D73" },
        dark: { main: "#E774BB", bg: "#371C2D", text: "#F797D2" },
    },
];

const getJiraTokens = (isDark) => ({
    canvasBg: isDark ? "#1D2125" : "#F7F8F9",
    cardBg: isDark ? "#22272B" : "#FFFFFF",
    cardFooterBg: isDark ? "#1D2125" : "#FAFBFC",
    subtleSurface: isDark ? "#161A1D" : "#F7F8F9",
    border: isDark ? "#38414A" : "#DFE1E6",
    borderHover: isDark ? "#579DFF" : "#B3D4FF",
    textPrimary: isDark ? "#B6C2CF" : "#172B4D",
    textSecondary: isDark ? "#8C9BAB" : "#44546F",
    textSubtle: isDark ? "#738496" : "#626F86",
    brandMain: isDark ? "#579DFF" : "#1868DB",
    brandHover: isDark ? "#85B8FF" : "#0055CC",
    brandBg: isDark ? "#1C2B41" : "#E9F2FF",
    brandBorder: isDark ? "#2C4870" : "#CCE0FF",
    statusSuccessBg: isDark ? "#163326" : "#DCFFF1",
    statusSuccessText: isDark ? "#7EE2B8" : "#216E4E",
    cardShadowHover: isDark
        ? "0 6px 12px -2px rgba(3, 4, 4, 0.55), 0 0 1px rgba(255, 255, 255, 0.12)"
        : "0 4px 8px -2px rgba(9, 30, 66, 0.12), 0 0 1px rgba(9, 30, 66, 0.31)",
});

export default function Orginizations() {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";
    const tokens = useMemo(() => getJiraTokens(isDark), [isDark]);

    const [managedOrg, setManagedOrg] = useState(null);
    const [createModelOpen, setCreateModelOpen] = useState(false);
    const [orginizationList, setOrginizationList] = useState([]);
    const [columns, setColumns] = useState(3);
    const notify = useNotification();

    const handleCreateModelOpen = () => setCreateModelOpen(true);
    const handleCreateModelClose = () => setCreateModelOpen(false);

    const handleManageOpen = (org) => setManagedOrg(org);
    const handleManageClose = () => setManagedOrg(null);

    const getOrgAccent = (index) => {
        const pair = JIRA_ACCENTS[index % JIRA_ACCENTS.length];
        return isDark ? pair.dark : pair.light;
    };

    const fetchOrganizations = useCallback(async () => {
        try {
            const response = await getOrginizationList();
            const list = Array.isArray(response) ? response : [];
            setOrginizationList(list);

            setManagedOrg((prev) => {
                if (!prev) return null;
                return list.find((org) => org.id === prev.id) || null;
            });
        } catch (err) {
            console.error("Failed to fetch organizations:", err);
            notify.error("Failed to load organizations.");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        void fetchOrganizations();
    }, [fetchOrganizations]);

    const handleOrganizationCreated = () => {
        handleCreateModelClose();
        void fetchOrganizations();
    };

    const handleCopy = async (value) => {
        try {
            await navigator.clipboard.writeText(value);
            notify.success("Organization ID copied.");
        } catch {
            notify.error("Unable to copy organization ID.");
        }
    };

    const formatDate = (date) => {
        if (!date) return "-";
        return new Date(date).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    };

    return (
        <Box
            sx={{
                bgcolor: tokens.canvasBg,
                minHeight: "100vh",
                display: "flex",
                flexDirection: "column",
                pb: 4,
                transition: "background-color 0.2s ease",
            }}
        >
            <PageHeader
                title="Organizations"
                subtitle="Manage workspaces, access keys, and registered organizations"
                count={orginizationList.length}
                countLabel="Total"
                countIcon={BusinessIcon}
                sticky
                tokens={tokens}
                action={
                    <Stack direction="row" spacing={1.25} alignItems="center">
                        <ToggleButtonGroup
                            value={columns}
                            exclusive
                            size="small"
                            onChange={(event, value) => {
                                if (value !== null) {
                                    setColumns(value);
                                }
                            }}
                            sx={{
                                height: 34,
                                bgcolor: tokens.subtleSurface,
                                "& .MuiToggleButton-root": {
                                    minWidth: 34,
                                    borderRadius: "3px",
                                    borderColor: tokens.border,
                                    color: tokens.textSecondary,
                                    margin: ".5px",
                                    fontSize: "0.75rem",
                                    fontWeight: 600,
                                    "&:hover": {
                                        bgcolor: tokens.cardBg,
                                    },
                                    "&.Mui-selected": {
                                        bgcolor: tokens.brandBg,
                                        color: tokens.brandMain,
                                        borderColor: tokens.brandMain,
                                        "&:hover": {
                                            bgcolor: tokens.brandBg,
                                        },
                                    },
                                },
                            }}
                        >
                            <ToggleButton value={2}>2</ToggleButton>
                            <ToggleButton value={3}>3</ToggleButton>
                            <ToggleButton value={4}>4</ToggleButton>
                        </ToggleButtonGroup>

                        <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            onClick={handleCreateModelOpen}
                            disableElevation
                            sx={{
                                bgcolor: tokens.brandMain,
                                color: isDark ? "#1D2125" : "#FFFFFF",
                                borderRadius: "3px",
                                textTransform: "none",
                                fontWeight: 600,
                                fontSize: "0.875rem",
                                px: 2,
                                height: 34,
                                whiteSpace: "nowrap",
                                "&:hover": {
                                    bgcolor: tokens.brandHover,
                                },
                            }}
                        >
                            Add
                        </Button>
                        <Button
                            variant="contained"
                            startIcon={<SyncIcon />}
                            onClick={handleCreateModelOpen}
                            disableElevation
                            sx={{
                                bgcolor: tokens.brandMain,
                                color: isDark ? "#1D2125" : "#FFFFFF",
                                borderRadius: "3px",
                                textTransform: "none",
                                fontWeight: 600,
                                fontSize: "0.875rem",
                                px: 2,
                                height: 34,
                                whiteSpace: "nowrap",
                                "&:hover": {
                                    bgcolor: tokens.brandHover,
                                },
                            }}
                        >
                            Sync
                        </Button>
                    </Stack>
                }
            />

            <Box sx={{ px: 3, pt: 2.5, flexGrow: 1 }}>
                {/* Organization Cards */}
                <Grid container spacing={2}>
                    {orginizationList.map((item, index) => {
                        const accent = getOrgAccent(index);

                        return (
                            <Grid key={item.id} size={{ xs: 12, sm: 6, md: 12 / columns }}>
                                <Card
                                    variant="outlined"
                                    onClick={() => handleManageOpen(item)}
                                    sx={{
                                        height: "100%",
                                        display: "flex",
                                        flexDirection: "column",
                                        cursor: "pointer",
                                        borderRadius: "4px",
                                        bgcolor: tokens.cardBg,
                                        borderColor: tokens.border,
                                        borderTop: `3px solid ${accent.main}`,
                                        transition:
                                            "box-shadow 0.15s ease, border-color 0.15s ease, background-color 0.2s ease",
                                        "&:hover": {
                                            borderColor: tokens.borderHover,
                                            borderTopColor: accent.main,
                                            boxShadow: tokens.cardShadowHover,
                                        },
                                    }}
                                >
                                    <CardContent sx={{ flexGrow: 1, p: 2 }}>
                                        <Stack
                                            direction="row"
                                            alignItems="flex-start"
                                            spacing={1.5}
                                            sx={{ mb: 2 }}
                                        >
                                            <Box
                                                sx={{
                                                    width: 38,
                                                    height: 38,
                                                    flexShrink: 0,
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    borderRadius: "4px",
                                                    bgcolor: accent.bg,
                                                    color: accent.main,
                                                    border: `1px solid ${accent.main}44`,
                                                }}
                                            >
                                                <BusinessIcon fontSize="small" />
                                            </Box>

                                            <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                                                <Typography
                                                    variant="subtitle2"
                                                    noWrap
                                                    title={item.organizationName}
                                                    sx={{
                                                        fontWeight: 700,
                                                        color: tokens.textPrimary,
                                                        fontSize: "0.95rem",
                                                    }}
                                                >
                                                    {item.organizationName}
                                                </Typography>
                                                <Typography
                                                    variant="caption"
                                                    sx={{
                                                        color: tokens.textSubtle,
                                                        display: "block",
                                                        fontWeight: 500,
                                                    }}
                                                >
                                                    Workspace Organization
                                                </Typography>
                                            </Box>

                                            <Box
                                                sx={{
                                                    px: 1,
                                                    py: 0.25,
                                                    borderRadius: "3px",
                                                    bgcolor: tokens.statusSuccessBg,
                                                    color: tokens.statusSuccessText,
                                                    fontSize: "0.6875rem",
                                                    fontWeight: 700,
                                                    letterSpacing: "0.04em",
                                                    textTransform: "uppercase",
                                                    lineHeight: 1.4,
                                                }}
                                            >
                                                ACTIVE
                                            </Box>
                                        </Stack>

                                        <Box
                                            sx={{
                                                mb: 2,
                                                px: 1.25,
                                                py: 0.75,
                                                bgcolor: tokens.subtleSurface,
                                                border: `1px solid ${tokens.border}`,
                                                borderRadius: "3px",
                                            }}
                                        >
                                            <Typography
                                                variant="caption"
                                                sx={{
                                                    color: tokens.textSubtle,
                                                    fontWeight: 600,
                                                    fontSize: "0.6875rem",
                                                    textTransform: "uppercase",
                                                    letterSpacing: "0.03em",
                                                    display: "block",
                                                }}
                                            >
                                                Organization Key
                                            </Typography>
                                            <Stack direction="row" alignItems="center" spacing={0.5}>
                                                <Typography
                                                    variant="body2"
                                                    sx={{
                                                        flexGrow: 1,
                                                        fontFamily:
                                                            "'JetBrains Mono', 'Fira Code', monospace",
                                                        fontSize: "0.8rem",
                                                        fontWeight: 600,
                                                        color: tokens.textPrimary,
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        whiteSpace: "nowrap",
                                                    }}
                                                    title={item.organizationId}
                                                >
                                                    {item.organizationId}
                                                </Typography>
                                                <Tooltip title="Copy Organization ID" arrow>
                                                    <IconButton
                                                        size="small"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            void handleCopy(item.organizationId);
                                                        }}
                                                        sx={{
                                                            p: 0.4,
                                                            borderRadius: "3px",
                                                            color: tokens.textSecondary,
                                                            "&:hover": {
                                                                bgcolor: tokens.border,
                                                                color: tokens.textPrimary,
                                                            },
                                                        }}
                                                    >
                                                        <ContentCopyIcon sx={{ fontSize: 14 }} />
                                                    </IconButton>
                                                </Tooltip>
                                            </Stack>
                                        </Box>

                                        <Stack spacing={0.75}>
                                            <Stack direction="row" alignItems="center" spacing={1}>
                                                <CalendarTodayIcon
                                                    sx={{ fontSize: 14, color: tokens.textSubtle }}
                                                />
                                                <Typography
                                                    variant="caption"
                                                    sx={{ color: tokens.textSecondary }}
                                                >
                                                    Created{" "}
                                                    <strong style={{ color: tokens.textPrimary }}>
                                                        {formatDate(item.createdAt)}
                                                    </strong>
                                                </Typography>
                                            </Stack>
                                            <Stack direction="row" alignItems="center" spacing={1}>
                                                <UpdateIcon
                                                    sx={{ fontSize: 14, color: tokens.textSubtle }}
                                                />
                                                <Typography
                                                    variant="caption"
                                                    sx={{ color: tokens.textSecondary }}
                                                >
                                                    Updated{" "}
                                                    <strong style={{ color: tokens.textPrimary }}>
                                                        {formatDate(item.updatedAt)}
                                                    </strong>
                                                </Typography>
                                            </Stack>
                                        </Stack>
                                    </CardContent>

                                    <Divider sx={{ borderColor: tokens.border }} />

                                    <CardActions
                                        sx={{
                                            px: 2,
                                            py: 1,
                                            bgcolor: tokens.cardFooterBg,
                                            justifyContent: "space-between",
                                        }}
                                    >
                                        <Typography
                                            variant="caption"
                                            sx={{
                                                fontFamily: "monospace",
                                                color: tokens.textSubtle,
                                                fontWeight: 600,
                                            }}
                                        >
                                            VM Count:{item.machineCount ?? 0}
                                        </Typography>
                                        <Button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleManageOpen(item);
                                            }}
                                            size="small"
                                            endIcon={<ArrowForwardIcon sx={{ fontSize: 14 }} />}
                                            sx={{
                                                borderRadius: "3px",
                                                textTransform: "none",
                                                fontWeight: 600,
                                                fontSize: "0.8rem",
                                                color: tokens.brandMain,
                                                px: 1,
                                                py: 0.25,
                                                "&:hover": {
                                                    bgcolor: tokens.brandBg,
                                                },
                                            }}
                                        >
                                            Manage
                                        </Button>
                                    </CardActions>
                                </Card>
                            </Grid>
                        );
                    })}

                    {orginizationList.length === 0 && (
                        <Grid size={12}>
                            <Paper
                                variant="outlined"
                                sx={{
                                    py: 7,
                                    px: 3,
                                    textAlign: "center",
                                    borderRadius: "4px",
                                    borderColor: tokens.border,
                                    bgcolor: tokens.cardBg,
                                }}
                            >
                                <Box
                                    sx={{
                                        width: 52,
                                        height: 52,
                                        mx: "auto",
                                        mb: 2,
                                        borderRadius: "4px",
                                        bgcolor: tokens.brandBg,
                                        color: tokens.brandMain,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}
                                >
                                    <BusinessIcon sx={{ fontSize: 28 }} />
                                </Box>
                                <Typography
                                    variant="h6"
                                    sx={{ fontWeight: 700, color: tokens.textPrimary, mb: 0.5 }}
                                >
                                    No organizations yet
                                </Typography>
                                <Typography
                                    variant="body2"
                                    sx={{
                                        color: tokens.textSecondary,
                                        mb: 2.5,
                                        maxWidth: 400,
                                        mx: "auto",
                                    }}
                                >
                                    Create your first organization workspace to start managing teams
                                    and projects.
                                </Typography>
                                <Button
                                    variant="contained"
                                    startIcon={<AddIcon />}
                                    onClick={handleCreateModelOpen}
                                    disableElevation
                                    sx={{
                                        bgcolor: tokens.brandMain,
                                        color: isDark ? "#1D2125" : "#FFFFFF",
                                        borderRadius: "3px",
                                        textTransform: "none",
                                        fontWeight: 600,
                                        "&:hover": { bgcolor: tokens.brandHover },
                                    }}
                                >
                                    Create organization
                                </Button>
                            </Paper>
                        </Grid>
                    )}
                </Grid>

                <NewOrginizationModel
                    open={createModelOpen}
                    handleClose={handleCreateModelClose}
                    onCreated={handleOrganizationCreated}
                />

                <ManageOrganizationModal
                    organization={managedOrg}
                    open={Boolean(managedOrg)}
                    handleClose={handleManageClose}
                    onUpdated={() => void fetchOrganizations()}
                />
            </Box>
        </Box>
    );
}