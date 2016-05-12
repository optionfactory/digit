function connect(path) {
    var socket = new WebSocket("ws://localhost:9000/ws?path=" + path);
    socket.onopen = function() {
        var repoViewer = new RepoViewer();
        repoViewer.render(d3.select("#local"));
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
for (var i = 0; i != paths.length; ++i) {
    connect(paths[i]);
}
