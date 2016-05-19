repoViewer = new RepoViewer();
repoViewer.render(d3.select("#local"));

function connect() {
    var socket = new WebSocket("ws://localhost:9000/ws");
    socket.onopen = function() {
        socket.onmessage = function(evt) {
            repoViewer.update(JSON.parse(evt.data));
        };
    };
    socket.onerror = function() {
        socket.close();
    }
    socket.onclose = function() {
        setTimeout(connect, 1000);
    }
};
connect();

