package main

//go:generate go-bindata -pkg assets -o assets/assets.go --prefix "embedded-data/" embedded-data/...

import (
	// "encoding/json"
	"flag"
	"fmt"
	"github.com/optionfactory/digit/git"
	"github.com/optionfactory/digit/http"
	"github.com/optionfactory/digit/watch"
	"github.com/tjgq/broadcast"
	"log"
	"os"
	"path/filepath"
)

var version string

func parseRepo(name string, path string) *git.Repo {
	absPath, err := filepath.Abs(path)
	if err != nil {
		log.Fatal(err)
	}
	return git.New(name, absPath)
}

func main() {
	fmt.Fprintf(os.Stderr, "starting version %v\n", version)

	flag.Usage = func() {
		fmt.Fprintf(os.Stderr, "Usage: %s [options] local_repo [remote_repo]\n", os.Args[0])
		fmt.Fprintf(os.Stderr, "\n")
		fmt.Fprintf(os.Stderr, "Options:\n")
		flag.PrintDefaults()
	}

	bindAddress := flag.String("bind-to", "localhost:9000", "Address:Port to bind to")
	flag.Parse()

	args := flag.Args()
	if len(args) < 1 || len(args) > 2 {
		flag.Usage()
		os.Exit(1)
	}

	target_repos := make(map[string]*git.Repo, 0)

	target_repos["local"] = parseRepo("local", args[0])
	if len(args) > 1 {
		target_repos["remote"] = parseRepo("remote", args[1])
	}

	var updates broadcast.Broadcaster
	solicitationsMap := make(map[string]chan chan interface{})

	for _, r := range target_repos {
		solicitationsMap[r.Name] = watch.Watch(r, &updates)
	}

	fmt.Fprintf(os.Stderr, "Listening on http://%v\n", *bindAddress)
	http.Listen(*bindAddress, target_repos, &updates, solicitationsMap)
}
