function pluck(name) {
    var v, params = Array.prototype.slice.call(arguments, 1);
    return function(o) {
        return (typeof(v = o[name]) === 'function' ? v.apply(o, params) : v);
    };
}

function identity(d) {
    return d;
}

function adaptGraphToD3Format(rawGraph, canvas, padding, origin, mainDirectrix, config) {
    function createXScaler(nodes, svgWidth, horizontalPadding) {
        var x_min = d3.min(nodes, function(d) {
            return d.x;
        });
        var x_max = d3.max(nodes, function(d) {
            return d.x;
        });
        return d3.scale.linear()
            .domain([x_min, x_max])
            .range([horizontalPadding, svgWidth - horizontalPadding]);
    }

    function createYScaler(nodes, svgHeight, verticalPadding) {
        var y_min = d3.min(nodes, function(d) {
            return d.y;
        });
        var y_max = d3.max(nodes, function(d) {
            return d.y;
        });

        return d3.scale.linear()
            .domain([y_min, y_max])
            .range([svgHeight - verticalPadding, verticalPadding]);
    }

    var coordinatesForNodes = new CoordinatesCalculator(config).positionNodes(rawGraph.nodes);
    var coordsById = d3.map();


    coordinatesForNodes.forEach(function(coordinates) {
        coordsById.set(coordinates.id, coordinates);
    });

    var xScaler = createXScaler(coordinatesForNodes, canvas.width, padding.horizontal);
    var yScaler = createYScaler(coordinatesForNodes, canvas.height, padding.vertical);

    var adaptedNodes = rawGraph.nodes.map(function(node) {
        return {
            "id": node.id,
            "fixed": true,
            "x": xScaler(coordsById.get(node.id).x),
            "y": yScaler(coordsById.get(node.id).y)
        }
    });
    var adaptedNodeById = d3.map();
    adaptedNodes.forEach(function(node) {
        adaptedNodeById.set(node.id, node);
    });

    return {
        nodes: adaptedNodes,
        links: [].concat.apply([], rawGraph.nodes.map(function(node) {
            return node.parents.map(function(parentId) {
                return { "source": adaptedNodeById.get(node.id), "target": adaptedNodeById.get(parentId) }
            })
        }))
    }

}

function drawDemoGraph(divId, graphName, demoGraph, config) {

    var canvas = {
        width: 400,
        height: 200
    }
    var graphPadding = {
        horizontal: canvas.width * .08,
        vertical: canvas.height * .25
    }

    var graph = adaptGraphToD3Format(demoGraph, canvas, graphPadding, undefined, undefined, config);
    var color = d3.scale.category20();

    var force = d3.layout.force()
        .charge(0)
        .linkDistance(0)
        .size([canvas.width, canvas.height])
        .nodes(graph.nodes)
        .links(graph.links)
        //.start(); //no need to start the simulation, as all points are fixed

    //create a wrapper div to hold svg and buttons together
    var containerDiv = d3
        .select("#" + divId)
        .append("div")
        .attr("class", "svgContainer");

    var zoomBehavior = d3.behavior.zoom()
        .on("zoom", function() {

            var t = d3.transform(zoomableCanvas.attr("transform"));
            t.translate = d3.event.translate;
            t.scale = d3.event.scale;
            // We only want to transition on wheel event, without interfering with mouse drag panning
            var isWheel = d3.event.sourceEvent.type === "wheel";
            var toTransform = isWheel ? zoomableCanvas.transition() : zoomableCanvas;

            toTransform.attr("transform", t.toString());
        });

    //reset button
    containerDiv.append("button")
        .attr("class", "reset")
        .on("click", function() {
            zoomBehavior.scale(1);
            zoomBehavior.translate([0, 0]);
            zoomableCanvas.transition().attr('transform', 'translate(' + zoomBehavior.translate() + ') scale(' + zoomBehavior.scale() + ')')
        });

    //main svg
    var svg = containerDiv
        .append("svg")
        .attr("width", canvas.width)
        .attr("height", canvas.height)
        .append("g")
        .call(zoomBehavior)
        .on("dblclick.zoom", null);

    //just some grey background
    var rect = svg.append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", canvas.width)
        .attr("height", canvas.height)
        .attr("fill", "#EEE")
        .style("pointer-events", "all");

    //graph title (needs to be positioned after the grey box to be over it)
    svg.append("g")
        .selectAll(".title")
        .data([graphName])
        .enter()
        .append("text")
        .attr("class", "nodeLabel")
        .attr("x", canvas.width / 2)
        .attr("y", "0")
        .attr("dy", "1.25em")
        .attr("text-anchor", "middle")
        .text(identity);

    //the main svg:g element, used to zoom/pan
    var zoomableCanvas = svg.append("g")
        .attr("x", 5)
        .attr("y", 5)
        .attr("width", canvas.width - 5)
        .attr("height", canvas.height - 5);

    var nodeRadius = 8;

    //draw actual svg elements
    var nodes = zoomableCanvas.selectAll(".node")
        .data(graph.nodes)
        .enter().append("circle")
        .attr("class", "node")
        .attr("r", nodeRadius)
        .attr("cx", pluck("x"))
        .attr("cy", pluck("y"))
        .style("fill", function(d) {
            return color(d.group);
        })
        .on("dblclick.zoom", function(d) {
           d3.event.stopPropagation(); // possibly redundant, as we removed it from the main svg
            var dcx = (canvas.width / 2 - d.x * zoomBehavior.scale());
            var dcy = (canvas.height / 2 - d.y * zoomBehavior.scale());
            zoomableCanvas.transition().attr("transform", "translate(" + [dcx, dcy] + ")scale(" + zoomBehavior.scale() + ")");
        });

    var nodeLabels = zoomableCanvas.append("g")
        .selectAll(".nodeLabel")
        .data(graph.nodes)
        .enter()
        .append("text")
        .attr("class", "nodeLabel")
        .attr("x", pluck("x"))
        .attr("y", function(d) {
            return d.y + nodeRadius;
        })
        .attr("dy", ".75em")
        .attr("text-anchor", "middle")
        .text(pluck("id"));

    var links = zoomableCanvas.selectAll(".link")
        .data(graph.links)
        .enter().append("path")
        .attr("class", "link")
        .attr("marker-end", "url(#arrow)")
        .attr("d", function(d) {
            var path = "";
            // move to starting node's center
            path += "M " + (d.source.x - nodeRadius) + " " + d.source.y + " ";
            // cubic Bezier curve control points. magic number here
            path += "C " + (d.source.x - 30) + " " + d.source.y + " ";
            path += ", " + (d.target.x + 30) + " " + d.target.y + " ";
            // final destination (just right of the destination node)
            path += ", " + (d.target.x + nodeRadius) + " " + d.target.y + " ";
            return path;
        });

    //line ending (arrow symbol)
    zoomableCanvas.append("defs").selectAll("marker")
        .data(["arrow"])
        .enter().append("marker")
        .attr("id", identity)
        .attr("viewBox", "0 0 10 10")
        .attr("refX", nodeRadius)
        .attr("refY", 5)
        .attr("markerUnits", "strokeWidth")
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M 0 0 L 10 5 L 0 10 z");

    //no need to start the simulation, as all points are fixed
    /*    force.on("tick", function() {

        });
    */


}

function drawDemoGraphs(graphs, divId, config) {
    Object.keys(graphs).forEach(function(graphName) {
        var demoGraph = graphs[graphName];
        drawDemoGraph(divId, graphName, demoGraph, config);
    });
}



drawDemoGraphs(demoGraphs, "default");

drawDemoGraphs(demoGraphs, "horizontalIncrement", {
    alongDirectrixStep:10,
    betweenDirectrixesStep:10,
    directrixSelectionStrategy: directrixSelectionStrategies.incremental,
    forwardNodeDistributionStrategy: distributionStrategies.horizontalStartingFrom,
    backwardsNodeDistributionStrategy: distributionStrategies.horizontalEndingAt
});

drawDemoGraphs(demoGraphs, "horizontalFlipFlop", {
    alongDirectrixStep:10,
    betweenDirectrixesStep:10,
    directrixSelectionStrategy: directrixSelectionStrategies.flipFlop,
    forwardNodeDistributionStrategy: distributionStrategies.horizontalStartingFrom,
    backwardsNodeDistributionStrategy: distributionStrategies.horizontalEndingAt
});
