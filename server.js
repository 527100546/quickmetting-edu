const path = require('path');
const express = require('express')
const http = require('http')
const moment = require('moment');
const socketio = require('socket.io');
const PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);

const io = socketio(server);

app.use(express.static(path.join(__dirname, 'public')));

let rooms = {};
let socketroom = {};
let socketname = {};
let micSocket = {};
let videoSocket = {};
let roomBoard = {};

io.on('connect', socket => {

socket.on("join room", (roomid, username) => {
    socket.join(roomid);

    // ================== 第一步：彻底清除这个用户名在房间里的一切历史痕迹 ==================
    if (rooms[roomid]) {
        rooms[roomid] = rooms[roomid].filter(oldSocketId => {
            if (socketname[oldSocketId] === username) {
                console.log('【清理僵尸】移除旧用户:', oldSocketId, username);

                // 彻底删除这个旧 socket 的所有记录
                delete socketroom[oldSocketId];
                delete socketname[oldSocketId];
                delete micSocket[oldSocketId];
                delete videoSocket[oldSocketId];

                return false; // 从房间数组里移除
            }
            return true;
        });
    } else {
        rooms[roomid] = [];
    }

    // ================== 第二步：注册当前这个新 socket ==================
    socketroom[socket.id] = roomid;
    socketname[socket.id] = username;
    micSocket[socket.id] = 'on';
    videoSocket[socket.id] = 'on';
    rooms[roomid].push(socket.id);

    // ================== 第三步：发给当前这个用户（包括刷新者）房间里所有真实在线的人 ==================
    // 注意：这里发给他的列表里已经不包含任何同名旧用户了
    const currentMembersExceptMe = rooms[roomid].filter(id => id !== socket.id);

    if (currentMembersExceptMe.length > 0) {
        // 构造干净的映射表
        const names = {}, mics = {}, vids = {};
        rooms[roomid].forEach(id => {
            names[id] = socketname[id];
            mics[id]  = micSocket[id];
            vids[id]  = videoSocket[id];
        });

        io.to(socket.id).emit('join room', currentMembersExceptMe, names, mics, vids);
        socket.to(roomid).emit('message', `${username} 重新连接`, '系统', moment().format("h:mm a"));
    } else {
        // 第一个进来的
        io.to(socket.id).emit('join room', null, null, null, null);
    }

    // ================== 第四步：广播人数 + 白板同步 ==================
    io.to(roomid).emit('user count', rooms[roomid].length);
    if (roomBoard[roomid]) {
        socket.emit('getCanvas', roomBoard[roomid]);
    }
});
    socket.on('action', msg => {
        if (msg == 'mute')
            micSocket[socket.id] = 'off';
        else if (msg == 'unmute')
            micSocket[socket.id] = 'on';
        else if (msg == 'videoon')
            videoSocket[socket.id] = 'on';
        else if (msg == 'videooff')
            videoSocket[socket.id] = 'off';

        socket.to(socketroom[socket.id]).emit('action', msg, socket.id);
    })

    socket.on('video-offer', (offer, sid) => {
        socket.to(sid).emit('video-offer', offer, socket.id, socketname[socket.id], micSocket[socket.id], videoSocket[socket.id]);
    })

    socket.on('video-answer', (answer, sid) => {
        socket.to(sid).emit('video-answer', answer, socket.id);
    })

    socket.on('new icecandidate', (candidate, sid) => {
        socket.to(sid).emit('new icecandidate', candidate, socket.id);
    })

    socket.on('message', (msg, username, roomid) => {
        io.to(roomid).emit('message', msg, username, moment().format(
            "h:mm a"
        ));
    })

    socket.on('getCanvas', () => {
        if (roomBoard[socketroom[socket.id]])
            socket.emit('getCanvas', roomBoard[socketroom[socket.id]]);
    });

    socket.on('draw', (newx, newy, prevx, prevy, color, size) => {
        socket.to(socketroom[socket.id]).emit('draw', newx, newy, prevx, prevy, color, size);
    })

    socket.on('clearBoard', () => {
        socket.to(socketroom[socket.id]).emit('clearBoard');
    });

    socket.on('store canvas', url => {
        roomBoard[socketroom[socket.id]] = url;
    })
socket.on('disconnect', () => {
    if (!socketroom[socket.id]) return;

    const roomid = socketroom[socket.id];
    const username = socketname[socket.id];

    // 彻底清理
    if (rooms[roomid]) {
        rooms[roomid] = rooms[roomid].filter(id => id !== socket.id);
        io.to(roomid).emit('user count', rooms[roomid].length);
    }

    delete socketroom[socket.id];
    delete socketname[socket.id];
    delete micSocket[socket.id];
    delete videoSocket[socket.id];

    socket.to(roomid).emit('message', `${username} 离开会议.`, '系统', moment().format("h:mm a"));
    console.log(username + ' 断开连接');
});
})


server.listen(PORT, () => console.log(`Server is up and running on port ${PORT}`));