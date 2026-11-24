import { useParams } from "react-router-dom";
import { Box } from "@mui/material";
import MachineTerminalTab from "../../machines/components/MachineTerminalTab";

const DEFAULT_TOKENS = {
    green: { text: "#34D399" },
    textSecondary: "#94A3B8",
};

const OUTLINE_BTN_SX = {
    textTransform: "none",
    fontWeight: 600,
    fontSize: "0.75rem",
    borderColor: "#334155",
    color: "#E2E8F0",
};

export default function StandaloneTerminalPage() {
    const { machineId } = useParams();

    return (
        <Box
            sx={{
                minHeight: "100vh",
                bgcolor: "#070A10",
                p: 1.5,
                display: "flex",
                flexDirection: "column",
            }}
        >
            <MachineTerminalTab
                machineId={machineId}
                tokens={DEFAULT_TOKENS}
                outlineBtnSx={OUTLINE_BTN_SX}
                terminalHeight={Math.max(630, window.innerHeight - 90)}
            />
        </Box>
    );
}