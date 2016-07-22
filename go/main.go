package main

import (
	// "encoding/json"
	"fmt"
	"github.com/gorilla/websocket"
	"github.com/howeyc/fsnotify"
	"github.com/optionfactory/digit/git"
	// "golang.org/x/net/websocket"
	"github.com/tjgq/broadcast"
	"html/template"
	"log"
	"net/http"
	"os"
	"path/filepath"
)

var version string

var templates = template.Must(template.ParseFiles("index.template.go"))

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

func echoHandler(updateListener *broadcast.Listener, solicitations chan bool, repoName string, w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println(err)
		return
	}
	solicitations <- true
	for updateEvent := range updateListener.Ch {
		update, ok := updateEvent.(git.Repo)
		if !ok {
			continue
		}
		if repoName != update.Name {
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
		panic(err)
	}
	return git.New(name, absPath)
}

func main() {
	fmt.Fprintf(os.Stderr, "starting version %v\n", version)

	// TODO: help and options docs
	target_repos := []*git.Repo{parseRepo("local", os.Args[1])}
	if len(os.Args) > 2 {
		target_repos = append(target_repos, parseRepo("remote", os.Args[2]))
	}
	var repo_names = []string{}
	for _, r := range target_repos {
		repo_names = append(repo_names, r.Name)
	}

	http.HandleFunc("/index.html", func(w http.ResponseWriter, r *http.Request) {
		err := templates.ExecuteTemplate(w, "index.template.go", repo_names)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
	})
	var updates broadcast.Broadcaster

	solicitationsMap := make(map[string]chan bool)

	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		repoName := r.FormValue("name")
		log.Println("listening for", repoName)
		updateListener := updates.Listen()
		defer updateListener.Close()
		echoHandler(updateListener, solicitationsMap[repoName], repoName, w, r)
	})
	http.Handle("/", http.FileServer(http.Dir(".")))

	for _, r := range target_repos {
		solicitationsMap[r.Name] = make(chan bool)
		watcher, err := fsnotify.NewWatcher()
		if err != nil {
			log.Fatal(err)
		}
		go func() {
			for {
				select {
				case _ = <-solicitationsMap[r.Name]:
					r.Update()
					updates.Send(*r)
				case event := <-watcher.Event:
					solicitationsMap[r.Name] <- true
					log.Println("event:", event)
				case err := <-watcher.Error:
					// TODO
					log.Println("error:", err)
				}
			}
		}()

		err = watcher.Watch(r.Path)
		if err != nil {
			panic(err)
		}
	}

	if err := http.ListenAndServe(":9000", nil); err != nil {
		log.Fatal("ListenAndServe:", err)
	}
}
