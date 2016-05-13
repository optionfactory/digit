from autobahn.twisted.websocket import WebSocketServerFactory, WebSocketServerProtocol
from autobahn.twisted.resource import WebSocketResource
import sys
import time
import logging
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from twisted.web.server import Site
from twisted.web import server, resource
from twisted.web.static import File

import subprocess
import json
import time
import webbrowser
repos = {}

class Repo:
    def __init__(self, name):
        self.name = name
        self.connections = []
        self.data  = {"history": None}
        self.pending = False
        self.lastSent = 0

def provideRepo(name):
    global repos
    if name not in repos:
        repos[name] = Repo(name)
    return repos[name]

class MyServerProtocol(WebSocketServerProtocol):
    def __init__(self):
        self.name = None

    def onConnect(self, request):
        if "name" not in request.params:
            raise ValueError("Missing parameter: name")
        name = request.params["name"][0]
        print("Client connecting to {}: {}".format(name, request.peer))
        self.name = name

    def onOpen(self):
        repo = provideRepo(self.name)
        repo.connections.append(self)
        self.sendMessage(repo.data["history"], False)
        print("WebSocket connection open.")

    def onMessage(self, payload, isBinary):
        if isBinary:
            print("Binary message received: {} bytes".format(len(payload)))
        else:
            print("Text message received: {}".format(payload.decode('utf8')))

        # echo back message verbatim
        # self.sendMessage(payload, isBinary)

    def onClose(self, wasClean, code, reason):
        global repos
        if self.name:
            conns = repos[self.name].connections
            if self in conns:
                conns.remove(self)

        print("WebSocket connection closed: {}".format(reason))


def updateData(name, history):
    repo = provideRepo(name)
    repo.data["history"] = history
    repo.pending = True
    sendData(repo)

def sendData(repo):
    now = time.time()
    if (not repo.pending):
        return
    if (now - repo.lastSent > 1):
        repo.lastSent = time.time()
        repo.pending = False
        for c in repo.connections:
            c.sendMessage(repo.data["history"], False)
    else:
        reactor.callLater(1-(now-repo.lastSent), sendData, repo)

class MyEventHandler(FileSystemEventHandler):
    def __init__(self, name, path):
        self.name = name
        self.path = path

    def on_any_event(self, event):
        GET_REACHABLES="git -C {0} log --pretty='%H %P|%an|%ae|%ad|%cn|%ce|%cd|%s' --reverse --all"
        GET_UNREACHABLES="git -C {0} rev-list --no-walk --pretty='%H %P|%an|%ae|%ad|%cn|%ce|%cd|%s' $(git -C {0} fsck --unreachable --no-reflogs --no-progress | awk '{{print $3}}') 2>/dev/null| grep -v '^commit'"
        GET_TAGS="git -C {0} show-ref --tags -d"
        GET_BRANCHES="git -C {0} show-ref --heads"
        GET_REMOTE_BRANCHES="git -C {0} show-ref | grep refs/remotes/"
        GET_STASH="git -C {0} show-ref | grep refs/stash"
        GET_HEAD_COMMIT="git -C {0} show-ref --head | grep HEAD"
        GET_HEAD_BRANCH="git -C {0} symbolic-ref --short HEAD 2>/dev/null"

        history = {"name": self.name, "path": self.path, "commits": [], "tags": [], "stash": [], "branches": [], "head": None}

        def readCommits(cmd, unreachable=False):
            try:
                output = subprocess.check_output(cmd, shell=True)
            except:
                output = ""
            for line in output.split("\n"):
                if not len(line):
                    continue
                ids, author_name, author_email, author_date, committer_name, committer_email, committer_date, message = line.split("|", 7)
                hashes = ids.split(" ")
                hash, parents = hashes[0], [p for p in hashes[1:] if len(p) > 0]
                history["commits"].append({"id": hash, "unreachable": unreachable, "parents": parents, "author_name":author_name, "author_email":author_email, "author_date":author_date, "committer_name":committer_name, "committer_email":committer_email, "committer_date":committer_date,"message": message}) 

        readCommits(GET_REACHABLES.format(self.path))
        readCommits(GET_UNREACHABLES.format(self.path), True)

        def readRefs(cmd, key):
            refs = []
            try:
                output=subprocess.check_output(cmd, shell=True).split("\n")
            except:
                output=""
            for line in output:
                if not len(line):
                    continue
                hash, ref = line.split(" ")
                id = ref.split("/",2)[-1]
                refs.append({"id": id, "commitId": hash})
            derefs = [r["id"][:-3] for r in refs if r["id"].endswith("^{}")]
            refs = [r for r in refs if r["id"] not in derefs]
            for ref in refs:
                if ref["id"].endswith("^{}"):
                    ref["id"] = ref["id"][:-3]
            history[key].extend(refs)

        readRefs(GET_TAGS.format(self.path), "tags")
        readRefs(GET_BRANCHES.format(self.path), "branches")
        readRefs(GET_REMOTE_BRANCHES.format(self.path), "branches")
        readRefs(GET_STASH.format(self.path), "branches")

        try:
            head = subprocess.check_output(GET_HEAD_BRANCH.format(self.path), shell=True).strip()
            history["head"] = {"branchId": head}
        except:
            head = subprocess.check_output(GET_HEAD_COMMIT.format(self.path), shell=True).strip().split(" ")[0]
            history["head"] = {"commitId": head}        
        
        reactor.callFromThread(updateData, self.name, json.dumps(history))

class Index(resource.Resource):
    isLeaf = True
    def __init__(self, names):
        self.names = names
    
    def render_GET(self, request):
        f = open("index.template")
        body = f.read()
        return body.replace("$$NAMES$$", json.dumps(self.names))

if __name__ == '__main__':

    import sys

    from twisted.python import log
    from twisted.internet import reactor
    log.startLogging(sys.stdout)

    target_repos = zip(["local", "remote"], sys.argv[1:])
    from autobahn.twisted.websocket import WebSocketServerFactory
    factory = WebSocketServerFactory()
    factory.protocol = MyServerProtocol
    resource = WebSocketResource(factory)
    root = File(".")
    root.putChild(u"index.html", Index([repo[0] for repo in target_repos]))
    root.putChild(u"ws", resource)
    site = Site(root)
    reactor.listenTCP(9000, site)


    for repo in target_repos:
        event_handler = MyEventHandler(repo[0], repo[1])
        event_handler.on_any_event(None)
        observer = Observer()
        observer.schedule(event_handler, repo[1]+"/.git", recursive=True)
        observer.start()
    
    reactor.run()
    observer.stop()
    observer.join()

