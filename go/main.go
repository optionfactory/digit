package main

import (
	// "encoding/json"
	"fmt"
	"github.com/howeyc/fsnotify"
	// "golang.org/x/net/websocket"
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
	// http.HandleFunc("/websocket", websocket.Handler(Echo))
	http.Handle("/", http.FileServer(http.Dir(".")))
	if err := http.ListenAndServe(":8000", nil); err != nil {
		log.Fatal("ListenAndServe:", err)
	}

	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		log.Fatal(err)
	}

	for _, r := range target_repos {
		go func() {
			for {
				select {
				case event := <-watcher.Event:
					log.Println("event:", event)
				case err := <-watcher.Error:
					log.Println("error:", err)
				}
			}
		}()

		err = watcher.Watch(r.Path)
		if err != nil {
			panic(err)
		}
	}
}
