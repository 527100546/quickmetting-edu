const socket = io();
const myvideo = document.querySelector("#vd1");
const roomid = params.get("room");
let username = params.get("username");
const chatRoom = document.querySelector('.chat-cont');
const sendButton = document.querySelector('.chat-send');
const messageField = document.querySelector('.chat-input');
const videoContainer = document.querySelector('#vcont2');
const overlayContainer = document.querySelector('#overlay')
const continueButt = document.querySelector('.continue-name');
const nameField = document.querySelector('#name-field');
const videoButt = document.querySelector('.novideo');
const audioButt = document.querySelector('.audio');
const cutCall = document.querySelector('.cutcall');
const screenShareButt = document.querySelector('.screenshare');
const whiteboardButt = document.querySelector('.board-icon')

//whiteboard js start
const whiteboardCont = document.querySelector('.whiteboard-cont');
const canvas = document.querySelector("#whiteboard");
const ctx = canvas.getContext('2d');

let boardVisisble = false;

whiteboardCont.style.visibility = 'hidden';

let isDrawing = 0;
let x = 0;
let y = 0;
let color = "black";
let drawsize = 3;
let colorRemote = "black";
let drawsizeRemote = 3;

function fitToContainer(canvas) {
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
}

fitToContainer(canvas);

// ============== 生成虚拟头像视频流（无摄像头时使用）==============
function createVirtualVideoStream(username) {
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');

    // 背景色（柔和灰蓝）
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 画一个圆形头像背景
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2 - 20, 80, 0, Math.PI * 2);
    ctx.fillStyle = '#4ECCA3';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.stroke();

    // 写用户名（自动换行）
    ctx.fillStyle = 'white';
    ctx.font = 'bold 36px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 简单自动折行
    const maxWidth = 200;
    let displayName = username || "用户";
    if (ctx.measureText(displayName).width > maxWidth) {
        displayName = displayName.substring(0, 8) + "...";
    }
    ctx.fillText(displayName, canvas.width / 2, canvas.height / 2 - 20);

    // 下方小文字
    ctx.font = '20px Arial';
    ctx.fillStyle = '#ddd';
    ctx.fillText('无摄像头', canvas.width / 2, canvas.height / 2 + 40);

    // 将 canvas 转为视频流
    const stream = canvas.captureStream(15); // 15fps 足够
    const videoTrack = stream.getVideoTracks()[0];
    videoTrack.contentHint = 'detail'; // 优化静态画面

    // 给 track 加个标识，方便后面判断
    videoTrack.isVirtual = true;

    return stream;
}

//getCanvas call is under join room call
socket.on('getCanvas', url => {
    let img = new Image();
    img.onload = start;
    img.src = url;

    function start() {
        ctx.drawImage(img, 0, 0);
    }

    console.log('got canvas', url)
})

function setColor(newcolor) {
    color = newcolor;
    drawsize = 3;
}

function setEraser() {
    color = "white";
    drawsize = 10;
}

//might remove this
function reportWindowSize() {
    fitToContainer(canvas);
}

window.onresize = reportWindowSize;
//

function clearBoard() {
    if (window.confirm('Are you sure you want to clear board? This cannot be undone')) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        socket.emit('store canvas', canvas.toDataURL());
        socket.emit('clearBoard');
    }
    else return;
}

socket.on('clearBoard', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
})

function draw(newx, newy, oldx, oldy) {
    ctx.strokeStyle = color;
    ctx.lineWidth = drawsize;
    ctx.beginPath();
    ctx.moveTo(oldx, oldy);
    ctx.lineTo(newx, newy);
    ctx.stroke();
    ctx.closePath();

    socket.emit('store canvas', canvas.toDataURL());

}

function drawRemote(newx, newy, oldx, oldy) {
    ctx.strokeStyle = colorRemote;
    ctx.lineWidth = drawsizeRemote;
    ctx.beginPath();
    ctx.moveTo(oldx, oldy);
    ctx.lineTo(newx, newy);
    ctx.stroke();
    ctx.closePath();

}

canvas.addEventListener('mousedown', e => {
    x = e.offsetX;
    y = e.offsetY;
    isDrawing = 1;
})

canvas.addEventListener('mousemove', e => {
    if (isDrawing) {
        draw(e.offsetX, e.offsetY, x, y);
        socket.emit('draw', e.offsetX, e.offsetY, x, y, color, drawsize);
        x = e.offsetX;
        y = e.offsetY;
    }
})

window.addEventListener('mouseup', e => {
    if (isDrawing) {
        isDrawing = 0;
    }
})

socket.on('draw', (newX, newY, prevX, prevY, color, size) => {
    colorRemote = color;
    drawsizeRemote = size;
    drawRemote(newX, newY, prevX, prevY);
})

//whiteboard js end

let videoAllowed = 1;
let audioAllowed = 1;

let micInfo = {};
let videoInfo = {};

let videoTrackReceived = {};

let mymuteicon = document.querySelector("#mymuteicon");
mymuteicon.style.visibility = 'hidden';

let myvideooff = document.querySelector("#myvideooff");
myvideooff.style.visibility = 'hidden';

const configuration = { iceServers: [{ urls: "stun:stun.stunprotocol.org" }] }

let mediaConstraints = { video: false, audio: true };

let connections = {};
let cName = {};
let audioTrackSent = {};
let videoTrackSent = {};

let mystream, myscreenshare;


document.querySelector('.roomcode').innerHTML = `${roomid}`

function CopyClassText() {

    var textToCopy = document.querySelector('.roomcode');
    var currentRange;
    if (document.getSelection().rangeCount > 0) {
        currentRange = document.getSelection().getRangeAt(0);
        window.getSelection().removeRange(currentRange);
    }
    else {
        currentRange = false;
    }

    var CopyRange = document.createRange();
    CopyRange.selectNode(textToCopy);
    window.getSelection().addRange(CopyRange);
    document.execCommand("copy");

    window.getSelection().removeRange(CopyRange);

    if (currentRange) {
        window.getSelection().addRange(currentRange);
    }

    document.querySelector(".copycode-button").textContent = "Copied!"
    setTimeout(()=>{
        document.querySelector(".copycode-button").textContent = "Copy Code";
    }, 5000);
}


continueButt.addEventListener('click', () => {
    if (nameField.value == '') return;
    username = nameField.value;
    overlayContainer.style.visibility = 'hidden';
    document.querySelector("#myname").innerHTML = `${username} (您)`;
    socket.emit("join room", roomid, username);

})

if(!!username){
    overlayContainer.style.visibility = 'hidden';
    document.querySelector("#myname").innerHTML = `${username} (您)`;
    socket.emit("join room", roomid, username);
}

nameField.addEventListener("keyup", function (event) {
    if (event.keyCode === 13) {
        event.preventDefault();
        continueButt.click();
    }
});

socket.on('user count', count => {
    if (count > 1) {
        videoContainer.className = 'video-cont';
    }
    else {
        videoContainer.className = 'video-cont-single';
    }
})

let peerConnection;

function handleGetUserMediaError(e) {
    switch (e.name) {
        case "NotFoundError":
            alert("Unable to open your call because no camera and/or microphone" +
                "were found.");
            break;
        case "SecurityError":
        case "PermissionDeniedError":
            break;
        default:
            alert("Error opening your camera and/or microphone: " + e.message);
            break;
    }

}


function reportError(e) {
    console.log(e);
    return;
}

// ==================== 智能获取媒体流（无摄像头/麦克风也能进） ====================
async function requestMediaStream() {
    let hasVideo = false;
    let hasAudio = false;

    try {
        hasVideo = !!(await navigator.mediaDevices.getUserMedia({ video: true }).catch(() => false));
    } catch (e) { hasVideo = false; }
    try {
        hasAudio = !!(await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => false));
    } catch (e) { hasAudio = false; }

    mediaConstraints = {
        video: hasVideo,
        audio: hasAudio
    };

    if (!hasVideo && !hasAudio) {
        console.log("无摄像头无麦克风 → 纯聊天 + 虚拟头像");
        mystream = createVirtualVideoStream(username); // 虚拟视频流
        myvideo.srcObject = mystream;
        myvideo.muted = true;

        videoAllowed = 1; // 允许“关闭视频”按钮（其实是隐藏虚拟头像）
        audioAllowed = 0;
        audioButt.innerHTML = `<i class="fas fa-microphone-slash"></i>`;
        audioButt.style.backgroundColor = "#666";
        audioButt.disabled = true;
        mymuteicon.style.visibility = 'visible';

        addMyOwnSmallVideo();
        return;
    }

    try {
        const realStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);

        // 如果有真实摄像头 → 正常使用
        if (hasVideo) {
            mystream = realStream;
        } else {
            // 有麦克风但无摄像头 → 音频 + 虚拟视频
            const virtualVideoStream = createVirtualVideoStream(username);
            mystream = new MediaStream([
                ...realStream.getAudioTracks(),
                virtualVideoStream.getVideoTracks()[0]
            ]);
        }

        myvideo.srcObject = mystream;
        myvideo.muted = true;

        if (!hasVideo) {
            videoAllowed = 1; // 允许关闭“虚拟头像”
            videoButt.innerHTML = `<i class="fas fa-video"></i>`;
            videoButt.title = "关闭虚拟头像";
            myvideooff.textContent = '虚拟头像';
        } else {
            videoAllowed = 1;
        }

        if (!hasAudio) {
            audioAllowed = 0;
            audioButt.innerHTML = `<i class="fas fa-microphone-slash"></i>`;
            audioButt.disabled = true;
            mymuteicon.style.visibility = 'visible';
        }

        addMyOwnSmallVideo();

    } catch (err) {
        console.log("用户拒绝权限 → 使用虚拟头像", err);
        mystream = createVirtualVideoStream(username);
        myvideo.srcObject = mystream;
        myvideo.muted = true;
        addMyOwnSmallVideo();

        alert("已进入无摄像头模式（支持聊天、白板、听课）");
    }
}

function startCall() {
    requestMediaStream().then(() => {
        // 把本地流发给其他人
        if (mystream) {
            mystream.getTracks().forEach(track => {
                for (let key in connections) {
                    connections[key].addTrack(track, mystream);
                    if (track.kind === 'audio') audioTrackSent[key] = track;
                    else videoTrackSent[key] = track;
                }
            });
        }
    });
}

window.sids = {}

function handleVideoOffer(offer, sid, cname, micinf, vidinf) {
    cName[sid] = cname;
    micInfo[sid] = micinf;
    videoInfo[sid] = vidinf;
    sids[cname] = sid
    
    connections[sid] = new RTCPeerConnection(configuration);

    // ICE 候选
    connections[sid].onicecandidate = event => {
        if (event.candidate) {
            socket.emit('new icecandidate', event.candidate, sid);
        }
    };

    // 收到对方轨道 → 显示视频
    connections[sid].ontrack = event => {
        if (document.getElementById(cName[sid])) {
            document.getElementById(cName[sid]).remove()
            // 创建对方视频框的代码保持不变...
            // （你原来的创建 video 元素的代码）
            // ... 略（保持原样）
        }

        console.log('track event fired')
                    let vidCont = document.createElement('div');
                    let newvideo = document.createElement('video');
                    let name = document.createElement('div');
                    let muteIcon = document.createElement('div');
                    let videoOff = document.createElement('div');
                    videoOff.classList.add('video-off');
                    muteIcon.classList.add('mute-icon');
                    name.classList.add('nametag');
                    name.innerHTML = `${cName[sid]}`;
                    vidCont.id = cName[sid];
                    muteIcon.id = `mute${sid}`;
                    videoOff.id = `vidoff${sid}`;
                    muteIcon.innerHTML = `<i class="fas fa-microphone-slash"></i>`;
                    videoOff.innerHTML = '摄像头已关闭'
                    vidCont.classList.add('video-box');
                    newvideo.classList.add('video-frame');
                    newvideo.autoplay = true;
                    newvideo.playsinline = true;
                    newvideo.id = `video${sid}`;
                    newvideo.srcObject = event.streams[0];

                    if (micInfo[sid] == 'on')
                        muteIcon.style.visibility = 'hidden';
                    else
                        muteIcon.style.visibility = 'visible';

                    if (videoInfo[sid] == 'on')
                        videoOff.style.visibility = 'hidden';
                    else
                        videoOff.style.visibility = 'visible';

                    vidCont.appendChild(newvideo);
                    vidCont.appendChild(name);
                    vidCont.appendChild(muteIcon);
                    vidCont.appendChild(videoOff);

                    videoContainer.appendChild(vidCont);

    };

    connections[sid].onremovetrack = () => {
        if (document.getElementById(sid)) {
            document.getElementById(sid).remove();
        }
    };

    // 关键：不要在这里强制请求本地媒体！！
    // 直接设置远程描述，然后创建 answer
    const desc = new RTCSessionDescription(offer);
    connections[sid].setRemoteDescription(desc)
        .then(() => {
            // 只添加我们已经有的轨道（可能是空，也可能只有音频）
            if (mystream) {
                mystream.getTracks().forEach(track => {
                    connections[sid].addTrack(track, mystream);
                });
            }
            // 即使 mystream 是空，也没关系，addTrack 不会报错
        })
        .then(() => connections[sid].createAnswer())
        .then(answer => connections[sid].setLocalDescription(answer))
        .then(() => {
            socket.emit('video-answer', connections[sid].localDescription, sid);
        })
        .catch(err => {
            console.error("PeerConnection error:", err);
        });
}

function handleNewIceCandidate(candidate, sid) {
    console.log('new candidate recieved')
    var newcandidate = new RTCIceCandidate(candidate);

    connections[sid].addIceCandidate(newcandidate)
        .catch(reportError);
}

function handleVideoAnswer(answer, sid) {
    console.log('answered the offer')
    const ans = new RTCSessionDescription(answer);
    connections[sid].setRemoteDescription(ans);
}

//Thanks to (https://github.com/miroslavpejic85) for ScreenShare Code

screenShareButt.addEventListener('click', () => {
    screenShareToggle();
});
let screenshareEnabled = false;
function screenShareToggle() {
    let screenMediaPromise;
    if (!screenshareEnabled) {
        // 优先使用 getDisplayMedia
        if (navigator.getDisplayMedia) {
            screenMediaPromise = navigator.getDisplayMedia({ video: true });
        } else if (navigator.mediaDevices.getDisplayMedia) {
            screenMediaPromise = navigator.mediaDevices.getDisplayMedia({ video: true });
        } else {
            // 旧方式降级
            screenMediaPromise = navigator.mediaDevices.getUserMedia({
                video: { mediaSource: "screen" }
            });
        }
    } else {
        // 停止共享，切回“原来应该显示什么”
        screenMediaPromise = Promise.resolve(mystream || new MediaStream());
    }

    screenMediaPromise
        .then(stream => {
            screenshareEnabled = !screenshareEnabled;

            // 替换所有对端的 video track
            for (let key in connections) {
                const sender = connections[key].getSenders()
                    .find(s => s.track && s.track.kind === 'video');
                if (sender) {
                    const newTrack = stream.getVideoTracks()[0] || null;
                    sender.replaceTrack(newTrack);
                }
            }

            // 本地小视频也切换
            myvideo.srcObject = stream;
            mystream = stream;  // 更新当前流引用

            // 图标切换
            screenShareButt.innerHTML = screenshareEnabled
                ? `<i class="fas fa-desktop"></i><span class="tooltiptext">停止共享</span>`
                : `<i class="fas fa-desktop"></i><span class="tooltiptext">共享屏幕</span>`;

            // 共享结束后自动停止
            if (stream.getVideoTracks()[0]) {
                stream.getVideoTracks()[0].onended = () => {
                    if (screenshareEnabled) screenShareToggle();
                };
            }
        })
        .catch(err => {
            console.error("屏幕共享失败:", err);
            alert("无法共享屏幕：" + (err.message || err.name));
        });
}
socket.on('video-offer', handleVideoOffer);

socket.on('new icecandidate', handleNewIceCandidate);

socket.on('video-answer', handleVideoAnswer);


socket.on('join room', async (conc, cnames, micinfo, videoinfo) => {
    socket.emit('getCanvas');
    if (cnames)
        cName = cnames;

    if (micinfo)
        micInfo = micinfo;

    if (videoinfo)
        videoInfo = videoinfo;
window.conc = conc


    console.log("cName::::",cName,conc);
    if (conc) {
        await conc.forEach(sid => {
            connections[sid] = new RTCPeerConnection(configuration);

            connections[sid].onicecandidate = function (event) {
                if (event.candidate) {
                    console.log('icecandidate fired');
                    socket.emit('new icecandidate', event.candidate, sid);
                }
            };

            connections[sid].ontrack = function (event) {

                if (document.getElementById(cName[sid])) {
                    document.getElementById(cName[sid]).remove()
            }
                    console.log('track event fired')
                    let vidCont = document.createElement('div');
                    let newvideo = document.createElement('video');
                    let name = document.createElement('div');
                    let muteIcon = document.createElement('div');
                    let videoOff = document.createElement('div');
                    videoOff.classList.add('video-off');
                    muteIcon.classList.add('mute-icon');
                    name.classList.add('nametag');
                    name.innerHTML = `${cName[sid]}`;
                    vidCont.id = cName[sid];
                    muteIcon.id = `mute${sid}`;
                    videoOff.id = `vidoff${sid}`;
                    muteIcon.innerHTML = `<i class="fas fa-microphone-slash"></i>`;
                    videoOff.innerHTML = '摄像头已关闭'
                    vidCont.classList.add('video-box');
                    newvideo.classList.add('video-frame');
                    newvideo.autoplay = true;
                    newvideo.playsinline = true;
                    newvideo.id = `video${sid}`;
                    newvideo.srcObject = event.streams[0];

                    if (micInfo[sid] == 'on')
                        muteIcon.style.visibility = 'hidden';
                    else
                        muteIcon.style.visibility = 'visible';

                    if (videoInfo[sid] == 'on')
                        videoOff.style.visibility = 'hidden';
                    else
                        videoOff.style.visibility = 'visible';

                    vidCont.appendChild(newvideo);
                    vidCont.appendChild(name);
                    vidCont.appendChild(muteIcon);
                    vidCont.appendChild(videoOff);

                    videoContainer.appendChild(vidCont);

                // }

            };

            connections[sid].onremovetrack = function (event) {
                if (document.getElementById(sid)) {
                    document.getElementById(sid).remove();
                }
            }

            connections[sid].onnegotiationneeded = function () {

                connections[sid].createOffer()
                    .then(function (offer) {
                        return connections[sid].setLocalDescription(offer);
                    })
                    .then(function () {

                        socket.emit('video-offer', connections[sid].localDescription, sid);

                    })
                    .catch(reportError);
            };

        });

        console.log('added all sockets to connections');
        startCall();

    }
    else {
        console.log('waiting for someone to join');
        requestMediaStream(); // 直接调用新函数
        return 
        navigator.mediaDevices.getUserMedia(mediaConstraints)
            .then(localStream => {
                myvideo.srcObject = localStream;
                myvideo.muted = true;
                addMyOwnSmallVideo();
                mystream = localStream;
            })
            .catch(handleGetUserMediaError);
    }
})

socket.on('remove peer', sid => {
    if (document.getElementById(sid)) {
        document.getElementById(sid).remove();
    }

    delete connections[sid];
})

sendButton.addEventListener('click', () => {
    const msg = messageField.value;
    messageField.value = '';
    socket.emit('message', msg, username, roomid);
})

messageField.addEventListener("keyup", function (event) {
    if (event.keyCode === 13) {
        event.preventDefault();
        sendButton.click();
    }
});

socket.on('message', (msg, sendername, time) => {
    chatRoom.scrollTop = chatRoom.scrollHeight;
    chatRoom.innerHTML += `<div class="message">
    <div class="info">
        <div class="username">${sendername}</div>
        <div class="time">${time}</div>
    </div>
    <div class="content">
        ${msg}
    </div>
</div>`
});

videoButt.addEventListener('click', () => {

    if (videoAllowed) {
        for (let key in videoTrackSent) {
            videoTrackSent[key].enabled = false;
        }
        videoButt.innerHTML = `<i class="fas fa-video-slash"></i>`;
        videoAllowed = 0;
        videoButt.style.backgroundColor = "#b12c2c";

        if (mystream) {
            mystream.getTracks().forEach(track => {
                if (track.kind === 'video') {
                    track.enabled = false;
                }
            })
        }

        myvideooff.style.visibility = 'visible';

        socket.emit('action', 'videooff');
    }
    else {
        for (let key in videoTrackSent) {
            videoTrackSent[key].enabled = true;
        }
        videoButt.innerHTML = `<i class="fas fa-video"></i>`;
        videoAllowed = 1;
        videoButt.style.backgroundColor = "#4ECCA3";
        if (mystream) {
            mystream.getTracks().forEach(track => {
                if (track.kind === 'video')
                    track.enabled = true;
            })
        }


        myvideooff.style.visibility = 'hidden';

        socket.emit('action', 'videoon');
    }
})


audioButt.addEventListener('click', () => {

    if (audioAllowed) {
        for (let key in audioTrackSent) {
            audioTrackSent[key].enabled = false;
        }
        audioButt.innerHTML = `<i class="fas fa-microphone-slash"></i>`;
        audioAllowed = 0;
        audioButt.style.backgroundColor = "#b12c2c";
        if (mystream) {
            mystream.getTracks().forEach(track => {
                if (track.kind === 'audio')
                    track.enabled = false;
            })
        }

        mymuteicon.style.visibility = 'visible';

        socket.emit('action', 'mute');
    }
    else {
        for (let key in audioTrackSent) {
            audioTrackSent[key].enabled = true;
        }
        audioButt.innerHTML = `<i class="fas fa-microphone"></i>`;
        audioAllowed = 1;
        audioButt.style.backgroundColor = "#4ECCA3";
        if (mystream) {
            mystream.getTracks().forEach(track => {
                if (track.kind === 'audio')
                    track.enabled = true;
            })
        }

        mymuteicon.style.visibility = 'hidden';

        socket.emit('action', 'unmute');
    }
})

socket.on('action', (msg, sid) => {
    if (msg == 'mute') {
        console.log(sid + ' muted themself');
        document.querySelector(`#mute${sid}`).style.visibility = 'visible';
        micInfo[sid] = 'off';
    }
    else if (msg == 'unmute') {
        console.log(sid + ' unmuted themself');
        document.querySelector(`#mute${sid}`).style.visibility = 'hidden';
        micInfo[sid] = 'on';
    }
    else if (msg == 'videooff') {
        console.log(sid + 'turned 摄像头已关闭');
        document.querySelector(`#vidoff${sid}`).style.visibility = 'visible';
        videoInfo[sid] = 'off';
    }
    else if (msg == 'videoon') {
        console.log(sid + 'turned video on');
        document.querySelector(`#vidoff${sid}`).style.visibility = 'hidden';
        videoInfo[sid] = 'on';
    }
})

whiteboardButt.addEventListener('click', () => {
    if (boardVisisble) {
        whiteboardCont.style.visibility = 'hidden';
        boardVisisble = false;
    }
    else {
        whiteboardCont.style.visibility = 'visible';
        boardVisisble = true;
    }
})

cutCall.addEventListener('click', () => {
    location.href = '/';
})

videoContainer.addEventListener('click', (e) => {
    const videoBox = e.target.closest('.video-box');
    if (!videoBox) return;
    const sid = sids[cName[videoBox.id]] || videoBox.id;
    const mainVideo = document.querySelector("#vd1");
    const mainNameTag = document.querySelector("#myname");
    let targetStream = null;
    let speakerName = `${username} (您)`;

    // 关键修复：点击自己的小视频 OR 别人点你的大头像，都用最新的 mystream
    if (!sid || sid === 'myOwnSmallVideo' || sid === socket.id) {
        targetStream = mystream;  // 永远用最新的本地流
        speakerName = `${username} (您)`;
    } else {
        let remoteVideo = document.querySelector(`#${sid}`).querySelector("video");
        if (remoteVideo && remoteVideo.srcObject) {
            targetStream = remoteVideo.srcObject;
            speakerName = (cName[sid] || "用户") + " (主讲人)";
        }
    }

    if (targetStream) {
        mainVideo.srcObject = targetStream;
        mainNameTag.innerHTML = speakerName;
    }

    // 高亮处理（你原来的代码）
    document.querySelectorAll("#vcont2 .video-box").forEach(b =>
        b.classList.remove("main-speaker-active")
    );
    videoBox.classList.add("main-speaker-active");
});

// 在你第一次成功拿到本地流的地方加上这块代码
// 目前你有两个地方会获取 mystream：
// 1. startCall() 里
// 2. join room 里等待别人加入时

// 把下面这个函数抽出来，方便两个地方调用
function addMyOwnSmallVideo() {
    // 防止重复添加（比如重新开启摄像头时）
    if (document.getElementById('myOwnSmallVideo')) return;

    const mySmallBox = document.createElement('div');
    mySmallBox.id = 'myOwnSmallVideo';           // 固定 id，方便判断
    mySmallBox.classList.add('video-box');
    mySmallBox.title = '点击可切换回自己';

    const mySmallVideo = document.createElement('video');
    mySmallVideo.classList.add('video-frame');
    mySmallVideo.autoplay = true;
    mySmallVideo.playsinline = true;
    mySmallVideo.muted = true;                    // 小视频也静音，避免回音
    mySmallVideo.srcObject = mystream;            // 直接用自己的流

    const myNameTag = document.createElement('div');
    myNameTag.classList.add('nametag');
    myNameTag.innerHTML = `${username} (我)`;

    // 麦克风和摄像头关闭图标复用你已有的逻辑
    const myMuteIcon = document.createElement('div');
    myMuteIcon.classList.add('mute-icon');
    myMuteIcon.innerHTML = `<i class="fas fa-microphone-slash"></i>`;
    myMuteIcon.style.visibility = audioAllowed ? 'hidden' : 'visible';

    const myVideoOff = document.createElement('div');
    myVideoOff.classList.add('video-off');
    myVideoOff.innerHTML = '摄像头已关闭';
    myVideoOff.style.visibility = videoAllowed ? 'hidden' : 'visible';

    mySmallBox.appendChild(mySmallVideo);
    mySmallBox.appendChild(myNameTag);
    mySmallBox.appendChild(myMuteIcon);
    mySmallBox.appendChild(myVideoOff);

    // 插到左侧列表最上面（或最下面，随你喜好）
    videoContainer.insertBefore(mySmallBox, videoContainer.firstChild);

    // 点击自己的小视频 → 切回主画面看自己
    mySmallBox.onclick = () => {
        document.querySelector("#vd1").srcObject = mystream;
        document.querySelector("#myname").innerHTML = `${username} (您)`;

        // 高亮自己，去掉其他人高亮
        document.querySelectorAll("#vcont2 .video-box").forEach(b => 
            b.classList.remove("main-speaker-active")
        );
        mySmallBox.classList.add("main-speaker-active");
    };
}