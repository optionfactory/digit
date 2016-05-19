function RepoViewer(config) {
    this.currentState = {
        commits: [],
        branches: [],
        stash: [],
        tags:  [],
        head: {
            branchId: "master"
        }
    }
    this.coordsById = d3.map();

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
            .attr("viewBox", function() {
                return "0 0 " + me.canvas.width + " " + me.canvas.height })
            .append("g")
            .call(me.zoomBehavior)
            .on("dblclick.zoom", null)

        //just some grey background
        var rect = svg.append("rect")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", me.canvas.width)
            .attr("height", me.canvas.height)
            .classed("background", true)
            .style("pointer-events", "all");

        //reset button
        containerDiv.append("button")
            .attr("class", "reset")
            .on("click", function() {
                me.zoomBehavior.scale(1);
                me.zoomBehavior.translate([0, 0]);
                me.zoomableCanvas.transition().attr('transform', 'translate(' + me.zoomBehavior.translate() + ') scale(' + me.zoomBehavior.scale() + ')')
            });
        containerDiv.append("button")
            .attr("class", "gotoHead")
            .on("click", me._positionOnHEAD.bind(me));
        //the main svg:g element, used to zoom/pan
        this.zoomableCanvas = svg.append("g")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", me.canvas.width)
            .attr("height", me.canvas.height);

        this.commitsG = this.zoomableCanvas.append("g");
        this._renderItems();
    },
    update: function(history, isFirstUpdate) {
        this.currentState = history;
        this._renderItems();
        if(isFirstUpdate){
            this._positionOnHEAD();
        }

    },
    _positionOnHEAD: function() {
        var me = this;
        var headCoords = me.coordsById.get("HEAD");
        var dcx = (me.canvas.width / 2 - headCoords.x * me.zoomBehavior.scale());
        var dcy = (me.canvas.height / 2 - headCoords.y * me.zoomBehavior.scale());
        me.zoomBehavior.translate([dcx, dcy]);
        me.zoomableCanvas.transition().attr('transform', 'translate(' + me.zoomBehavior.translate() + ') scale(' + me.zoomBehavior.scale() + ')')
    },
    _renderItems: function() {
        var me = this;
        var color = d3.scale.category20();

        var tooltip = d3.select("div.tooltip");

        var startingPoint = {
            x: 2 * me.commitRadius * me.zoomBehavior.scale(),
            y: me.canvas.height / 2
        };
        var positionedData = new CoordinatesCalculator({
            alongDirectrixStep: me.spacingX,
            betweenDirectrixesStep: me.spacingY,
            startingPoint: startingPoint,
            mainDirectrix: me.canvas.height / 2
        }).positionNodes(this.currentState.commits);

        this.coordsById = d3.map();
        var positionedById = d3.map();
        positionedData.forEach(function(node) {
            var index = 0;
            node.refs = me.currentState.branches
                .filter(function(ref) {
                    return ref.commitId === node.id
                }).map(function(ref) {
                    ref.type = "branch";
                    ref.position = index++;
                    return ref;
                });
            node.refs = node.refs.concat(me.currentState.tags
                .filter(function(ref) {
                    return ref.commitId === node.id
                }).map(function(ref) {
                    ref.type = "tag";
                    ref.position = index++;
                    return ref;
                }));
            positionedById.set(node.id, node);
            me.coordsById.set(node.id, { x: node.x, y: node.y });
        });

        var commits = this.commitsG
            .selectAll("g.commit")
            .data(positionedData, pluck("id"))
            .classed('unreachable', function(c) {
                return c.originalNode.unreachable
            })

        //each (new) commit has its own g
        var newCommits = commits
            .enter()
            .append("g")
            .classed("commit", true)
            .classed('unreachable', function(c) {
                return c.originalNode.unreachable
            });

        newCommits.append("circle")
            .attr("class", "commit")
            .on("dblclick.zoom", function(d) {
                d3.event.stopPropagation(); // possibly redundant, as we removed it from the main svg
                //me.zoomBehavior.scale(1);
                var dcx = (me.canvas.width / 2 - d.x * me.zoomBehavior.scale());
                var dcy = (me.canvas.height / 2 - d.y * me.zoomBehavior.scale());
                me.zoomBehavior.translate([dcx, dcy]);
                me.zoomableCanvas.transition().attr('transform', 'translate(' + me.zoomBehavior.translate() + ') scale(' + me.zoomBehavior.scale() + ')')
            })
            .on("mouseover", function(commit) {
                var cm = commit.originalNode
                d3.select("#tooltip_commit_id").text(cm.id)
                d3.select("#tooltip_author_name").text(cm.author_name)
                d3.select("#tooltip_author_email").text(cm.author_email)
                d3.select("#tooltip_author_date").text(cm.author_date)
                d3.select("#tooltip_committer_name").text(cm.committer_name)
                d3.select("#tooltip_committer_email").text(cm.committer_email)
                d3.select("#tooltip_committer_date").text(cm.committer_date)
                d3.select("#tooltip_message").text(cm.message)
                d3.select("#tooltip_parents").text(cm.parents.map(function(p) {
                    return p.substr(0, 6) }).toString())


                tooltip.style("opacity", "1");
            })
            .on("mousemove", function(commit) {
                tooltip
                    .style("left", Math.max(0, d3.event.pageX - 150) + "px")
                    .style("top", (d3.event.pageY + 20) + "px");
            })
            .on("mouseout", function() {
                return tooltip.style("opacity", "0");
            })
            .attr("r", this.commitRadius)
            .transition("inflate")
            .duration(500)

        var copyTextContent = function(t) {
            var range = document.createRange();
            range.selectNodeContents(this);
            window.getSelection().addRange(range);
            try {
                document.execCommand('copy');
            } catch (err) {
                console.log('copy fail.');
            }
            window.getSelection().empty();
        };

        newCommits
            .append("text")
            .attr("class", "commitId")
            .on("dblclick", copyTextContent)
            .text(function(node) {
                return node.id.substr(0, 6)
            })
            .append("title")
            .text(function(node) {
                return node.id;
            })

        newCommits
            .append("text")
            .attr("class", "commitMessage")
            .text(function(node) {
                return node.originalNode.message.length > 12 ?
                    node.originalNode.message.substr(0, 12) + "..." : node.originalNode.message;
            })
            .append("title")
            .text(function(node) {
                return node.originalNode.message;
            })
            .transition("inflate")
            .duration(500)

        commits
            .select("circle.commit")
            .attr("cx", pluck("x"))
            .attr("cy", pluck("y"))

        commits
            .select("text.commitId")
            .attr("x", pluck("x"))
            .attr("y", function(node) {
                return node.y - 2.5 * me.commitRadius
            })

        var commitBBoxById = d3.map();
        commits
            .selectAll("text.commitId")
            .forEach(function(commitTexts) {
                var bbox = commitTexts[0].getBBox();
                var fullCommitId = commitTexts[0].childNodes[1].textContent;
                commitBBoxById.set(fullCommitId, bbox);
            })

        commits
            .select("text.commitMessage")
            .attr("x", pluck("x"))
            .attr("y", function(node) {
                return node.y - 1.5 * me.commitRadius
            })

        commits.exit().remove();

        var links =
            commits.selectAll('path.link')
            .data(function(node) {
                return node.originalNode.parents.map(function(parentId) {
                    return {
                        source: node,
                        target: positionedById.get(parentId)
                    };
                });
            });

        links
            .enter()
            .append("path")
            .attr("class", "link")
            .attr("marker-end", "url(#arrow)")

        links
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


        var refs =
            commits
            .selectAll('g.ref')
            .data(function(node) {
                return node.refs.map(function(ref) {
                    ref.node = node;
                    return ref;
                });
            }, pluck("id"))
            .attr("class", pluck("type"))
            .classed("ref", true);

        var newRefs = refs
            .enter()
            .append("g")
            .attr("class", pluck("type"))
            .classed("ref", true);

        newRefs.append("rect");

        newRefs.append("text")
            .attr("class", "refText")
            .text(pluck("id"))
            .on("dblclick", copyTextContent)

        refs
            .select("text")
            .attr("x", function(ref) {
                return ref.node.x;
            })
            .attr("y", function(ref) {
                var refY = ref.node.y + 2 * me.commitRadius + me.commitRadius * 1.4 * ref.position;
                me.coordsById.set(ref.id, { x: ref.node.x, y: refY });
                return refY;
            });

        var refsBBoxById = d3.map();
        refs
            .selectAll("text")
            .forEach(function(refTexts) {
                var bbox = refTexts[0].getBBox();
                refsBBoxById.set(refTexts[0].textContent, bbox);
                d3.select(refTexts[0].parentNode)
                    .select("rect")
                    .attr("x", bbox.x - 2)
                    .attr("y", bbox.y - 2)
                    .attr("width", bbox.width + 4)
                    .attr("height", bbox.height + 4)
            })

        refs.exit().remove();

        var headG = this
            .zoomableCanvas
            .selectAll("g.head")
            .data([this.currentState.head]);

        var newHead = headG
            .enter()
            .append("g")
            .classed("head", true)
            .classed("ref", true)

        newHead.append("rect")

        newHead.append("text")
            .attr("class", "refText")
            .text("HEAD")
            .on("dblclick", copyTextContent)

        var head = this.currentState.head;
        headG
            .select("text")
            .attr("x", function(h) {
                if (head.branchId && refsBBoxById.has(head.branchId)) {
                    me.coordsById.set("HEAD", me.coordsById.get(head.branchId));
                    var refbb = refsBBoxById.get(head.branchId);
                    return refbb.x + refbb.width + 10;
                }
                if (head.commitId && commitBBoxById.has(head.commitId)) {
                    me.coordsById.set("HEAD", me.coordsById.get(head.commitId));
                    var commitBB = commitBBoxById.get(head.commitId);
                    return commitBB.x + commitBB.width + 10;
                }
                return 0;
            })
            .attr("y", function(h) {
                if (head.branchId && refsBBoxById.has(head.branchId)) {
                    var refbb = refsBBoxById.get(head.branchId);
                    return refbb.y + refbb.height - 4;
                }
                if (head.commitId && commitBBoxById.has(head.commitId)) {
                    var commitBB = commitBBoxById.get(head.commitId);
                    return commitBB.y + commitBB.height - 4;
                }
                return 0;
            })

        var headText = headG.select("text");
        headG
            .select("rect")
            .attr("x", headText.node().getBBox().x - 2)
            .attr("y", headText.node().getBBox().y - 2)
            .attr("width", headText.node().getBBox().width + 4)
            .attr("height", headText.node().getBBox().height + 4)

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
