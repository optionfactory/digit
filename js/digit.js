function connect(path) {
    var socket = new WebSocket("ws://localhost:9000/ws?name=" + path);
    socket.onopen = function() {
        var repoViewer = new RepoViewer();
        repoViewer.render(d3.select("#"+path));
        socket.onmessage = function(evt) {
            repoViewer.update(JSON.parse(evt.data));
        };
    };
    socket.onerror = function() {
        socket.close();
    }
    socket.onclose = function() {
        setTimeout(connect.bind(null, path), 1000);
    }
};
paths.forEach(connect);