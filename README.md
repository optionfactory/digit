# digit - learn git by visualizing it
A visualization tool to learn git, as used in our wonderful workshop (http://www.optionfactory.net/courses/details/Git/).

## Usage
'''
digit [--bind-to <bind-address>:<bind-port>] local_repo_path [origin_repo_path]
'''

and point your browser to http://localhost:9000 (or any other address specified in --bind-to)

Both paths must reside on the local filesystem (no network support yet).

## Building from source
This repo uses a submodule in embedded_data/graph-algorithm.

*When cloning, make sure to use --recursive in order to properly initialize the submodule.*

The build system relies on docker and GNU Make.

make local: builds for the local os/arch
make all: builds for all architectures

## Known Limitations

* just a learning aid
* not meant to scale (tested with repos with a couple hunder commits)

# Supported platforms

* Linux (tested)
* OS X (tested)
* Windows (test in progress)
* Others: possibly

## Authors

* Francesco Degrassi
* Davide Salvador

## Thanks
To Wei Wang: several ideas taken from https://github.com/onlywei/explain-git-with-d3
