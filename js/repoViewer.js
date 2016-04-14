function RepoViewer(config) {
    this.currentState = {
        commits: [],
        branches: [],
        stash: [],
        tags:  [],
        head: { branchId: "master" }
    }

    this.commitRadius = config && config.commitRadius || 20;
    this.spacingX = config && config.spacingX || 100 * 1.5;
    this.spacingY = config && config.spacingY || -100 * 1.5;

    this.offsetX = 0;
}

RepoViewer.prototype = {
    render: function(container) {

        this.canvas = {
            width: parseInt(container.style('width'), 10),
            height: parseInt(container.style('height'), 10)
        }

        //create a wrapper div to hold svg and buttons together
        var containerDiv = container
            .append("div")
            .attr("class", "svg-container");
        var me = this;

        this.zoomBehavior = d3.behavior.zoom()
            .on("zoom", function() {
                var t = d3.transform(me.zoomableCanvas.attr("transform"));
                t.translate = d3.event.translate;
                t.scale = d3.event.scale;
                // We only want to transition on wheel event, without interfering with mouse drag panning
                var isWheel = d3.event.sourceEvent && d3.event.sourceEvent.type === "wheel";
                var toTransform = isWheel ? me.zoomableCanvas.transition() : me.zoomableCanvas;

                toTransform.attr("transform", t.toString());
            });
        //main svg
        var svg = containerDiv
            .append("svg")
            .attr("width", me.canvas.width)
            .attr("height", me.canvas.height)
            .append("g")
            .call(me.zoomBehavior)
            .on("dblclick.zoom", null)

        //just some grey background
        var rect = svg.append("rect")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", me.canvas.width)
            .attr("height", me.canvas.height)
            .attr("fill", "#EEE")
            .style("pointer-events", "all");

        //reset button
        containerDiv.append("button")
            .attr("class", "reset")
            .on("click", function() {
                me.zoomBehavior.scale(1);
                me.zoomBehavior.translate([0, 0]);
                me.zoomableCanvas.transition().attr('transform', 'translate(' + me.zoomBehavior.translate() + ') scale(' + me.zoomBehavior.scale() + ')')
            });
        //the main svg:g element, used to zoom/pan
        this.zoomableCanvas = svg.append("g")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", me.canvas.width)
            .attr("height", me.canvas.height);

        this.commitsG = this.zoomableCanvas.append("g");
        this.linksG = this.zoomableCanvas.append("g");
        this.renderItems();
    },
    update: function(history) {
        this.currentState = history;
        this.renderItems();
    },
    renderItems: function() {
        var me = this;
        var color = d3.scale.category20();

        var startingPoint = {
            x: 2 * me.commitRadius * me.zoomBehavior.scale(),
            y: me.canvas.height / 2
        };
        var positionedData = calculateCoordinates(this.currentState.commits, startingPoint, me.canvas.height / 2, {
            alongDirectrixStep: me.spacingX,
            betweenDirectrixesStep: me.spacingY,
            directrixSelectionStrategy: directrixSelectionStrategies.flipFlop,
            forwardNodeDistributionStrategy: distributionStrategies.horizontalStartingFrom,
            backwardsNodeDistributionStrategy: distributionStrategies.horizontalEndingAt
        });
        var positionedById = d3.map();
        positionedData.forEach(function(node) {
            var index = 0;
            node.refs = me.currentState.branches
                .filter(function(ref) {
                    return ref.commitId === node.id
                }).map(function(ref) {
                    ref.type = "branch";
                    ref.position=index++;
                    return ref;
                });
            node.refs.concat(me.currentState.tags
                .filter(function(ref) {
                    return ref.commitId === node.id
                }).map(function(ref) {
                    ref.type = "tag";
                    ref.position=index++;
                    return ref;
                }));
            positionedById.set(node.id, node);
        });

        var commits = this.commitsG
            .selectAll("g.commit")
            .data(positionedData, pluck("id"))
            .classed('unreachable', function(c) {
                return c.originalNode.unreachable
            })

        commits
            .select("circle.commit")
            .transition()
            .duration(500)
            .attr("cx", pluck("x"))
            .attr("cy", pluck("y"));

        commits
            .select("text.commitId")
            .transition()
            .duration(500)
            .attr("x", pluck("x"))
            .attr("y", function(node) {
                return node.y - 1.5 * me.commitRadius
            });

        var newCommits = commits
            .enter()
            .append("g")
            .classed("commit", true)
            .classed('unreachable', function(c) {
                return c.originalNode.unreachable
            });

        newCommits
            .append("circle")
            .attr("class", "commit")
            .attr("r", this.commitRadius)
            .attr("cx", pluck("x"))
            .attr("cy", pluck("y"))
            .on("dblclick.zoom", function(d) {
                d3.event.stopPropagation(); // possibly redundant, as we removed it from the main svg
                var dcx = (me.canvas.width / 2 - d.x * me.zoomBehavior.scale());
                var dcy = (me.canvas.height / 2 - d.y * me.zoomBehavior.scale());
                me.zoomableCanvas.transition().attr("transform", "translate(" + [dcx, dcy] + ")scale(" + me.zoomBehavior.scale() + ")");
            })
            .transition("inflate")
            .duration(500)

        newCommits
            .append("text")
            .attr("class", "commitId")
            .attr("x", pluck("x"))
            .attr("y", function(node) {
                return node.y - 1.5 * me.commitRadius
            })
            .text(function(node) {
                return node.id.substr(0, 6)
            })
            .transition("inflate")
            .duration(500)

        commits.exit().remove();

        var refs =
            commits.selectAll('g.ref')
            .data(function(node) {
                return node.refs.map(function(ref) {
                    ref.node = node;
                    return ref;
                });
            }, pluck("id"))
            .attr("class", pluck("type"))
            .classed("ref", true);

        refs
            .select("text")
            .attr("x", function(ref) {
                return ref.node.x
            })
            .attr("y", function(ref, i) {
                return ref.node.y + 2 * me.commitRadius + me.commitRadius * ref.position
            })
            .text(pluck("id"));

        var newRefs = refs
            .enter()
            .append("g")
            .attr("class", pluck("type"))
            .classed("ref", true);

        newRefs.append("text")
            .attr("x", function(ref) {
                return ref.node.x
            })
            .attr("y", function(ref) {
                return ref.node.y + 2 * me.commitRadius + me.commitRadius * ref.position
            })
            .text(pluck("id"));

        refs
            .exit()
            .remove();


        var links =
            commits.selectAll('path.link')
            .data(function(node) {
                return node.originalNode.parents.map(function(parentId) {
                    return { source: node, target: positionedById.get(parentId) };
                });
            });

        links.attr("class", "link")
            .attr("marker-end", "url(#arrow)")
            .attr("d", function(d) {
                var path = "";
                // move to starting node's center
                path += "M " + (d.source.x - me.commitRadius) + " " + d.source.y + " ";
                // cubic Bezier curve control points. 
                var controlPointOffset = Math.abs(d.source.x - d.target.x) / 2;
                path += "C " + (d.source.x - controlPointOffset) + " " + d.source.y + " ";
                path += ", " + (d.target.x + controlPointOffset) + " " + d.target.y + " ";
                // final destination (just right of the destination node)
                path += ", " + (d.target.x + me.commitRadius) + " " + d.target.y + " ";
                return path;
            });

        links
            .enter()
            .append("path")
            .attr("class", "link")
            .attr("marker-end", "url(#arrow)")
            .attr("d", function(d) {
                var path = "";
                // move to starting node's center
                path += "M " + (d.source.x - me.commitRadius) + " " + d.source.y + " ";
                // cubic Bezier curve control points. 
                var controlPointOffset = Math.abs(d.source.x - d.target.x) / 2;
                path += "C " + (d.source.x - controlPointOffset) + " " + d.source.y + " ";
                path += ", " + (d.target.x + controlPointOffset) + " " + d.target.y + " ";
                // final destination (just right of the destination node)
                path += ", " + (d.target.x + me.commitRadius) + " " + d.target.y + " ";
                return path;
            });

        links.exit().remove();

        //line ending (arrow symbol)
        this.zoomableCanvas.append("defs").selectAll("marker")
            .data(["arrow"])
            .enter().append("marker")
            .attr("id", identity)
            .attr("viewBox", "0 0 10 10")
            .attr("refX", me.commitRadius / 2)
            .attr("refY", 5)
            .attr("markerUnits", "strokeWidth")
            .attr("markerWidth", 6)
            .attr("markerHeight", 6)
            .attr("orient", "auto")
            .append("path")
            .attr("d", "M 0 0 L 10 5 L 0 10 z");
    }
}
