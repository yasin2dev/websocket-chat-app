const http = require("http");
const { WebSocketServer } = require("ws");
const url = require("url");
const uuidv4 = require("uuid").v4;
const knex = require("knex");

const server = http.createServer();
const socketServer = new WebSocketServer({ server });
const port = 3001;

const db = knex({
    client: "pg",
    connection: {
        host: "localhost",
        user: "postgres",
        password: "root",
        database: "websocket"
    },
})

const selectAllData = (table, column) => {
    return db.select(column)
        .from(table)
        .then((data) => {
            return data
        }).catch((error) => {
            console.error('Error on getting data from the DB: ' + error)
        })
}


const insertChatData = (user, msg, time, uuid) => {
    return db('chats').insert({
        author: user,
        msg: msg,
        time: time,
        id: uuid
    }).catch((error) => {
        console.error('Error on inserting chat data to the DB: ' + error)
    })
}

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
        }
        insertChatData(user.username, message, createTimeAndDate(), user.UUID)
        broadcastMessages(user, bytes);
    }
};



const broadcastMessages = (uInfo, bytes) => {
    Object.keys(connections).forEach((uuid) => {
        const connection = connections[uuid];
        const message = JSON.parse(bytes)
        connection.send(JSON.stringify({ event: "message-server", mesg: message.msg, author: uInfo.username, time: timeAndDate, disconnectedUser: '', }));
    });
};

const broadcastDisconnections = (uInfo) => {
    Object.keys(connections).map((uuid) => {
        const connection = connections[uuid];
        connection.send(JSON.stringify({ event: "message-server", mesg: '', author: 'SERVER', disconnectedUser: uInfo?.username }));
        connection.send(JSON.stringify({ event: "users", users: users }))
    })
}

const broadcastUsers = () => {
    Object.keys(connections).map((uuid) => {
        const connection = connections[uuid];
        connection.send(JSON.stringify({ event: "users", users: users }))
    })
}

const csrfToken = uuidv4();

socketServer.on("connection", (connection, request) => {    
    const { username } = url.parse(request.url, true).query;   

    let values = Object.values(users);
    let isDuplicate = false;

    values.forEach((item) => {       
        if (item.username.toLowerCase() === username.toLowerCase()) {
            isDuplicate = true;
            watcher.add(item)
            connection.send(JSON.stringify({ event: 'duplicated', isDuplicated: isDuplicate }))
            watcher.delete(item)
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