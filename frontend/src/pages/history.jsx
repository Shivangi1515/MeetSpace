import React, { useContext, useEffect, useState, useMemo } from 'react'
import { AuthContext } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom';
import { 
    Card, Box, CardContent, Button, Typography, IconButton, Grid, Paper, 
    Tooltip, Snackbar, Avatar, TextField, InputAdornment, MenuItem, Select, 
    FormControl, InputLabel, Dialog, DialogTitle, DialogContent, DialogActions, 
    Divider, Chip, Stack 
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import VideoCallIcon from '@mui/icons-material/VideoCall';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import SearchIcon from '@mui/icons-material/Search';
import DeleteIcon from '@mui/icons-material/Delete';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import PeopleOutlinedIcon from '@mui/icons-material/PeopleOutlined';
import ChatBubbleOutlinedIcon from '@mui/icons-material/ChatBubbleOutlined';
import InfoIcon from '@mui/icons-material/Info';
import AssessmentIcon from '@mui/icons-material/Assessment';
import TimerIcon from '@mui/icons-material/Timer';
import HistoryIcon from '@mui/icons-material/History';
import LaunchIcon from '@mui/icons-material/Launch';

export default function History() {
    const { getHistoryOfUser, deleteMeetingFromHistory } = useContext(AuthContext);
    const [meetings, setMeetings] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeFilter, setActiveFilter] = useState("all"); // "all", "today", "week", "month"
    const [sortBy, setSortBy] = useState("newest"); // "newest", "oldest", "duration", "participants"
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState("");
    const routeTo = useNavigate();

    // Details Modal State
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [selectedMeetingDetails, setSelectedMeetingDetails] = useState(null);

    // Delete confirmation dialog state
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [selectedMeetingToDelete, setSelectedMeetingToDelete] = useState(null);

    // Pinned meetings state (local persistent)
    const [pinnedCodes, setPinnedCodes] = useState(() => {
        try {
            const saved = localStorage.getItem("meetspace_pinned_meetings");
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const history = await getHistoryOfUser();
                if (history && Array.isArray(history)) {
                    // Sort by date descending initially
                    const sorted = [...history].sort((a, b) => new Date(b.date) - new Date(a.date));
                    setMeetings(sorted);
                }
            } catch (err) {
                console.error("Failed to load history", err);
            }
        }
        fetchHistory();
    }, [getHistoryOfUser]);

    const handleCopyCode = (code, e) => {
        if (e) e.stopPropagation();
        navigator.clipboard.writeText(code);
        setSnackbarMessage(`Meeting code "${code}" copied to clipboard!`);
        setSnackbarOpen(true);
    };

    const handleCopyInviteLink = (code, e) => {
        if (e) e.stopPropagation();
        const link = `${window.location.origin}/${code}`;
        navigator.clipboard.writeText(link);
        setSnackbarMessage("Invite link copied to clipboard!");
        setSnackbarOpen(true);
    };

    const handleTogglePin = (code, e) => {
        if (e) e.stopPropagation();
        let updated;
        if (pinnedCodes.includes(code)) {
            updated = pinnedCodes.filter(c => c !== code);
            setSnackbarMessage("Meeting unpinned");
        } else {
            updated = [...pinnedCodes, code];
            setSnackbarMessage("Meeting pinned to the top!");
        }
        setPinnedCodes(updated);
        localStorage.setItem("meetspace_pinned_meetings", JSON.stringify(updated));
        setSnackbarOpen(true);
    };

    const handleOpenDeleteConfirm = (meeting, e) => {
        if (e) e.stopPropagation();
        setSelectedMeetingToDelete(meeting);
        setDeleteConfirmOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!selectedMeetingToDelete) return;
        try {
            if (deleteMeetingFromHistory) {
                await deleteMeetingFromHistory(selectedMeetingToDelete._id);
                setMeetings(prev => prev.filter(m => m._id !== selectedMeetingToDelete._id));
                setSnackbarMessage("Meeting record deleted successfully");
                setSnackbarOpen(true);
            }
        } catch (err) {
            console.error("Failed to delete meeting", err);
            setSnackbarMessage("Failed to delete meeting from history");
            setSnackbarOpen(true);
        } finally {
            setDeleteConfirmOpen(false);
            setSelectedMeetingToDelete(null);
        }
    };

    const handleOpenDetails = (meeting, e) => {
        if (e) e.stopPropagation();
        setSelectedMeetingDetails(meeting);
        setDetailsOpen(true);
    };

    // Date & Time Helpers
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    }

    const formatTime = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    const getRelativeTime = (dateString) => {
        const now = new Date();
        const date = new Date(dateString);
        const diffMs = now - date;
        const diffSecs = Math.floor(diffMs / 1000);
        const diffMins = Math.floor(diffSecs / 60);
        const diffHrs = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHrs / 24);

        if (diffSecs < 60) return "Just now";
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHrs < 24) return `${diffHrs}h ago`;
        if (diffDays === 1) return "Yesterday";
        if (diffDays < 7) return `${diffDays} days ago`;
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    const formatDuration = (seconds) => {
        if (!seconds || seconds <= 0) return "0s (Just joined)";
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        if (mins === 0) return `${secs}s`;
        return `${mins}m ${secs}s`;
    };

    const getAvatarColor = (title) => {
        const colors = ["#2f6feb", "#10b981", "#ff4a5a", "#8b5cf6", "#f59e0b", "#ec4899"];
        const charCodeSum = (title || "").split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return colors[charCodeSum % colors.length];
    };

    // Calculate Analytics
    const analytics = useMemo(() => {
        const total = meetings.length;
        
        const now = new Date();
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const thisWeek = meetings.filter(m => new Date(m.date) >= oneWeekAgo).length;

        const meetingsWithDuration = meetings.filter(m => m.duration && m.duration > 0);
        const totalDuration = meetingsWithDuration.reduce((acc, m) => acc + m.duration, 0);
        const avgDuration = meetingsWithDuration.length > 0 
            ? Math.round(totalDuration / meetingsWithDuration.length)
            : 0;

        let activeCode = "N/A";
        if (meetings.length > 0) {
            const sortedByParticipants = [...meetings].sort((a, b) => (b.participantsCount || 0) - (a.participantsCount || 0));
            if (sortedByParticipants[0] && (sortedByParticipants[0].participantsCount || 0) > 1) {
                activeCode = sortedByParticipants[0].meetingCode;
            } else {
                activeCode = meetings[0].meetingCode;
            }
        }

        return { total, thisWeek, avgDuration, activeCode };
    }, [meetings]);

    // Filtered & Sorted Meetings
    const filteredMeetings = useMemo(() => {
        let result = [...meetings];

        // 1. Search Query Filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(m => 
                m.meetingCode.toLowerCase().includes(query) || 
                (m.meetingTitle && m.meetingTitle.toLowerCase().includes(query))
            );
        }

        // 2. Recency Date Filter
        const now = new Date();
        if (activeFilter === "today") {
            result = result.filter(m => {
                const date = new Date(m.date);
                return date.toDateString() === now.toDateString();
            });
        } else if (activeFilter === "week") {
            const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            result = result.filter(m => new Date(m.date) >= oneWeekAgo);
        } else if (activeFilter === "month") {
            const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            result = result.filter(m => new Date(m.date) >= oneMonthAgo);
        }

        // 3. Sort by Pin first, then sort by criteria
        result.sort((a, b) => {
            const aPinned = pinnedCodes.includes(a.meetingCode);
            const bPinned = pinnedCodes.includes(b.meetingCode);
            if (aPinned && !bPinned) return -1;
            if (!aPinned && bPinned) return 1;

            if (sortBy === "newest") {
                return new Date(b.date) - new Date(a.date);
            }
            if (sortBy === "oldest") {
                return new Date(a.date) - new Date(b.date);
            }
            if (sortBy === "duration") {
                return (b.duration || 0) - (a.duration || 0);
            }
            if (sortBy === "participants") {
                return (b.participantsCount || 0) - (a.participantsCount || 0);
            }
            return 0;
        });

        return result;
    }, [meetings, searchQuery, activeFilter, sortBy, pinnedCodes]);

    return (
        <Box sx={{ minHeight: "100vh", bgcolor: "var(--bg-dashboard)", pb: 8 }}>
            {/* Header / Navbar */}
            <Box sx={{ 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "space-between", 
                px: 4, 
                height: 70, 
                bgcolor: "white", 
                borderBottom: "1px solid #e2e8f0",
                boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                mb: 4
            }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <IconButton onClick={() => routeTo("/home")} sx={{ bgcolor: "#f1f5f9", "&:hover": { bgcolor: "#e2e8f0" } }}>
                        <ArrowBackIcon sx={{ color: "#475569" }} />
                    </IconButton>
                    <Typography variant="h6" sx={{ fontWeight: 800, color: "#0f172a", display: "flex", alignItems: "center", gap: 1 }}>
                        <HistoryIcon sx={{ color: "var(--primary)" }} /> Meeting Records
                    </Typography>
                </Box>
                <Typography variant="body2" sx={{ color: "#64748b", fontWeight: 600 }}>
                    {meetings.length} meeting{meetings.length !== 1 ? 's' : ''} total
                </Typography>
            </Box>

            {/* Content Container */}
            <Box sx={{ maxWidth: "1200px", margin: "0 auto", px: 3 }}>
                {meetings.length > 0 && (
                    <>
                        {/* Analytics summary dashboard */}
                        <Grid container spacing={3} sx={{ mb: 4 }}>
                            <Grid item xs={12} sm={6} md={3}>
                                <Paper variant="outlined" sx={{ p: 2.5, borderRadius: "16px", display: "flex", alignItems: "center", gap: 2, bgcolor: "white" }}>
                                    <Avatar sx={{ bgcolor: "rgba(47, 111, 235, 0.1)", color: "var(--primary)", borderRadius: "12px", width: 48, height: 48 }}>
                                        <HistoryIcon />
                                    </Avatar>
                                    <Box>
                                        <Typography variant="caption" sx={{ color: "var(--text-muted)", fontWeight: 600, display: "block" }}>Total Meetings</Typography>
                                        <Typography variant="h5" sx={{ fontWeight: 800, color: "var(--text-main)" }}>{analytics.total}</Typography>
                                    </Box>
                                </Paper>
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                                <Paper variant="outlined" sx={{ p: 2.5, borderRadius: "16px", display: "flex", alignItems: "center", gap: 2, bgcolor: "white" }}>
                                    <Avatar sx={{ bgcolor: "rgba(16, 185, 129, 0.1)", color: "#10b981", borderRadius: "12px", width: 48, height: 48 }}>
                                        <CalendarTodayIcon />
                                    </Avatar>
                                    <Box>
                                        <Typography variant="caption" sx={{ color: "var(--text-muted)", fontWeight: 600, display: "block" }}>Meetings This Week</Typography>
                                        <Typography variant="h5" sx={{ fontWeight: 800, color: "var(--text-main)" }}>{analytics.thisWeek}</Typography>
                                    </Box>
                                </Paper>
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                                <Paper variant="outlined" sx={{ p: 2.5, borderRadius: "16px", display: "flex", alignItems: "center", gap: 2, bgcolor: "white" }}>
                                    <Avatar sx={{ bgcolor: "rgba(139, 92, 246, 0.1)", color: "#8b5cf6", borderRadius: "12px", width: 48, height: 48 }}>
                                        <TimerIcon />
                                    </Avatar>
                                    <Box>
                                        <Typography variant="caption" sx={{ color: "var(--text-muted)", fontWeight: 600, display: "block" }}>Avg. Duration</Typography>
                                        <Typography variant="h5" sx={{ fontWeight: 800, color: "var(--text-main)" }}>{formatDuration(analytics.avgDuration)}</Typography>
                                    </Box>
                                </Paper>
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                                <Paper variant="outlined" sx={{ p: 2.5, borderRadius: "16px", display: "flex", alignItems: "center", gap: 2, bgcolor: "white" }}>
                                    <Avatar sx={{ bgcolor: "rgba(245, 158, 11, 0.1)", color: "#f59e0b", borderRadius: "12px", width: 48, height: 48 }}>
                                        <AssessmentIcon />
                                    </Avatar>
                                    <Box>
                                        <Typography variant="caption" sx={{ color: "var(--text-muted)", fontWeight: 600, display: "block" }}>Most Active Call</Typography>
                                        <Typography variant="h5" sx={{ fontWeight: 800, color: "var(--text-main)", fontSize: "1.1rem", mt: 0.5, fontFamily: "monospace" }}>{analytics.activeCode}</Typography>
                                    </Box>
                                </Paper>
                            </Grid>
                        </Grid>

                        {/* Search, Filter & Sort Row */}
                        <Paper variant="outlined" sx={{ p: 2, borderRadius: "16px", mb: 4, display: "flex", flexDirection: { xs: "column", md: "row" }, gap: 2.5, alignItems: "center", bgcolor: "white" }}>
                            {/* Search field */}
                            <TextField 
                                variant="outlined" 
                                size="small"
                                placeholder="Search by code or title..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                slotProps={{
                                    input: {
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <SearchIcon fontSize="small" sx={{ color: "#94a3b8" }} />
                                            </InputAdornment>
                                        ),
                                    }
                                }}
                                sx={{ flex: 1, width: "100%", "& .MuiOutlinedInput-root": { borderRadius: "10px" } }}
                            />

                            {/* Filter Chips */}
                            <Stack direction="row" spacing={1} sx={{ width: { xs: "100%", md: "auto" }, overflowX: "auto" }}>
                                {[
                                    { key: "all", label: "All Time" },
                                    { key: "today", label: "Today" },
                                    { key: "week", label: "This Week" },
                                    { key: "month", label: "This Month" }
                                ].map((item) => (
                                    <Chip 
                                        key={item.key}
                                        label={item.label}
                                        clickable
                                        color={activeFilter === item.key ? "primary" : "default"}
                                        variant={activeFilter === item.key ? "filled" : "outlined"}
                                        onClick={() => setActiveFilter(item.key)}
                                        sx={{ fontWeight: 600, borderRadius: "8px" }}
                                    />
                                ))}
                            </Stack>

                            {/* Sort Dropdown */}
                            <FormControl size="small" sx={{ minWidth: 160, width: { xs: "100%", md: "auto" } }}>
                                <InputLabel id="sort-label">Sort By</InputLabel>
                                <Select
                                    labelId="sort-label"
                                    value={sortBy}
                                    label="Sort By"
                                    onChange={(e) => setSortBy(e.target.value)}
                                    sx={{ borderRadius: "10px" }}
                                >
                                    <MenuItem value="newest">Newest First</MenuItem>
                                    <MenuItem value="oldest">Oldest First</MenuItem>
                                    <MenuItem value="duration">Longest Duration</MenuItem>
                                    <MenuItem value="participants">Most Participants</MenuItem>
                                </Select>
                            </FormControl>
                        </Paper>
                    </>
                )}

                {/* Main cards list */}
                {filteredMeetings.length > 0 ? (
                    <Grid container spacing={3}>
                        {filteredMeetings.map((e, i) => {
                            const isPinned = pinnedCodes.includes(e.meetingCode);
                            const avatarColor = getAvatarColor(e.meetingTitle || "MeetSpace Call");

                            return (
                                <Grid item xs={12} sm={6} md={4} key={e._id || i}>
                                    <Card 
                                        variant="outlined"
                                        onClick={(event) => handleOpenDetails(e, event)}
                                        sx={{ 
                                            position: "relative",
                                            borderRadius: "16px", 
                                            border: isPinned ? "2px solid var(--primary)" : "1px solid #e2e8f0",
                                            bgcolor: "white",
                                            cursor: "pointer",
                                            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                                            boxShadow: isPinned 
                                                ? "0 4px 20px -5px rgba(47, 111, 235, 0.15)"
                                                : "0 1px 3px rgba(0,0,0,0.01)",
                                            "&:hover": { 
                                                transform: "translateY(-4px)",
                                                boxShadow: "0 12px 25px -10px rgba(0, 0, 0, 0.1)",
                                                borderColor: "var(--primary)"
                                            }
                                        }}
                                    >
                                        <CardContent sx={{ p: 3 }}>
                                            {/* Header */}
                                            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2.5 }}>
                                                <Avatar sx={{ bgcolor: avatarColor, color: "white", width: 44, height: 44, borderRadius: "10px", fontWeight: 700 }}>
                                                    {(e.meetingTitle || "M")[0]}
                                                </Avatar>
                                                
                                                <Box sx={{ display: "flex", gap: 0.5 }}>
                                                    <Tooltip title={isPinned ? "Unpin meeting" : "Pin to top"}>
                                                        <IconButton 
                                                            onClick={(event) => handleTogglePin(e.meetingCode, event)} 
                                                            size="small" 
                                                            sx={{ color: isPinned ? "#eab308" : "#94a3b8" }}
                                                        >
                                                            {isPinned ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
                                                        </IconButton>
                                                    </Tooltip>

                                                    <Tooltip title="Delete record">
                                                        <IconButton 
                                                            onClick={(event) => handleOpenDeleteConfirm(e, event)} 
                                                            size="small" 
                                                            sx={{ color: "#94a3b8", "&:hover": { color: "var(--danger)" } }}
                                                        >
                                                            <DeleteIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                </Box>
                                            </Box>

                                            {/* Details Info */}
                                            <Box sx={{ textAlign: "left", mb: 3 }}>
                                                <Typography variant="h6" sx={{ fontWeight: 800, color: "#0f172a", fontSize: "1.1rem", lineHeight: 1.3, mb: 0.5 }}>
                                                    {e.meetingTitle || "MeetSpace Call"}
                                                </Typography>
                                                <Tooltip title="Click to copy code">
                                                    <Typography 
                                                        variant="caption" 
                                                        onClick={(event) => handleCopyCode(e.meetingCode, event)}
                                                        sx={{ 
                                                            color: "var(--primary)", 
                                                            fontWeight: 700, 
                                                            fontFamily: "monospace", 
                                                            display: "inline-block", 
                                                            bgcolor: "var(--primary-light)", 
                                                            px: 1, 
                                                            py: 0.2, 
                                                            borderRadius: "4px", 
                                                            mb: 2,
                                                            cursor: "pointer",
                                                            transition: "all 0.2s",
                                                            "&:hover": {
                                                                bgcolor: "var(--primary)",
                                                                color: "white"
                                                            }
                                                        }}
                                                    >
                                                        {e.meetingCode}
                                                    </Typography>
                                                </Tooltip>

                                                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.2, borderTop: "1px solid #f1f5f9", pt: 1.5 }}>
                                                    <Box sx={{ display: "flex", justifySpace: "between", alignItems: "center", gap: 1 }}>
                                                        <CalendarTodayIcon sx={{ fontSize: 15, color: "#94a3b8" }} />
                                                        <Typography variant="body2" sx={{ color: "#475569", fontWeight: 500 }}>
                                                            {formatDate(e.date)}
                                                        </Typography>
                                                        <Typography variant="caption" sx={{ marginLeft: "auto", color: "var(--primary)", fontWeight: 700 }}>
                                                            {getRelativeTime(e.date)}
                                                        </Typography>
                                                    </Box>
                                                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                                        <AccessTimeIcon sx={{ fontSize: 15, color: "#94a3b8" }} />
                                                        <Typography variant="body2" sx={{ color: "#475569", fontWeight: 500 }}>
                                                            {formatTime(e.date)}
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                            </Box>

                                            {/* Summary Stats Row */}
                                            <Grid container spacing={1} sx={{ bgcolor: "#f8fafc", p: 1, borderRadius: "8px", mb: 2.5 }}>
                                                <Grid item xs={4} sx={{ textAlign: "center" }}>
                                                    <Typography variant="caption" sx={{ color: "#94a3b8", display: "block" }}>Duration</Typography>
                                                    <Typography variant="body2" sx={{ fontWeight: 700, color: "#334155" }}>
                                                        {e.duration ? `${Math.ceil(e.duration / 60)}m` : "0m"}
                                                    </Typography>
                                                </Grid>
                                                <Grid item xs={4} sx={{ textAlign: "center", borderLeft: "1px solid #e2e8f0" }}>
                                                    <Typography variant="caption" sx={{ color: "#94a3b8", display: "block" }}>Peers</Typography>
                                                    <Typography variant="body2" sx={{ fontWeight: 700, color: "#334155" }}>
                                                        {e.participantsCount || 1}
                                                    </Typography>
                                                </Grid>
                                                <Grid item xs={4} sx={{ textAlign: "center", borderLeft: "1px solid #e2e8f0" }}>
                                                    <Typography variant="caption" sx={{ color: "#94a3b8", display: "block" }}>Chats</Typography>
                                                    <Typography variant="body2" sx={{ fontWeight: 700, color: "#334155" }}>
                                                        {e.chatCount || 0}
                                                    </Typography>
                                                </Grid>
                                            </Grid>

                                            {/* CTA Buttons */}
                                            <Box sx={{ display: "flex", gap: 1 }}>
                                                <Button
                                                    fullWidth
                                                    variant="contained"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        routeTo(`/${e.meetingCode}`);
                                                    }}
                                                    sx={{ 
                                                        borderRadius: "8px", 
                                                        fontWeight: 700, 
                                                        bgcolor: "var(--primary)",
                                                        boxShadow: "none",
                                                        textTransform: "none",
                                                        "&:hover": {
                                                            bgcolor: "var(--primary-hover)",
                                                            boxShadow: "none"
                                                        }
                                                    }}
                                                >
                                                    Rejoin
                                                </Button>
                                                <Tooltip title="View Info">
                                                    <IconButton 
                                                        onClick={(event) => handleOpenDetails(e, event)}
                                                        variant="outlined" 
                                                        sx={{ border: "1px solid #cbd5e1", borderRadius: "8px", color: "#64748b" }}
                                                    >
                                                        <InfoIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </Box>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            );
                        })}
                    </Grid>
                ) : (
                    <Paper 
                        variant="outlined" 
                        sx={{ 
                            p: 6, 
                            borderRadius: "24px", 
                            textAlign: "center", 
                            maxWidth: "500px", 
                            margin: "4rem auto 0",
                            bgcolor: "white",
                            border: "1px solid #e2e8f0",
                            boxShadow: "0 10px 35px -15px rgba(0,0,0,0.05)"
                        }}
                    >
                        <VideoCallIcon sx={{ fontSize: 64, color: "var(--primary-light)", mb: 2 }} />
                        <Typography variant="h5" sx={{ fontWeight: 800, color: "#0f172a", mb: 1 }}>
                            No Meetings Found
                        </Typography>
                        <Typography variant="body2" sx={{ color: "#64748b", mb: 4, px: 2 }}>
                            {meetings.length === 0 
                                ? "You haven't recorded any meetings yet. Join a video call from your dashboard to display records here."
                                : "No meetings match your active search queries or filters. Try adjusting the search query."
                            }
                        </Typography>
                        <Button 
                            variant="contained" 
                            onClick={() => routeTo("/home")}
                            sx={{ borderRadius: "10px", fontWeight: 700, px: 4, py: 1.2, textTransform: "none" }}
                        >
                            Go to Dashboard
                        </Button>
                    </Paper>
                )}
            </Box>

            {/* MEETING DETAILS DIALOG */}
            {selectedMeetingDetails && (
                <Dialog 
                    open={detailsOpen} 
                    onClose={() => setDetailsOpen(false)}
                    PaperProps={{ sx: { borderRadius: "16px", p: 1.5, maxWidth: "440px", width: "100%" } }}
                >
                    <DialogTitle sx={{ fontWeight: 800, pb: 1, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "1.2rem" }}>Meeting Details</span>
                        <Chip 
                            label={getRelativeTime(selectedMeetingDetails.date)} 
                            size="small" 
                            color="primary" 
                            sx={{ fontWeight: 700, fontSize: "0.75rem" }} 
                        />
                    </DialogTitle>
                    <DialogContent>
                        <Box sx={{ mb: 3 }}>
                            <Typography variant="h6" sx={{ fontWeight: 800, color: "var(--text-main)" }}>
                                {selectedMeetingDetails.meetingTitle || "MeetSpace Call"}
                            </Typography>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mt: 1 }}>
                                <Typography variant="caption" sx={{ color: "var(--text-muted)", fontWeight: 600 }}>MEETING CODE</Typography>
                                <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: "monospace", color: "var(--primary)", bgcolor: "var(--primary-light)", px: 1, py: 0.2, borderRadius: "4px" }}>
                                    {selectedMeetingDetails.meetingCode}
                                </Typography>
                            </Box>
                        </Box>

                        <Divider sx={{ my: 2 }} />

                        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                                <CalendarTodayIcon sx={{ color: "#94a3b8", fontSize: 20 }} />
                                <Box>
                                    <Typography variant="caption" sx={{ color: "var(--text-muted)", display: "block" }}>Date Started</Typography>
                                    <Typography variant="body2" sx={{ fontWeight: 600, color: "#334155" }}>{formatDate(selectedMeetingDetails.date)}</Typography>
                                </Box>
                            </Box>
                            
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                                <AccessTimeIcon sx={{ color: "#94a3b8", fontSize: 20 }} />
                                <Box>
                                    <Typography variant="caption" sx={{ color: "var(--text-muted)", display: "block" }}>Time Started</Typography>
                                    <Typography variant="body2" sx={{ fontWeight: 600, color: "#334155" }}>{formatTime(selectedMeetingDetails.date)}</Typography>
                                </Box>
                            </Box>

                            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                                <TimerIcon sx={{ color: "#94a3b8", fontSize: 20 }} />
                                <Box>
                                    <Typography variant="caption" sx={{ color: "var(--text-muted)", display: "block" }}>Call Duration</Typography>
                                    <Typography variant="body2" sx={{ fontWeight: 600, color: "#334155" }}>{formatDuration(selectedMeetingDetails.duration)}</Typography>
                                </Box>
                            </Box>
                        </Box>

                        <Divider sx={{ my: 2 }} />

                        <Grid container spacing={2} sx={{ mt: 0.5 }}>
                            <Grid item xs={6}>
                                <Paper variant="outlined" sx={{ p: 1.5, textAlign: "center", borderRadius: "10px" }}>
                                    <PeopleOutlinedIcon sx={{ color: "var(--primary)", mb: 0.5 }} />
                                    <Typography variant="h6" sx={{ fontWeight: 800 }}>{selectedMeetingDetails.participantsCount || 1}</Typography>
                                    <Typography variant="caption" sx={{ color: "#94a3b8" }}>Total Participants</Typography>
                                </Paper>
                            </Grid>
                            <Grid item xs={6}>
                                <Paper variant="outlined" sx={{ p: 1.5, textAlign: "center", borderRadius: "10px" }}>
                                    <ChatBubbleOutlinedIcon sx={{ color: "var(--primary)", mb: 0.5 }} />
                                    <Typography variant="h6" sx={{ fontWeight: 800 }}>{selectedMeetingDetails.chatCount || 0}</Typography>
                                    <Typography variant="caption" sx={{ color: "#94a3b8" }}>Chat Messages</Typography>
                                </Paper>
                            </Grid>
                        </Grid>
                    </DialogContent>
                    <DialogActions sx={{ px: 3, pb: 2, pt: 1, gap: 1 }}>
                        <Button 
                            variant="outlined" 
                            startIcon={<ContentCopyIcon />}
                            onClick={(event) => handleCopyInviteLink(selectedMeetingDetails.meetingCode, event)}
                            sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 700 }}
                        >
                            Copy Link
                        </Button>
                        <Button 
                            variant="contained" 
                            startIcon={<LaunchIcon />}
                            onClick={() => routeTo(`/${selectedMeetingDetails.meetingCode}`)}
                            sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 700, bgcolor: "var(--primary)" }}
                        >
                            Rejoin Call
                        </Button>
                    </DialogActions>
                </Dialog>
            )}

            {/* DELETE CONFIRMATION DIALOG */}
            {selectedMeetingToDelete && (
                <Dialog
                    open={deleteConfirmOpen}
                    onClose={() => setDeleteConfirmOpen(false)}
                    PaperProps={{ sx: { borderRadius: "16px", p: 1 } }}
                >
                    <DialogTitle sx={{ fontWeight: 800 }}>Delete Meeting Record?</DialogTitle>
                    <DialogContent>
                        <Typography variant="body2" sx={{ color: "var(--text-muted)" }}>
                            Are you sure you want to remove the meeting record for <strong>"{selectedMeetingToDelete.meetingTitle || 'MeetSpace Call'}"</strong> ({selectedMeetingToDelete.meetingCode})? This action is permanent and cannot be undone.
                        </Typography>
                    </DialogContent>
                    <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
                        <Button onClick={() => setDeleteConfirmOpen(false)} sx={{ textTransform: "none", fontWeight: 700 }}>
                            Cancel
                        </Button>
                        <Button 
                            variant="contained" 
                            color="error" 
                            onClick={handleConfirmDelete}
                            sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 700, bgcolor: "var(--danger)", "&:hover": { bgcolor: "var(--danger-hover)" } }}
                        >
                            Delete Record
                        </Button>
                    </DialogActions>
                </Dialog>
            )}

            <Snackbar
                open={snackbarOpen}
                autoHideDuration={3000}
                onClose={() => setSnackbarOpen(false)}
                message={snackbarMessage}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            />
        </Box>
    )
}