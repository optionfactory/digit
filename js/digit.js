function connect(name) {
    var socket = new WebSocket("ws://localhost:9000/ws?name=" + name);
    socket.onopen = function() {
        var repoViewer = new RepoViewer();
        repoViewer.render(d3.select("#"+name));
        var firstUpdate = true;
        socket.onmessage = function(evt) {
            repoViewer.update(JSON.parse(evt.data), firstUpdate);
            firstUpdate=false;
        };
    };
    socket.onerror = function() {
        socket.close();
    }
    socket.onclose = function() {
        setTimeout(connect.bind(null, path), 1000);
    }
};
names.forEach(connect);