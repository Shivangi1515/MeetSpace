import React, { useEffect, useRef, useState, useContext } from 'react'
import io from "socket.io-client";
import { useParams, useNavigate } from 'react-router-dom';
import { Badge, IconButton, TextField, Button, Box, Typography, Paper, Tooltip, Snackbar, Alert, Divider, Menu, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff'
import CallEndIcon from '@mui/icons-material/CallEnd'
import MicIcon from '@mui/icons-material/Mic'
import MicOffIcon from '@mui/icons-material/MicOff'
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import StopScreenShareIcon from '@mui/icons-material/StopScreenShare'
import ChatIcon from '@mui/icons-material/Chat';
import PeopleIcon from '@mui/icons-material/People';
import InfoIcon from '@mui/icons-material/Info';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import VideocamIconOutlined from '@mui/icons-material/VideocamOutlined';
import CloseIcon from '@mui/icons-material/Close';
import ShareIcon from '@mui/icons-material/Share';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions';
import AssignmentIcon from '@mui/icons-material/Assignment';
import PushPinIcon from '@mui/icons-material/PushPin';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';

import StopIcon from '@mui/icons-material/Stop';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import { saveRecording } from '../utils/recordingsDB';

import styles from "../styles/videoComponent.module.css";
import server from '../environment';
import { AuthContext } from '../contexts/AuthContext';

const server_url = server;
var connections = {};

const peerConfigConnections = {
    "iceServers": [
        { "urls": "stun:stun.l.google.com:19302" }
    ]
}

const getInitials = (name) => {
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
};

/* --- REUSABLE PARTICIPANT TILE COMPONENT --- */
/* Includes Web Audio API for Voice Activity Detection (VAD) / Speaking Highlights */
function ParticipantTile({ stream, username, socketId, audioEnabled, videoEnabled, screenEnabled, isLocal, isPinned, onPin, muted }) {
    const videoRef = useRef();
    const [isSpeaking, setIsSpeaking] = useState(false);
    
    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream, videoEnabled]);

    // Volume level analyser for active speaker highlight
    useEffect(() => {
        if (isLocal) {
            // Can optionally analyze local mic, but speaker glow is most important for remote feeds
        }
        
        if (!stream || !audioEnabled || isLocal) {
            setIsSpeaking(false);
            return;
        }
        
        let audioContext;
        let analyser;
        let source;
        let animationFrameId;
        
        try {
            const audioTracks = stream.getAudioTracks();
            if (audioTracks.length === 0) return;
            
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 512;
            
            // Connect first audio track to the frequency analyser
            source = audioContext.createMediaStreamSource(new MediaStream([audioTracks[0]]));
            source.connect(analyser);
            
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            
            const checkVolume = () => {
                analyser.getByteFrequencyData(dataArray);
                let sum = 0;
                for (let i = 0; i < bufferLength; i++) {
                    sum += dataArray[i];
                }
                const average = sum / bufferLength;
                // Average volume threshold of 15 out of 255 marks active voice activity
                setIsSpeaking(average > 15);
                animationFrameId = requestAnimationFrame(checkVolume);
            };
            
            checkVolume();
        } catch (e) {
            console.warn("Failed to initialize active speaker analysis", e);
        }
        
        return () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            if (source) source.disconnect();
            if (audioContext) audioContext.close();
        };
    }, [stream, audioEnabled, isLocal]);

    return (
        <div className={`${styles.videoTile} ${isSpeaking ? styles.activeSpeakerGlow : ''}`}>
            {/* Pin Overlay Button */}
            <Tooltip title={isPinned ? "Unpin video" : "Pin video"}>
                <IconButton 
                    className={styles.pinButton}
                    size="small" 
                    onClick={() => onPin(isPinned ? null : socketId)}
                >
                    {isPinned ? <PushPinIcon fontSize="small" /> : <PushPinOutlinedIcon fontSize="small" />}
                </IconButton>
            </Tooltip>

            {videoEnabled ? (
                <video
                    className={styles.videoTileVideo}
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted={muted}
                />
            ) : (
                <div className={styles.avatarPlaceholder}>
                    <div className={styles.avatarCircle}>
                           {getInitials(username)}
                    </div>
                    <span className={styles.avatarStatusText}>Camera Off</span>
                </div>
            )}
            
            <div className={styles.tileNameBadge}>
                {username} {isLocal ? "(You)" : ""}
            </div>
            
            <div className={styles.tileStatusBadges}>
                {!audioEnabled && (
                    <div className={`${styles.tileBadge} ${styles.tileBadgeDanger}`}>
                        <MicOffIcon sx={{ fontSize: 16 }} />
                    </div>
                )}
                {screenEnabled && (
                    <div className={styles.tileBadge}>
                        <ScreenShareIcon sx={{ fontSize: 16, color: "var(--success)" }} />
                    </div>
                )}
            </div>
        </div>
    );
}

const defaultMeetingTitles = [
    "Product Planning Sync",
    "Ad-hoc Collaboration",
    "Design Review Session",
    "Weekly Team Alignment",
    "Sprint Planning Discussion",
    "Project Retrospective"
];

export default function VideoMeetComponent() {
    const { url } = useParams(); // URL/code of the meeting
    const navigate = useNavigate();
    const { userData, addToUserHistory, updateMeetingHistory } = useContext(AuthContext);
    const [meetingTitle] = useState(() => {
        const randIndex = Math.floor(Math.random() * defaultMeetingTitles.length);
        return defaultMeetingTitles[randIndex];
    });

    var socketRef = useRef();
    let socketIdRef = useRef();
    let localVideoref = useRef();
    const chatEndRef = useRef(null);

    let [videoAvailable, setVideoAvailable] = useState(true);
    let [audioAvailable, setAudioAvailable] = useState(true);
    let [video, setVideo] = useState(true); // set initial camera to true
    let [audio, setAudio] = useState(true); // set initial mic to true
    let [screen, setScreen] = useState(false);
    let [screenAvailable, setScreenAvailable] = useState(false);

    let [sidebarOpen, setSidebarOpen] = useState(false);
    let [sidebarTab, setSidebarTab] = useState("chat"); // "chat", "participants", "notes"
    let [detailsOpen, setDetailsOpen] = useState(false);
    let [hideEmptyStateCard, setHideEmptyStateCard] = useState(false);

    let [messages, setMessages] = useState([])
    let [message, setMessage] = useState("");
    let [newMessages, setNewMessages] = useState(0);

    let [askForUsername, setAskForUsername] = useState(true);
    let [username, setUsername] = useState("");
    let [participants, setParticipants] = useState([]);

    const videoRef = useRef([])
    let [videos, setVideos] = useState([])

    // Meeting elapsed timer
    let [elapsedTime, setElapsedTime] = useState(0);

    // Fullscreen state
    let [isFullscreen, setIsFullscreen] = useState(false);

    // Emoji reactions state
    let [reactionsAnchorEl, setReactionsAnchorEl] = useState(null);
    let [reactionsList, setReactionsList] = useState([]);

    // Meeting notes state
    let [notes, setNotes] = useState("");

    // Pinned video state (Spotlight layout)
    let [pinnedParticipant, setPinnedParticipant] = useState(null); // 'local' or socketId

    // Recording states
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef(null);

    // Toast states
    let [toastOpen, setToastOpen] = useState(false);
    let [toastMessage, setToastMessage] = useState("");

    // Admin / Host states
    const [adminRequestPrompt, setAdminRequestPrompt] = useState(null); // { socketId, username }
    const [adminRequestSent, setAdminRequestSent] = useState(false);

    const showToast = (msg) => {
        setToastMessage(msg);
        setToastOpen(true);
    };

    const handleAcceptAdminRequest = (targetSocketId) => {
        if (socketRef.current) {
            socketRef.current.emit("transfer-admin", targetSocketId);
        }
        setAdminRequestPrompt(null);
    };

    const handleDeclineAdminRequest = (targetSocketId) => {
        if (socketRef.current) {
            socketRef.current.emit("decline-admin-request", targetSocketId);
        }
        setAdminRequestPrompt(null);
    };

    const handleRequestAdmin = () => {
        if (socketRef.current) {
            socketRef.current.emit("request-admin");
            setAdminRequestSent(true);
            showToast("Request to be admin sent to the host.");
        }
    };

    const handleTransferAdminDirectly = (targetSocketId) => {
        if (socketRef.current) {
            socketRef.current.emit("transfer-admin", targetSocketId);
        }
    };

    // Pre-fill username from AuthContext if available
    useEffect(() => {
        if (userData && userData.name && !username) {
            setUsername(userData.name);
        }
    }, [userData]);

    // Timer logic
    useEffect(() => {
        if (askForUsername) return;
        const timer = setInterval(() => {
            setElapsedTime(prev => prev + 1);
        }, 1000);
        return () => clearInterval(timer);
    }, [askForUsername]);

    // Scroll chat to bottom
    useEffect(() => {
        if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, sidebarOpen, sidebarTab]);

    // Sync fullscreen state if changed by Esc key
    useEffect(() => {
        const handleFsChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener("fullscreenchange", handleFsChange);
        return () => document.removeEventListener("fullscreenchange", handleFsChange);
    }, []);

    // Load local meeting notes on join
    useEffect(() => {
        if (!askForUsername && url) {
            const savedNotes = localStorage.getItem(`meetspace_notes_${url}`);
            if (savedNotes) {
                setNotes(savedNotes);
            }
        }
    }, [askForUsername, url]);

    // Periodically update meeting history (every 15 seconds) to prevent stale duration on disconnects/refreshes
    useEffect(() => {
        if (askForUsername) return;
        
        const updateInterval = setInterval(async () => {
            try {
                if (updateMeetingHistory) {
                    const durationSeconds = elapsedTime;
                    const totalParticipants = participants.length > 0 ? participants.length : 1;
                    const totalChats = messages.length;
                    await updateMeetingHistory(url, durationSeconds, totalParticipants, totalChats, meetingTitle);
                }
            } catch (err) {
                console.warn("Stale history update error:", err);
            }
        }, 15000);

        return () => clearInterval(updateInterval);
    }, [askForUsername, elapsedTime, participants.length, messages.length, url, meetingTitle, updateMeetingHistory]);

    // Cleanup WebRTC and Sockets on unmount
    useEffect(() => {
        getPermissions();
        
        return () => {
            console.log("UNMOUNT: cleaning up WebRTC and Socket connections");
            
            // 1. Disconnect socket
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
            
            // 2. Close peer connections
            for (let id in connections) {
                if (connections[id]) {
                    connections[id].close();
                }
            }
            connections = {}; 
            
            // 3. Stop local stream tracks
            if (window.localStream) {
                window.localStream.getTracks().forEach(track => track.stop());
            }

            // 4. Stop recording if active
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
                mediaRecorderRef.current.stop();
            }
        };
    }, []);

    const getPermissions = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            if (stream) {
                setVideoAvailable(true);
                setAudioAvailable(true);
                window.localStream = stream;
                if (localVideoref.current) {
                    localVideoref.current.srcObject = stream;
                }
            }
        } catch (error) {
            console.log("Failed to get both video and audio, trying video only...", error);
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                if (stream) {
                    setVideoAvailable(true);
                    setAudioAvailable(false);
                    window.localStream = stream;
                    if (localVideoref.current) {
                        localVideoref.current.srcObject = stream;
                    }
                }
            } catch (err2) {
                console.log("Failed to get video, trying audio only...", err2);
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    if (stream) {
                        setVideoAvailable(false);
                        setAudioAvailable(true);
                        window.localStream = stream;
                        if (localVideoref.current) {
                            localVideoref.current.srcObject = stream;
                        }
                    }
                } catch (err3) {
                    console.log("No devices available or permission denied", err3);
                    setVideoAvailable(false);
                    setAudioAvailable(false);
                }
            }
        }

        if (navigator.mediaDevices.getDisplayMedia) {
            setScreenAvailable(true);
        } else {
            setScreenAvailable(false);
        }
    };

    // Sync local track state if changed (no need to recall getUserMedia)
    useEffect(() => {
        if (window.localStream && !askForUsername) {
            const videoTrack = window.localStream.getVideoTracks()[0];
            if (videoTrack) videoTrack.enabled = video;
            const audioTrack = window.localStream.getAudioTracks()[0];
            if (audioTrack) audioTrack.enabled = audio;
        }
    }, [video, audio, askForUsername]);

    let getMedia = () => {
        const targetVideo = videoAvailable && video;
        const targetAudio = audioAvailable && audio;
        if (window.localStream) {
            const videoTrack = window.localStream.getVideoTracks()[0];
            if (videoTrack) videoTrack.enabled = targetVideo;
            const audioTrack = window.localStream.getAudioTracks()[0];
            if (audioTrack) audioTrack.enabled = targetAudio;
        }
        setVideo(targetVideo);
        setAudio(targetAudio);
        connectToSocketServer(targetVideo, targetAudio);
    }

    let getUserMediaSuccess = (stream) => {
        const videoTrack = stream.getVideoTracks()[0];
        const audioTrack = stream.getAudioTracks()[0];

        // Replace tracks on active peer connections
        for (let id in connections) {
            if (id === socketIdRef.current) continue;
            const senders = connections[id].getSenders();
            
            const videoSender = senders.find(s => s.track && s.track.kind === 'video');
            if (videoSender) {
                videoSender.replaceTrack(videoTrack || null);
            }
            
            const audioSender = senders.find(s => s.track && s.track.kind === 'audio');
            if (audioSender) {
                audioSender.replaceTrack(audioTrack || null);
            }
        }

        // Stop existing tracks on window.localStream if it's different
        if (window.localStream && window.localStream !== stream) {
            window.localStream.getTracks().forEach(track => track.stop());
        }

        window.localStream = stream;
        if (localVideoref.current) {
            localVideoref.current.srcObject = stream;
        }

        stream.getTracks().forEach(track => track.onended = () => {
            setVideo(false);
            setAudio(false);
            if (socketRef.current) {
                socketRef.current.emit("state-change", "video", false);
                socketRef.current.emit("state-change", "audio", false);
            }

            try {
                let tracks = localVideoref.current.srcObject.getTracks()
                tracks.forEach(t => t.stop())
            } catch (e) { }

            let blackSilence = (...args) => new MediaStream([black(...args), silence()])
            window.localStream = blackSilence()
            if (localVideoref.current) {
                localVideoref.current.srcObject = window.localStream
            }

            // Replace tracks with black/silence on peers
            const blackVideoTrack = window.localStream.getVideoTracks()[0];
            const silenceAudioTrack = window.localStream.getAudioTracks()[0];
            for (let id in connections) {
                if (id === socketIdRef.current) continue;
                const senders = connections[id].getSenders();
                const videoSender = senders.find(s => s.track && s.track.kind === 'video');
                if (videoSender) videoSender.replaceTrack(blackVideoTrack);
                const audioSender = senders.find(s => s.track && s.track.kind === 'audio');
                if (audioSender) audioSender.replaceTrack(silenceAudioTrack);
            }
        })
    }

    let getUserMedia = () => {
        if ((video && videoAvailable) || (audio && audioAvailable)) {
            navigator.mediaDevices.getUserMedia({ video: video, audio: audio })
                .then(getUserMediaSuccess)
                .catch((e) => console.log(e))
        } else {
            try {
                let tracks = localVideoref.current.srcObject.getTracks()
                tracks.forEach(track => track.stop())
            } catch (e) { }

            // Replace tracks with null on all peers to indicate devices are off
            for (let id in connections) {
                if (id === socketIdRef.current) continue;
                const senders = connections[id].getSenders();
                const videoSender = senders.find(s => s.track && s.track.kind === 'video');
                if (videoSender) videoSender.replaceTrack(null);
                const audioSender = senders.find(s => s.track && s.track.kind === 'audio');
                if (audioSender) audioSender.replaceTrack(null);
            }
        }
    }

    let getDislayMediaSuccess = (stream) => {
        console.log("HERE SCREEN SHARE")
        const screenTrack = stream.getVideoTracks()[0];

        // Replace track on existing peer connections
        for (let id in connections) {
            if (id === socketIdRef.current) continue;
            const senders = connections[id].getSenders();
            const videoSender = senders.find(s => s.track && s.track.kind === 'video');
            if (videoSender && screenTrack) {
                videoSender.replaceTrack(screenTrack);
            }
        }

        // Stop only video tracks of local stream
        if (window.localStream) {
            const localVideoTrack = window.localStream.getVideoTracks()[0];
            if (localVideoTrack) {
                localVideoTrack.stop();
            }
        }

        // Update local stream video track
        if (window.localStream) {
            const oldTrack = window.localStream.getVideoTracks()[0];
            if (oldTrack) window.localStream.removeTrack(oldTrack);
            window.localStream.addTrack(screenTrack);
        } else {
            window.localStream = stream;
        }

        if (localVideoref.current) {
            localVideoref.current.srcObject = window.localStream;
        }

        // Notify peers of screen share
        if (socketRef.current) {
            socketRef.current.emit("state-change", "screen", true);
            socketRef.current.emit("state-change", "video", true); // screen sharing counts as active video
        }

        screenTrack.onended = () => {
            setScreen(false);
            if (socketRef.current) {
                socketRef.current.emit("state-change", "screen", false);
            }
            getUserMedia();
        };
    }

    let getDislayMedia = () => {
        if (screen) {
            if (navigator.mediaDevices.getDisplayMedia) {
                navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
                    .then(getDislayMediaSuccess)
                    .catch((e) => {
                        console.log(e);
                        setScreen(false);
                    })
            }
        }
    }

    useEffect(() => {
        if (screen !== undefined && !askForUsername) {
            getDislayMedia();
        }
    }, [screen]);

    let gotMessageFromServer = (fromId, message) => {
        var signal = JSON.parse(message)

        if (fromId !== socketIdRef.current) {
            if (signal.sdp) {
                connections[fromId].setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(() => {
                    if (signal.sdp.type === 'offer') {
                        connections[fromId].createAnswer().then((description) => {
                            connections[fromId].setLocalDescription(description).then(() => {
                                socketRef.current.emit('signal', fromId, JSON.stringify({ 'sdp': connections[fromId].localDescription }))
                            }).catch(e => console.log(e))
                        }).catch(e => console.log(e))
                    }
                }).catch(e => console.log(e))
            }

            if (signal.ice) {
                connections[fromId].addIceCandidate(new RTCIceCandidate(signal.ice)).catch(e => console.log(e))
            }
        }
    }

    let connectToSocketServer = (initialVideo, initialAudio) => {
        socketRef.current = io.connect(server_url, { secure: false })

        socketRef.current.on('signal', gotMessageFromServer)

        socketRef.current.on('connect', () => {
            // Send room path, username and initial states
            socketRef.current.emit('join-call', window.location.href, username, initialVideo, initialAudio)
            socketIdRef.current = socketRef.current.id

            // Sync initial states immediately
            socketRef.current.emit("state-change", "video", initialVideo);
            socketRef.current.emit("state-change", "audio", initialAudio);
            socketRef.current.emit("state-change", "screen", screen);

            socketRef.current.on('chat-message', addMessage)

            socketRef.current.on('participant-list', (list) => {
                setParticipants(list);
                const currentLocal = list.find(p => p.socketId === socketIdRef.current);
                if (currentLocal && currentLocal.isAdmin) {
                    setAdminRequestSent(false);
                }
            });

            socketRef.current.on("admin-request-received", ({ socketId, username }) => {
                setAdminRequestPrompt({ socketId, username });
            });

            socketRef.current.on("admin-request-declined", () => {
                showToast("Your request to be admin was declined by the host.");
                setAdminRequestSent(false);
            });

            socketRef.current.on("admin-transferred", ({ newAdminId, newAdminName }) => {
                showToast(`${newAdminId === socketIdRef.current ? "You are" : `${newAdminName} is`} now the host.`);
                setAdminRequestSent(false);
            });

            // Listen to emoji reactions
            socketRef.current.on("reaction", (emoji, senderName, senderId) => {
                const newReaction = {
                    id: Date.now() + Math.random(),
                    emoji,
                    senderName: senderId === socketIdRef.current ? "You" : senderName
                };
                setReactionsList(prev => [...prev, newReaction]);
                
                // Clear reaction bubble after 3 seconds
                setTimeout(() => {
                    setReactionsList(prev => prev.filter(r => r.id !== newReaction.id));
                }, 3000);
            });

            socketRef.current.on('user-left', (id) => {
                setVideos((videos) => videos.filter((video) => video.socketId !== id))
                if (connections[id]) {
                    connections[id].close();
                    delete connections[id];
                }
                // Reset pin if pinned user left
                setPinnedParticipant(prev => prev === id ? null : prev);
            })

            socketRef.current.on('user-joined', (id, clients) => {
                clients.forEach((socketListId) => {
                    connections[socketListId] = new RTCPeerConnection(peerConfigConnections)
                    // Wait for ice candidate       
                    connections[socketListId].onicecandidate = function (event) {
                        if (event.candidate != null) {
                            socketRef.current.emit('signal', socketListId, JSON.stringify({ 'ice': event.candidate }))
                        }
                    }

                    // Wait for stream
                    connections[socketListId].onaddstream = (event) => {
                        let videoExists = videoRef.current.find(video => video.socketId === socketListId);

                        if (videoExists) {
                            setVideos(videos => {
                                const updatedVideos = videos.map(video =>
                                    video.socketId === socketListId ? { ...video, stream: event.stream } : video
                                );
                                videoRef.current = updatedVideos;
                                return updatedVideos;
                            });
                        } else {
                            let newVideo = {
                                socketId: socketListId,
                                stream: event.stream,
                                autoplay: true,
                                playsinline: true
                            };

                            setVideos(videos => {
                                const updatedVideos = [...videos, newVideo];
                                videoRef.current = updatedVideos;
                                return updatedVideos;
                            });
                        }
                    };

                    // Add local stream
                    if (window.localStream !== undefined && window.localStream !== null) {
                        connections[socketListId].addStream(window.localStream)
                    } else {
                        let blackSilence = (...args) => new MediaStream([black(...args), silence()])
                        window.localStream = blackSilence()
                        connections[socketListId].addStream(window.localStream)
                    }
                })

                if (id === socketIdRef.current) {
                    for (let id2 in connections) {
                        if (id2 === socketIdRef.current) continue

                        try {
                            connections[id2].addStream(window.localStream)
                        } catch (e) { }

                        connections[id2].createOffer().then((description) => {
                            connections[id2].setLocalDescription(description)
                                .then(() => {
                                    socketRef.current.emit('signal', id2, JSON.stringify({ 'sdp': connections[id2].localDescription }))
                                })
                                .catch(e => console.log(e))
                        })
                    }
                }
            })
        })
    }

    let silence = () => {
        let ctx = new AudioContext()
        let oscillator = ctx.createOscillator()
        let dst = oscillator.connect(ctx.createMediaStreamDestination())
        oscillator.start()
        ctx.resume()
        return Object.assign(dst.stream.getAudioTracks()[0], { enabled: false })
    }

    let black = ({ width = 640, height = 480 } = {}) => {
        let canvas = Object.assign(document.createElement("canvas"), { width, height })
        canvas.getContext('2d').fillRect(0, 0, width, height)
        let stream = canvas.captureStream()
        return Object.assign(stream.getVideoTracks()[0], { enabled: false })
    }

    let handleVideo = async () => {
        let newVideo = !video;
        setVideo(newVideo);
        
        // Mute video track locally/remotely
        if (window.localStream) {
            const videoTrack = window.localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = newVideo;
            } else if (newVideo) {
                // Request video track if not present (fallback)
                try {
                    const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
                    const newTrack = tempStream.getVideoTracks()[0];
                    if (newTrack) {
                        window.localStream.addTrack(newTrack);
                        if (localVideoref.current) {
                            localVideoref.current.srcObject = window.localStream;
                        }
                        for (let id in connections) {
                            if (id === socketIdRef.current) continue;
                            const senders = connections[id].getSenders();
                            const videoSender = senders.find(s => s.track && s.track.kind === 'video');
                            if (videoSender) {
                                videoSender.replaceTrack(newTrack);
                            } else {
                                connections[id].addTrack(newTrack, window.localStream);
                            }
                        }
                    }
                } catch (e) {
                    console.warn("Failed to dynamically acquire camera on toggle", e);
                    setVideo(false);
                    newVideo = false;
                }
            }
        }

        if (socketRef.current) {
            socketRef.current.emit("state-change", "video", newVideo);
        }
    }

    let handleAudio = async () => {
        let newAudio = !audio;
        setAudio(newAudio);
        
        // Mute audio track locally/remotely
        if (window.localStream) {
            const audioTrack = window.localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = newAudio;
            } else if (newAudio) {
                // Request audio track if not present (fallback)
                try {
                    const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    const newTrack = tempStream.getAudioTracks()[0];
                    if (newTrack) {
                        window.localStream.addTrack(newTrack);
                        for (let id in connections) {
                            if (id === socketIdRef.current) continue;
                            const senders = connections[id].getSenders();
                            const audioSender = senders.find(s => s.track && s.track.kind === 'audio');
                            if (audioSender) {
                                audioSender.replaceTrack(newTrack);
                            } else {
                                connections[id].addTrack(newTrack, window.localStream);
                            }
                        }
                    }
                } catch (e) {
                    console.warn("Failed to dynamically acquire mic on toggle", e);
                    setAudio(false);
                    newAudio = false;
                }
            }
        }

        if (socketRef.current) {
            socketRef.current.emit("state-change", "audio", newAudio);
        }
    }

    let handleScreen = () => {
        setScreen(!screen);
    }

    const startRecordingCall = () => {
        try {
            if (!window.localStream) {
                showToast("No active camera or microphone to record.");
                return;
            }

            const chunks = [];
            // Record using the local stream directly (no screen sharing prompts!)
            const recorder = new MediaRecorder(window.localStream, { mimeType: "video/webm;codecs=vp9,opus" });
            
            recorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    chunks.push(e.data);
                }
            };
            
            const startTime = Date.now();
            
            recorder.onstop = async () => {
                const recordingBlob = new Blob(chunks, { type: "video/webm" });
                const durationSecs = Math.round((Date.now() - startTime) / 1000);
                
                try {
                    await saveRecording({
                        id: "rec_" + Date.now(),
                        meetingCode: url,
                        meetingTitle: meetingTitle || "MeetSpace Call",
                        date: new Date().toISOString(),
                        blob: recordingBlob,
                        duration: durationSecs
                    });
                    showToast("Recording saved successfully to dashboard!");
                } catch (err) {
                    console.error("IndexedDB save failed", err);
                    showToast("Failed to save recording to your dashboard.");
                }
                
                setIsRecording(false);
            };
            
            mediaRecorderRef.current = recorder;
            recorder.start(1000);
            setIsRecording(true);
            showToast("Recording started!");
        } catch (e) {
            console.error("Recording start error", e);
            showToast("Could not start recording.");
        }
    };

    const stopRecordingCall = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            mediaRecorderRef.current.stop();
        }
    };

    let handleEndCall = async () => {
        try {
            let tracks = localVideoref.current.srcObject.getTracks()
            tracks.forEach(track => track.stop())
        } catch (e) { }

        // Update meeting history with final details
        try {
            if (updateMeetingHistory) {
                const durationSeconds = elapsedTime;
                const totalParticipants = participants.length > 0 ? participants.length : 1;
                const totalChats = messages.length;
                await updateMeetingHistory(url, durationSeconds, totalParticipants, totalChats, meetingTitle);
            }
        } catch (err) {
            console.error("Failed to update meeting history", err);
        }

        navigate("/home");
    }

    let handleMessage = (e) => {
        setMessage(e.target.value);
    }

    const addMessage = (data, sender, socketIdSender) => {
        setMessages((prevMessages) => [
            ...prevMessages,
            { sender: sender, data: data, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
        ]);
        if (socketIdSender !== socketIdRef.current) {
            setNewMessages((prevNewMessages) => prevNewMessages + 1);
        }
    };

    let sendMessage = () => {
        if (message.trim() === "") return;
        socketRef.current.emit("chat-message", message, username);
        setMessage("");
    };

    let connect = () => {
        if (!username.trim()) return;
        setAskForUsername(false);
        getMedia();

        // Add to user meeting history upon joining
        try {
            if (addToUserHistory) {
                addToUserHistory(url).catch(err => console.error("Error adding call to history", err));
            }
        } catch (e) {
            console.error("Failed to register call history entry", e);
        }
    }

    // Toggle sidebar tabs
    const toggleChat = () => {
        if (sidebarOpen && sidebarTab === "chat") {
            setSidebarOpen(false);
        } else {
            setSidebarOpen(true);
            setSidebarTab("chat");
            setNewMessages(0);
        }
    };

    const toggleParticipants = () => {
        if (sidebarOpen && sidebarTab === "participants") {
            setSidebarOpen(false);
        } else {
            setSidebarOpen(true);
            setSidebarTab("participants");
        }
    };

    const toggleNotes = () => {
        if (sidebarOpen && sidebarTab === "notes") {
            setSidebarOpen(false);
        } else {
            setSidebarOpen(true);
            setSidebarTab("notes");
        }
    };

    // Fullscreen handler
    const toggleFullScreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen()
                .then(() => setIsFullscreen(true))
                .catch((err) => console.log(err));
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    // Emoji click actions
    const handleReactionsClick = (event) => {
        setReactionsAnchorEl(event.currentTarget);
    };

    const handleReactionsClose = () => {
        setReactionsAnchorEl(null);
    };

    const sendReaction = (emoji) => {
        if (socketRef.current) {
            socketRef.current.emit("reaction", emoji, username);
        }
        handleReactionsClose();
    };

    // Shared notes text change
    const handleNotesChange = (e) => {
        setNotes(e.target.value);
        localStorage.setItem(`meetspace_notes_${url}`, e.target.value);
    };

    // Notification toast on list change (joins/leaves)
    const prevParticipantsRef = useRef([]);
    useEffect(() => {
        if (prevParticipantsRef.current.length > 0 && participants.length > 0) {
            // Check joined
            participants.forEach(p => {
                const existed = prevParticipantsRef.current.find(prev => prev.socketId === p.socketId);
                if (!existed && p.socketId !== socketIdRef.current) {
                    showToast(`${p.username || 'A participant'} joined the meeting`);
                }
            });
            // Check left
            prevParticipantsRef.current.forEach(prev => {
                const exists = participants.find(p => p.socketId === prev.socketId);
                if (!exists && prev.socketId !== socketIdRef.current) {
                    showToast(`${prev.username || 'A participant'} left the meeting`);
                }
            });
        }
        prevParticipantsRef.current = participants;
    }, [participants]);

    // Helpers
    const formatElapsedTime = () => {
        const hrs = Math.floor(elapsedTime / 3600);
        const mins = Math.floor((elapsedTime % 3600) / 60);
        const secs = elapsedTime % 60;
        return [
            hrs > 0 ? String(hrs).padStart(2, '0') : null,
            String(mins).padStart(2, '0'),
            String(secs).padStart(2, '0')
        ].filter(Boolean).join(':');
    };

    const handleCopyInviteLink = () => {
        const link = `${window.location.origin}/${url}`;
        navigator.clipboard.writeText(link);
        showToast("Invite link copied to clipboard!");
    };

    const handleCopyMeetingCode = () => {
        navigator.clipboard.writeText(url);
        showToast("Meeting code copied to clipboard!");
    };

    const handleShareInvite = () => {
        const link = `${window.location.origin}/${url}`;
        if (navigator.share) {
            navigator.share({
                title: 'Join MeetSpace Meeting',
                text: `Join my video meeting on MeetSpace. Code: ${url}`,
                url: link,
            }).catch(err => console.log("Error sharing", err));
        } else {
            handleCopyInviteLink();
        }
    };

    const getGridTemplate = (totalCount) => {
        if (totalCount <= 1) {
            return { gridTemplateColumns: '1fr', maxWidth: '800px' };
        }
        if (totalCount === 2) {
            return { gridTemplateColumns: '1fr 1fr', maxWidth: '1200px' };
        }
        if (totalCount <= 4) {
            return { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', maxWidth: '1200px' };
        }
        return { gridTemplateColumns: '1fr 1fr 1fr', gridTemplateRows: 'repeat(auto-fill, 1fr)', maxWidth: '1400px' };
    };

    const localParticipant = participants.find(p => p.socketId === socketIdRef.current);
    const isLocalAdmin = localParticipant?.isAdmin || false;

    return (
        <div>
            {/* Floating rising reactions overlay */}
            <div className={styles.reactionsOverlay}>
                {reactionsList.map(r => (
                    <div className={styles.reactionBubble} key={r.id}>
                        <span>{r.emoji}</span>
                        <span style={{ fontSize: '0.72rem', opacity: 0.85 }}>{r.senderName}</span>
                    </div>
                ))}
            </div>

            {askForUsername === true ? (
                /* --- PRE-MEETING LOBBY SCREEN --- */
                <div className={styles.lobbyContainer}>
                    <div className={styles.lobbyWrapper}>
                        {/* Camera Preview */}
                        <div className={styles.lobbyPreviewCard}>
                            <div className={styles.lobbyVideoWrapper}>
                                {video ? (
                                    <video ref={localVideoref} autoPlay muted className={styles.lobbyVideo}></video>
                                ) : (
                                    <div className={styles.lobbyNoVideo}>
                                        <VideocamIconOutlined sx={{ fontSize: 80, color: "#475569" }} />
                                        <Typography variant="body1" sx={{ fontWeight: 600 }}>Your camera is turned off</Typography>
                                    </div>
                                )}
                                {/* Quick toggles inside preview */}
                                <div className={styles.lobbyVideoControls}>
                                    <IconButton onClick={() => setAudio(!audio)} sx={{ 
                                        bgcolor: audio ? "rgba(255,255,255,0.15)" : "rgba(239,68,68,0.8)",
                                        color: "white",
                                        "&:hover": { bgcolor: audio ? "rgba(255,255,255,0.25)" : "rgba(239,68,68,0.9)" }
                                    }}>
                                        {audio ? <MicIcon /> : <MicOffIcon />}
                                    </IconButton>
                                    <IconButton onClick={() => setVideo(!video)} sx={{ 
                                        bgcolor: video ? "rgba(255,255,255,0.15)" : "rgba(239,68,68,0.8)",
                                        color: "white",
                                        "&:hover": { bgcolor: video ? "rgba(255,255,255,0.25)" : "rgba(239,68,68,0.9)" }
                                    }}>
                                        {video ? <VideocamIcon /> : <VideocamOffIcon />}
                                    </IconButton>
                                </div>
                            </div>
                        </div>

                        {/* Name form */}
                        <div className={styles.lobbyFormCard}>
                            <div>
                                <h2>Ready to Join?</h2>
                                <p>Set up your camera and enter your display name to start communicating.</p>
                            </div>
                            
                            <TextField 
                                fullWidth
                                label="Your Name" 
                                value={username} 
                                onChange={e => setUsername(e.target.value)} 
                                variant="outlined" 
                                placeholder="Enter username..."
                                slotProps={{
                                    input: {
                                        startAdornment: <KeyboardIcon sx={{ color: "#94a3b8", mr: 1 }} />
                                    }
                                }}
                                sx={{
                                    "& label": { color: "rgba(255,255,255,0.5)" },
                                    "& label.Mui-focused": { color: "var(--primary)" },
                                    "& .MuiOutlinedInput-root": {
                                        color: "white",
                                        "& fieldset": { borderColor: "rgba(255,255,255,0.15)" },
                                        "&:hover fieldset": { borderColor: "rgba(255,255,255,0.3)" },
                                        "&.Mui-focused fieldset": { borderColor: "var(--primary)" },
                                    }
                                }}
                            />
                            
                            <Button 
                                fullWidth
                                variant="contained" 
                                onClick={connect}
                                disabled={!username.trim()}
                                sx={{
                                    height: 52,
                                    borderRadius: "10px",
                                    fontSize: "1.05rem",
                                    fontWeight: 700,
                                    bgcolor: "#2f6feb !important",
                                    color: "white !important",
                                    boxShadow: "0 4px 14px rgba(47, 111, 235, 0.4)",
                                    "&:hover": { bgcolor: "#1e5bc8 !important" },
                                    "&.Mui-disabled": {
                                        bgcolor: "rgba(47, 111, 235, 0.5) !important",
                                        color: "rgba(255, 255, 255, 0.5) !important",
                                        boxShadow: "none"
                                    }
                                }}
                            >
                                Enter Meeting Room
                            </Button>
                        </div>
                    </div>
                </div>
            ) : (
                /* --- ACTIVE VIDEO MEETING ROOM --- */
                <div className={styles.meetVideoContainer}>
                    
                    <div className={styles.mainCallArea}>
                        {/* Top-left Information & Call Timer */}
                        <div className={styles.meetHeader}>
                            <div className={styles.roomBadge}>
                                <VideocamIcon sx={{ fontSize: 18, color: "var(--primary)" }} />
                                <span>MeetSpace Room</span>
                            </div>
                            <div className={styles.timerBadge}>
                                {formatElapsedTime()}
                            </div>
                        </div>

                        {/* Main Video Area (Supports Grid View vs Spotlight Pinned View) */}
                        <div className={styles.gridArea}>
                        
                        {/* 1. Empty State - If user is alone in the room */}
                        {videos.length === 0 && !hideEmptyStateCard ? (
                            <Box sx={{ 
                                display: "flex", 
                                flexDirection: { xs: "column", md: "row" }, 
                                gap: 4, 
                                alignItems: "center", 
                                justifyContent: "center",
                                margin: "auto" 
                            }}>
                                <div className={styles.emptyStateCard} style={{ position: "relative" }}>
                                    <IconButton 
                                        size="small" 
                                        onClick={() => setHideEmptyStateCard(true)}
                                        sx={{ position: "absolute", top: 12, right: 12, color: "var(--text-room-muted)", "&:hover": { color: "white" } }}
                                    >
                                        <CloseIcon fontSize="small" />
                                    </IconButton>

                                    <h3>You're the only one here</h3>
                                    <p>Share this meeting code or invite link with colleagues or friends to let them join.</p>
                                    
                                    <div className={styles.inviteBox}>
                                        <span className={styles.inviteCode}>{url}</span>
                                        <Tooltip title="Copy Code">
                                            <IconButton onClick={handleCopyMeetingCode} size="small" sx={{ bgcolor: "rgba(255,255,255,0.05)", color: "white" }}>
                                                <ContentCopyIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    </div>
                                    
                                    <Box sx={{ display: "flex", gap: 2 }}>
                                        <Button 
                                            fullWidth 
                                            variant="outlined" 
                                            startIcon={<ContentCopyIcon />}
                                            onClick={handleCopyInviteLink}
                                            sx={{ 
                                                borderRadius: "10px", 
                                                color: "white", 
                                                borderColor: "rgba(255,255,255,0.2)",
                                                textTransform: "none",
                                                fontWeight: 600,
                                                py: 1.2,
                                                "&:hover": { borderColor: "white", bgcolor: "rgba(255,255,255,0.05)" }
                                            }}
                                        >
                                            Copy Link
                                        </Button>

                                        <Button 
                                            fullWidth 
                                            variant="contained" 
                                            startIcon={<ShareIcon />}
                                            onClick={handleShareInvite}
                                            sx={{ 
                                                borderRadius: "10px", 
                                                bgcolor: "var(--primary)",
                                                textTransform: "none",
                                                fontWeight: 600,
                                                py: 1.2,
                                                "&:hover": { bgcolor: "var(--primary-hover)" }
                                            }}
                                        >
                                            Share Invite
                                        </Button>
                                    </Box>
                                </div>

                                {/* Local Preview Tile */}
                                <div style={{ width: '480px', maxWidth: '100%' }}>
                                    <ParticipantTile 
                                        stream={window.localStream}
                                        username={username}
                                        socketId="local"
                                        audioEnabled={audio}
                                        videoEnabled={video}
                                        screenEnabled={screen}
                                        isLocal={true}
                                        isPinned={pinnedParticipant === 'local'}
                                        onPin={setPinnedParticipant}
                                        muted={true}
                                    />
                                </div>
                            </Box>
                        ) : (
                            /* 2. active meeting view */
                            pinnedParticipant ? (
                                /* --- A. SPOTLIGHT PINNED VIEW --- */
                                <div className={styles.spotlightArea}>
                                    {/* Center Large Pinned Video */}
                                    <div className={styles.spotlightMain}>
                                        {pinnedParticipant === 'local' ? (
                                            <ParticipantTile 
                                                stream={window.localStream}
                                                username={username}
                                                socketId="local"
                                                audioEnabled={audio}
                                                videoEnabled={video}
                                                screenEnabled={screen}
                                                isLocal={true}
                                                isPinned={true}
                                                onPin={setPinnedParticipant}
                                                muted={true}
                                            />
                                        ) : (
                                            (() => {
                                                const pinnedVidObj = videos.find(v => v.socketId === pinnedParticipant);
                                                const p = participants.find(p => p.socketId === pinnedParticipant);
                                                return (
                                                    <ParticipantTile 
                                                        stream={pinnedVidObj?.stream}
                                                        username={p?.username || "Guest"}
                                                        socketId={pinnedParticipant}
                                                        audioEnabled={p ? p.audio : true}
                                                        videoEnabled={p ? p.video : true}
                                                        screenEnabled={p ? p.screen : false}
                                                        isLocal={false}
                                                        isPinned={true}
                                                        onPin={setPinnedParticipant}
                                                        muted={false}
                                                    />
                                                );
                                            })()
                                        )}
                                    </div>

                                    {/* Horizontal scrolling strip of other tiles */}
                                    <div className={styles.spotlightStrip}>
                                        {/* Show Local User in Strip if not pinned */}
                                        {pinnedParticipant !== 'local' && (
                                            <div className={styles.spotlightStripTile}>
                                                <ParticipantTile 
                                                    stream={window.localStream}
                                                    username={username}
                                                    socketId="local"
                                                    audioEnabled={audio}
                                                    videoEnabled={video}
                                                    screenEnabled={screen}
                                                    isLocal={true}
                                                    isPinned={false}
                                                    onPin={setPinnedParticipant}
                                                    muted={true}
                                                />
                                            </div>
                                        )}

                                        {/* Show remote users in strip if not pinned */}
                                        {videos.map((vid) => {
                                            if (pinnedParticipant === vid.socketId) return null;
                                            const p = participants.find(p => p.socketId === vid.socketId);
                                            return (
                                                <div className={styles.spotlightStripTile} key={vid.socketId}>
                                                    <ParticipantTile 
                                                        stream={vid.stream}
                                                        username={p?.username || "Guest"}
                                                        socketId={vid.socketId}
                                                        audioEnabled={p ? p.audio : true}
                                                        videoEnabled={p ? p.video : true}
                                                        screenEnabled={p ? p.screen : false}
                                                        isLocal={false}
                                                        isPinned={false}
                                                        onPin={setPinnedParticipant}
                                                        muted={false}
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : (
                                /* --- B. STANDARD GRID VIEW --- */
                                <div className={styles.videoGrid} style={getGridTemplate(videos.length + 1)}>
                                    {/* Local Participant Tile */}
                                    <ParticipantTile 
                                        stream={window.localStream}
                                        username={username}
                                        socketId="local"
                                        audioEnabled={audio}
                                        videoEnabled={video}
                                        screenEnabled={screen}
                                        isLocal={true}
                                        isPinned={false}
                                        onPin={setPinnedParticipant}
                                        muted={true}
                                    />

                                    {/* Remote Participant Tiles */}
                                    {videos.map((vid) => {
                                        const p = participants.find(p => p.socketId === vid.socketId);
                                        return (
                                            <ParticipantTile 
                                                key={vid.socketId}
                                                stream={vid.stream}
                                                username={p?.username || "Guest"}
                                                socketId={vid.socketId}
                                                audioEnabled={p ? p.audio : true}
                                                videoEnabled={p ? p.video : true}
                                                screenEnabled={p ? p.screen : false}
                                                isLocal={false}
                                                isPinned={false}
                                                onPin={setPinnedParticipant}
                                                muted={false}
                                            />
                                        );
                                    })}
                                </div>
                            )
                        )}
                    </div>

                    {/* Bottom Floating Control Bar */}
                    <div className={styles.buttonContainers}>
                        {/* Audio Toggle */}
                        <Tooltip title={audio ? "Mute Microphone" : "Unmute Microphone"}>
                            <IconButton onClick={handleAudio} sx={{ 
                                color: "white", 
                                bgcolor: audio ? "rgba(255,255,255,0.08)" : "rgba(239, 68, 68, 0.2)",
                                border: "1px solid",
                                borderColor: audio ? "rgba(255,255,255,0.08)" : "rgba(239, 68, 68, 0.4)",
                                p: 1.5,
                                "&:hover": { bgcolor: audio ? "rgba(255,255,255,0.18)" : "rgba(239, 68, 68, 0.3)" }
                            }}>
                                {audio ? <MicIcon /> : <MicOffIcon sx={{ color: "#ef4444" }} />}
                            </IconButton>
                        </Tooltip>

                        {/* Video Toggle */}
                        <Tooltip title={video ? "Stop Camera" : "Start Camera"}>
                            <IconButton onClick={handleVideo} sx={{ 
                                color: "white", 
                                bgcolor: video ? "rgba(255,255,255,0.08)" : "rgba(239, 68, 68, 0.2)",
                                border: "1px solid",
                                borderColor: video ? "rgba(255,255,255,0.08)" : "rgba(239, 68, 68, 0.4)",
                                p: 1.5,
                                "&:hover": { bgcolor: video ? "rgba(255,255,255,0.18)" : "rgba(239, 68, 68, 0.3)" }
                            }}>
                                {video ? <VideocamIcon /> : <VideocamOffIcon sx={{ color: "#ef4444" }} />}
                            </IconButton>
                        </Tooltip>

                        {/* Screen Share Toggle */}
                        {screenAvailable && (
                            <Tooltip title={screen ? "Stop Sharing Screen" : "Share Screen"}>
                                <IconButton onClick={handleScreen} sx={{ 
                                    color: screen ? "var(--success)" : "white",
                                    bgcolor: screen ? "rgba(16, 185, 129, 0.15)" : "rgba(255,255,255,0.08)",
                                    border: "1px solid",
                                    borderColor: screen ? "rgba(16, 185, 129, 0.3)" : "rgba(255,255,255,0.08)",
                                    p: 1.5,
                                    "&:hover": { bgcolor: screen ? "rgba(16, 185, 129, 0.25)" : "rgba(255,255,255,0.18)" }
                                }}>
                                    {screen ? <StopScreenShareIcon /> : <ScreenShareIcon />}
                                </IconButton>
                            </Tooltip>
                        )}

                        {/* Emoji Reactions Trigger */}
                        <Tooltip title="Send Reaction">
                            <IconButton onClick={handleReactionsClick} sx={{ 
                                color: "white", 
                                bgcolor: "rgba(255,255,255,0.08)",
                                border: "1px solid rgba(255,255,255,0.08)",
                                p: 1.5,
                                "&:hover": { bgcolor: "rgba(255,255,255,0.18)" }
                            }}>
                                <EmojiEmotionsIcon />
                            </IconButton>
                        </Tooltip>

                        {/* Emojis Popover Menu */}
                        <Menu
                            anchorEl={reactionsAnchorEl}
                            open={Boolean(reactionsAnchorEl)}
                            onClose={handleReactionsClose}
                            PaperProps={{
                                sx: {
                                    bgcolor: "#12141a",
                                    border: "1px solid rgba(255,255,255,0.08)",
                                    borderRadius: "12px",
                                    p: 0.5,
                                    mt: -1
                                }
                            }}
                            anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
                            transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                        >
                            <Box sx={{ display: "flex", gap: 1, p: 0.5 }}>
                                {['👍', '👏', '🎉', '❤️', '😂', '😮'].map(emoji => (
                                    <MenuItem 
                                        key={emoji} 
                                        onClick={() => sendReaction(emoji)}
                                        sx={{ 
                                            fontSize: "1.4rem", 
                                            borderRadius: "8px", 
                                            px: 1.5,
                                            py: 0.8,
                                            "&:hover": { bgcolor: "rgba(255,255,255,0.08)" }
                                        }}
                                    >
                                        {emoji}
                                    </MenuItem>
                                ))}
                            </Box>
                        </Menu>

                        <Divider orientation="vertical" flexItem sx={{ bgcolor: "rgba(255,255,255,0.1)" }} />

                        {/* Fullscreen Toggle */}
                        <Tooltip title={isFullscreen ? "Exit Full Screen" : "Enter Full Screen"}>
                            <IconButton onClick={toggleFullScreen} sx={{ 
                                color: "white", 
                                bgcolor: isFullscreen ? "rgba(47, 111, 235, 0.15)" : "rgba(255,255,255,0.08)",
                                border: "1px solid",
                                borderColor: isFullscreen ? "rgba(47, 111, 235, 0.3)" : "rgba(255,255,255,0.08)",
                                p: 1.5,
                                "&:hover": { bgcolor: isFullscreen ? "rgba(47, 111, 235, 0.25)" : "rgba(255,255,255,0.18)" }
                            }}>
                                {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
                            </IconButton>
                        </Tooltip>

                        {/* Video Recording Toggle */}
                        <Tooltip title={isRecording ? "Stop Recording" : "Record Meeting"}>
                            <IconButton onClick={isRecording ? stopRecordingCall : startRecordingCall} sx={{ 
                                color: isRecording ? "var(--danger)" : "white", 
                                bgcolor: isRecording ? "rgba(239, 68, 68, 0.15)" : "rgba(255,255,255,0.08)",
                                border: "1px solid",
                                borderColor: isRecording ? "rgba(239, 68, 68, 0.3)" : "rgba(255,255,255,0.08)",
                                p: 1.5,
                                animation: isRecording ? `${styles.pulseRed} 1.5s infinite` : "none",
                                "&:hover": { bgcolor: isRecording ? "rgba(239, 68, 68, 0.25)" : "rgba(255,255,255,0.18)" }
                            }}>
                                {isRecording ? <StopIcon /> : <FiberManualRecordIcon />}
                            </IconButton>
                        </Tooltip>

                        {/* Info Toggle */}
                        <Tooltip title="Meeting Details">
                            <IconButton onClick={() => setDetailsOpen(!detailsOpen)} sx={{ 
                                color: detailsOpen ? "var(--primary)" : "white",
                                bgcolor: detailsOpen ? "rgba(47, 111, 235, 0.15)" : "rgba(255,255,255,0.08)",
                                border: "1px solid",
                                borderColor: detailsOpen ? "rgba(47, 111, 235, 0.3)" : "rgba(255,255,255,0.08)",
                                p: 1.5,
                                "&:hover": { bgcolor: detailsOpen ? "rgba(47, 111, 235, 0.25)" : "rgba(255,255,255,0.18)" }
                            }}>
                                <InfoIcon />
                            </IconButton>
                        </Tooltip>

                        {/* Participants Toggle */}
                        <Tooltip title="Participants">
                            <IconButton onClick={toggleParticipants} sx={{ 
                                color: (sidebarOpen && sidebarTab === "participants") ? "var(--primary)" : "white",
                                bgcolor: (sidebarOpen && sidebarTab === "participants") ? "rgba(47, 111, 235, 0.15)" : "rgba(255,255,255,0.08)",
                                border: "1px solid",
                                borderColor: (sidebarOpen && sidebarTab === "participants") ? "rgba(47, 111, 235, 0.3)" : "rgba(255,255,255,0.08)",
                                p: 1.5,
                                "&:hover": { bgcolor: (sidebarOpen && sidebarTab === "participants") ? "rgba(47, 111, 235, 0.25)" : "rgba(255,255,255,0.18)" }
                            }}>
                                <Badge badgeContent={participants.length} color="primary">
                                    <PeopleIcon />
                                </Badge>
                            </IconButton>
                        </Tooltip>

                        {/* Chat Toggle */}
                        <Tooltip title="Chat messages">
                            <IconButton onClick={toggleChat} sx={{ 
                                color: (sidebarOpen && sidebarTab === "chat") ? "var(--primary)" : "white",
                                bgcolor: (sidebarOpen && sidebarTab === "chat") ? "rgba(47, 111, 235, 0.15)" : "rgba(255,255,255,0.08)",
                                border: "1px solid",
                                borderColor: (sidebarOpen && sidebarTab === "chat") ? "rgba(47, 111, 235, 0.3)" : "rgba(255,255,255,0.08)",
                                p: 1.5,
                                "&:hover": { bgcolor: (sidebarOpen && sidebarTab === "chat") ? "rgba(47, 111, 235, 0.25)" : "rgba(255,255,255,0.18)" }
                            }}>
                                <Badge badgeContent={newMessages} color="secondary">
                                    <ChatIcon />
                                </Badge>
                            </IconButton>
                        </Tooltip>

                        {/* Notes Tab Toggle */}
                        <Tooltip title="Meeting Notes">
                            <IconButton onClick={toggleNotes} sx={{ 
                                color: (sidebarOpen && sidebarTab === "notes") ? "var(--primary)" : "white",
                                bgcolor: (sidebarOpen && sidebarTab === "notes") ? "rgba(47, 111, 235, 0.15)" : "rgba(255,255,255,0.08)",
                                border: "1px solid",
                                borderColor: (sidebarOpen && sidebarTab === "notes") ? "rgba(47, 111, 235, 0.3)" : "rgba(255,255,255,0.08)",
                                p: 1.5,
                                "&:hover": { bgcolor: (sidebarOpen && sidebarTab === "notes") ? "rgba(47, 111, 235, 0.25)" : "rgba(255,255,255,0.18)" }
                            }}>
                                <AssignmentIcon />
                            </IconButton>
                        </Tooltip>

                        <Divider orientation="vertical" flexItem sx={{ bgcolor: "rgba(255,255,255,0.1)" }} />

                        {/* Call End Button */}
                        <Tooltip title="End Meeting">
                            <Button 
                                variant="contained" 
                                onClick={handleEndCall} 
                                startIcon={<CallEndIcon />}
                                sx={{ 
                                    bgcolor: "var(--danger)",
                                    borderRadius: "9999px",
                                    height: "44px",
                                    px: 3,
                                    fontWeight: 700,
                                    "&:hover": { bgcolor: "var(--danger-hover)" }
                                }}
                            >
                                Leave
                            </Button>
                        </Tooltip>
                    </div>

                    {/* Floating Info / Details Popover */}
                    {detailsOpen && (
                        <Paper 
                            elevation={10} 
                            sx={{ 
                                position: "absolute", 
                                bottom: "90px", 
                                left: "20px", 
                                p: 3, 
                                borderRadius: "16px",
                                border: "1px solid rgba(255,255,255,0.08)",
                                bgcolor: "var(--bg-room-card)",
                                color: "white",
                                width: "320px",
                                zIndex: 45
                            }}
                        >
                            {/* Close Icon to hide */}
                            <IconButton 
                                size="small" 
                                onClick={() => setDetailsOpen(false)}
                                sx={{ position: "absolute", top: 12, right: 12, color: "var(--text-room-muted)", "&:hover": { color: "white" } }}
                            >
                                <CloseIcon fontSize="small" />
                            </IconButton>

                            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
                                <InfoIcon fontSize="small" sx={{ color: "var(--primary)" }} /> Meeting Info
                            </Typography>
                            
                            <Box sx={{ mb: 2 }}>
                                <Typography variant="caption" sx={{ color: "var(--text-room-muted)", display: "block", mb: 0.5 }}>Meeting Code</Typography>
                                <Box sx={{ display: "flex", justifySpace: "between", alignItems: "center", bgcolor: "#0d0e14", p: 1, borderRadius: "6px" }}>
                                    <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: "monospace" }}>{url}</Typography>
                                    <IconButton size="small" onClick={handleCopyMeetingCode} sx={{ color: "#60a5fa" }}>
                                        <ContentCopyIcon fontSize="inherit" />
                                    </IconButton>
                                </Box>
                            </Box>
                            
                            <Box sx={{ display: "flex", gap: 1 }}>
                                <Button 
                                    fullWidth 
                                    variant="outlined" 
                                    size="small"
                                    onClick={handleCopyInviteLink}
                                    sx={{ 
                                        borderColor: "rgba(255,255,255,0.1)", 
                                        color: "white", 
                                        textTransform: "none", 
                                        borderRadius: "6px" 
                                    }}
                                >
                                    Copy Link
                                </Button>
                                <Button 
                                    fullWidth 
                                    variant="contained" 
                                    size="small"
                                    startIcon={<ShareIcon fontSize="inherit" />}
                                    onClick={handleShareInvite}
                                    sx={{ 
                                        bgcolor: "var(--primary)", 
                                        color: "white", 
                                        textTransform: "none", 
                                        borderRadius: "6px",
                                        "&:hover": { bgcolor: "var(--primary-hover)" }
                                    }}
                                >
                                    Share
                                </Button>
                            </Box>
                        </Paper>
                    )}

                    </div>

                    {/* Slide-out Sidebar Panels (Right) */}
                    {sidebarOpen && (
                        <div className={styles.chatRoom}>
                            <div className={styles.chatContainer}>
                                {/* Tab select */}
                                <div className={styles.sidebarHeader}>
                                    <div 
                                        className={`${styles.sidebarTab} ${sidebarTab === 'chat' ? styles.sidebarTabActive : ''}`}
                                        onClick={() => setSidebarTab("chat")}
                                    >
                                        Chat
                                    </div>
                                    <div 
                                        className={`${styles.sidebarTab} ${sidebarTab === 'participants' ? styles.sidebarTabActive : ''}`}
                                        onClick={() => setSidebarTab("participants")}
                                    >
                                        People ({participants.length})
                                    </div>
                                    <div 
                                        className={`${styles.sidebarTab} ${sidebarTab === 'notes' ? styles.sidebarTabActive : ''}`}
                                        onClick={() => setSidebarTab("notes")}
                                    >
                                        Notes
                                    </div>
                                </div>

                                {/* Tab 1: Chat Message List */}
                                {sidebarTab === "chat" && (
                                    <>
                                        <div className={styles.chattingDisplay}>
                                            {messages.length !== 0 ? (
                                                messages.map((item, index) => {
                                                    const isSelf = item.sender === username;
                                                    return (
                                                        <div className={`${styles.msgRow} ${isSelf ? styles.msgRowSelf : ''}`} key={index}>
                                                            <span className={styles.msgSender}>{item.sender}</span>
                                                            <div className={`${styles.msgBubble} ${isSelf ? styles.msgBubbleSelf : styles.msgBubbleOther}`}>
                                                                {item.data}
                                                            </div>
                                                            <span className={styles.msgTime}>{item.time}</span>
                                                        </div>
                                                    )
                                                })
                                            ) : (
                                                <div className={styles.chatEmptyState}>
                                                    <ChatIcon sx={{ fontSize: 48, color: "rgba(255,255,255,0.1)" }} />
                                                    <Typography variant="body2">No Messages Yet</Typography>
                                                    <Typography variant="caption" sx={{ textAlign: "center", color: "var(--text-room-muted)" }}>
                                                        Messages sent in-call are visible to everyone.
                                                    </Typography>
                                                </div>
                                            )}
                                            <div ref={chatEndRef} />
                                        </div>

                                        <div className={styles.chattingArea}>
                                            <TextField 
                                                className={styles.chatInput}
                                                value={message} 
                                                onChange={handleMessage} 
                                                placeholder="Send message..." 
                                                variant="outlined" 
                                                size="small"
                                                onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
                                            />
                                            <Button variant='contained' onClick={sendMessage} sx={{ bgcolor: "var(--primary)" }}>Send</Button>
                                        </div>
                                    </>
                                )}

                                {/* Tab 2: Participants list */}
                                {sidebarTab === "participants" && (
                                    <div className={styles.participantsList}>
                                        {!isLocalAdmin && (
                                            <Button 
                                                fullWidth
                                                variant="outlined" 
                                                size="small" 
                                                onClick={handleRequestAdmin}
                                                disabled={adminRequestSent}
                                                startIcon={<AdminPanelSettingsIcon />}
                                                sx={{ 
                                                    mb: 1.5,
                                                    py: 1,
                                                    borderRadius: "8px",
                                                    textTransform: "none", 
                                                    borderColor: "rgba(96, 165, 250, 0.4)", 
                                                    color: "#60a5fa",
                                                    fontWeight: 600,
                                                    "&:hover": { borderColor: "#60a5fa", bgcolor: "rgba(96, 165, 250, 0.1)" },
                                                    "&.Mui-disabled": { color: "rgba(255,255,255,0.3)", borderColor: "rgba(255,255,255,0.05)" }
                                                }}
                                            >
                                                {adminRequestSent ? "Host Request Pending..." : "Request to be Admin"}
                                            </Button>
                                        )}

                                        {/* Local user entry */}
                                        <div className={styles.participantItem}>
                                            <div className={styles.participantUser}>
                                                <div className={styles.participantAvatar}>
                                                    {getInitials(username)}
                                                </div>
                                                <span className={styles.participantName}>
                                                    {username} (You)
                                                    {localParticipant?.isAdmin && (
                                                        <Tooltip title="Host / Admin">
                                                            <AdminPanelSettingsIcon sx={{ fontSize: 16, color: "#60a5fa", ml: 0.5, verticalAlign: "middle" }} />
                                                        </Tooltip>
                                                    )}
                                                </span>
                                            </div>
                                            <div className={styles.participantIcons}>
                                                {!audio ? (
                                                    <MicOffIcon fontSize="small" className={styles.participantMuted} />
                                                ) : (
                                                    <MicIcon fontSize="small" />
                                                )}
                                                {!video ? (
                                                    <VideocamOffIcon fontSize="small" className={styles.participantMuted} />
                                                ) : (
                                                    <VideocamIcon fontSize="small" />
                                                )}
                                            </div>
                                        </div>

                                        {/* Remote users list */}
                                        {participants.filter(p => p.socketId !== socketIdRef.current).map((p, index) => (
                                            <div className={styles.participantItem} key={index}>
                                                <div className={styles.participantUser}>
                                                    <div className={styles.participantAvatar}>
                                                        {getInitials(p.username)}
                                                    </div>
                                                    <span className={styles.participantName}>
                                                        {p.username || "Guest"}
                                                        {p.isAdmin && (
                                                            <Tooltip title="Host / Admin">
                                                                <AdminPanelSettingsIcon sx={{ fontSize: 16, color: "#60a5fa", ml: 0.5, verticalAlign: "middle" }} />
                                                            </Tooltip>
                                                        )}
                                                    </span>
                                                </div>
                                                <div className={styles.participantIcons} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                    {isLocalAdmin && (
                                                        <Tooltip title="Transfer Host Control">
                                                            <IconButton 
                                                                size="small" 
                                                                onClick={() => handleTransferAdminDirectly(p.socketId)}
                                                                sx={{ color: "#60a5fa", p: 0.5 }}
                                                            >
                                                                <SupervisorAccountIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    )}
                                                    {p.audio === false ? (
                                                        <MicOffIcon fontSize="small" className={styles.participantMuted} />
                                                    ) : (
                                                        <MicIcon fontSize="small" />
                                                    )}
                                                    {p.video === false ? (
                                                        <VideocamOffIcon fontSize="small" className={styles.participantMuted} />
                                                    ) : (
                                                        <VideocamIcon fontSize="small" />
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Tab 3: Meeting Notes */}
                                {sidebarTab === "notes" && (
                                    <div className={styles.notesContainer}>
                                        <textarea 
                                            className={styles.notesTextArea}
                                            value={notes}
                                            onChange={handleNotesChange}
                                            placeholder="Type your personal meeting notes here. They will persist in your browser for this room..."
                                        />
                                        <div className={styles.notesActions}>
                                            <Button 
                                                fullWidth 
                                                variant="outlined" 
                                                onClick={() => {
                                                    navigator.clipboard.writeText(notes);
                                                    showToast("Notes copied to clipboard!");
                                                }}
                                                sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.1)', textTransform: 'none', fontWeight: 600 }}
                                            >
                                                Copy Notes
                                            </Button>
                                            <Button 
                                                fullWidth 
                                                variant="outlined" 
                                                color="error" 
                                                onClick={() => {
                                                    setNotes("");
                                                    localStorage.removeItem(`meetspace_notes_${url}`);
                                                }}
                                                sx={{ textTransform: 'none', fontWeight: 600 }}
                                            >
                                                Clear
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                </div>
            )}

            {/* Admin Request Dialog */}
            <Dialog
                open={Boolean(adminRequestPrompt)}
                onClose={() => handleDeclineAdminRequest(adminRequestPrompt?.socketId)}
                PaperProps={{
                    sx: {
                        bgcolor: "#12141a",
                        color: "white",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: "16px",
                        p: 1
                    }
                }}
            >
                <DialogTitle sx={{ fontWeight: 700 }}>Request for Admin Rights</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.7)" }}>
                        <strong>{adminRequestPrompt?.username}</strong> is requesting to become the admin/host of this meeting.
                        If you accept, you will transfer all admin controls to them.
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button 
                        onClick={() => handleDeclineAdminRequest(adminRequestPrompt?.socketId)} 
                        sx={{ color: "#ef4444", fontWeight: 600, textTransform: "none" }}
                    >
                        Decline
                    </Button>
                    <Button 
                        variant="contained" 
                        onClick={() => handleAcceptAdminRequest(adminRequestPrompt?.socketId)} 
                        sx={{ bgcolor: "var(--primary)", fontWeight: 700, textTransform: "none", "&:hover": { bgcolor: "var(--primary-hover)" } }}
                    >
                        Transfer Host
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={toastOpen}
                autoHideDuration={4000}
                onClose={() => setToastOpen(false)}
                anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
                <Alert onClose={() => setToastOpen(false)} severity="info" variant="filled" sx={{ width: '100%', borderRadius: "10px", fontWeight: 600 }}>
                    {toastMessage}
                </Alert>
            </Snackbar>
        </div>
    )
}