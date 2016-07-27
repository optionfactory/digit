package git

import (
	"bufio"
	"errors"
	"fmt"
	"log"
	"os/exec"
	"strings"
	"syscall"
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

func (self *Repo) Update() error {
	var err error
	self.Branches, err = self.localBranches()
	if err != nil {
		return err
	}
	self.RemoteBranches, err = self.remoteBranches()
	if err != nil {
		return err
	}
	self.Stash, err = self.stashContent()
	if err != nil {
		return err
	}
	self.Tags, err = self.tags()
	if err != nil {
		return err
	}
	self.Head, err = self.headCommit()
	if err != nil {
		return err
	}
	self.Commits, err = self.reachables()
	if err != nil {
		return err
	}
	unreachables, err := self.unreachables()
	if err != nil {
		return err
	}
	self.Commits = append(self.Commits, unreachables...)
	if err != nil {
		return err
	}
	self.Status, err = self.status()
	return err
}

type filter func(line string) bool

func always(line string) bool {
	return true
}

type Ref struct {
	Id   string `json:"id"`
	Hash string `json:"commitId"`
}

type CmdError struct {
	CommandRan bool
	ExitStatus int
	Stderr     []string
	Cause      error
}

func (self *Repo) readLines(opts []string, filter filter) ([]string, *CmdError) {
	args := []string{"-C", self.Path}
	args = append(args, opts...)
	cmd := exec.Command("git", args...)
	stderr, _ := cmd.StderrPipe()
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		log.Printf("Failed to get stdout for '%v': %s\n", cmd, err)
		return nil, &CmdError{Cause: err}
	}
	if err := cmd.Start(); err != nil {
		log.Printf("Failed to run command '%v': %s\n", cmd, err)
		return nil, &CmdError{Cause: err}
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
	stderrLines := []string{}
	sscanner := bufio.NewScanner(stderr)
	for sscanner.Scan() {
		stderrLines = append(stderrLines, sscanner.Text())
	}
	if err := cmd.Wait(); err != nil {
		exiterr, ok := err.(*exec.ExitError)
		if !ok {
			return nil, &CmdError{
				CommandRan: true,
				Stderr:     stderrLines,
				Cause:      errors.New(fmt.Sprintf("executing %v got %s, %+v", cmd, err, stderrLines)),
			}
		}
		status, ok := exiterr.Sys().(syscall.WaitStatus)
		if !ok {
			panic("unsupported platform")
		}
		return nil, &CmdError{
			CommandRan: true,
			ExitStatus: status.ExitStatus(),
			Stderr:     stderrLines,
			Cause:      errors.New(fmt.Sprintf("executing %v got %s, %+v", cmd, err, stderrLines)),
		}
	}
	return result, nil
}

func (self *Repo) readReferences(opts []string, filter filter) ([]Ref, error) {
	fullOpts := append([]string{"show-ref"}, opts...)
	result := make([]Ref, 0)
	lines, cmderr := self.readLines(fullOpts, filter)
	if cmderr != nil && cmderr.ExitStatus != 1 {
		return nil, cmderr.Cause
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
	lines, cmderr := self.readLines([]string{"symbolic-ref", "--short", "HEAD"}, always)
	if cmderr != nil && cmderr.ExitStatus != 1 {
		return "", cmderr.Cause
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

func (self *Repo) tags() ([]Ref, error) {
	return self.readReferences([]string{"--tags", "-d"}, always)
}

func (self *Repo) localBranches() ([]Ref, error) {
	return self.readReferences([]string{"--heads"}, always)

}

func (self *Repo) remoteBranches() ([]Ref, error) {
	return self.readReferences([]string{}, func(line string) bool {
		return strings.Contains(line, "refs/remotes/")
	})
}

func (self *Repo) stashContent() ([]Ref, error) {
	return self.readReferences([]string{}, func(line string) bool {
		return strings.Contains(line, "refs/stash/")
	})
}

type HeadRef struct {
	BranchId string `json:"branchId"`
	CommitId string `json:"commitId"`
}

func (self *Repo) headCommit() (HeadRef, error) {
	refName, err := self.readHEADRef()
	if err != nil {
		return HeadRef{}, err
	}
	if len(refName) > 0 {
		return HeadRef{
			BranchId: refName,
		}, nil
	}
	refs, err := self.readReferences([]string{"--head"}, func(line string) bool {
		return strings.Contains(line, " HEAD")
	})
	if err != nil {
		return HeadRef{}, err
	}
	return HeadRef{
		CommitId: refs[0].Hash,
	}, nil
}

func (self *Repo) reachables() ([]Commit, error) {
	lines, cmderr := self.readLines([]string{"log", "--pretty=%H|%P|%an|%ae|%ad|%cn|%ce|%cd|%s", "--reverse", "--all"}, always)
	if cmderr != nil {
		return nil, cmderr.Cause
	}
	commits := make([]Commit, 0, len(lines))
	for _, line := range lines {
		commits = append(commits, parseCommit(line, false))
	}
	return commits, nil
}

func (self *Repo) unreachables() ([]Commit, error) {
	idLines, cmderr := self.readLines([]string{"fsck", "--unreachable", "--no-reflogs", "--no-progress"}, func(line string) bool {
		return strings.Contains(line, "commit")
	})
	if cmderr != nil {
		return nil, cmderr.Cause
	}
	unreacheableIds := make([]string, 0, len(idLines))
	for _, line := range idLines {
		unreacheableIds = append(unreacheableIds, strings.SplitN(line, " ", 3)[2])
	}
	if len(unreacheableIds) == 0 {
		return nil, nil
	}
	revListArgs := []string{"rev-list", "--no-walk", "--pretty=%H|%P|%an|%ae|%ad|%cn|%ce|%cd|%s"}
	revListArgs = append(revListArgs, unreacheableIds...)
	lines, cmderr := self.readLines(revListArgs, func(line string) bool {
		return !strings.HasPrefix(line, "commit")
	})
	if cmderr != nil {
		return nil, cmderr.Cause
	}
	commits := make([]Commit, 0, len(lines))
	for _, line := range lines {
		commits = append(commits, parseCommit(line, true))
	}
	return commits, nil
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

func (self *Repo) status() ([]FileStatus, error) {
	lines, cmderr := self.readLines([]string{"status", "--porcelain", "-uall"}, always)
	if cmderr != nil {
		return nil, cmderr.Cause
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
	return statuses, nil
}
