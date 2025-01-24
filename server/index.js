const http = require("http");
const { WebSocketServer } = require("ws");
const url = require("url");
const uuidv4 = require("uuid").v4;
const db = require("./database/knex");
const path = require('path');
require("dotenv").config({path: path.resolve(__dirname, '../.env')});

const server = http.createServer();
const socketServer = new WebSocketServer({ server });
const port = process.env.WS_PORT;

const selectAllData = (table) => {
    return db.select("*")
        .from(table)
        .then((data) => {
            return data
        }).catch((error) => {
            console.error('Error on getting data from the DB: ' + error)
        })
}


// WARN: For these operations to work properly, the command 'knex migrate:latest' must be executed.
/* This function inserting message data to the 'chats' table, PostgreSQL database. */
const insertChatData = (user, msg, time, uuid) => {
    return db('chats').insert({
        author: user,
        msg: msg,
        time: time,
        userUuid: uuid
    }).catch((error) => {
        console.error('Error on inserting chat data to the DB: ' + error)
    })
}

/* Create time and date for every block and return final timeAndDate format.*/
/*** 
 * example usage: createTimeAndDate() -> when called function will return time and date in this format: '01/01/2025, 12:00'
 * ***/
var now, date, hours, minutes, time, timeAndDate;
const createTimeAndDate = () => {
    now = new Date();
    hours = now.getHours();
    minutes = now.getMinutes();
    time = `${hours}:${minutes < 10 ? '0' + minutes : minutes}`
    date = ('0' + now.getDate()).slice(-2) + '/' + ('0' + (now.getMonth() + 1)).slice(-2) + '/' + now.getFullYear();
    timeAndDate = `${date}, ${time}`
    return timeAndDate
}


const connections = {}
const users = {};
var bUser = [];
const watcher = new Set();

const handleMessage = (bytes, uuid) => {    
    const parsedMessage = JSON.parse(bytes)
    if (parsedMessage.type === 'chat-message') {
        const message = parsedMessage.msg;
        const user = users[uuid];   
        if (!user) {
            console.error(`User not found for UUID: ${uuid}`);
            return;
        } else {
            insertChatData(user.username, message, createTimeAndDate(), user.UUID)
            broadcastMessages(user, bytes);
        }
    }
};



const broadcastMessages = (uInfo, bytes) => {
    Object.values(connections).forEach((uuid) => {
        const message = JSON.parse(bytes)
        uuid.send(JSON.stringify({ event: "message-server", mesg: message.msg, author: uInfo.username, time: timeAndDate, disconnectedUser: '', }));
    });
};

const broadcastDisconnections = (uInfo) => {
    Object.values(connections).map((uuid) => {
        uuid.send(JSON.stringify({ event: "message-server", mesg: '', author: 'SERVER', disconnectedUser: uInfo?.username }));
        uuid.send(JSON.stringify({ event: "users", users: users }))
    })
}

const broadcastUsers = () => {
    Object.values(connections).map((uuid) => {
        uuid.send(JSON.stringify({ event: "users", users: users }))
    })
}


socketServer.on("connection", (connection, request) => {
    const { username } = url.parse(request.url, true).query;
    const path = url.parse(request.url, true).pathname;
    const validSocketUrl = "/";
    
    if (path === validSocketUrl) {
        const csrfToken = uuidv4();

        let isDuplicate = false;
        Object.values(users).forEach((item) => {       
            if (item.username.toLowerCase() === username.toLowerCase()) {
                isDuplicate = true;
                watcher.add(item)
                connection.send(JSON.stringify({ event: 'duplicated', isDuplicated: isDuplicate }))
                watcher.delete(item)
            } else {
                
            }
        });
        
        
        let last = null;
        connection.once("message", (msg) => {
            const parsedMessage = JSON.parse(msg.toString())
            if (parsedMessage.type === 'authToken') {
                last = csrfToken;
            }
    
            if (isDuplicate === false && csrfToken === last) {
                const uuid = uuidv4()
                if (username) {
                    connections[uuid] = connection;
                    users[uuid] = {
                        UUID: uuid,
                        username: username,
                        status: "online",
                    };
                }
                broadcastUsers();
                selectAllData('chats')
                .then((data) => {
                    bUser = [...data];
                    bUser.map((uuid) => {
                        connection.send(JSON.stringify({ event: 'message-server', mesg: uuid.msg, author: uuid.author, time: uuid.time, disconnectedUser: '' }));
                    })
                })
    
                connection.on("message", (message) => handleMessage(message, uuid))
                connection.on("close", () => handleClose(uuid))
                connection.send(JSON.stringify({ event: 'duplicated', isDuplicated: isDuplicate }))            
                console.log(`User connected: ${username} - [${createTimeAndDate().toString()}]`)
                connection.send(JSON.stringify({ event: 'auth', csrfToken: csrfToken }))
        
            }
        })
    } else {
        socketServer.close(1011, "Invalid socket URL");
    }
})


const handleClose = (uuid) => {
    const disconnectedUser = users[uuid];
    delete connections[uuid];
    delete users[uuid];
    broadcastDisconnections(disconnectedUser)
    console.log(`User disconnected: ${disconnectedUser.username} - [${createTimeAndDate().toString()}] `)
}

server.listen(port, () => {
    console.log(`Websocket server started successfully on port: ${port}`);
});