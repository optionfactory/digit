package main

import (
	// "encoding/json"
	"fmt"
	"github.com/gorilla/websocket"
	"github.com/howeyc/fsnotify"
	// "golang.org/x/net/websocket"
	"github.com/tjgq/broadcast"
	"html/template"
	"log"
	"net/http"
	"os"
)

var version string

var templates = template.Must(template.ParseFiles("index.template.go"))

type Repo struct {
	Name string
	Path string
}

type Update struct {
	RepoName string
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

func echoHandler(updateListener *broadcast.Listener, w http.ResponseWriter, r *http.Request) {
	repoName := r.FormValue("name")
	log.Println("listening for", repoName)
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println(err)
		return
	}

	for updateEvent := range updateListener.Ch {
		update, ok := updateEvent.(*Update)
		if !ok {
			continue
		}
		log.Println("cast gave", ok)
		if repoName != update.RepoName {
			continue
		}
		err = conn.WriteJSON(update)
		if err != nil {
			log.Println(err)
			return
		}
	}
}

func main() {
	fmt.Fprintf(os.Stderr, "starting version %v\n", version)

	// TODO: help and options docs
	target_repos := []Repo{{
		Name: "local",
		Path: os.Args[1],
	}}
	if len(os.Args) > 2 {
		target_repos = append(target_repos, Repo{
			Name: "remote",
			Path: os.Args[2],
		})
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
	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		updateListener := updates.Listen()
		defer updateListener.Close()
		echoHandler(updateListener, w, r)
	})
	http.Handle("/", http.FileServer(http.Dir(".")))

	for _, r := range target_repos {
		watcher, err := fsnotify.NewWatcher()
		if err != nil {
			log.Fatal(err)
		}

		go func() {
			for {
				select {
				case event := <-watcher.Event:
					updates.Send(&Update{
						RepoName: r.Name,
					})
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
