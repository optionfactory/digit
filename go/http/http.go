package http

import (
	"github.com/gorilla/websocket"
	"github.com/optionfactory/digit/git"
	"github.com/tjgq/broadcast"
	"html/template"
	"log"
	"net/http"
	"sync"
)

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

func merge(cs ...<-chan interface{}) <-chan interface{} {
	var wg sync.WaitGroup
	out := make(chan interface{})
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

	go func() {
		wg.Wait()
		close(out)
	}()
	return out
}

func Listen(target_repos map[string]*git.Repo, updates *broadcast.Broadcaster, solicitationsMap map[string]chan chan interface{}) {
	var repo_names = []string{}
	for name := range target_repos {
		repo_names = append(repo_names, name)
	}

	http.HandleFunc("/index.html", func(w http.ResponseWriter, r *http.Request) {
		err := templates.ExecuteTemplate(w, "index.template.go", repo_names)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
	})

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

	if err := http.ListenAndServe(":9000", nil); err != nil {
		log.Fatal("ListenAndServe:", err)
	}
}
