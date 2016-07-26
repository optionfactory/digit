package watch

import (
	"github.com/dietsche/rfsnotify"
	"github.com/optionfactory/digit/git"
	"github.com/tjgq/broadcast"
	"gopkg.in/fsnotify.v1"
	"log"
	"time"
)

func Watch(r *git.Repo, updates *broadcast.Broadcaster) chan chan interface{} {
	r.Update()
	solicitations := make(chan chan interface{})
	watcher, err := rfsnotify.NewWatcher()
	if err != nil {
		log.Fatal(err)
	}
	if err = watcher.AddRecursive(r.Path); err != nil {
		log.Fatal(err)
	}
	go func() {
		coalescing := []fsnotify.Event{}
		timer := make(<-chan time.Time)
		for {
			select {
			case replyChan := <-solicitations:
				replyChan <- *r
			case event := <-watcher.Events:
				if event.Op&fsnotify.Chmod == fsnotify.Chmod {
					continue
				}
				if len(coalescing) == 0 {
					timer = time.NewTimer(time.Second).C
				}
				coalescing = append(coalescing, event)
			case _ = <-timer:
				if len(coalescing) > 0 {
					log.Println("events:", coalescing)
					coalescing = []fsnotify.Event{}
					r.Update()
					updates.Send(*r)
				}
			case err := <-watcher.Errors:
				log.Println("error:", err)
			}
		}
	}()
	return solicitations
}
