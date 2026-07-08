import httpStatus from "http-status";
import { User } from "../models/user.model.js";
import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { getAuth } from "firebase-admin/auth";
import { getApps } from "firebase-admin/app";
import { Meeting } from "../models/meeting.model.js";

const JWT_SECRET = process.env.JWT_SECRET || "meetspace_sec_key_2026_jwt_token_auth";

// Reusable JWT verification helper
const verifySessionToken = (token) => {
    if (!token) throw new Error("Authentication token is missing");
    return jwt.verify(token, JWT_SECRET);
};

// Unified Firebase Token Login and Registration Handler
const firebaseLogin = async (req, res) => {
    if (getApps().length === 0) {
        return res.status(503).json({ 
            message: "Authentication is temporarily unavailable. Firebase Admin SDK is not initialized." 
        });
    }

    const { token, name: displayName } = req.body;
    if (!token) {
        return res.status(400).json({ message: "Firebase ID Token is required" });
    }

    try {
        // Verify the ID token signature against Firebase/Google certificates
        const decodedToken = await getAuth().verifyIdToken(token);
        const { email, name: tokenName } = decodedToken;

        if (!email) {
            return res.status(400).json({ message: "Email not provided in credentials" });
        }

        // Find or register the user in MongoDB
        let user = await User.findOne({ email });
        
        if (!user) {
            // Derive a unique username
            const baseUsername = email.split("@")[0];
            let checkUser = await User.findOne({ username: baseUsername });
            let finalUsername = baseUsername;
            while (checkUser) {
                finalUsername = baseUsername + Math.floor(Math.random() * 1000);
                checkUser = await User.findOne({ username: finalUsername });
            }

            // Securely hash a random derived password for Firebase authenticated users
            const randomPass = crypto.randomBytes(16).toString("hex");
            const hashedRandomPass = await bcrypt.hash(randomPass, 10);

            user = new User({
                name: displayName || tokenName || baseUsername,
                username: finalUsername,
                email: email,
                password: hashedRandomPass,
                isEmailVerified: true
            });
            await user.save();
        }

        // Sign local JWT Session Token (Expires in 24 hours)
        const sessionToken = jwt.sign(
            { id: user._id, username: user.username },
            JWT_SECRET,
            { expiresIn: "24h" }
        );

        return res.status(httpStatus.OK).json({ 
            token: sessionToken, 
            user: { name: user.name, username: user.username } 
        });

    } catch (e) {
        console.error("Firebase token verification failed:", e);
        return res.status(401).json({ message: `Authentication failed: ${e.message || e}` });
    }
};

// Protected routes (JWT verified)
const getUserHistory = async (req, res) => {
    const { token } = req.query;

    try {
        const decoded = verifySessionToken(token);
        const user = await User.findOne({ username: decoded.username });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const meetings = await Meeting.find({ user_id: user.username });
        return res.json(meetings);
    } catch (e) {
        return res.status(401).json({ message: `Session invalid: ${e.message || e}` });
    }
};

const addToHistory = async (req, res) => {
    const { token, meeting_code } = req.body;

    try {
        const decoded = verifySessionToken(token);
        const user = await User.findOne({ username: decoded.username });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const newMeeting = new Meeting({
            user_id: user.username,
            meetingCode: meeting_code
        });

        await newMeeting.save();
        return res.status(httpStatus.CREATED).json({ message: "Added code to history" });
    } catch (e) {
        return res.status(401).json({ message: `Session invalid: ${e.message || e}` });
    }
};

const updateMeetingHistory = async (req, res) => {
    const { token, meetingCode, duration, participantsCount, chatCount, meetingTitle } = req.body;

    try {
        const decoded = verifySessionToken(token);
        const user = await User.findOne({ username: decoded.username });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const meeting = await Meeting.findOne({ 
            user_id: user.username, 
            meetingCode: meetingCode 
        }).sort({ date: -1 });

        if (meeting) {
            if (duration !== undefined) meeting.duration = duration;
            if (participantsCount !== undefined) meeting.participantsCount = participantsCount;
            if (chatCount !== undefined) meeting.chatCount = chatCount;
            if (meetingTitle !== undefined) meeting.meetingTitle = meetingTitle;

            await meeting.save();
            return res.json({ message: "Meeting history updated successfully" });
        } else {
            return res.status(404).json({ message: "Meeting record not found" });
        }
    } catch (e) {
        return res.status(401).json({ message: `Session invalid: ${e.message || e}` });
    }
};

const deleteMeetingFromHistory = async (req, res) => {
    const { token, meetingId } = req.body;

    try {
        const decoded = verifySessionToken(token);
        const user = await User.findOne({ username: decoded.username });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        await Meeting.deleteOne({ _id: meetingId, user_id: user.username });
        return res.json({ message: "Meeting deleted from history successfully" });
    } catch (e) {
        return res.status(401).json({ message: `Session invalid: ${e.message || e}` });
    }
};

const getUserProfile = async (req, res) => {
    const { token } = req.query;
    if (!token) {
        return res.status(400).json({ message: "Token is required" });
    }

    try {
        const decoded = verifySessionToken(token);
        const user = await User.findOne({ username: decoded.username });
        if (!user) {
            return res.status(httpStatus.NOT_FOUND).json({ message: "User not found" });
        }
        return res.status(httpStatus.OK).json({ name: user.name, username: user.username });
    } catch (e) {
        return res.status(401).json({ message: `Session invalid: ${e.message || e}` });
    }
};

export { 
    firebaseLogin,
    getUserHistory, 
    addToHistory, 
    getUserProfile, 
    updateMeetingHistory, 
    deleteMeetingFromHistory
};