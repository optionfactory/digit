var nodePrototype = { id: "anyString", timestamp: 0, parents: [] }

var demoGraphs = {
    empty: {
        nodes: [],
        cheapestToTip: [
            []
        ],
        costliestToTip: [
            []
        ],
        costliestPossible: [
            []
        ]
    },
    singleNode: {
        nodes: [
            { id: "tip", timestamp: 0, parents: [] }
        ],
        cheapestToTip: [
            ["tip"]
        ],
        costliestToTip: [
            ["tip"]
        ],
        costliestPossible: [
            ["tip"]
        ]
    },
    twoNodes: {
        nodes: [
            { id: "root", timestamp: 0, parents: [] },
            { id: "tip", timestamp: 1, parents: ["root"] }
        ],
        cheapestToTip: [
            ["root", "tip"]
        ],
        costliestToTip: [
            ["root", "tip"]
        ],
        costliestPossible: [
            ["root", "tip"]
        ]
    },
    threeNodes: {
        nodes: [
            { id: "root", timestamp: 0, parents: [] },
            { id: "node1", timestamp: 1, parents: ["root"] },
            { id: "tip", timestamp: 2, parents: ["node1"] }
        ],
        cheapestToTip: [
            ["root", "node1", "tip"]
        ],
        costliestToTip: [
            ["root", "node1", "tip"]
        ],
        costliestPossible: [
            ["root", "node1", "tip"]
        ]
    },
    forkAtRoot: {
        nodes: [
            { id: "root", timestamp: 0, parents: [] },
            { id: "tip", timestamp: 1, parents: ["root"] },
            { id: "branch", timestamp: 2, parents: ["root"] }
        ],
        cheapestToTip: [
            ["root", "tip"]
        ],
        costliestToTip: [
            ["root", "tip"]
        ],
        costliestPossible: [
            ["root", "branch"],
            ["root", "tip"]
        ]
    },
    forkAtFirstLeaf: {
        nodes: [
            { id: "root", timestamp: 0, parents: [] },
            { id: "node1", timestamp: 1, parents: ["root"] },
            { id: "tip", timestamp: 2, parents: ["node1"] },
            { id: "branch", timestamp: 3, parents: ["node1"] }
        ],
        cheapestToTip: [
            ["root", "node1", "tip"]
        ],
        costliestToTip: [
            ["root", "node1", "tip"]
        ],
        costliestPossible: [
            ["root", "node1", "branch"],
            ["root", "node1", "tip"]
        ]
    },
    forkAndMerge: {
        nodes: [
            { id: "root", timestamp: 0, parents: [] },
            { id: "br1", timestamp: 1, parents: ["root"] },
            { id: "br2", timestamp: 2, parents: ["root"] },
            { id: "tip", timestamp: 3, parents: ["br1", "br2"] }
        ],
        cheapestToTip: [
            ["root", "br1", "tip"],
            ["root", "br2", "tip"]
        ],
        costliestToTip: [
            ["root", "br1", "tip"],
            ["root", "br2", "tip"]
        ],
        costliestPossible: [
            ["root", "br1", "tip"],
            ["root", "br2", "tip"]
        ]
    },
    forkAtRootAsimmetric: {
        nodes: [
            { id: "root", timestamp: 0, parents: [] },
            { id: "a1", timestamp: 1, parents: ["root"] },
            { id: "a2", timestamp: 2, parents: ["a1"] },
            { id: "b1", timestamp: 2, parents: ["root"] },
            { id: "b2", timestamp: 2, parents: ["b1"] },
            { id: "tip", timestamp: 5, parents: ["a2"] }
        ],
        cheapestToTip: [
            ["root", "a1", "a2", "tip"]
        ],
        costliestToTip: [
            ["root", "a1", "a2", "tip"]
        ],
        costliestPossible: [
            ["root", "a1", "a2", "tip"]
        ]
    },
    forkAtRootLongerBranch: {
        nodes: [
            { id: "root", timestamp: 0, parents: [] },
            { id: "br1", timestamp: 1, parents: ["root"] },
            { id: "br2", timestamp: 2, parents: ["root"] },
            { id: "tip", timestamp: 5, parents: ["br1"] }
        ],
        cheapestToTip: [
            ["root", "br1", "tip"]
        ],
        costliestToTip: [
            ["root", "br1", "tip"]
        ],
        costliestPossible: [
            ["root", "br1", "tip"]
        ]
    },
    forkAtRootShorterBranch: {
        nodes: [
            { id: "root", timestamp: 0, parents: [] },
            { id: "br1n1", timestamp: 1, parents: ["root"] },
            { id: "br1n2", timestamp: 5, parents: ["br1n1"] },
            { id: "tip", timestamp: 2, parents: ["root"] }
        ],
        cheapestToTip: [
            ["root", "tip"]
        ],
        costliestToTip: [
            ["root", "tip"]
        ],
        costliestPossible: [
            ["root", "br1n1", "br1n2"]
        ]
    },
    forkAtFirstLeafLongerBranch: {
        nodes: [
            { id: "root", timestamp: 0, parents: [] },
            { id: "node1", timestamp: 1, parents: ["root"] },
            { id: "br1", timestamp: 2, parents: ["node1"] },
            { id: "br2", timestamp: 3, parents: ["node1"] },
            { id: "tip", timestamp: 4, parents: ["br1"] }
        ],
        cheapestToTip: [
            ["root", "node1", "br1", "tip"]
        ],
        costliestToTip: [
            ["root", "node1", "br1", "tip"]
        ],
        costliestPossible: [
            ["root", "node1", "br1", "tip"]
        ]
    },
    forkAndMergeLongerBranch: {
        nodes: [
            { id: "root", timestamp: 0, parents: [] },
            { id: "br1n1", timestamp: 1, parents: ["root"] },
            { id: "br1n2", timestamp: 3, parents: ["br1n1"] },
            { id: "br2", timestamp: 2, parents: ["root"] },
            { id: "tip", timestamp: 4, parents: ["br1n2", "br2"] }
        ],
        cheapestToTip: [
            ["root", "br2", "tip"]
        ],
        costliestToTip: [
            ["root", "br1n1", "br1n2", "tip"]
        ],
        costliestPossible: [
            ["root", "br1n1", "br1n2", "tip"]
        ]
    },
    forkAndMerge2: {
        nodes: [
            { id: "root", timestamp: 0, parents: [] },
            { id: "m1", timestamp: 1, parents: ["root"] },
            { id: "m2", timestamp: 3, parents: ["m1"] },
            { id: "m3", timestamp: 2, parents: ["m2"] },
            { id: "m4", timestamp: 3, parents: ["m3"] },
            { id: "m5", timestamp: 2, parents: ["m4"] },
            { id: "tip", timestamp: 4, parents: ["m5", "b2"] },
            { id: "b1", timestamp: 4, parents: ["m2"] },
            { id: "b2", timestamp: 4, parents: ["b1"] }
        ],
        cheapestToTip: [
            ["root", "m1", "m2", "b1", "b2", "tip"]
        ],
        costliestToTip: [
            ["root", "m1", "m2", "m3", "m4", "m5", "tip"]
        ],
        costliestPossible: [
            ["root", "m1", "m2", "m3", "m4", "m5", "tip"]
        ]
    },
    twoRoots: {
        nodes: [
            { id: "root", timestamp: 0, parents: [] },
            { id: "root2", timestamp: 2, parents: [] },
            { id: "tip", timestamp: 4, parents: ["root", "root2"] }
        ],
        cheapestToTip: [
            ["root", "tip"],
            ["root2", "tip"]
        ],
        costliestToTip: [
            ["root", "tip"],
            ["root2", "tip"]
        ],
        costliestPossible: [
            ["root", "tip"],
            ["root2", "tip"]
        ]
    },
    twoRootsLongerBranch: {
        nodes: [
            { id: "root", timestamp: 0, parents: [] },
            { id: "node1", timestamp: 2, parents: ["root"] },
            { id: "root2", timestamp: 4, parents: [] },
            { id: "tip", timestamp: 8, parents: ["node1", "root2"] }
        ],
        cheapestToTip: [
            ["root2", "tip"]
        ],
        costliestToTip: [
            ["root", "node1", "tip"]
        ],
        costliestPossible: [
            ["root", "node1", "tip"]
        ]
    },
    overlappingBranches: {
        nodes: [
            { id: "root", timestamp: 0, parents: [] },
            { id: "m1", timestamp: 0, parents: ["root"] },
            { id: "m2", timestamp: 0, parents: ["m1"] },
            { id: "m3", timestamp: 0, parents: ["m2"] },
            { id: "m4", timestamp: 0, parents: ["m3"] },
            { id: "m5", timestamp: 0, parents: ["m4", "b2"] },
            { id: "m6", timestamp: 0, parents: ["m5", "c2"] },
            { id: "tip", timestamp: 0, parents: ["m6"] },
            { id: "b1", timestamp: 0, parents: ["m1"] },
            { id: "b2", timestamp: 0, parents: ["b1"] },
            { id: "c1", timestamp: 0, parents: ["m2"] },
            { id: "c2", timestamp: 0, parents: ["c1"] },
        ],
        cheapestToTip: [
            ["root", "m1", "m2", "c1", "c2", "m6", "tip"],
            ["root", "m1", "b1", "b2", "m5", "m6", "tip"],
        ],
        costliestToTip: [
            ["root", "m1", "m2", "m3", "m4", "m5", "m6", "tip"]
        ],
        costliestPossible: [
            ["root", "m1", "m2", "m3", "m4", "m5", "m6", "tip"]
        ]
    },
    notOverlappingBranches: {
        nodes: [
            { id: "root", timestamp: 0, parents: [] },
            { id: "m1", timestamp: 0, parents: ["root"] },
            { id: "m2", timestamp: 0, parents: ["m1"] },
            { id: "m3", timestamp: 0, parents: ["m2"] },
            { id: "m4", timestamp: 0, parents: ["b1"] },
            { id: "m5", timestamp: 0, parents: ["m4"] },
            { id: "m6", timestamp: 0, parents: ["m5", "c2"] },
            { id: "tip", timestamp: 0, parents: ["m6"] },
            { id: "b1", timestamp: 0, parents: ["root"] },
            { id: "c1", timestamp: 0, parents: ["m4"] },
            { id: "c2", timestamp: 0, parents: ["c1", "m3"] },
        ],
        cheapestToTip: [
            ["root", "b1", "m4", "m5", "m6", "tip"]
        ],
        costliestToTip: [
            ["root", "b1", "m4", "c1", "c2", "m6", "tip"]
        ],
        costliestPossible: [
            ["root", "b1", "m4", "c1", "c2", "m6", "tip"]
        ]
    },
    parallelBranches: {
        nodes: [
            { id: "root", timestamp: 0, parents: [] },
            { id: "m1", timestamp: 0, parents: ["root"] },
            { id: "m2", timestamp: 0, parents: ["m1"] },
            { id: "m3", timestamp: 0, parents: ["m2", "b3"] },
            { id: "m4", timestamp: 0, parents: ["m3", "a3"] },
            { id: "m5", timestamp: 0, parents: ["m4"] },
            { id: "m6", timestamp: 0, parents: ["m5"] },
            { id: "m7", timestamp: 0, parents: ["m6"] },
            { id: "a1", timestamp: 0, parents: ["m1"] },
            { id: "a3", timestamp: 0, parents: ["a1"] },
            { id: "a4", timestamp: 0, parents: ["m3"] },
            { id: "tip", timestamp: 0, parents: ["a4"] },
            { id: "b1", timestamp: 0, parents: ["root"] },
            { id: "b2", timestamp: 0, parents: ["b1"] },
            { id: "b3", timestamp: 0, parents: ["b2"] },
            { id: "b4", timestamp: 0, parents: ["m2"] },
            { id: "b5", timestamp: 0, parents: ["b4"] },
        ],
        cheapestToTip: [
            ["root", "m1", "m2", "m3", "a4", "tip"]
        ],
        costliestToTip: [
            ["root", "b1", "b2", "b3", "m3", "a4", "tip"]
        ],
        costliestPossible: [
            ["root", "b1", "b2", "b3", "m3", "m4", "m5", "m6", "m7"]
        ]
    },
    backAndForth: {
        nodes: [
            { id: "root", timestamp: 0, parents: [] },
            { id: "m1", timestamp: 0, parents: ["root"] },
            { id: "m2", timestamp: 0, parents: ["m1"] },
            { id: "m2a", timestamp: 0, parents: ["m2"] },
            { id: "m3", timestamp: 0, parents: ["a1", "m2a"] },
            { id: "m4", timestamp: 0, parents: ["m3"] },
            { id: "m5", timestamp: 0, parents: ["m4"] },
            { id: "m6", timestamp: 0, parents: ["m5"] },
            { id: "tip", timestamp: 0, parents: ["a2", "m6"] },
            { id: "a0", timestamp: 0, parents: ["root"] },
            { id: "a1", timestamp: 0, parents: ["m1", "a0"] },
            { id: "a2", timestamp: 0, parents: ["a1"] },
        ],
        cheapestToTip: [
            ["root", "a0", "a1", "a2", "tip"],
            ["root", "m1", "a1", "a2", "tip"],
        ],
        costliestToTip: [
            ["root", "m1", "m2", "m2a", "m3", "m4", "m5", "m6", "tip"]
        ],
        costliestPossible: [
            ["root", "m1", "m2", "m2a", "m3", "m4", "m5", "m6", "tip"]
        ]
    }
}
