const http = require("http");
const { WebSocketServer } = require("ws");
const url = require("url");
const uuidv4 = require("uuid").v4;
const knex = require("knex");

//HTTP server
const server = http.createServer();
const socketServer = new WebSocketServer({ server });

//Websocket Port
const port = 3001;


// PostgreSQL
const db = knex({
    client: "pg",
    connection: {
        host: "localhost",
        user: "postgres",
        password: "root",
        database: "websocket"
    },
})

//SELECT column (etc. '*', 'username') FROM table (etc. 'chats', 'users') 
const selectAllData = (table, column) => {
    return db.select(column)
        .from(table)
        .then((data) => {
            //return database data when called.
            return data
        }).catch((error) => {
            console.error('Error on getting data from the DB: ' + error)
        })
}

//INSERT INTO chats (author, msg, time, id) VALUES ('user', 'msg', 'time', 'uuid');
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


// Store active connections
const connections = {}
// Store active users with uuid
const users = {};
//Store messages in array from SQL query result.
var bUser = [];
//Store duplicated users by username and delete after check isDuplicate.
const watcher = new Set();
// Time variables for use in every block.

const handleMessage = (bytes, uuid) => {
    // Identifying timestamps.
    now = new Date();
    hours = now.getHours();
    minutes = now.getMinutes();
    time = `${hours}:${minutes < 10 ? '0' + minutes : minutes}`
    date = ('0' + now.getDate()).slice(-2) + '/' + ('0' + (now.getMonth() + 1)).slice(-2) + '/' + now.getFullYear();
    timeAndDate = `${date}, ${time}`
    //Read and assign input data to message const.
    const parsedMessage = JSON.parse(bytes)
    if (parsedMessage.type === 'chat-message') {
        const message = parsedMessage.msg;
        const user = users[uuid];
        // check user uuid
        if (!user) {
            console.error(`User not found for UUID: ${uuid}`);
            return;
        }
        insertChatData(user.username, message, timeAndDate, user.UUID)
        broadcastMessages(user, bytes);
    }
    // Insert all data to the db
    // Broadcast messages to the all active clients.
};



const broadcastMessages = (uInfo, bytes) => {
    // Object.keys = change data type Object to Array for map and foreach functions.
    Object.keys(connections).forEach((uuid) => {
        //assign connection with current uuid in connections.
        const connection = connections[uuid];
        const message = JSON.parse(bytes)
        //Send message to the client-side with specific event name. It can be catch at the client-side.
        connection.send(JSON.stringify({ event: "message-server", mesg: message.msg, author: uInfo.username, time: timeAndDate, disconnectedUser: '', }));
    });
};

const broadcastDisconnections = (uInfo) => {
    Object.keys(connections).map((uuid) => {
        const connection = connections[uuid];
        //Send specific SERVER message to the client-side for disconnection messages.
        connection.send(JSON.stringify({ event: "message-server", mesg: '', author: 'SERVER', disconnectedUser: uInfo?.username }));
        //Send users named event on close. So send users once connected and once disconnected.
        connection.send(JSON.stringify({ event: "users", users: users }))
    })
}

//Broadcasting users for disconnection & connection status updates.
const broadcastUsers = () => {
    Object.keys(connections).map((uuid) => {
        const connection = connections[uuid];
        connection.send(JSON.stringify({ event: "users", users: users }))
    })
}

const csrfToken = uuidv4();
const validateToken = (msg) => {
    try {
        const parsedMessage = JSON.parse(msg);
        if (parsedMessage.type === 'authToken') {
            last = csrfToken;
            if (last = csrfToken) {
                return true;
            } else {
                return false;
            }
        }
    } catch (error) {
        console.error(error)
    }
    return false;
}


// ON new Connection at websocket
socketServer.on("connection", (connection, request) => {
    //Get username query value at the URL
    const { username } = url.parse(request.url, true).query;

    //Values from 'users' object
    let values = Object.values(users);
    //define isDuplicate checker, initial value is false.
    let isDuplicate = false;
    //Every value in values array.
    values.forEach((item) => {
        // if item (value[0], value[1]...) username match with query param username
        // toLowerCase() removes case sensivity
        // request username = furyex, in active client = Furyex: connection will be rejected. 
        if (item.username.toLowerCase() === username.toLowerCase()) {
            //set isduplicate true
            isDuplicate = true;
            // add duplicated values to where duplicated values store.
            watcher.add(item)
            // Send an event named 'duplicated'
            connection.send(JSON.stringify({ event: 'duplicated', isDuplicated: isDuplicate }))
            // delete duplicated value
            watcher.delete(item)
        }
    });

    
    let last = null;

    // FOR VALIDATING CSRF TOKEN BETWEEN SERVER AND CLIENT
    connection.once("message", (msg) => {
        const parsedMessage = JSON.parse(msg.toString())
        if (parsedMessage.type === 'authToken') {
            last = csrfToken;
        }
        if (isDuplicate === false && csrfToken === last) {
            //create new uuid
            const uuid = uuidv4()
            //if username not empty
            if (username) {
                //create new connection and user with this schemes
                connections[uuid] = connection;
                users[uuid] = {
                    UUID: uuid,
                    username: username,
                    status: "online",
                };
            }
            broadcastUsers();
            //BROADCAST to every client 'database chat data' on connection establish.
            selectAllData('chats')
            .then((data) => {
                bUser = [...data];
                bUser.map((uuid) => {
                    connection.send(JSON.stringify({ event: 'message-server', mesg: uuid.msg, author: uuid.author, time: uuid.time, disconnectedUser: '' }));
                })
            })
    
    
            
            //Handle events.
            connection.on("message", (message) => handleMessage(message, uuid))
            connection.on("close", () => handleClose(uuid))
            //Send isduplicate value after create user. 
            connection.send(JSON.stringify({ event: 'duplicated', isDuplicated: isDuplicate }))
            //Echo Server Information Messages.
            console.log(`User connected: ${username} - [${createTimeAndDate().toString()}]`)
            connection.send(JSON.stringify({ event: 'auth', csrfToken: csrfToken }))
    
        }
    })
    
})

// on Close connection
const handleClose = (uuid) => {
    //get disconnecteduser from users array from uuid.
    const disconnectedUser = users[uuid];
    //delete that uuid and values from connections and users objArray
    delete connections[uuid];
    delete users[uuid];
    //Broadcast 'disconnected' messages to all active clients.
    broadcastDisconnections(disconnectedUser)
    console.log(`User disconnected: ${disconnectedUser.username} - [${createTimeAndDate().toString()}] `)
}

// Listen HTTP server on running.
server.listen(port, () => {
    console.log(`Websocket server started successfully on port: ${port}`);
});