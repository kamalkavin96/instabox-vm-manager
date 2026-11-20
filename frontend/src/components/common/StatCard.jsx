import {
    Card,
    CardContent,
    Box,
    Typography,
} from "@mui/material";

export default function StatCard({
    title,
    value,
    subtitle,
    icon,
    color = "primary.main",
}) {
    return (
        <Card sx={{ height: "100%" }}>
            <CardContent>
                <Box
                    display="flex"
                    justifyContent="space-between"
                    alignItems="center"
                >
                    <Typography
                        color="text.secondary"
                        fontSize={14}
                    >
                        {title}
                    </Typography>

                    <Box
                        sx={{
                            color,
                            bgcolor: "action.hover",
                            p: 1,
                            borderRadius: 2,
                            display: "flex",
                        }}
                    >
                        {icon}
                    </Box>
                </Box>

                <Typography
                    variant="h4"
                    fontWeight={700}
                    sx={{ mt: 2 }}
                >
                    {value}
                </Typography>

                <Typography
                    variant="caption"
                    color="text.secondary"
                >
                    {subtitle}
                </Typography>
            </CardContent>
        </Card>
    );
}