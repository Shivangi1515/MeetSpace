import express from "express";
import  {createServer} from "node:http";

import {Server} from "socket.io";
import  mongoose from "mongoose";
import dotenv from "dotenv";

// Reloading backend to detect service account credentials and SMTP keys
dotenv.config();

import { initializeApp, cert } from "firebase-admin/app";
import fs from "fs";
import path from "path";

const serviceAccountPath = path.resolve("./firebase-service-account.json");
if (fs.existsSync(serviceAccountPath)) {
    try {
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf-8"));
        initializeApp({
            credential: cert(serviceAccount)
        });
        console.log("Firebase Admin SDK initialized successfully");
    } catch (err) {
        console.error("Failed to parse firebase-service-account.json:", err);
    }
} else if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
        initializeApp({
            credential: cert(serviceAccount)
        });
        console.log("Firebase Admin SDK initialized successfully from environment variable");
    } catch (err) {
        console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON environment variable:", err);
    }
} else {
    console.warn("WARNING: firebase-service-account.json not found in backend directory and FIREBASE_SERVICE_ACCOUNT_JSON env is missing. Google Login verification will fail.");
}

import { connectToSocket } from "./controllers/socketManager.js";

import cors from "cors";

import userRoutes from "./routes/users.routes.js";


const app=express();
const server=createServer(app);
const io=connectToSocket(server,{
    cors:{
        origin:"*",
        methods:["GET","POST"],
        allowedHeaders:["*"],
        credentials: true
    }
});

app.set("port",(process.env.PORT || 8000));
app.use(cors());
app.use(express.json({limit:"40kb"}));
app.use(express.urlencoded({extended:true,limit:"40kb"}));

app.use("/api/v1/users",userRoutes);



const start=async()=>{
    app.set("mongo_user")
    const connectionDb=await mongoose.connect(process.env.MONGO_URL);

    console.log(`MONGO Connected DB:${connectionDb.connection.host}`)

    server.listen(app.get("port"),()=>{

        console.log("listening on port 8000!");

    });
}

start();