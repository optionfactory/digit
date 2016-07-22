PROJECT=digit
SCM_SERVICE=github.com
SCM_TEAM=optionfactory
GO_LANG_DOCKER_CONTAINER=golang:1.6
UID=$(shell id -u)
GID=$(shell id -g)
VERSION=$(shell git describe --always)
SHELL = /bin/bash
GOFLAGS=-a
SKIPDEPS=false
SKIPTESTS=false


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




local: GOFLAGS=

local: FORCE
	@echo spawning docker container
	@docker run --rm=true \
		-v ${PWD}/goroot:/go \
		-v ${PWD}/go:/go/src/$(SCM_SERVICE)/$(SCM_TEAM)/$(PROJECT)/ \
		-v ${PWD}/Makefile:/go/Makefile \
		-v ${PWD}/bin:/go/bin \
		-w /go/src/$(SCM_SERVICE)/$(SCM_TEAM)/$(PROJECT)/ \
		$(GO_LANG_DOCKER_CONTAINER) \
		make -f /go/Makefile $(PROJECT)-$(BUILD_OS)-$(BUILD_ARCH) SKIPTESTS=${SKIPTESTS} SKIPDEPS=${SKIPDEPS} GOFLAGS=${GOFLAGS} UID=${UID} GID=${GID} VERSION=${VERSION} BUILD_OS=${BUILD_OS} BUILD_ARCH=${BUILD_ARCH} TESTING_OPTIONS=${TESTING_OPTIONS}



local-fast: SKIPTESTS=true
local-fast: SKIPDEPS=true

local-fast: local



all: FORCE
	@echo spawning docker container
	@docker run --rm=true \
		-v ${PWD}/go/:/go/src/$(SCM_SERVICE)/$(SCM_TEAM)/$(PROJECT)/ \
		-v ${PWD}/Makefile:/go/Makefile \
		-v ${PWD}/bin:/go/bin \
		-w /go/src/$(SCM_SERVICE)/$(SCM_TEAM)/$(PROJECT)/ \
		$(GO_LANG_DOCKER_CONTAINER) \
		make -f /go/Makefile build SKIPTESTS=${SKIPTESTS} SKIPDEPS=${SKIPDEPS} GOFLAGS=${GOFLAGS} UID=${UID} GID=${GID} VERSION=${VERSION} BUILD_OS=${BUILD_OS} BUILD_ARCH=${BUILD_ARCH} TESTING_OPTIONS=${TESTING_OPTIONS}

build: \
	$(PROJECT)-linux-amd64 \
	$(PROJECT)-darwin-amd64 \
	$(PROJECT)-windows-amd64

build-exotic: \
	$(PROJECT)-linux-386 $(PROJECT)-linux-arm \
	$(PROJECT)-darwin-386 \
	$(PROJECT)-dragonfly-amd64 \
    $(PROJECT)-freebsd-386 $(PROJECT)-freebsd-amd64 $(PROJECT)-freebsd-arm \
	$(PROJECT)-netbsd-386 $(PROJECT)-netbsd-amd64 $(PROJECT)-netbsd-arm \
	$(PROJECT)-openbsd-386 $(PROJECT)-openbsd-amd64 \
	$(PROJECT)-solaris-amd64 \


#$(PROJECT)-dragonfly-386 

$(PROJECT)-linux-%: GOOS = linux
$(PROJECT)-darwin-%: GOOS = darwin
$(PROJECT)-dragonfly-%: GOOS = dragonfly
$(PROJECT)-freebsd-%: GOOS = freebsd
$(PROJECT)-netbsd-%: GOOS = netbsd
$(PROJECT)-openbsd-%: GOOS = openbsd
$(PROJECT)-solaris-%: GOOS = solaris
$(PROJECT)-windows-%: GOOS = windows
$(PROJECT)-windows-%: EXT = .exe

$(PROJECT)-%-amd64: GOARCH = amd64
$(PROJECT)-%-386: GOARCH = 386
$(PROJECT)-%-arm: GOARCH = arm

$(PROJECT)-%: reformat prepare-dependencies-% tests-% *.go
	@echo building for $(GOOS):$(GOARCH) in ${BUILD_OS}:${BUILD_ARCH}
	@GOOS=$(GOOS) GOARCH=$(GOARCH) CGO_ENABLED=0 go install $(GOFLAGS) -tags netgo -installsuffix netgo -ldflags "-X main.version=$(VERSION)"
	@if [ "${GOOS}" == "${BUILD_OS}" -a "${GOARCH}" == "${BUILD_ARCH}" ] ; then \
		mv "/go/bin/${PROJECT}${EXT}" "/go/bin/${PROJECT}-${GOOS}-${GOARCH}${EXT}"; \
	else \
		mv "/go/bin/$(GOOS)_$(GOARCH)/$(PROJECT)$(EXT)" "/go/bin/$(PROJECT)-$(GOOS)-$(GOARCH)$(EXT)"; \
		rm -rf "/go/bin/${GOOS}_${GOARCH}/"; \
	fi
	@chown ${UID}:${GID} "/go/bin/${PROJECT}-${GOOS}-${GOARCH}${EXT}"
	@echo ""

reformat:
	@echo reformatting
	@gofmt -w=true -s=true .

prepare-dependencies-%:
ifeq ($(SKIPDEPS), false)
	@echo "preparing dependencies for $(GOOS):$(GOARCH): go-bindata"
	@GOOS=$(GOOS) GOARCH=$(GOARCH) CGO_ENABLED=0 go get -installsuffix netgo -u github.com/jteeuwen/go-bindata/...
	@echo building assets with go-bindata
	@GOOS=$(GOOS) GOARCH=$(GOARCH) CGO_ENABLED=0 go-bindata -pkg assets -o assets/assets.go embedded-data/
	@echo "preparing dependencies for $(GOOS):$(GOARCH)"	
	@GOOS=$(GOOS) GOARCH=$(GOARCH) CGO_ENABLED=0 go get -installsuffix netgo ./...
else 
	@echo skipping dependencies	
endif

tests-%: FORCE
ifeq ($(SKIPTESTS), false)
	@if [ "${GOOS}" == "${BUILD_OS}" -a "${GOARCH}" == "${BUILD_ARCH}" ] ; then \
		GOOS=$(GOOS) GOARCH=$(GOARCH) CGO_ENABLED=0 go vet -tags netgo -installsuffix netgo -ldflags "-X main.version=$(VERSION)" ./...; \
		GOOS=$(GOOS) GOARCH=$(GOARCH) CGO_ENABLED=0 go test $(GOFLAGS) $(TESTING_OPTIONS) -tags netgo -installsuffix netgo -ldflags "-X main.version=$(VERSION)" ./...; \
	fi
else
	@echo "skipping tests"
endif


clean:
	-rm -f bin/$(PROJECT)*

FORCE:
