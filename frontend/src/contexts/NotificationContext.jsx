import {
    createContext,
    useCallback,
    useContext,
    useState,
} from "react";

import {
    Snackbar,
    Alert,
    IconButton,
} from "@mui/material";

import CloseIcon from "@mui/icons-material/Close";

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {

    const [notification, setNotification] = useState({
        open: false,
        message: "",
        severity: "success",
    });

    const showNotification = useCallback((message, severity = "success") => {
        setNotification({
            open: true,
            message,
            severity,
        });
    }, []);

    const hideNotification = () => {
        setNotification((prev) => ({
            ...prev,
            open: false,
        }));
    };

    return (
        <NotificationContext.Provider value={{ showNotification }}>
            {children}

            <Snackbar
                open={notification.open}
                autoHideDuration={4000}
                onClose={hideNotification}
                anchorOrigin={{
                    vertical: "top",
                    horizontal: "right",
                }}
            >
                <Alert
                    onClose={hideNotification}
                    severity={notification.severity}
                    variant="filled"
                    sx={{
                        width: "100%",
                        minWidth: 280,
                        boxShadow: 3,
                    }}
                    action={
                        <IconButton
                            size="small"
                            color="inherit"
                            onClick={hideNotification}
                        >
                            <CloseIcon fontSize="small" />
                        </IconButton>
                    }
                >
                    {notification.message}
                </Alert>
            </Snackbar>

        </NotificationContext.Provider>
    );
};

export const useNotification = () => {
    const context = useContext(NotificationContext);

    if (!context) {
        throw new Error(
            "useNotification must be used within NotificationProvider"
        );
    }

    return context;
};