package git

import (
	"bufio"
	"errors"
	"log"
	"os/exec"
	"strings"
)

type Commit struct {
	Id             string   `json:"id"`
	Unreachable    bool     `json:"unreachable"`
	Parents        []string `json:"parents"`
	AuthorName     string   `json:"author_name"`
	AuthorEmail    string   `json:"author_email"`
	AuthorDate     string   `json:"author_date"`
	CommitterName  string   `json:"committer_name"`
	CommitterEmail string   `json:"committer_email"`
	CommitterDate  string   `json:"committer_date"`
	Message        string   `json:"message"`
}

type Repo struct {
	Path           string       `json:"path"`
	Name           string       `json:"name"`
	Commits        []Commit     `json:"commits"`
	Tags           []Ref        `json:"tags"`
	Stash          []Ref        `json:"stash"`
	Branches       []Ref        `json:"branches"`
	RemoteBranches []Ref        `json:"remoteBranches"`
	Head           HeadRef      `json:"head"`
	Status         []FileStatus `json:"status"`
}

type FileStatus struct {
	Filename             string `json:"filename"`
	WorkingCopyToStaging string `json:"workingCopyToStaging"`
	StagingToCommit      string `json:"stagingToCommit"`
}

func New(name string, repositoryDir string) *Repo {
	return &Repo{
		Name: name,
		Path: repositoryDir,
	}
}

func (self *Repo) Update() *Repo {
	self.Branches = self.localBranches()
	self.RemoteBranches = self.remoteBranches()
	self.Stash = self.stashContent()
	self.Tags = self.tags()
	self.Head = self.headCommit()
	self.Commits = self.reachables()
	self.Commits = append(self.Commits, self.unreachables()...)
	self.Status = self.status()
	return self
}

type filter func(line string) bool

func always(line string) bool {
	return true
}

type Ref struct {
	Id   string `json:"id"`
	Hash string `json:"commitId"`
}

func (self *Repo) readLines(opts []string, filter filter) ([]string, error) {
	args := []string{"-C", self.Path}
	args = append(args, opts...)
	cmd := exec.Command("git", args...)
	stderr, _ := cmd.StderrPipe()
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		log.Println(err)
		return nil, err
	}
	if err := cmd.Start(); err != nil {
		log.Println(err)
		return nil, err
	}
	result := make([]string, 0)
	scanner := bufio.NewScanner(stdout)
	for scanner.Scan() {
		line := strings.Trim(scanner.Text(), " \t")
		if line == "" {
			continue
		}
		if filter(line) {
			result = append(result, scanner.Text())
		}
	}
	sscanner := bufio.NewScanner(stderr)
	for sscanner.Scan() {
		log.Println(sscanner.Text())
	}
	if err := cmd.Wait(); err != nil {
		log.Println(err)
		return result, err
	}
	return result, nil
}

func (self *Repo) readReferences(opts []string, filter filter) ([]Ref, error) {
	fullOpts := append([]string{"show-ref"}, opts...)
	result := make([]Ref, 0)
	lines, err := self.readLines(fullOpts, filter)
	if err != nil {
		return result, err
	}
	for _, line := range lines {
		ref, err := parseRef(line)
		if err == nil {
			result = append(result, ref)
		}
	}
	return result, nil
}

func (self *Repo) readHEADRef() (string, error) {
	lines, err := self.readLines([]string{"symbolic-ref", "--short", "HEAD"}, always)
	if err != nil {
		return "", err
	}
	for _, line := range lines {
		if len(line) > 0 {
			return line, nil
		}
	}
	return "", nil
}

func parseRef(text string) (Ref, error) {
	refParts := strings.SplitN(text, " ", 2)
	hash := refParts[0]
	idParts := strings.SplitN(refParts[1], "/", 3)
	id := idParts[len(idParts)-1]
	if strings.HasSuffix(id, "^{}") {
		return Ref{}, errors.New("^{}")
	}
	return Ref{
		Id:   id,
		Hash: hash,
	}, nil
}

func (self *Repo) tags() []Ref {
	res, err := self.readReferences([]string{"--tags", "-d"}, always)
	if err != nil {
		panic(err)
	}
	return res
}

func (self *Repo) localBranches() []Ref {
	res, err := self.readReferences([]string{"--heads"}, always)
	if err != nil {
		panic(err)
	}
	return res

}

func (self *Repo) remoteBranches() []Ref {
	res, err := self.readReferences([]string{}, func(line string) bool {
		return strings.Contains(line, "refs/remotes/")
	})
	if err != nil {
		panic(err)
	}
	return res
}

func (self *Repo) stashContent() []Ref {
	res, err := self.readReferences([]string{}, func(line string) bool {
		return strings.Contains(line, "refs/stash/")
	})
	if err != nil {
		panic(err)
	}
	return res
}

type HeadRef struct {
	BranchId string `json:"branchId"`
	CommitId string `json:"commitId"`
}

func (self *Repo) headCommit() HeadRef {
	refName, err := self.readHEADRef()
	if err != nil {
		panic(err)
	}
	if len(refName) > 0 {
		return HeadRef{
			BranchId: refName,
		}
	}
	refs, err2 := self.readReferences([]string{"--head"}, func(line string) bool {
		return strings.Contains(line, " HEAD")
	})
	if err2 != nil {
		panic(err)
	}
	return HeadRef{
		CommitId: refs[0].Hash,
	}
}

func (self *Repo) reachables() []Commit {
	lines, err := self.readLines([]string{"log", "--pretty=%H|%P|%an|%ae|%ad|%cn|%ce|%cd|%s", "--reverse", "--all"}, always)
	if err != nil {
		panic(err)
	}
	commits := make([]Commit, 0, len(lines))
	for _, line := range lines {
		commits = append(commits, parseCommit(line, false))
	}
	return commits
}

func (self *Repo) unreachables() []Commit {
	idLines, err := self.readLines([]string{"fsck", "--unreachable", "--no-reflogs", "--no-progress"}, func(line string) bool {
		return strings.Contains(line, "commit")
	})
	if err != nil {
		panic(err)
	}
	unreacheableIds := make([]string, 0, len(idLines))
	for _, line := range idLines {
		unreacheableIds = append(unreacheableIds, strings.SplitN(line, " ", 3)[2])
	}

	revListArgs := []string{"rev-list", "--no-walk", "--pretty=%H|%P|%an|%ae|%ad|%cn|%ce|%cd|%s"}
	revListArgs = append(revListArgs, unreacheableIds...)
	lines, err := self.readLines(revListArgs, func(line string) bool {
		return !strings.HasPrefix(line, "commit")
	})
	commits := make([]Commit, 0, len(lines))
	for _, line := range lines {
		commits = append(commits, parseCommit(line, true))
	}
	return commits
}

func parseCommit(line string, unreachable bool) Commit {
	parts := strings.SplitN(line, "|", 9)
	parentIds := make([]string, 0)
	if len(parts[1]) > 0 {
		parentIds = strings.Split(parts[1], " ")
	}
	return Commit{
		Id:             parts[0],
		Unreachable:    unreachable,
		Parents:        parentIds,
		AuthorName:     parts[2],
		AuthorEmail:    parts[3],
		AuthorDate:     parts[4],
		CommitterName:  parts[5],
		CommitterEmail: parts[6],
		CommitterDate:  parts[7],
		Message:        parts[8],
	}
}

func (self *Repo) status() []FileStatus {
	lines, err := self.readLines([]string{"status", "--porcelain"}, always)
	if err != nil {
		panic(err)
	}
	statuses := make([]FileStatus, 0, len(lines))
	for _, line := range lines {
		stagingToCommit := line[0:1]
		workingCopyToStaging := line[1:2]
		filename := line[3:]
		statuses = append(statuses, FileStatus{
			Filename:             filename,
			WorkingCopyToStaging: workingCopyToStaging,
			StagingToCommit:      stagingToCommit,
		})
	}
	return statuses
}
