package main

import (
	// "encoding/json"
	"fmt"
	"github.com/dietsche/rfsnotify"
	"github.com/gorilla/websocket"
	"github.com/optionfactory/digit/git"
	"github.com/tjgq/broadcast"
	"html/template"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"sync"
)

var version string

var templates = template.Must(template.ParseFiles("index.template.go"))

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

func wsHandler(updates <-chan interface{}, repoName string, w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println(err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	for updateEvent := range updates {
		update, ok := updateEvent.(git.Repo)
		if !ok || repoName != update.Name {
			continue
		}
		err = conn.WriteJSON(update)
		if err != nil {
			log.Println(err)
			return
		}
	}
}

func parseRepo(name string, path string) *git.Repo {
	absPath, err := filepath.Abs(path)
	if err != nil {
		log.Fatal(err)
	}
	return git.New(name, absPath)
}

func merge(cs ...<-chan interface{}) <-chan interface{} {
	var wg sync.WaitGroup
	out := make(chan interface{})

	// Start an output goroutine for each input channel in cs.  output
	// copies values from c to out until c is closed, then calls wg.Done.
	output := func(c <-chan interface{}) {
		for n := range c {
			out <- n
		}
		wg.Done()
	}
	wg.Add(len(cs))
	for _, c := range cs {
		go output(c)
	}

	// Start a goroutine to close out once all the output goroutines are
	// done.  This must start after the wg.Add call.
	go func() {
		wg.Wait()
		close(out)
	}()
	return out
}

func main() {
	fmt.Fprintf(os.Stderr, "starting version %v\n", version)
	if len(os.Args) < 2 || len(os.Args) > 3 {
		fmt.Fprintf(os.Stderr, "Usage: %s local_repo [remote_repo]\n", os.Args[0])
		os.Exit(1)
	}

	target_repos := make(map[string]*git.Repo, 0)

	target_repos["local"] = parseRepo("local", os.Args[1])
	if len(os.Args) > 2 {
		target_repos["remote"] = parseRepo("remote", os.Args[2])
	}

	http.HandleFunc("/index.html", func(w http.ResponseWriter, r *http.Request) {
		var repo_names = []string{}
		for name := range target_repos {
			repo_names = append(repo_names, name)
		}
		err := templates.ExecuteTemplate(w, "index.template.go", repo_names)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
	})

	var updates broadcast.Broadcaster
	solicitationsMap := make(map[string]chan chan interface{})

	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		repoName := r.FormValue("name")
		log.Println("listening for", repoName)
		updateListener := updates.Listen()
		defer updateListener.Close()
		solicitations := make(chan interface{})
		solicitationsMap[repoName] <- solicitations

		wsHandler(merge(updateListener.Ch, solicitations), repoName, w, r)
	})
	http.Handle("/", http.FileServer(http.Dir(".")))

	for _, r := range target_repos {
		solicitationsMap[r.Name] = make(chan chan interface{})
		r.Update()
		watcher, err := rfsnotify.NewWatcher()
		if err != nil {
			log.Fatal(err)
		}
		if err = watcher.AddRecursive(r.Path); err != nil {
			log.Fatal(err)
		}
		go func() {
			for {
				select {
				case replyChan := <-solicitationsMap[r.Name]:
					replyChan <- *r
				case event := <-watcher.Events:
					r.Update()
					updates.Send(*r)
					log.Println("event:", event)
				case err := <-watcher.Errors:
					log.Println("error:", err)
				}
			}
		}()
	}

	if err := http.ListenAndServe(":9000", nil); err != nil {
		log.Fatal("ListenAndServe:", err)
	}
}
