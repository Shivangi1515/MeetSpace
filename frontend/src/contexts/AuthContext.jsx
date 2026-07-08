import axios from "axios";
import httpStatus from "http-status";
import { createContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  auth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword
} from "../utils/firebase";

import server from "../environment";

export const AuthContext = createContext();

const client = axios.create({
  baseURL: `${server}/api/v1/users`,
});

export const AuthProvider = ({ children }) => {
  const [userData, setUserData] = useState(null);
  const navigate = useNavigate();

  const getUserProfile = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return null;
      const request = await client.get("/get_user_profile", {
        params: { token },
      });
      if (request.status === httpStatus.OK) {
        setUserData(request.data);
        return request.data;
      }
    } catch (err) {
      localStorage.removeItem("token");
      setUserData(null);
    }
  };

  useEffect(() => {
    getUserProfile();
  }, []);

  const handleRegister = async (name, username, password, email) => {
    try {
      // 1. Register user with Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const idToken = await userCredential.user.getIdToken();

      // 2. Synchronize account setup in MongoDB
      const request = await client.post("/firebase-login", {
        token: idToken,
        name
      });

      if (request.status === httpStatus.OK) {
        localStorage.setItem("token", request.data.token);
        setUserData(request.data.user || null);
        navigate("/home");
        return "Registration successful!";
      }
    } catch (err) {
      throw err;
    }
  };

  const handleLogin = async (email, password) => {
    try {
      // 1. Authenticate user credentials with Firebase
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await userCredential.user.getIdToken();

      // 2. Retrieve session token from Node server
      const request = await client.post("/firebase-login", {
        token: idToken,
      });

      if (request.status === httpStatus.OK) {
        localStorage.setItem("token", request.data.token);
        setUserData(request.data.user || null);
        navigate("/home");
      }
    } catch (err) {
      throw err;
    }
  };

  const getHistoryOfUser = async () => {
    try {
      const request = await client.get("/get_all_activity", {
        params: {
          token: localStorage.getItem("token"),
        },
      });
      return request.data;
    } catch (err) {
      throw err;
    }
  };

  const addToUserHistory = async (meetingCode) => {
    try {
      const request = await client.post("/add_to_activity", {
        token: localStorage.getItem("token"),
        meeting_code: meetingCode,
      });
      return request.data;
    } catch (err) {
      throw err;
    }
  };

  const updateMeetingHistory = async (meetingCode, duration, participantsCount, chatCount, meetingTitle) => {
    try {
      const request = await client.post("/update_activity", {
        token: localStorage.getItem("token"),
        meetingCode,
        duration,
        participantsCount,
        chatCount,
        meetingTitle,
      });
      return request.data;
    } catch (err) {
      throw err;
    }
  };

  const deleteMeetingFromHistory = async (meetingId) => {
    try {
      const request = await client.post("/delete_activity", {
        token: localStorage.getItem("token"),
        meetingId,
      });
      return request.data;
    } catch (err) {
      throw err;
    }
  };

  const handleGoogleLogin = async (idToken) => {
    try {
      const request = await client.post("/firebase-login", {
        token: idToken
      });

      if (request.status === httpStatus.OK) {
        localStorage.setItem("token", request.data.token);
        setUserData(request.data.user || null);
        navigate("/home");
      }
    } catch (err) {
      throw err;
    }
  };

  const value = {
    userData,
    setUserData,
    handleRegister,
    handleLogin,
    handleGoogleLogin,
    getHistoryOfUser,
    addToUserHistory,
    updateMeetingHistory,
    deleteMeetingFromHistory,
    getUserProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};