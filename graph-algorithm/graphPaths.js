Function.prototype.curry = function() {
    if (arguments.length < 1) {
        return this; //nothing to curry with - return function
    }
    var __method = this;
    var args = Array.prototype.slice.call(arguments, 0);
    return function() {
        return __method.apply(this, args.concat(Array.prototype.slice.call(arguments, 0)));
    }
}
var graphs = {
    byId: function(nodeId) {
        return function(node) {
            return node.id === nodeId;
        }
    },
    createNodesStructure: function(graph, edgeWeightCalculator) {
        edgeWeightCalculator = edgeWeightCalculator || graphs.constantEdgeWeightCalculator(1);
        var nodes = graph.map(function(node) {
            return {
                id: node.id,
                parents: node.parents.map(function(parentId) {
                    return { id: parentId, weight: edgeWeightCalculator(node.id, parentId) };
                }),
                cost: Infinity,
                previous: undefined
            }
        });
        nodes.forEach(function(node) {
            node.reachable = nodes.filter(graphs.reachablefromNode(node.id));
        });
        return nodes;
    },
    constantEdgeWeightCalculator: function(cost) {
        return function(from, to) {
            return cost;
        }
    },
    invertEdgeWeightCalculation: function(edgeWeightCalculator) {
        edgeWeightCalculator = edgeWeightCalculator || graphs.constantEdgeWeightCalculator(1);
        return function(from, to) {
            return -1 * edgeWeightCalculator(from, to);
        }
    },
    updateCostIfLower: function(reachablefromNode, fromNode) {
        if (fromNode.cost === Infinity) {
            return;
        }
        reachablefromNode.forEach(function(node) {
            var costIncrement = node.parents.find(graphs.byId(fromNode.id)).weight;
            var newCost = fromNode.cost + costIncrement;
            if (node.cost < newCost) {
                return;
            }
            node.cost = newCost;
            node.previous = fromNode.id;
        });
    },
    sortNodesByCost: function(lhs, rhs) {
        //Don't user lhs.cost - rhs.cost because costs can be Infinite, and that messes up things
        return lhs.cost < rhs.cost ? -1 : lhs.cost > rhs.cost ? 1 : 0;
    },
    sortByCostToNode: function(nodeId, lhsRoute, rhsRoute) {
        var lhsNode = lhsRoute.find(graphs.byId(nodeId));
        var rhsNode = rhsRoute.find(graphs.byId(nodeId));
        if (lhsNode === undefined) {
            return rhsNode === undefined ? 0 : 1;
        }
        if (rhsNode === undefined) {
            return -1;
        }
        return graphs.sortNodesByCost(lhsNode, rhsNode);
    },
    getLowestCostNode: function(nodes) {
        return nodes.sort(graphs.sortNodesByCost)[0];
    },
    navigate: function(nodes, startingFromId, result) {
        var start = nodes.find(graphs.byId(startingFromId));
        if (start == undefined) {
            return result;
        }
        result.push(startingFromId);
        return graphs.navigate(nodes, start.previous, result);
    },
    toId: function(node) {
        return node.id;
    },
    finiteCost: function(node) {
        return node.cost !== Infinity;
    },
    reachablefromNode: function(fromNodeId) {
        return function(node) {
            return node.parents.map(graphs.toId).indexOf(fromNodeId) > -1;
        }
    }
}

var BellmanFord = {
    _calculateCostsStartingFromNode: function(graph, edgeWeightCalculator, startingNode) {
        var start = new Date();
        var nodes = graphs.createNodesStructure(graph, edgeWeightCalculator);
        if (nodes.length <= 1) {
            return nodes;
        }
        nodes.sort(function(lhs, rhs) {
            if (lhs.id === startingNode.id) {
                return -1;
            }
            if (rhs.id === startingNode.id) {
                return 1;
            }
            return 0;
        });
        nodes[0].cost = 0;
        for (var i = 0; i < nodes.length - 1; ++i) {
            for (var j = 0; j < nodes.length; ++j) {
                var fromNode = nodes[j];
                graphs.updateCostIfLower(fromNode.reachable, fromNode);
            }
        }
        return nodes;
    },
    _buildSubgraphToNode: function(graph, nodeId, target) {
        target = target || [];
        var node = graph.find(graphs.byId(nodeId));
        target.push(node);
        for (var i = 0; i != node.parents.length; ++i) {
            BellmanFord._buildSubgraphToNode(graph, node.parents[i], target);
        }
        return target;
    },
    _buildSubgraphFromNode: function(graph, node, target) {
        target = target || [];
        target.push(node);
        var children = graph.filter(function(nod) {
            return nod.parents.indexOf(node.id) !== -1;
        });
        for (var i = 0; i != children.length; ++i) {
            BellmanFord._buildSubgraphFromNode(graph, children[i], target);
        }
        return target;
    },
    cheapestToNode: function(graph, toNodeId, edgeWeightCalculator) {
        edgeWeightCalculator = edgeWeightCalculator || graphs.constantEdgeWeightCalculator(1);
        if (!graph.map(graphs.toId).includes(toNodeId)) {
            return [];
        }

        var subgraph = [];
        BellmanFord._buildSubgraphToNode(graph, toNodeId, subgraph);
        var rootNodes = subgraph.filter(function(node) {
            return node.parents.length == 0;
        });
        var weightedNodesByStartingPoint = rootNodes.map(BellmanFord._calculateCostsStartingFromNode.curry(subgraph, edgeWeightCalculator));
        var routeWithShortestPathToNode = weightedNodesByStartingPoint.length === 0 ? [] : weightedNodesByStartingPoint.sort(graphs.sortByCostToNode.curry(toNodeId))[0];
        return graphs.navigate(routeWithShortestPathToNode, toNodeId, []).reverse();
    },
    costliestToNode: function(graph, toNodeId, edgeWeightCalculator) {
        edgeWeightCalculator = edgeWeightCalculator || graphs.constantEdgeWeightCalculator(1);
        // Inverting the edge weights makes the cheapest path search into the costlier
        return BellmanFord.cheapestToNode(graph, toNodeId, graphs.invertEdgeWeightCalculation(edgeWeightCalculator));
    },
    costliestFromNode: function(graph, fromNodeId, edgeWeightCalculator) {
        edgeWeightCalculator = edgeWeightCalculator || graphs.constantEdgeWeightCalculator(1);
        var startingNodeInGraph = graph.find(graphs.byId(fromNodeId));
        if (startingNodeInGraph === undefined) {
            return [];
        }
        var subgraph = [];
        BellmanFord._buildSubgraphFromNode(graph, startingNodeInGraph, subgraph);

        // Inverting the edge weights makes the cheapest path search into the costlier
        var weightedNodes = BellmanFord._calculateCostsStartingFromNode(subgraph, graphs.invertEdgeWeightCalculation(edgeWeightCalculator), startingNodeInGraph);
        if (weightedNodes.length === 0) {
            return [];
        }
        // because we inverted the edge weight calculation function, costs are expressed as negative numbers
        // therefore the one with the lowest cost is the most expensive
        var mostCostlyNodeToReach = weightedNodes.sort(graphs.sortNodesByCost)[0];
        return graphs.navigate(weightedNodes, mostCostlyNodeToReach.id, []).reverse();
    },
    costliestPossible: function(graph, edgeWeightCalculator) {
        edgeWeightCalculator = edgeWeightCalculator || function() {
                return 1;
            }
            //the costliest path necessarily starts from a root node
        var rootNodes = graph.filter(function(node) {
            return node.parents.length == 0;
        });

        // Inverting the edge weights makes the cheapest path search into the costlier
        var weightedNodesByStartingPoint = rootNodes.map(BellmanFord._calculateCostsStartingFromNode.curry(graph, graphs.invertEdgeWeightCalculation(edgeWeightCalculator)));
        if (weightedNodesByStartingPoint.length === 0) {
            return [];
        }

        // because we inverted the edge weight calculation function, costs are expressed as negative numbers
        // therefore the one with the lowest cost is the most expensive
        var weightedNodesWithCostlierNode = weightedNodesByStartingPoint.map(function(weightedNodes) {
            return {
                weightedNodes: weightedNodes,
                costlierNodeToReach: weightedNodes.sort(graphs.sortNodesByCost)[0]
            };
        });
        var costliestPossible = weightedNodesWithCostlierNode.sort(function(lhs, rhs) {
            return graphs.sortNodesByCost(lhs.costlierNodeToReach, rhs.costlierNodeToReach);
        })[0];

        return graphs.navigate(costliestPossible.weightedNodes, costliestPossible.costlierNodeToReach.id, []).reverse();
    }
}

var Dijkstra = {
    _visit: function(nodes, visited, fromNode) {
        graphs.updateCostIfLower(fromNode.reachable, fromNode);
        visited.push(fromNode);
        var notVisited = nodes.filter(function(node) {
            return !visited.some(graphs.byId(node.id));
        });
        if (notVisited.length === 0) {
            return nodes;
        }
        var nextNode = graphs.getLowestCostNode(notVisited);
        return Dijkstra._visit(nodes, visited, nextNode);
    },
    _calculateCostsStartingFromNode: function(graph, edgeWeightCalculator, startingNode) {
        var nodes = graphs.createNodesStructure(graph, edgeWeightCalculator);
        nodes.sort(function(lhs, rhs) {
            if (lhs.id === startingNode.id) {
                return -1;
            }
            if (rhs.id === startingNode.id) {
                return 1;
            }
            return 0;
        });
        nodes[0].cost = 0;
        return Dijkstra._visit(nodes, [], nodes.find(graphs.byId(startingNode.id)));
    },
    cheapestToNode: function(graph, toNodeId, edgeWeightCalculator) {
        var rootNodes = graph.filter(function(node) {
            return node.parents.length == 0;
        });
        var weightedNodesByStartingPoint = rootNodes.map(Dijkstra._calculateCostsStartingFromNode.curry(graph, edgeWeightCalculator));
        if (weightedNodesByStartingPoint.length === 0) {
            return [];
        }
        var weightedNodesWithCheapestRoute = weightedNodesByStartingPoint.sort(graphs.sortByCostToNode.curry(toNodeId))[0];
        return graphs.navigate(weightedNodesWithCheapestRoute, toNodeId, []).reverse();
    }
}
