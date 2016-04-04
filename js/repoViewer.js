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
            .attr("class", "svgContainer");
        var me = this;

        this.zoomBehavior = d3.behavior.zoom()
            .on("zoom", function() {
                var t = d3.transform(me.zoomableCanvas.attr("transform"));
                t.translate = d3.event.translate;
                t.scale = d3.event.scale;
                // We only want to transition on wheel event, without interfering with mouse drag panning
                var isWheel = d3.event.sourceEvent.type === "wheel";
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
            .on("dblclick.zoom", null);

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
        var commits = this.commitsG
            .selectAll("g")
            .data(positionedData, pluck("id"))

        commits.enter().append("circle")
            .attr("class", "node")
            .attr("r", this.commitRadius)
            .attr("cx", pluck("x"))
            .attr("cy", pluck("y"))
            .classed('unreachable', function(c) {
                return c.originalNode.unreachable })
            .style("fill", function(d) {
                return color(d.group);
            })
            .on("dblclick.zoom", function(d) {
                d3.event.stopPropagation(); // possibly redundant, as we removed it from the main svg
                var dcx = (me.canvas.width / 2 - d.x * me.zoomBehavior.scale());
                var dcy = (me.canvas.height / 2 - d.y * me.zoomBehavior.scale());
                me.zoomableCanvas.transition().attr("transform", "translate(" + [dcx, dcy] + ")scale(" + me.zoomBehavior.scale() + ")");
            });
    }
}
