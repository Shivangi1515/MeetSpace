import * as React from "react";
import Avatar from "@mui/material/Avatar";
import Button from "@mui/material/Button";
import CssBaseline from "@mui/material/CssBaseline";
import TextField from "@mui/material/TextField";
import Paper from "@mui/material/Paper";
import Box from "@mui/material/Box";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { Snackbar } from "@mui/material";
import { AuthContext } from "../contexts/AuthContext";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";

const defaultTheme = createTheme();

export default function Authentication() {
    const [username, setUsername] = React.useState("");
    const [password, setPassword] = React.useState("");
    const [name, setName] = React.useState("");
    const [error, setError] = React.useState("");
    const [message, setMessage] = React.useState("");
    const [formState, setFormState] = React.useState(0); // 0 = Sign In, 1 = Sign Up
    const [open, setOpen] = React.useState(false);

    const { handleRegister, handleLogin } = React.useContext(AuthContext);

    const handleAuth = async () => {
        try {
            setError("");

            if (formState === 0) {
                await handleLogin(username, password);
            } else {
                const result = await handleRegister(name, username, password);
                setName("");
                setUsername("");
                setPassword("");
                setMessage(result);
                setOpen(true);
                setFormState(0);
            }
        } catch (err) {
            const msg = err?.response?.data?.message || "Something went wrong";
            setError(msg);
        }
    };

    return (
        <ThemeProvider theme={defaultTheme}>
            <CssBaseline />

            <Box sx={{ display: "flex", minHeight: "100vh", width: "100%" }}>
                {/* LEFT IMAGE */}
                <Box
                    sx={{
                        flex: 7,
                        display: { xs: "none", sm: "block" },
                        backgroundImage: 'url("/videocall.jpg")',
                        backgroundRepeat: "no-repeat",
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                        minHeight: "100vh",
                    }}
                />

                {/* RIGHT AUTH PANEL */}
                <Paper
                    elevation={6}
                    square
                    sx={{
                        flex: { xs: 1, sm: 5 },
                        minHeight: "100vh",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        px: 4,
                    }}
                >
                    <Box sx={{ width: "100%", maxWidth: "400px", textAlign: "center" }}>
                        <Avatar sx={{ m: "0 auto 12px", bgcolor: "secondary.main" }}>
                            <LockOutlinedIcon />
                        </Avatar>

                        <Box sx={{ display: "flex", justifyContent: "center", gap: 1, mb: 2 }}>
                            <Button
                                variant={formState === 0 ? "contained" : "outlined"}
                                onClick={() => {
                                    setFormState(0);
                                    setError("");
                                }}
                            >
                                Sign In
                            </Button>
                            <Button
                                variant={formState === 1 ? "contained" : "outlined"}
                                onClick={() => {
                                    setFormState(1);
                                    setError("");
                                }}
                            >
                                Sign Up
                            </Button>
                        </Box>

                        <Box component="form" noValidate>
                            {formState === 1 && (
                                <TextField
                                    margin="normal"
                                    required
                                    fullWidth
                                    label="Full Name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                />
                            )}

                            <TextField
                                margin="normal"
                                required
                                fullWidth
                                label="Username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                            />

                            <TextField
                                margin="normal"
                                required
                                fullWidth
                                label="Password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />

                            {formState === 0 && (
                                <FormControlLabel
                                    control={<Checkbox value="remember" color="primary" />}
                                    label="Remember me"
                                    sx={{ display: "flex", justifyContent: "flex-start", mt: 1 }}
                                />
                            )}

                            {error && (
                                <p style={{ color: "red", marginTop: "10px", textAlign: "left" }}>
                                    {error}
                                </p>
                            )}

                            <Button
                                type="button"
                                fullWidth
                                variant="contained"
                                sx={{ mt: 3, mb: 2, py: 1.2 }}
                                onClick={handleAuth}
                            >
                                {formState === 0 ? "Login" : "Register"}
                            </Button>
                        </Box>
                    </Box>
                </Paper>
            </Box>

            <Snackbar
                open={open}
                autoHideDuration={4000}
                onClose={() => setOpen(false)}
                message={message}
            />
        </ThemeProvider>
    );
}