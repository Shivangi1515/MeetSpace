import express from "express";
import  {createServer} from "node:http";

import {Server} from "socket.io";
import  mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

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