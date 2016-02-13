import subprocess
import json

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
readCommits(GET_UNREACHABLES)

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

print json.dumps(history)
