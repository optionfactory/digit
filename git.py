from autobahn.twisted.websocket import WebSocketServerFactory, WebSocketServerProtocol
from autobahn.twisted.resource import WebSocketResource
import sys
import time
import logging
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from twisted.web.server import Site
from twisted.web.static import File

import subprocess
import json
import time
import webbrowser

connections = []
data = {"history": None}
pending = False
lastSent = 0

class MyServerProtocol(WebSocketServerProtocol):

    def onConnect(self, request):
        print("Client connecting: {}".format(request.peer))

    def onOpen(self):
        connections.append(self)
        self.sendMessage(data["history"], False)
        print("WebSocket connection open.")

    def onMessage(self, payload, isBinary):
        if isBinary:
            print("Binary message received: {} bytes".format(len(payload)))
        else:
            print("Text message received: {}".format(payload.decode('utf8')))

        # echo back message verbatim
        # self.sendMessage(payload, isBinary)

    def onClose(self, wasClean, code, reason):
        connections.remove(self)

        print("WebSocket connection closed: {}".format(reason))

def updateData(history):
    global data, pending, lastSent
    data["history"] = history
    pending = True
    sendData()

def sendData():
    global data, pending, lastSent
    now = time.time()
    if (not pending):
        return
    if (now - lastSent > 1):
        lastSent = time.time()
        pending = False
        for c in connections:
            c.sendMessage(data["history"], False)
    else:
        reactor.callLater(1-(now-lastSent), sendData)

class MyEventHandler(FileSystemEventHandler):
    def __init__(self, path):
        self.path = path

    def on_any_event(self, event):
        GET_REACHABLES="git -C {0} log --pretty='%H %P|%s' --reverse --all"
        GET_UNREACHABLES="git -C {0} rev-list --no-walk --pretty='%H %P|%s' $(git -C {0} fsck --unreachable --no-reflogs --no-progress | awk '{{print $3}}') 2>/dev/null| grep -v '^commit'"
        GET_TAGS="git -C {0} show-ref --tags -d"
        GET_BRANCHES="git -C {0} show-ref --heads"
        GET_REMOTE_BRANCHES="git -C {0} show-ref | grep refs/remotes/"
        GET_STASH="git -C {0} show-ref | grep refs/stash"
        GET_HEAD_COMMIT="git -C {0} show-ref --head | grep HEAD"
        GET_HEAD_BRANCH="git -C {0} symbolic-ref --short HEAD 2>/dev/null"

        history = {"commits": [], "tags": [], "stash": [], "branches": [], "head": None}

        def readCommits(cmd, unreachable=False):
            try:
                output = subprocess.check_output(cmd, shell=True)
            except:
                output = ""
            for line in output.split("\n"):
                if not len(line):
                    continue
                ids, message = line.split("|", 1)
                hashes = ids.split(" ")
                hash, parents = hashes[0], [p for p in hashes[1:] if len(p) > 0]
                history["commits"].append({"id": hash, "unreachable": unreachable, "parents": parents, "message": message}) 

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
        readRefs(GET_STASH.format(self.path), "stash")

        try:
            head = subprocess.check_output(GET_HEAD_BRANCH.format(self.path), shell=True).strip()
            history["head"] = {"branchId": head}
        except:
            head = subprocess.check_output(GET_HEAD_COMMIT.format(self.path), shell=True).strip().split(" ")[0]
            history["head"] = {"commitId": head}        
        
        reactor.callFromThread(updateData, json.dumps(history))


if __name__ == '__main__':

    import sys

    from twisted.python import log
    from twisted.internet import reactor
    log.startLogging(sys.stdout)

    from autobahn.twisted.websocket import WebSocketServerFactory
    factory = WebSocketServerFactory()
    factory.protocol = MyServerProtocol
    resource = WebSocketResource(factory)
    root = File(".")
    root.putChild(u"ws", resource)
    site = Site(root)
    reactor.listenTCP(9000, site)

    path = sys.argv[1]
    event_handler = MyEventHandler(path)
    event_handler.on_any_event(None)
    observer = Observer()
    observer.schedule(event_handler, path+"/.git", recursive=True)
    observer.start()


    
    webbrowser.open_new_tab("http://localhost:9000")
    reactor.run()
    observer.stop()
    observer.join()

