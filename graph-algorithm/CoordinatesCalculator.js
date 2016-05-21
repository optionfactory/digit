function CoordinatesCalculator(config) {
    this.configuration = {
        startingPoint: (config && config.startingPoint) || { x: 0, y: 0 },
        alongDirectrixStep: (config && config.alongDirectrixStep) || 10,
        betweenDirectrixesStep: (config && config.betweenDirectrixesStep) || 10,
        mainDirectrix: (config && config.mainDirectrix) || 0,
        forwardNodeDistributionStrategy: (config && config.forwardNodeDistributionStrategy) || distributionStrategies.horizontalConstrained,
        backwardsNodeDistributionStrategy: (config && config.backwardsNodeDistributionStrategy) || distributionStrategies.horizontalConstrainedInverse,
        directrixSelectionStrategy: (config && config.directrixSelectionStrategy) || directrixSelectionStrategies.flipFlop,
    }
}

var distributionStrategies = {
    horizontalConstrained: function(startNode, defaultIncrement) {
        return function(nodes, directrix, parentDirectrix, allNodes) {
            var chunkPositions = [];
            var current = startNode.x + (directrix === parentDirectrix ? 0 : -defaultIncrement / 2);

            for (var i = 0; i != nodes.length; ++i) {
                var node = nodes[i];
                // search all parents already positioned, get their x
                var parentXs = node.originalNode.parents
                    .map(function(nodeId) {
                        return allNodes.find(graphs.byId(nodeId)).x;
                    }).filter(function(coord) {
                        return coord !== undefined;
                    }).map(function(coord) {
                        return coord + defaultIncrement / 2
                    });
                var minimumX = Math.max(...parentXs);

                // then search all children, get their x
                var childrenXs = allNodes.filter(function(nd) {
                    return nd.x !== undefined;
                }).filter(function(nd) {
                    return nd.originalNode.parents.indexOf(node.id) !== -1;
                }).map(function(nd) {
                    return nd.x - defaultIncrement / 2;
                })
                var maximumX = Math.min(...childrenXs);

                //   max(current, parents)+minDelta <= node position <= min(current, children)-minDelta
                var effectiveX = current + defaultIncrement;
                if (effectiveX > maximumX) {
                    effectiveX = maximumX;
                }
                if (effectiveX < minimumX) {
                    effectiveX = minimumX;
                }

                node.x = effectiveX;
                node.y = directrix;
                chunkPositions.push({ x: node.x, y: node.y });
                current = effectiveX;
            }
            return chunkPositions;
        }
    },
    horizontalStartingFrom: function(startNode, increment) {
        return function(nodes, directrix, parentDirectrix) {
            var chunkPositions = [];
            var current = startNode.x;
            for (var nodeIdx in nodes) {
                var node = nodes[nodeIdx];
                node.x = current + (directrix === parentDirectrix ? increment : increment / 2);
                node.y = directrix;
                chunkPositions.push({ x: node.x, y: node.y });
                current += increment;
            }
            return chunkPositions;
        }
    },
    horizontalConstrainedInverse: function(endNode, defaultIncrement) {
        return function(nodes, directrix, parentDirectrix, allNodes) {
            var chunkPositions = [];
            var current = endNode.x - (directrix === parentDirectrix ? 0 : -defaultIncrement / 2);
            var reversed = [].concat(nodes).reverse();

            for (var i = 0; i != reversed.length; ++i) {
                var node = reversed[i];

                // search all parents already positioned, get their x
                var parentXs = node.originalNode.parents
                    .map(function(nodeId) {
                        return allNodes.find(graphs.byId(nodeId)).x;
                    }).filter(function(coord) {
                        return coord !== undefined;
                    }).map(function(coord) {
                        return coord + defaultIncrement / 2
                    });
                var minimumX = Math.max(...parentXs);

                // then search all children, get their x
                var childrenXs = allNodes.filter(function(nd) {
                    return nd.x !== undefined;
                }).filter(function(nd) {
                    return nd.originalNode.parents.indexOf(node.id) !== -1;
                }).map(function(nd) {
                    return nd.x - defaultIncrement / 2;
                })
                var maximumX = Math.min(...childrenXs);

                //   max(current, parents)+minDelta <= node position <= min(current, children)-minDelta
                var effectiveX = current - defaultIncrement;
                if (effectiveX > maximumX) {
                    effectiveX = maximumX;
                }
                if (effectiveX < minimumX) {
                    effectiveX = minimumX;
                }

                node.x = effectiveX;
                node.y = directrix;
                chunkPositions.push({ x: node.x, y: node.y });
                current = effectiveX;
            }
            return chunkPositions;
        }
    },
    horizontalEndingAt: function(endNode, increment) {
        return function(nodes, directrix, parentDirectrix) {
            var current = endNode.x;
            var chunkPositions = [];
            var reversed = [].concat(nodes).reverse();
            for (var nodeIdx in reversed) {
                var node = reversed[nodeIdx];
                node.x = current - (directrix === parentDirectrix ? increment : increment / 2);
                node.y = directrix;
                chunkPositions.push({ x: node.x, y: node.y });
                current -= increment;
            }
            return chunkPositions;
        }
    },
    verticalStartingFrom: function(startNode, increment) {
        return function(nodes, directrix, parentDirectrix) {
            var chunkPositions = [];
            var current = startNode.y;
            for (var nodeIdx in nodes) {
                var node = nodes[nodeIdx];
                node.y = current + (directrix === parentDirectrix ? increment : increment / 2);
                node.x = directrix;
                chunkPositions.push({ x: node.x, y: node.y });
                current += increment;
            }
            return chunkPositions;
        }
    },
    verticalEndingAt: function(endNode, increment) {
        return function(nodes, directrix, parentDirectrix) {
            var current = endNode.y;
            var chunkPositions = [];
            var reversed = [].concat(nodes).reverse();
            for (var nodeIdx in reversed) {
                var node = reversed[nodeIdx];
                node.y = current - (directrix === parentDirectrix ? increment : increment / 2);
                node.x = directrix;
                chunkPositions.push({ x: node.x, y: node.y });
                current -= increment;
            }
            return chunkPositions;
        }
    }

}

var directrixSelectionStrategies = {
    incremental: function(increment) {
        return function(baseline, alreadyTried) {
            var current = baseline;
            while (alreadyTried.includes(current)) {
                current += increment;
            }
            return current;
        }
    },
    flipFlop: function(increment) {
        return function(baseline, alreadyTried) {
            function getOffset(index) {
                //0, 1, -1, 2, -2, 3, ...
                return Math.pow(-1, index + 1) * Math.ceil(index / 2);
            }
            var offset = getOffset(alreadyTried.length);
            return baseline + offset * increment;
        }
    }
}

CoordinatesCalculator.prototype = {
    positionNodes: function(nodesToBePositioned) {
        var me = this;
        var nodes = nodesToBePositioned.map(function(node) {
            return {
                id: node.id,
                originalNode: node,
                parents: [].concat(node.parents),
                x: undefined,
                y: undefined
            }
        });
        var config = this.configuration;
        var costliestPossiblePath = BellmanFord.costliestPossible(nodes);
        this._isolateFloatingChainAlongPath(nodes, costliestPossiblePath, costliestPossiblePath[0]);

        var allChunksPositions = [];
        var mainChunkPositions = this._positionNodes(
            config.forwardNodeDistributionStrategy(config.startingPoint, config.alongDirectrixStep),
            config.directrixSelectionStrategy(config.betweenDirectrixesStep),
            nodes,
            costliestPossiblePath,
            allChunksPositions,
            config.mainDirectrix
        );

        allChunksPositions.push(mainChunkPositions);
        // then navigate backwards from the last node and position 
        // ancestors and descendants along parallel directrixes
        costliestPossiblePath.reverse().forEach(function(nodeId) {
            allChunksPositions = allChunksPositions.concat(
                me._positionAncestorsAndDescendants(nodes, nodeId, mainChunkPositions.directrix, allChunksPositions)
            );
        });
        return nodes;
    },
    _positionNodes: function(distributionStrategy, directrixSelectionStrategy, nodes, chainToBePositioned, previousChunksPositions, baselineDirectrix) {
        var me = this;
        var nodesToBePositioned = chainToBePositioned.map(function(nodeId) {
            return nodes.find(graphs.byId(nodeId));
        });
        var attemptedDirectrixes = [];
        while (true) {
            var directrix = directrixSelectionStrategy(baselineDirectrix, attemptedDirectrixes);
            attemptedDirectrixes.push(directrix);
            var currentChunkPositions = {
                directrix: directrix,
                chunkPositions: distributionStrategy(nodesToBePositioned, directrix, baselineDirectrix, nodes)
            };
            //search for colliding nodes (among those already placed)
            var thereAreCollisions = previousChunksPositions.some(function(previousChunkPosition) {
                return me._doCollide(previousChunkPosition, currentChunkPositions);
            })
            if (!thereAreCollisions) {
                return currentChunkPositions;
            }
        }
    },
    _doCollide: function(lhsCoordinatesChunk, rhsCoordinatesChunk) {
        // works only when chunks are positioned horizontally or vertically,
        // unreliable on diagonal positioning
        function getMinMax(coordinatesChunk) {
            var validCoordinates = coordinatesChunk.filter(function(coords) {
                return coords.x !== undefined && coords.y !== undefined;
            });
            var allX = validCoordinates.map(function(coords) {
                return coords.x;
            });
            var minX = Math.min(...allX);
            var maxX = Math.max(...allX);
            var allY = validCoordinates.map(function(coords) {
                return coords.y;
            });
            var minY = Math.min(...allY);
            var maxY = Math.max(...allY);
            return {
                min: { x: minX, y: minY },
                max: { x: maxX, y: maxY }
            }
        }
        if (lhsCoordinatesChunk.directrix !== rhsCoordinatesChunk.directrix) {
            return false;
        }
        lhs = getMinMax(lhsCoordinatesChunk.chunkPositions);
        rhs = getMinMax(rhsCoordinatesChunk.chunkPositions);
        var disjointedOnX = lhs.max.x < rhs.min.x || lhs.min.x > rhs.max.x;
        var disjointedOnY = lhs.max.y < rhs.min.y || lhs.min.y > rhs.max.y;
        return !disjointedOnX && !disjointedOnY;
    },
    _positionAncestorsAndDescendants: function(allNodes, ofNodeId, currentDirectrix, previousChunksPosition) {
        var me = this;
        var configuration = this.configuration;
        var node = allNodes.find(graphs.byId(ofNodeId));
        var newChunksPositions = [];
        do {
            var longestAncestorsChain = BellmanFord.costliestToNode(allNodes, ofNodeId);
            var longestValidAncestorsChain = this._isolateFloatingChainAlongInversePath(allNodes, longestAncestorsChain, ofNodeId);
            var anchestorsChunk = this._positionNodes(
                configuration.backwardsNodeDistributionStrategy(node, configuration.alongDirectrixStep),
                configuration.directrixSelectionStrategy(configuration.betweenDirectrixesStep),
                allNodes,
                longestValidAncestorsChain,
                previousChunksPosition,
                currentDirectrix
            );
            if (anchestorsChunk.chunkPositions.length > 0) {
                newChunksPositions.push(anchestorsChunk);
            }
            var longestDescendantsChain = BellmanFord.costliestFromNode(allNodes, ofNodeId);
            var longestValidDescendantsChain = this._isolateFloatingChainAlongPath(allNodes, longestDescendantsChain, ofNodeId);
            var descendantsChunk = this._positionNodes(
                configuration.forwardNodeDistributionStrategy(node, configuration.alongDirectrixStep),
                configuration.directrixSelectionStrategy(configuration.betweenDirectrixesStep),
                allNodes,
                longestValidDescendantsChain,
                previousChunksPosition.concat(newChunksPositions),
                currentDirectrix
            );
            if (descendantsChunk.chunkPositions.length > 0) {
                newChunksPositions.push(descendantsChunk);
            }

            longestValidAncestorsChain.reverse().forEach(function(ancestor) {
                newChunksPositions = newChunksPositions.concat(
                    me._positionAncestorsAndDescendants(allNodes, ancestor, anchestorsChunk.directrix, previousChunksPosition.concat(newChunksPositions), configuration)
                );
            })
            longestValidDescendantsChain.forEach(function(descendant) {
                newChunksPositions = newChunksPositions.concat(
                    me._positionAncestorsAndDescendants(allNodes, descendant, descendantsChunk.directrix, previousChunksPosition.concat(newChunksPositions), configuration)
                );
            })
        } while (longestValidAncestorsChain.length !== 0 || longestValidDescendantsChain.length !== 0)
        return newChunksPositions;
    },
    _removeIfPresent: function(array, elementToRemove) {
        var removeIndex = array.indexOf(elementToRemove);
        if (removeIndex !== -1) {
            array.splice(removeIndex, 1);
        }
    },
    _isolateFloatingChainAlongPath: function(nodes, pathToExplore, startingFromId) {
        var detachedChain = [];
        var chainStarted = false;
        for (var i = 0; i < pathToExplore.length - 1; ++i) {
            var currentNodeId = pathToExplore[i];
            if (chainStarted == false && currentNodeId !== startingFromId) {
                continue;
            } else {
                chainStarted = true;
            }
            var nextNodeId = pathToExplore[i + 1];
            var nextNode = nodes.find(graphs.byId(nextNodeId));
            this._removeIfPresent(nextNode.parents, currentNodeId);
            if (nextNode.x !== undefined && nextNode.y !== undefined) {
                break;
            } else {
                detachedChain.push(nextNodeId);
            }
        }
        return detachedChain;
    },
    _isolateFloatingChainAlongInversePath: function(nodes, pathToExplore, endingPoint) {
        var detachedChain = [];
        var chainStarted = false;
        for (var i = pathToExplore.length; i >= 1; --i) {
            var previousNodeId = pathToExplore[i - 1];
            var currentNodeId = pathToExplore[i];

            if (chainStarted == false && currentNodeId !== endingPoint) {
                continue;
            } else {
                chainStarted = true;
            }
            var currentNode = nodes.find(graphs.byId(currentNodeId));
            var previousNode = nodes.find(graphs.byId(previousNodeId));
            this._removeIfPresent(currentNode.parents, previousNodeId);
            if (previousNode.x !== undefined && previousNode.y !== undefined) {
                break;
            } else {
                detachedChain.push(previousNodeId);
            }
        }
        return detachedChain.reverse();
    }
}
