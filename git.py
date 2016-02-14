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
    print "history is", history
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
    
    def on_any_event(self, event):
        GET_REACHABLES="git log --pretty='%H %P' --reverse --all"
        GET_UNREACHABLES="git show -s --pretty='%H %P' $(git fsck --unreachable --no-reflogs --no-progress | awk '{print $3}')"
        GET_TAGS="git show-ref --tags"
        GET_BRANCHES="git show-ref --heads"
        GET_REMOTE_BRANCHES="git show-ref | grep refs/remotes/"
        GET_HEAD_COMMIT="git show-ref --head | grep HEAD"
        GET_HEAD_BRANCH="git symbolic-ref --short HEAD"

        history = {"commits": [], "tags": [], "branches": [], "head": None}

        def readCommits(cmd, unreachable=False):
            for line in subprocess.check_output(cmd, shell=True).split("\n"):
                if not len(line):
                    continue
                hashes = line.split(" ")
                hash, parents = hashes[0], [p for p in hashes[1:] if len(p) > 0]
                history["commits"].append({"id": hash, "unreachable": unreachable, "parents": parents}) 

        readCommits(GET_REACHABLES)
        readCommits(GET_UNREACHABLES, True)

        def readRefs(cmd, key):
            try:
                output=subprocess.check_output(cmd, shell=True).split("\n")
            except:
                output=""
            for line in output:
                if not len(line):
                    continue
                hash, ref = line.split(" ")
                id = ref.split("/",2)[-1]
                history[key].append({"id": id, "commitId": hash})

        readRefs(GET_TAGS, "tags")
        readRefs(GET_BRANCHES, "branches")
        readRefs(GET_REMOTE_BRANCHES, "branches")

        try:
            head = subprocess.check_output(GET_HEAD_BRANCH, shell=True).strip()
            history["head"] = {"branchId": head}
        except:
            head = subprocess.check_output(GET_HEAD_COMMIT, shell=True).strip().split(" ")[0]
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

    event_handler = MyEventHandler()
    event_handler.on_any_event(None)
    observer = Observer()
    observer.schedule(event_handler, ".git", recursive=True)
    observer.start()


    
    reactor.run()
    observer.stop()
    observer.join()

