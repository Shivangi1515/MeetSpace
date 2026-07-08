import React, { useContext, useState, useEffect } from 'react'
import withAuth from '../utils/withAuth'
import { useNavigate } from 'react-router-dom'
import "../App.css";
import { Button, IconButton, TextField, Box, Typography, Paper, Grid, Avatar, Tooltip, Divider, Card, CardContent, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import RestoreIcon from '@mui/icons-material/Restore';
import LogoutIcon from '@mui/icons-material/Logout';
import VideoCallIcon from '@mui/icons-material/VideoCall';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteIcon from '@mui/icons-material/Delete';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import { getAllRecordings, deleteRecording } from '../utils/recordingsDB';
import { AuthContext } from '../contexts/AuthContext';

function HomeComponent() {
    let navigate = useNavigate();
    const [meetingCode, setMeetingCode] = useState("");
    const [recentMeetings, setRecentMeetings] = useState([]);
    const [time, setTime] = useState(new Date());

    // Recordings and Player States
    const [recordings, setRecordings] = useState([]);
    const [playerOpen, setPlayerOpen] = useState(false);
    const [playUrl, setPlayUrl] = useState("");
    const [playTitle, setPlayTitle] = useState("");

    const { getHistoryOfUser, userData } = useContext(AuthContext);

    // Live clock
    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Load recent history (last 3)
    useEffect(() => {
        const loadRecentHistory = async () => {
            try {
                const history = await getHistoryOfUser();
                if (history && Array.isArray(history)) {
                    // Sort descending by date and take top 3
                    const sorted = [...history]
                        .sort((a, b) => new Date(b.date) - new Date(a.date))
                        .slice(0, 3);
                    setRecentMeetings(sorted);
                }
            } catch (err) {
                console.log("Could not load history for dashboard", err);
            }
        };
        loadRecentHistory();
    }, [getHistoryOfUser]);

    // Load local recordings on mount
    useEffect(() => {
        const loadRecordings = async () => {
            try {
                const recs = await getAllRecordings();
                if (recs && Array.isArray(recs)) {
                    recs.sort((a, b) => new Date(b.date) - new Date(a.date));
                    setRecordings(recs);
                }
            } catch (err) {
                console.error("Failed to load local video recordings", err);
            }
        };
        loadRecordings();
    }, []);

    const handlePlayVideo = (rec) => {
        const url = URL.createObjectURL(rec.blob);
        setPlayUrl(url);
        setPlayTitle(rec.meetingTitle);
        setPlayerOpen(true);
    };

    const handleClosePlayer = () => {
        setPlayerOpen(false);
        if (playUrl) {
            URL.revokeObjectURL(playUrl);
            setPlayUrl("");
        }
    };

    const handleDownloadVideo = (rec) => {
        const url = URL.createObjectURL(rec.blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `meetspace-recording-${rec.meetingCode}-${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleDeleteVideo = async (id) => {
        try {
            await deleteRecording(id);
            setRecordings(prev => prev.filter(r => r.id !== id));
        } catch (err) {
            console.error("Failed to delete recording", err);
        }
    };

    const formatDuration = (seconds) => {
        if (!seconds || seconds <= 0) return "0s";
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        if (mins === 0) return `${secs}s`;
        return `${mins}m ${secs}s`;
    };

    const handleJoinVideoCall = async () => {
        if (!meetingCode.trim()) return;
        navigate(`/${meetingCode}`);
    };

    const handleCreateNewMeeting = async () => {
        // Generate random abc-def-ghi code
        const chars = 'abcdefghijklmnopqrstuvwxyz';
        let code = '';
        for (let i = 0; i < 9; i++) {
            if (i === 3 || i === 6) code += '-';
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        navigate(`/${code}`);
    };

    const getInitials = (fullName) => {
        if (!fullName) return "U";
        return fullName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    };

    const formattedTime = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const formattedDate = time.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });

    return (
        <Box sx={{ minHeight: "100vh", bgcolor: "var(--bg-dashboard)" }}>
            {/* Header / Navbar */}
            <Box sx={{ 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "space-between", 
                px: 4, 
                height: 70, 
                bgcolor: "white", 
                borderBottom: "1px solid #e2e8f0",
                boxShadow: "0 1px 3px rgba(0,0,0,0.02)"
            }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <VideoCallIcon sx={{ color: "var(--primary)", fontSize: 32 }} />
                    <Typography variant="h5" sx={{ fontWeight: 800, color: "var(--primary)", letterSpacing: "-0.5px" }}>
                        MeetSpace
                    </Typography>
                </Box>

                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <Tooltip title="View Meeting History">
                        <IconButton onClick={() => navigate("/history")} sx={{ bgcolor: "#f1f5f9", "&:hover": { bgcolor: "#e2e8f0" } }}>
                            <RestoreIcon sx={{ color: "#475569" }} />
                        </IconButton>
                    </Tooltip>
                    
                    <Divider orientation="vertical" flexItem />

                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Avatar sx={{ bgcolor: "var(--primary)", fontWeight: 600, width: 40, height: 40 }}>
                            {getInitials(userData?.name)}
                        </Avatar>
                        <Box sx={{ display: { xs: "none", sm: "block" }, textAlign: "left" }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#0f172a", lineHeight: 1.2 }}>
                                {userData?.name || "Loading..."}
                            </Typography>
                            <Typography variant="caption" sx={{ color: "#64748b" }}>
                                @{userData?.username || "user"}
                            </Typography>
                        </Box>
                    </Box>

                    <Tooltip title="Logout">
                        <IconButton onClick={() => {
                            localStorage.removeItem("token");
                            navigate("/auth");
                        }} sx={{ color: "#ef4444", ml: 1 }}>
                            <LogoutIcon />
                        </IconButton>
                    </Tooltip>
                </Box>
            </Box>

            {/* Dashboard Container */}
            <Grid container spacing={4} sx={{ p: { xs: 3, md: 6 }, maxWidth: "1400px", margin: "0 auto" }}>
                {/* Left Side: Controls */}
                <Grid item xs={12} md={7} sx={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <Box sx={{ textAlign: "left" }}>
                        <Typography variant="h3" sx={{ fontWeight: 800, color: "#0f172a", mb: 1, letterSpacing: "-1px" }}>
                            Premium video meetings.
                        </Typography>
                        <Typography variant="h3" sx={{ fontWeight: 800, color: "var(--primary)", mb: 2, letterSpacing: "-1px" }}>
                            Now free for everyone.
                        </Typography>
                        <Typography variant="h6" sx={{ color: "#64748b", fontWeight: 400, maxWidth: "550px", mb: 2 }}>
                            Connect, collaborate, and celebrate from anywhere with MeetSpace. Simple, reliable, and secure.
                        </Typography>
                    </Box>

                    {/* Actions Card */}
                    <Paper elevation={0} sx={{ p: 4, borderRadius: "16px", border: "1px solid #e2e8f0", bgcolor: "white" }}>
                        <Grid container spacing={3}>
                            <Grid item xs={12} sm={6}>
                                <Button
                                    fullWidth
                                    variant="contained"
                                    size="large"
                                    onClick={handleCreateNewMeeting}
                                    startIcon={<VideoCallIcon />}
                                    sx={{ 
                                        height: "56px", 
                                        borderRadius: "10px", 
                                        bgcolor: "var(--primary)",
                                        fontSize: "1.05rem",
                                        boxShadow: "0 4px 14px rgba(47, 111, 235, 0.3)",
                                        "&:hover": { bgcolor: "var(--primary-hover)" }
                                    }}
                                >
                                    New Meeting
                                </Button>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Box sx={{ display: "flex", gap: 1 }}>
                                    <TextField
                                        fullWidth
                                        variant="outlined"
                                        placeholder="Enter meeting code"
                                        value={meetingCode}
                                        onChange={(e) => setMeetingCode(e.target.value)}
                                        slotProps={{
                                            input: {
                                                startAdornment: <KeyboardIcon sx={{ color: "#94a3b8", mr: 1 }} />
                                            }
                                        }}
                                        sx={{ 
                                            "& .MuiOutlinedInput-root": { 
                                                borderRadius: "10px", 
                                                height: "56px" 
                                            } 
                                        }}
                                    />
                                    <Button
                                        variant="text"
                                        onClick={handleJoinVideoCall}
                                        disabled={!meetingCode.trim()}
                                        sx={{ 
                                            fontWeight: 700, 
                                            px: 3, 
                                            borderRadius: "10px",
                                            color: "var(--primary)",
                                            "&.Mui-disabled": { color: "#94a3b8" }
                                        }}
                                    >
                                        Join
                                    </Button>
                                </Box>
                            </Grid>
                        </Grid>
                    </Paper>

                    <Divider />

                    {/* Recent Meetings */}
                    <Box sx={{ textAlign: "left" }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#1e293b", mb: 2 }}>
                            Rejoin Recent Meetings
                        </Typography>
                        {recentMeetings.length > 0 ? (
                            <Grid container spacing={2}>
                                {recentMeetings.map((meet, idx) => (
                                    <Grid item xs={12} sm={4} key={idx}>
                                        <Card 
                                            variant="outlined" 
                                            onClick={() => navigate(`/${meet.meetingCode}`)}
                                            sx={{ 
                                                borderRadius: "12px", 
                                                cursor: "pointer", 
                                                transition: "all 0.2s",
                                                "&:hover": { 
                                                    borderColor: "var(--primary)", 
                                                    transform: "translateY(-2px)",
                                                    boxShadow: "0 4px 12px rgba(0,0,0,0.04)"
                                                }
                                            }}
                                        >
                                            <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                                                <Typography variant="body2" sx={{ fontWeight: 700, color: "#0f172a", mb: 0.5 }}>
                                                    {meet.meetingCode}
                                                </Typography>
                                                <Typography variant="caption" sx={{ color: "#64748b" }}>
                                                    {new Date(meet.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                                </Typography>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                ))}
                            </Grid>
                        ) : (
                            <Typography variant="body2" sx={{ color: "#94a3b8", fontStyle: "italic" }}>
                                No recent activity found. Start a meeting to see it here!
                            </Typography>
                        )}
                    </Box>
                </Grid>

                {/* Right Side: Clock Widget & Recorded Sessions */}
                <Grid item xs={12} md={5} sx={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
                    <Paper 
                        elevation={0}
                        sx={{ 
                            p: 5, 
                            borderRadius: "24px", 
                            border: "1px solid #e2e8f0", 
                            width: "100%", 
                            maxWidth: "440px",
                            height: "300px",
                            display: "flex", 
                            flexDirection: "column", 
                            justifyContent: "center", 
                            alignItems: "center",
                            background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
                            color: "white",
                            boxShadow: "0 20px 40px rgba(15, 23, 42, 0.15)"
                        }}
                    >
                        <Typography variant="h2" sx={{ fontWeight: 800, mb: 1, letterSpacing: "-1px", fontFamily: "var(--font-sans)" }}>
                            {formattedTime}
                        </Typography>
                        <Typography variant="h6" sx={{ color: "#94a3b8", mb: 4, fontWeight: 500 }}>
                            {formattedDate}
                        </Typography>
                        <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.6)", textAlign: "center", maxWidth: "280px" }}>
                            Enjoy secure, crystal clear audio and video connections with MeetSpace.
                        </Typography>
                    </Paper>

                    {/* Recordings Panel */}
                    <Paper 
                        elevation={0}
                        sx={{ 
                            p: 4, 
                            borderRadius: "24px", 
                            border: "1px solid #e2e8f0", 
                            width: "100%", 
                            maxWidth: "440px",
                            bgcolor: "white",
                            textAlign: "left",
                            boxShadow: "0 4px 20px rgba(0,0,0,0.02)"
                        }}
                    >
                        <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#0f172a", mb: 2.5, display: "flex", alignItems: "center", gap: 1 }}>
                            <FiberManualRecordIcon sx={{ color: "var(--danger)", fontSize: 16 }} /> Recorded Meetings
                        </Typography>
                        
                        {recordings.length > 0 ? (
                            <Box sx={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: "320px", overflowY: "auto", pr: 0.5 }}>
                                {recordings.map((rec) => (
                                    <Box 
                                        key={rec.id}
                                        sx={{ 
                                            p: 2, 
                                            borderRadius: "12px", 
                                            border: "1px solid #e2e8f0",
                                            bgcolor: "#f8fafc",
                                            transition: "border-color 0.2s",
                                            "&:hover": { borderColor: "var(--primary)" }
                                        }}
                                    >
                                        <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#1e293b", mb: 0.5 }}>
                                            {rec.meetingTitle}
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: "#64748b", display: "block", mb: 1.5 }}>
                                            Code: {rec.meetingCode} • {new Date(rec.date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </Typography>
                                        
                                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <Typography variant="caption" sx={{ color: "var(--primary)", fontWeight: 700, bgcolor: "var(--primary-light)", px: 1, py: 0.2, borderRadius: "4px" }}>
                                                {formatDuration(rec.duration)}
                                            </Typography>
                                            <Box sx={{ display: "flex", gap: 0.5 }}>
                                                <Tooltip title="Play Recording">
                                                    <IconButton size="small" onClick={() => handlePlayVideo(rec)} sx={{ color: "var(--primary)" }}>
                                                        <PlayArrowIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Download Video">
                                                    <IconButton size="small" onClick={() => handleDownloadVideo(rec)} sx={{ color: "#10b981" }}>
                                                        <DownloadIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Delete">
                                                    <IconButton size="small" onClick={() => handleDeleteVideo(rec.id)} sx={{ color: "#ff4a5a" }}>
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </Box>
                                        </Box>
                                    </Box>
                                ))}
                            </Box>
                        ) : (
                            <Box sx={{ py: 3, textAlign: "center", color: "#94a3b8" }}>
                                <VideoLibraryIcon sx={{ fontSize: 44, color: "#cbd5e1", mb: 1.5 }} />
                                <Typography variant="body2" sx={{ fontWeight: 700, color: "#475569" }}>No recordings yet</Typography>
                                <Typography variant="caption" sx={{ display: "block", mt: 0.5, color: "#64748b" }}>Recordings made in your calls will appear here.</Typography>
                            </Box>
                        )}
                    </Paper>
                </Grid>
            </Grid>

            {/* VIDEO PLAYER DIALOG */}
            <Dialog 
                open={playerOpen} 
                onClose={handleClosePlayer} 
                maxWidth="md"
                fullWidth
                PaperProps={{ sx: { borderRadius: "16px", p: 1 } }}
            >
                <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>{playTitle || "Play Meeting Recording"}</DialogTitle>
                <DialogContent sx={{ p: 2 }}>
                    {playUrl && (
                        <video 
                            src={playUrl} 
                            controls 
                            autoPlay
                            style={{ width: "100%", borderRadius: "8px", background: "black", display: "block" }}
                        />
                    )}
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={handleClosePlayer} variant="contained" sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 700, bgcolor: "var(--primary)" }}>
                        Close Player
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

export default withAuth(HomeComponent)