package http

import (
	"github.com/elazarl/go-bindata-assetfs"
	"github.com/gorilla/websocket"
	"github.com/optionfactory/digit/assets"
	"github.com/optionfactory/digit/git"
	"github.com/tjgq/broadcast"
	"html/template"
	"log"
	"net/http"
	"sync"
)

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

func Listen(bindAddress string, target_repos map[string]*git.Repo, updates *broadcast.Broadcaster, solicitationsMap map[string]chan chan interface{}) {
	var repo_names = []string{}
	for name := range target_repos {
		repo_names = append(repo_names, name)
	}
	templateText := assets.MustAsset("index.gotemplate")
	var indexTemplate = template.Must(template.New("index.gotemplate").Parse(string(templateText)))

	rootHandler := func(w http.ResponseWriter, r *http.Request) {
		err := indexTemplate.Execute(w, repo_names)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
	}

	http.HandleFunc("/index.htm", rootHandler)
	http.HandleFunc("/index.html", rootHandler)

	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		repoName := r.FormValue("name")
		log.Println("listening for", repoName)
		updateListener := updates.Listen()
		defer updateListener.Close()
		solicitations := make(chan interface{})
		defer close(solicitations)
		solicitationsMap[repoName] <- solicitations

		wsHandler(merge(updateListener.Ch, solicitations), repoName, w, r)
	})
	fs := http.FileServer(&assetfs.AssetFS{Asset: assets.Asset, AssetDir: assets.AssetDir, AssetInfo: assets.AssetInfo, Prefix: ""})
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" {
			rootHandler(w, r)
			return
		}
		fs.ServeHTTP(w, r)
	})

	if err := http.ListenAndServe(bindAddress, nil); err != nil {
		log.Fatal("ListenAndServe:", err)
	}
}
