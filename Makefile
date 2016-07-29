PROJECT:=digit
SCM_SERVICE:=github.com
SCM_TEAM:=optionfactory
GOLANG_IMAGE:=golang:1.7
UID=$(shell id -u)
GID=$(shell id -g)
VERSION:=$(shell git describe --tags --always --dirty 2>/dev/null||echo "untracked")
SHELL = /bin/bash
TOOLS_TO_INSTALL=github.com/jteeuwen/go-bindata 
#set to true to skip tests execution 
#e.g: make develop DEVELOP_SKIP_TESTS=true 
DEVELOP_SKIP_TESTS=false
#set to true to skip rebuilding the executable after test execution 
#e.g: make develop DEVELOP_SKIP_BUILD=true 
DEVELOP_SKIP_BUILD=false
#set to a command to be executed inside the docker container after 
#rebuilding the executable
#e.g: make develop DEVELOP_AFTER_BUILD="killall my-exec; bin/my-exec &"
#e.g: make develop DEVELOP_AFTER_BUILD="(sleep 10; echo TADAAAAAAA)&"	
DEVELOP_AFTER_BUILD=

ifeq ($(OS),Windows_NT)
	BUILD_OS = windows
	ifeq ($(PROCESSOR_ARCHITECTURE),AMD64)
		BUILD_ARCH = amd64
	endif
	ifeq ($(PROCESSOR_ARCHITECTURE),x86)
		BUILD_ARCH = 386
	endif
else
	UNAME_S := $(shell uname -s)
	ifeq ($(UNAME_S),Linux)
		BUILD_OS = linux
	endif
	ifeq ($(UNAME_S),Darwin)
		BUILD_OS = darwin
	endif

	ifneq ("$(shell which arch)","")
		UNAME_P := $(shell arch)
	else
		UNAME_P := $(shell uname -p)
	endif

	ifeq ($(UNAME_P),x86_64)
		BUILD_ARCH = amd64
	endif
	ifneq ($(filter %86,$(UNAME_P)),)
		BUILD_ARCH = 386
	endif
	ifneq ($(filter arm%,$(UNAME_P)),)
		BUILD_ARCH = arm
	endif
endif


local: FORCE
	@echo spawning docker container $(GOLANG_IMAGE)
	@docker run --rm=true \
		-v ${PWD}:/go/src/$(SCM_SERVICE)/$(SCM_TEAM)/$(PROJECT)/ \
		-v ${PWD}/Makefile:/go/Makefile \
		-v ${PWD}/bin:/go/bin \
		-w /go/src/$(SCM_SERVICE)/$(SCM_TEAM)/$(PROJECT)/ \
		$(GOLANG_IMAGE) \
		make -f /go/Makefile $(PROJECT)-$(BUILD_OS)-$(BUILD_ARCH) UID=${UID} GID=${GID} VERSION=${VERSION} BUILD_OS=${BUILD_OS} BUILD_ARCH=${BUILD_ARCH} TESTING_OPTIONS=${TESTING_OPTIONS}

develop: FORCE
	@echo spawning docker container $(GOLANG_IMAGE)
	@docker run --rm=true \
		-v ${PWD}:/go/src/$(SCM_SERVICE)/$(SCM_TEAM)/$(PROJECT)/ \
		-v ${PWD}/Makefile:/go/Makefile \
		-v ${PWD}/bin:/go/bin \
		-w /go/src/$(SCM_SERVICE)/$(SCM_TEAM)/$(PROJECT)/ \
		-ti \
		$(GOLANG_IMAGE) \
		make -f /go/Makefile develop-$(PROJECT)-$(BUILD_OS)-$(BUILD_ARCH) UID=${UID} GID=${GID} VERSION=${VERSION} BUILD_OS=${BUILD_OS} BUILD_ARCH=${BUILD_ARCH} TESTING_OPTIONS=${TESTING_OPTIONS} DEVELOP_SKIP_TESTS=${DEVELOP_SKIP_TESTS} DEVELOP_SKIP_BUILD=${DEVELOP_SKIP_BUILD} DEVELOP_AFTER_BUILD="${DEVELOP_AFTER_BUILD}"



all: FORCE
	@echo spawning docker container $(GOLANG_IMAGE)
	@docker run --rm=true \
		-v ${PWD}:/go/src/$(SCM_SERVICE)/$(SCM_TEAM)/$(PROJECT)/ \
		-v ${PWD}/Makefile:/go/Makefile \
		-v ${PWD}/bin:/go/bin \
		-w /go/src/$(SCM_SERVICE)/$(SCM_TEAM)/$(PROJECT)/ \
		$(GOLANG_IMAGE) \
		make -f /go/Makefile build UID=${UID} GID=${GID} VERSION=${VERSION} BUILD_OS=${BUILD_OS} BUILD_ARCH=${BUILD_ARCH} TESTING_OPTIONS=${TESTING_OPTIONS}

build: \
	$(PROJECT)-linux-386 $(PROJECT)-linux-amd64 \
	$(PROJECT)-darwin-amd64 \
	$(PROJECT)-windows-386 $(PROJECT)-windows-amd64

#from https://github.com/golang/go/blob/master/src/go/build/syslist.go
$(PROJECT)-android-%: GOOS = android
$(PROJECT)-darwin-%: GOOS = darwin
$(PROJECT)-dragonfly-%: GOOS = dragonfly
$(PROJECT)-freebsd-%: GOOS = freebsd
$(PROJECT)-linux-%: GOOS = linux
$(PROJECT)-nacl-%: GOOS = nacl
$(PROJECT)-netbsd-%: GOOS = netbsd
$(PROJECT)-openbsd-%: GOOS = openbsd
$(PROJECT)-plan9-%: GOOS = plan9
$(PROJECT)-solaris-%: GOOS = solaris
$(PROJECT)-windows-%: GOOS = windows
$(PROJECT)-windows-%: EXT = .exe

$(PROJECT)-%-amd64: GOARCH = amd64
$(PROJECT)-%-386: GOARCH = 386
$(PROJECT)-%-arm: GOARCH = arm
$(PROJECT)-%-amd64p32: GOARCH = amd64p32
$(PROJECT)-%-armbe: GOARCH = armbe
$(PROJECT)-%-arm64: GOARCH = arm64
$(PROJECT)-%-arm64be: GOARCH = arm64be
$(PROJECT)-%-ppc64: GOARCH = ppc64
$(PROJECT)-%-ppc64le: GOARCH = ppc64le
$(PROJECT)-%-mips: GOARCH = mips
$(PROJECT)-%-mipsle: GOARCH = mipsle
$(PROJECT)-%-mips64: GOARCH = mips64
$(PROJECT)-%-mips64le: GOARCH = mips64le
$(PROJECT)-%-mips64p32: GOARCH = mips64p32
$(PROJECT)-%-mips64p32le: GOARCH = mips64p32le
$(PROJECT)-%-ppc: GOARCH = ppc
$(PROJECT)-%-s390: GOARCH = s390
$(PROJECT)-%-s390x: GOARCH = s390x
$(PROJECT)-%-sparc: GOARCH = sparc
$(PROJECT)-%-sparc64: GOARCH = sparc64


develop-$(PROJECT)-%: GOOS = $(BUILD_OS)
develop-$(PROJECT)-%: GOARCH = $(BUILD_ARCH)
develop-$(PROJECT)-%: FORCE
	@if ! which inotifywait > /dev/null ; then \
		echo "* installing inotify-tools"; \
		DEBIAN_FRONTEND=noninteractive apt-get update -q -y 1>/dev/null; \
		DEBIAN_FRONTEND=noninteractive apt-get install -q -y inotify-tools 1>/dev/null; \
	fi
	@#
	@echo "* reformatting sources"
	@gofmt -w=true -s=true .
	@#
	@for TOOL in ${TOOLS_TO_INSTALL}; do \
		echo "* fetching $${TOOL} with netgo suffix for $(GOOS):$(GOARCH)"; \
		GOOS=$(GOOS) GOARCH=$(GOARCH) CGO_ENABLED=0 go get -tags netgo -installsuffix netgo -u $${TOOL}/...; \
	done
	@#
	@echo "* generating sources"
	-@GOOS=$(GOOS) GOARCH=$(GOARCH) CGO_ENABLED=0 go generate -tags netgo -installsuffix netgo ./...
	@#
	@echo "* fetching dependencies with netgo suffix for $(GOOS):$(GOARCH)"
	-@GOOS=$(GOOS) GOARCH=$(GOARCH) CGO_ENABLED=0 go get -tags netgo -installsuffix netgo ./...
	@#
	@echo "* checking for suspicious constructs (go vet)"
	-@GOOS=$(GOOS) GOARCH=$(GOARCH) CGO_ENABLED=0 go vet -tags netgo -installsuffix netgo -ldflags "-X main.version=$(VERSION)" ./...
	@#
	@echo "* running tests: DEVELOP_SKIP_TESTS=${DEVELOP_SKIP_TESTS}"
	-@if [ "true" != "${DEVELOP_SKIP_TESTS}" ] ; then \
		GOOS=$(GOOS) GOARCH=$(GOARCH) CGO_ENABLED=0 go test -a $(TESTING_OPTIONS) -tags netgo -installsuffix netgo -ldflags "-X main.version=$(VERSION)" ./...; \
	fi
	@#	
	@echo "* compiling (go) DEVELOP_SKIP_BUILD=${DEVELOP_SKIP_BUILD}"
	-@if [ "true" != "${DEVELOP_SKIP_BUILD}" ] ; then \
		GOOS=$(GOOS) GOARCH=$(GOARCH) CGO_ENABLED=0 go install -a -tags netgo -installsuffix netgo -ldflags "-X main.version=$(VERSION)"; \
	fi
	@#
	@echo "* fixing file ownership uid:$(UID) gid:$(GID)"
	-@chown -R ${UID}:${GID} "/go/bin/"
	-@chown -R ${UID}:${GID} "/go/src/$(SCM_SERVICE)/$(SCM_TEAM)/$(PROJECT)/"	
	@#
	@echo "* executing command DEVELOP_AFTER_BUILD=${DEVELOP_AFTER_BUILD}"
	@if [ "" != "${DEVELOP_AFTER_BUILD}" ] ; then \
		eval "$${DEVELOP_AFTER_BUILD}"; \
	fi
	@echo ""
	@echo ""
	@echo ""
	@echo "* listening for filesystem changes"
	@while inotifywait -e modify -e move -e move_self -e delete -e delete_self -q -r /go/src/$(SCM_SERVICE)/$(SCM_TEAM)/$(PROJECT)/; do\
		echo "* file modified or deleted"; \
		echo "* reformatting sources"; \
		gofmt -w=true -s=true .; \
		echo "* generating sources"; \
		GOOS=$(GOOS) GOARCH=$(GOARCH) CGO_ENABLED=0 go generate -tags netgo -installsuffix netgo ./...; \
		echo "* checking for suspicious constructs (go vet)"; \
		GOOS=$(GOOS) GOARCH=$(GOARCH) CGO_ENABLED=0 go vet -tags netgo -installsuffix netgo -ldflags "-X main.version=$(VERSION)" ./...; \
		echo "* running tests: DEVELOP_SKIP_TESTS=${DEVELOP_SKIP_TESTS}"; \
		if [ "true" != "${DEVELOP_SKIP_TESTS}" ] ; then \
			GOOS=$(GOOS) GOARCH=$(GOARCH) CGO_ENABLED=0 go test -a $(TESTING_OPTIONS) -tags netgo -installsuffix netgo -ldflags "-X main.version=$(VERSION)" ./...; \
		fi; \
		echo "* compiling (go) DEVELOP_SKIP_BUILD=${DEVELOP_SKIP_BUILD}"; \
		if [ "true" != "${DEVELOP_SKIP_BUILD}" ] ; then \
			GOOS=$(GOOS) GOARCH=$(GOARCH) CGO_ENABLED=0 go install -a -tags netgo -installsuffix netgo -ldflags "-X main.version=$(VERSION)"; \
		fi; \
		echo "* fixing file ownership uid:$(UID) gid:$(GID)"; \
		chown -R ${UID}:${GID} "/go/bin/"; \
		chown -R ${UID}:${GID} "/go/src/$(SCM_SERVICE)/$(SCM_TEAM)/$(PROJECT)/"; \
		echo "* executing command DEVELOP_AFTER_BUILD=${DEVELOP_AFTER_BUILD}"; \
		if [ "" != "${DEVELOP_AFTER_BUILD}" ] ; then \
			eval "$${DEVELOP_AFTER_BUILD}"; \
		fi; \
		echo ""; \
		echo ""; \
		echo ""; \
		echo "* listening for filesystem changes"; \
	done


$(PROJECT)-%: FORCE
	@echo "building $(PROJECT)@$(VERSION) for $(GOOS):$(GOARCH) on ${BUILD_OS}:${BUILD_ARCH}"
	@#
	@echo "* reformatting sources"
	@gofmt -w=true -s=true .
	@#
	@for TOOL in ${TOOLS_TO_INSTALL}; do \
		echo "* fetching $${TOOL} with netgo suffix for $(GOOS):$(GOARCH)"; \
		GOOS=$(GOOS) GOARCH=$(GOARCH) CGO_ENABLED=0 go get -tags netgo -installsuffix netgo -u $${TOOL}/...; \
	done
	@#
	@echo "* generating sources"
	@GOOS=$(GOOS) GOARCH=$(GOARCH) CGO_ENABLED=0 go generate -tags netgo -installsuffix netgo ./...
	@#
	@echo "* fetching dependencies with netgo suffix for $(GOOS):$(GOARCH)"
	@GOOS=$(GOOS) GOARCH=$(GOARCH) CGO_ENABLED=0 go get -tags netgo -installsuffix netgo ./...
	@#
	@if [ "${GOOS}" == "${BUILD_OS}" -a "${GOARCH}" == "${BUILD_ARCH}" ] ; then \
		echo "* checking for suspicious constructs (go vet)"; \
		GOOS=$(GOOS) GOARCH=$(GOARCH) CGO_ENABLED=0 go vet -tags netgo -installsuffix netgo -ldflags "-X main.version=$(VERSION)" ./...; \
		echo "* running tests"; \
		GOOS=$(GOOS) GOARCH=$(GOARCH) CGO_ENABLED=0 go test -a $(TESTING_OPTIONS) -tags netgo -installsuffix netgo -ldflags "-X main.version=$(VERSION)" ./...; \
	else \
		echo "* skipping tests"; \
	fi
	@#	
	@echo "* compiling (go)"
	@GOOS=$(GOOS) GOARCH=$(GOARCH) CGO_ENABLED=0 go install -a -tags netgo -installsuffix netgo -ldflags "-X main.version=$(VERSION)"
	@#	
	@echo "* fixing bin/* file names"
	@if [ "${GOOS}" == "${BUILD_OS}" -a "${GOARCH}" == "${BUILD_ARCH}" ] ; then \
		mv "/go/bin/${PROJECT}${EXT}" "/go/bin/${PROJECT}-${GOOS}-${GOARCH}${EXT}"; \
	else \
		mv "/go/bin/$(GOOS)_$(GOARCH)/$(PROJECT)$(EXT)" "/go/bin/$(PROJECT)-$(GOOS)-$(GOARCH)$(EXT)"; \
		rm -rf "/go/bin/${GOOS}_${GOARCH}/"; \
	fi
	@echo "* fixing file ownership uid:$(UID) gid:$(GID)"
	@chown -R ${UID}:${GID} "/go/bin/"
	@chown -R ${UID}:${GID} "/go/src/$(SCM_SERVICE)/$(SCM_TEAM)/$(PROJECT)/"


clean: FORCE
	-rm -f bin/$(PROJECT)*

FORCE:

