import { Server } from "socket.io"


let connections = {}
let messages = {}
let timeOnline = {}
let socketStates = {} // socketId -> { username, video, audio, screen }
let admins = {} // roomPath -> socketId of admin

const findRoomOfSocket = (socketId) => {
    for (const [room, list] of Object.entries(connections)) {
        if (list.includes(socketId)) {
            return room;
        }
    }
    return null;
}

export const connectToSocket = (server) => {
    const io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
            allowedHeaders: ["*"],
            credentials: true
        }
    });


    io.on("connection", (socket) => {

        console.log("SOMETHING CONNECTED")

        socket.on("join-call", (path, username, initialVideo, initialAudio) => {

            if (connections[path] === undefined) {
                connections[path] = []
            }
            connections[path].push(socket.id)

            timeOnline[socket.id] = new Date();
            const videoState = initialVideo !== undefined ? initialVideo : true;
            const audioState = initialAudio !== undefined ? initialAudio : true;
            socketStates[socket.id] = { username: username || "Guest", video: videoState, audio: audioState, screen: false };

            // Set joining user as admin if no admin is set for this room
            if (!admins[path]) {
                admins[path] = socket.id;
            }

            for (let a = 0; a < connections[path].length; a++) {
                io.to(connections[path][a]).emit("user-joined", socket.id, connections[path])
            }

            // Broadcast participant list to everyone in the room
            const participantList = connections[path].map(id => ({
                socketId: id,
                isAdmin: admins[path] === id,
                ...socketStates[id]
            }));

            connections[path].forEach(elem => {
                io.to(elem).emit("participant-list", participantList);
            });

            if (messages[path] !== undefined) {
                for (let a = 0; a < messages[path].length; ++a) {
                    io.to(socket.id).emit("chat-message", messages[path][a]['data'],
                        messages[path][a]['sender'], messages[path][a]['socket-id-sender'])
                }
            }

        })

        socket.on("signal", (toId, message) => {
            io.to(toId).emit("signal", socket.id, message);
        })

        socket.on("state-change", (stateName, value) => {
            if (socketStates[socket.id]) {
                socketStates[socket.id][stateName] = value;
            }
            // Find room of this socket
            let matchingRoom = findRoomOfSocket(socket.id);
            if (matchingRoom && connections[matchingRoom]) {
                const participantList = connections[matchingRoom].map(id => ({
                    socketId: id,
                    isAdmin: admins[matchingRoom] === id,
                    ...socketStates[id]
                }));
                connections[matchingRoom].forEach(elem => {
                    io.to(elem).emit("participant-list", participantList);
                });
            }
        })

        socket.on("reaction", (reactionType, sender) => {
            let matchingRoom = null;
            for (const [k, v] of Object.entries(connections)) {
                if (v.includes(socket.id)) {
                    matchingRoom = k;
                    break;
                }
            }
            if (matchingRoom && connections[matchingRoom]) {
                connections[matchingRoom].forEach(elem => {
                    io.to(elem).emit("reaction", reactionType, sender, socket.id);
                });
            }
        })

        socket.on("chat-message", (data, sender) => {

            const [matchingRoom, found] = Object.entries(connections)
                .reduce(([room, isFound], [roomKey, roomValue]) => {


                    if (!isFound && roomValue.includes(socket.id)) {
                        return [roomKey, true];
                    }

                    return [room, isFound];

                }, ['', false]);

            if (found === true) {
                if (messages[matchingRoom] === undefined) {
                    messages[matchingRoom] = []
                }

                messages[matchingRoom].push({ 'sender': sender, "data": data, "socket-id-sender": socket.id })
                console.log("message", matchingRoom, ":", sender, data)

                connections[matchingRoom].forEach((elem) => {
                    io.to(elem).emit("chat-message", data, sender, socket.id)
                })
            }

        })

        socket.on("disconnect", () => {

            var diffTime = Math.abs(timeOnline[socket.id] - new Date())

            var key

            for (const [k, v] of JSON.parse(JSON.stringify(Object.entries(connections)))) {

                for (let a = 0; a < v.length; ++a) {
                    if (v[a] === socket.id) {
                        key = k

                        for (let a = 0; a < connections[key].length; ++a) {
                            io.to(connections[key][a]).emit('user-left', socket.id)
                        }

                        var index = connections[key].indexOf(socket.id)

                        connections[key].splice(index, 1)


                        if (connections[key].length === 0) {
                            delete connections[key]
                            delete admins[key]
                        } else {
                            // If the disconnected user was the admin, transfer to the next available participant
                            let wasAdmin = false;
                            if (admins[key] === socket.id) {
                                wasAdmin = true;
                                admins[key] = connections[key][0] || null;
                            }

                            // Broadcast updated participant list to remaining users
                            const participantList = connections[key].map(id => ({
                                socketId: id,
                                isAdmin: admins[key] === id,
                                ...socketStates[id]
                            }));
                            connections[key].forEach(elem => {
                                io.to(elem).emit("participant-list", participantList);
                                if (wasAdmin && admins[key]) {
                                    io.to(elem).emit("admin-transferred", {
                                        newAdminId: admins[key],
                                        newAdminName: socketStates[admins[key]]?.username || "Guest"
                                    });
                                }
                            });
                        }
                    }
                }

            }

            delete socketStates[socket.id];
            delete timeOnline[socket.id];

        })

        socket.on("request-admin", () => {
            const path = findRoomOfSocket(socket.id);
            if (path && admins[path]) {
                const requesterName = socketStates[socket.id]?.username || "Guest";
                io.to(admins[path]).emit("admin-request-received", { socketId: socket.id, username: requesterName });
            }
        });

        socket.on("decline-admin-request", (targetSocketId) => {
            const path = findRoomOfSocket(socket.id);
            if (path && admins[path] === socket.id) {
                io.to(targetSocketId).emit("admin-request-declined");
            }
        });

        socket.on("transfer-admin", (targetSocketId) => {
            const path = findRoomOfSocket(socket.id);
            if (path && admins[path] === socket.id) {
                if (connections[path] && connections[path].includes(targetSocketId)) {
                    admins[path] = targetSocketId;
                    const participantList = connections[path].map(id => ({
                        socketId: id,
                        isAdmin: admins[path] === id,
                        ...socketStates[id]
                    }));
                    connections[path].forEach(elem => {
                        io.to(elem).emit("participant-list", participantList);
                        io.to(elem).emit("admin-transferred", {
                            newAdminId: targetSocketId,
                            newAdminName: socketStates[targetSocketId]?.username || "Guest"
                        });
                    });
                }
            }
        });


    })


    return io;
}
