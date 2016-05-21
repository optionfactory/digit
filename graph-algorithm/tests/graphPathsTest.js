var deepEqual = function(x, y) {
    if ((typeof x == "object" && x != null) && (typeof y == "object" && y != null)) {
        if (Object.keys(x).length != Object.keys(y).length)
            return false;
        for (var prop in x) {
            if (typeof x[prop] === "function") {
                continue;
            }
            if (y.hasOwnProperty(prop)) {
                if (!deepEqual(x[prop], y[prop]))
                    return false;
            } else
                return false;
        }

        return true;
    } else if (x !== y)
        return false;
    else
        return true;
}

function errorMessage(possibleExpectedSolutions, gotSolution) {
    var solutionsPossible = [].concat(possibleExpectedSolutions);
    var msg = "expected: ";
    if (solutionsPossible.length < 2) {
        msg = msg + "\"" + solutionsPossible + "\"";
    } else {
        msg = msg + " either \"" + solutionsPossible[0] + "\"";
        msg = msg + solutionsPossible.splice(1).map(function(expected) {
            return " or \"" + expected + "\"";
        });
    }
    msg += "; got: \"" + gotSolution + "\"";
    return msg;
}

QUnit.module("Dijkstra.cheapestToTip");
QUnit.test("path to not existing node is empty", function(assert) {
    var graph = demoGraphs.singleNode;
    assert.deepEqual(Dijkstra.cheapestToNode(graph.nodes, "notExisting"), []);
});
QUnit.test("path to root is itself", function(assert) {
    var graph = demoGraphs.twoRoots;
    assert.deepEqual(Dijkstra.cheapestToNode(graph.nodes, "root2"), ["root2"]);
});

Object.keys(demoGraphs).forEach(function(graphName) {
    QUnit.test(graphName, function(assert) {
        var graph = demoGraphs[graphName];
        var got = Dijkstra.cheapestToNode(graph.nodes, "tip");
        assert.ok(graph.cheapestToTip.some(function(expected) {
            return deepEqual(expected, got);
        }), errorMessage(graph.cheapestToTip, got));
    });
});

QUnit.module("BellmanFord.cheapestToTip");
QUnit.test("path to not existing node is empty", function(assert) {
    var graph = demoGraphs.singleNode;
    assert.deepEqual(BellmanFord.cheapestToNode(graph.nodes, "notExisting"), []);
});
QUnit.test("path to root is itself", function(assert) {
    var graph = demoGraphs.twoRoots;
    assert.deepEqual(BellmanFord.cheapestToNode(graph.nodes, "root2"), ["root2"]);
});

Object.keys(demoGraphs).forEach(function(graphName) {
    QUnit.test(graphName, function(assert) {
        var graph = demoGraphs[graphName];
        var got = BellmanFord.cheapestToNode(graph.nodes, "tip", function(){return 1;});
        assert.ok(graph.cheapestToTip.some(function(expected) {
            return deepEqual(expected, got);
        }), errorMessage(graph.cheapestToTip, got));
    });
});

QUnit.module("BellmanFord.costliestToTip");
Object.keys(demoGraphs).forEach(function(graphName) {
    QUnit.test(graphName, function(assert) {
        var graph = demoGraphs[graphName];
        var got = BellmanFord.costliestToNode(graph.nodes, "tip");
        assert.ok(graph.costliestToTip.some(function(expected) {
            return deepEqual(expected, got)
        }), errorMessage(graph.costliestToTip, got));
    });
});

QUnit.module("BellmanFord.costliestPossible");
Object.keys(demoGraphs).forEach(function(graphName) {
    QUnit.test(graphName, function(assert) {
        var graph = demoGraphs[graphName];
        var got = BellmanFord.costliestPossible(graph.nodes);
        assert.ok(graph.costliestPossible.some(function(expected) {
            return deepEqual(expected, got)
        }), errorMessage(graph.costliestPossible, got));
    });
});

QUnit.module("BellmanFord.costliestFromRoot");
Object.keys(demoGraphs).forEach(function(graphName) {
    var graph = demoGraphs[graphName];
    if (!graph.nodes.map(graphs.toId).includes("root")) {
        return;
    }
    QUnit.test(graphName, function(assert) {
        var got = BellmanFord.costliestFromNode(graph.nodes, "root");
        assert.ok(graph.costliestPossible.some(function(expected) {
            return deepEqual(expected, got)
        }), errorMessage(graph.costliestPossible, got));
    });
});
