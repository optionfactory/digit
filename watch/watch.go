package watch

import (
	"github.com/dietsche/rfsnotify"
	"github.com/optionfactory/digit/git"
	"github.com/tjgq/broadcast"
	"gopkg.in/fsnotify.v1"
	"log"
	"os"
	"strings"
	"time"
)

var gitLockSuffix string = string(os.PathSeparator) + "index.lock"

func isGitLock(filePath string) bool {
	return strings.Contains(filePath, ".git") && strings.HasSuffix(filePath, gitLockSuffix)
}

func Watch(r *git.Repo, updates *broadcast.Broadcaster) chan chan interface{} {
	if err := r.Update(); err != nil {
		log.Fatal(err)
	}
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
				if event.Op&fsnotify.Chmod == fsnotify.Chmod || isGitLock(event.Name) {
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
					if err := r.Update(); err != nil {
						log.Fatal(err)
					}
					updates.Send(*r)
				}
			case err = <-watcher.Errors:
				log.Println("error:", err)
			}
		}
	}()
	return solicitations
}
