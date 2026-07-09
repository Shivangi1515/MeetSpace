import * as React from "react";
import Button from "@mui/material/Button";
import CssBaseline from "@mui/material/CssBaseline";
import TextField from "@mui/material/TextField";
import Paper from "@mui/material/Paper";
import Box from "@mui/material/Box";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { Snackbar, Typography, Checkbox, FormControlLabel, Fade, Divider, InputAdornment, IconButton } from "@mui/material";
import { AuthContext } from "../contexts/AuthContext";
import VideoCallIcon from '@mui/icons-material/VideoCall';
import KeyboardBackspaceIcon from '@mui/icons-material/KeyboardBackspace';
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { useNavigate } from "react-router-dom";
import { signInWithGoogle, auth, sendPasswordResetEmail } from "../utils/firebase";

const GoogleLogoIcon = (props) => (
    <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        style={{ marginRight: '8px' }}
        {...props}
    >
        <path
            fill="#4285F4"
            d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.927h6.6c-.29 1.53-1.14 2.82-2.4 3.68v3.053h3.89c2.27-2.09 3.65-5.17 3.65-8.83z"
        />
        <path
            fill="#34A853"
            d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.89-3.05c-1.08.72-2.45 1.16-4.04 1.16-3.11 0-5.74-2.11-6.68-4.96H1.21v3.15C3.18 21.88 7.31 24 12 24z"
        />
        <path
            fill="#FBBC05"
            d="M5.32 14.24c-.24-.72-.38-1.5-.38-2.3 0-.8.14-1.58.38-2.3V6.49H1.21C.44 8.04 0 9.77 0 11.6c0 1.83.44 3.56 1.21 5.11l4.11-3.21z"
        />
        <path
            fill="#EA4335"
            d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.93 1.19 15.22 0 12 0 7.31 0 3.18 2.12 1.21 5.31l4.11 3.21c.94-2.85 3.57-4.96 6.68-4.96z"
        />
    </svg>
);

const customTheme = createTheme({
    palette: {
        primary: {
            main: "#2f6feb",
            dark: "#1e5bc8",
        },
        secondary: {
            main: "#ff9839",
        },
        background: {
            default: "#f8fafc",
        }
    },
    typography: {
        fontFamily: "'Outfit', sans-serif",
    },
    components: {
        MuiButton: {
            styleOverrides: {
                root: {
                    borderRadius: "8px",
                    textTransform: "none",
                    fontWeight: 600,
                    padding: "10px 20px",
                }
            }
        },
        MuiTextField: {
            styleOverrides: {
                root: {
                    "& .MuiOutlinedInput-root": {
                        borderRadius: "8px",
                    }
                }
            }
        }
    }
});

export default function Authentication() {
    const [username, setUsername] = React.useState("");
    const [password, setPassword] = React.useState("");
    const [name, setName] = React.useState("");
    const [email, setEmail] = React.useState("");
    const [error, setError] = React.useState("");
    const [message, setMessage] = React.useState("");
    const [formState, setFormState] = React.useState(0); // 0 = Sign In, 1 = Sign Up, 2 = Forgot Password
    const [open, setOpen] = React.useState(false);
    const [showPassword, setShowPassword] = React.useState(false);
    const [errors, setErrors] = React.useState({});

    const { handleRegister, handleLogin, handleGoogleLogin } = React.useContext(AuthContext);
    const navigate = useNavigate();
    const validate = () => {
        let tempErrors = {};
        if (formState === 1) {
            // Sign Up validation
            if (!name.trim()) {
                tempErrors.name = "Full Name is required";
            } else if (name.trim().length < 3) {
                tempErrors.name = "Name must be at least 3 characters";
            }

            if (!email.trim()) {
                tempErrors.email = "Email Address is required";
            } else if (!/\S+@\S+\.\S+/.test(email)) {
                tempErrors.email = "Email Address is invalid";
            }

            if (!username.trim()) {
                tempErrors.username = "Username is required";
            } else if (username.trim().length < 3) {
                tempErrors.username = "Username must be at least 3 characters";
            }

            if (!password) {
                tempErrors.password = "Password is required";
            } else {
                if (password.length < 6) {
                    tempErrors.password = "Password must be at least 6 characters";
                }
                if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
                    tempErrors.password = tempErrors.password 
                        ? tempErrors.password + " and must contain at least one special character" 
                        : "Password must contain at least one special character (e.g. !@#$%^&*)";
                }
            }
        } else if (formState === 0) {
            // Sign In validation
            if (!username.trim()) {
                tempErrors.username = "Email Address or Username is required";
            }

            if (!password) {
                tempErrors.password = "Password is required";
            } else {
                if (password.length < 6) {
                    tempErrors.password = "Password must be at least 6 characters";
                }
                if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
                    tempErrors.password = tempErrors.password 
                        ? tempErrors.password + " and must contain at least one special character" 
                        : "Password must contain at least one special character (e.g. !@#$%^&*)";
                }
            }
        }
        setErrors(tempErrors);
        return Object.keys(tempErrors).length === 0;
    };

    const validateForgotPassword = () => {
        let tempErrors = {};
        if (!email.trim()) {
            tempErrors.email = "Email Address is required";
        } else if (!/\S+@\S+\.\S+/.test(email)) {
            tempErrors.email = "Email Address is invalid";
        }
        setErrors(tempErrors);
        return Object.keys(tempErrors).length === 0;
    };

    const handleAuth = async () => {
        if (!validate()) return;
        try {
            setError("");

            if (formState === 0) {
                await handleLogin(username, password);
            } else {
                const result = await handleRegister(name, username, password, email);
                setName("");
                setUsername("");
                setPassword("");
                setEmail("");
                setErrors({});
                setMessage(result);
                setOpen(true);
                setFormState(0);
            }
        } catch (err) {
            const msg = err?.response?.data?.message || err?.message || "Something went wrong";
            setError(msg);
        }
    };

    const handleForgotPasswordSubmit = async () => {
        if (!validateForgotPassword()) return;
        try {
            setError("");
            await sendPasswordResetEmail(auth, email);
            setMessage("Password reset email sent successfully! Please check your inbox.");
            setOpen(true);
            setEmail("");
            setErrors({});
            setFormState(0);
        } catch (err) {
            const msg = err?.message || "Failed to dispatch password reset email.";
            setError(msg);
        }
    };

    const handleGoogleAuth = async () => {
        try {
            setError("");
            const result = await signInWithGoogle();
            const token = await result.user.getIdToken();
            await handleGoogleLogin(token);
        } catch (err) {
            const msg = err?.response?.data?.message || err?.message || "Google authentication failed";
            setError(msg);
        }
    };

    return (
        <ThemeProvider theme={customTheme}>
            <CssBaseline />

            <Box sx={{ display: "flex", minHeight: "100vh", width: "100%", bgcolor: "background.default" }}>
                {/* LEFT HERO PANEL */}
                <Box
                    sx={{
                        flex: 7,
                        display: { xs: "none", md: "flex" },
                        flexDirection: "column",
                        justifyContent: "space-between",
                        p: 6,
                        color: "white",
                        position: "relative",
                        overflow: "hidden",
                        background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #2f6feb 100%)",
                        "&::before": {
                            content: '""',
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundImage: 'url("/videocall.jpg")',
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                            opacity: 0.15,
                            zIndex: 1
                        }
                    }}
                >
                    <Box sx={{ zIndex: 2, display: "flex", alignItems: "center", gap: 1, cursor: "pointer" }} onClick={() => navigate("/")}>
                        <VideoCallIcon sx={{ fontSize: 32, color: "secondary.main" }} />
                        <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: "-0.5px" }}>
                            MeetSpace
                        </Typography>
                    </Box>

                    <Box sx={{ zIndex: 2, maxWidth: 500 }}>
                        <Typography variant="h3" sx={{ fontWeight: 800, mb: 2, lineHeight: 1.2, letterSpacing: "-1px" }}>
                            Connect with your team, anywhere, anytime.
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 400, color: "rgba(255,255,255,0.7)" }}>
                            Experience crystal clear video quality, instant screen sharing, and secure real-time messaging.
                        </Typography>
                    </Box>

                    <Box sx={{ zIndex: 2 }}>
                        <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.5)" }}>
                            © {new Date().getFullYear()} MeetSpace Inc. All rights reserved.
                        </Typography>
                    </Box>
                </Box>

                {/* RIGHT AUTH FORM PANEL */}
                <Paper
                    elevation={0}
                    square
                    sx={{
                        flex: { xs: 1, md: 5 },
                        minHeight: "100vh",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                        alignItems: "center",
                        px: { xs: 3, sm: 6 },
                        py: 4,
                        bgcolor: "background.default",
                        borderLeft: "1px solid",
                        borderColor: "divider"
                    }}
                >
                    <Box sx={{ width: "100%", maxWidth: "420px" }}>
                        {/* Mobile Logo */}
                        <Box sx={{ display: { xs: "flex", md: "none" }, alignItems: "center", gap: 1, mb: 4, justifyContent: "center" }}>
                            <VideoCallIcon sx={{ fontSize: 28, color: "primary.main" }} />
                            <Typography variant="h6" sx={{ fontWeight: 800, color: "primary.main" }}>
                                MeetSpace
                            </Typography>
                        </Box>

                        {/* Back navigation */}
                        <Button 
                            startIcon={<KeyboardBackspaceIcon />} 
                            onClick={() => navigate("/")}
                            sx={{ color: "text.secondary", mb: 3, p: 0, minWidth: 0, "&:hover": { bgcolor: "transparent", color: "text.primary" } }}
                        >
                            Back to Home
                        </Button>

                        <Box sx={{ mb: 4 }}>
                            <Typography variant="h4" sx={{ fontWeight: 800, mb: 1, color: "text.primary", letterSpacing: "-0.5px" }}>
                                {formState === 2 ? "Reset Password" : "Welcome to MeetSpace"}
                            </Typography>
                            <Typography variant="body2" sx={{ color: "text.secondary" }}>
                                {formState === 0 
                                    ? "Sign in to access your meetings and history" 
                                    : formState === 1 
                                        ? "Create an account to start hosting meetings"
                                        : "Enter your registered email to receive a password reset link"}
                            </Typography>
                        </Box>

                        {/* TABS CONTROLS */}
                        {formState !== 2 && (
                            <Box sx={{ display: "flex", bgcolor: "rgba(0,0,0,0.03)", p: 0.5, borderRadius: "10px", mb: 3 }}>
                                <Button
                                    fullWidth
                                    variant={formState === 0 ? "contained" : "text"}
                                    onClick={() => {
                                        setFormState(0);
                                        setError("");
                                        setErrors({});
                                    }}
                                    sx={{
                                        bgcolor: formState === 0 ? "white" : "transparent",
                                        color: formState === 0 ? "primary.main" : "text.secondary",
                                        boxShadow: formState === 0 ? "0 4px 10px rgba(0,0,0,0.05)" : "none",
                                        "&:hover": { bgcolor: formState === 0 ? "white" : "rgba(0,0,0,0.05)" }
                                    }}
                                >
                                    Sign In
                                </Button>
                                <Button
                                    fullWidth
                                    variant={formState === 1 ? "contained" : "text"}
                                    onClick={() => {
                                        setFormState(1);
                                        setError("");
                                        setErrors({});
                                    }}
                                    sx={{
                                        bgcolor: formState === 1 ? "white" : "transparent",
                                        color: formState === 1 ? "primary.main" : "text.secondary",
                                        boxShadow: formState === 1 ? "0 4px 10px rgba(0,0,0,0.05)" : "none",
                                        "&:hover": { bgcolor: formState === 1 ? "white" : "rgba(0,0,0,0.05)" }
                                    }}
                                >
                                    Sign Up
                                </Button>
                            </Box>
                        )}

                        <Box component="form" noValidate>
                            {formState === 1 && (
                                <Fade in={formState === 1}>
                                    <TextField
                                        margin="normal"
                                        required
                                        fullWidth
                                        label="Full Name"
                                        value={name}
                                        onChange={(e) => {
                                            setName(e.target.value);
                                            if (errors.name) setErrors({ ...errors, name: "" });
                                        }}
                                        error={Boolean(errors.name)}
                                        helperText={errors.name}
                                        sx={{ mb: 1 }}
                                    />
                                </Fade>
                            )}

                            {(formState === 1 || formState === 2) && (
                                <TextField
                                    margin="normal"
                                    required
                                    fullWidth
                                    label="Email Address"
                                    type="email"
                                    value={email}
                                    onChange={(e) => {
                                        setEmail(e.target.value);
                                        if (errors.email) setErrors({ ...errors, email: "" });
                                    }}
                                    error={Boolean(errors.email)}
                                    helperText={errors.email}
                                    sx={{ mb: 1 }}
                                />
                            )}

                            {formState !== 2 && (
                                <>
                                    <TextField
                                        margin="normal"
                                        required
                                        fullWidth
                                        label={formState === 0 ? "Email Address" : "Username"}
                                        value={username}
                                        onChange={(e) => {
                                            setUsername(e.target.value);
                                            if (errors.username) setErrors({ ...errors, username: "" });
                                        }}
                                        error={Boolean(errors.username)}
                                        helperText={errors.username}
                                        sx={{ mb: 1 }}
                                    />

                                    <TextField
                                        margin="normal"
                                        required
                                        fullWidth
                                        label="Password"
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => {
                                            setPassword(e.target.value);
                                            if (errors.password) setErrors({ ...errors, password: "" });
                                        }}
                                        error={Boolean(errors.password)}
                                        helperText={errors.password}
                                        slotProps={{
                                            input: {
                                                endAdornment: (
                                                    <InputAdornment position="end">
                                                        <IconButton
                                                            aria-label="toggle password visibility"
                                                            onClick={() => setShowPassword(!showPassword)}
                                                            edge="end"
                                                        >
                                                            {showPassword ? <VisibilityOff /> : <Visibility />}
                                                        </IconButton>
                                                    </InputAdornment>
                                                )
                                            }
                                        }}
                                    />
                                </>
                            )}

                            {formState === 0 && (
                                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 1 }}>
                                    <FormControlLabel
                                        control={<Checkbox value="remember" color="primary" defaultChecked />}
                                        label="Remember me"
                                        sx={{ color: "text.secondary" }}
                                    />
                                    <Button 
                                        variant="text" 
                                        onClick={() => {
                                            setFormState(2);
                                            setError("");
                                            setErrors({});
                                        }}
                                        sx={{ textTransform: "none", fontWeight: 700, fontSize: "0.85rem" }}
                                    >
                                        Forgot Password?
                                    </Button>
                                </Box>
                            )}

                            {error && (
                                <Paper elevation={0} sx={{ mt: 2, p: 1.5, bgcolor: "error.light", borderRadius: "8px", opacity: 0.15 }}>
                                    <Typography variant="body2" sx={{ color: "error.dark", fontWeight: 500 }}>
                                        {error}
                                    </Typography>
                                </Paper>
                            )}
                            
                            {/* Visual tweak for error container to render properly */}
                            {error && !error.includes("light") && (
                                <Typography variant="body2" sx={{ color: "error.main", mt: 2, textAlign: "left", fontWeight: 500 }}>
                                    {error}
                                </Typography>
                            )}



                            <Button
                                type="button"
                                fullWidth
                                variant="contained"
                                sx={{ mt: 4, mb: 2, py: 1.4, fontSize: "1rem", boxShadow: "0 4px 12px rgba(47, 111, 235, 0.2)" }}
                                onClick={formState === 2 ? handleForgotPasswordSubmit : handleAuth}
                            >
                                {formState === 0 ? "Login" : formState === 1 ? "Register" : "Send Reset Link"}
                            </Button>

                            {formState === 2 && (
                                <Button
                                    fullWidth
                                    variant="text"
                                    onClick={() => {
                                        setFormState(0);
                                        setError("");
                                        setErrors({});
                                    }}
                                    sx={{ mt: 1, textTransform: "none", fontWeight: 700 }}
                                >
                                    Back to Sign In
                                </Button>
                            )}

                            {formState !== 2 && (
                                <>
                                    <Divider sx={{ my: 2.5, color: "text.secondary", fontSize: "0.85rem" }}>or</Divider>

                                    <Button
                                        fullWidth
                                        variant="outlined"
                                        startIcon={<GoogleLogoIcon />}
                                        onClick={handleGoogleAuth}
                                        sx={{ 
                                            py: 1.4, 
                                            fontSize: "1rem", 
                                            textTransform: "none",
                                            borderRadius: "8px",
                                            borderColor: "#cbd5e1",
                                            color: "#334155",
                                            fontWeight: 700,
                                            "&:hover": {
                                                bgcolor: "#f8fafc",
                                                borderColor: "#94a3b8"
                                            }
                                        }}
                                    >
                                        Continue with Google
                                    </Button>
                                </>
                            )}
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