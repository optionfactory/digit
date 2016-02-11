define(['d3'], function () {
    
    var REG_MARKER_END = 'url(#triangle)',
        MERGE_MARKER_END = 'url(#brown-triangle)',
        FADED_MARKER_END = 'url(#faded-triangle)';

    /**
     * @class HistoryView
     * @constructor
     */
    function HistoryView(config) {
        this.commitData = config.commitData;
        this.tags = config.tags || [];
        this.name = config.name || 'UnnamedHistoryView';
        this.branches = config.branches;
        this.head = config.head;

        this.width = config.width || "100%";
        this.height = config.height || 400;
        this.baseLine = this.height * (config.baseLine || 0.6);

        this.commitRadius = config.commitRadius || 20;
        this.pointerMargin = this.commitRadius * 1.3;
        this.spacingX = config.spacingX || 100;
        this.spacingY = config.spacingY || -150;
    }

    HistoryView.generateId = function () {
        return Math.floor((1 + Math.random()) * 0x10000000).toString(16).substring(1);
    };

    HistoryView.prototype = {
        fixCirclePosition: function (selection) {
            var view = this;
            selection
                .attr('cx', function (d) {
                    return d.x * view.spacingX;
                })
                .attr('cy', function (d) {
                    return d.y * view.spacingY;
                });
        },

        fixIdPosition: function (selection, delta) {
            var view = this;
            selection.attr('x', function (d) {
                return d.x * view.spacingX;
            }).attr('y', function (d) {
                return d.y * view.spacingY - view.commitRadius - delta;
            });
        },
 
        getCommit: function getCommit(ref) {
            for (var i = 0; i < this.commitData.length; i++) {
                var commit = this.commitData[i];
                if (commit.id === ref) {
                    return commit; 
                }
            }
        },

        render: function (container) {
            
            var svgContainer = container.append('div')
                .classed('svg-container', true);
                
            var svg = svgContainer.append('svg:svg');

            svg.attr('id', this.name)
                .attr('width', this.width)
                .attr('height', this.height);

            this.svgContainer = svgContainer;
            this.svg = svg;
            this.translator = svg.append('svg:g');
            this.arrowBox = this.translator.append('svg:g').classed('pointers', true);
            this.commitBox = this.translator.append('svg:g').classed('commits', true);
            this.tagBox = this.translator.append('svg:g').classed('tags', true);
            // TODO: branches? head?
            this.renderCommits();
            // this._setCurrentBranch(this.head);
        },

        _calculatePositionData: function () {
            var view = this;
            var layers = [];
            for (var i = 0; i < this.commitData.length; i++) {
                var commit = this.commitData[i];
                commit.x = 1 + Math.max.apply(Math, [0].concat(commit.parents.map(function(parentId) { return view.getCommit(parentId).x})));
                layers[commit.x] = layers[commit.x] || [];
                layers[commit.x].push(commit);
            }
            layers.forEach(function(layer) {
                var slots = layer.map(function(_,i) { return i});
                for (var i = 0; i < layer.length; i++) {
                    var commit = layer[i];
                    var parentSlots = commit.parents.map(function(parentId) { return view.getCommit(parentId).y}).sort().reverse();
                    var opts = parentSlots.filter(slots.includes.bind(slots)).concat(slots);
                    var slot = opts[0];
                    console.log(slot);
                    commit.y = slot;
                    slots.splice(slots.indexOf(slot), 1);
                }
            });
            console.log(this.commitData);
        },

        renderCommits: function () {
            if (typeof this.height === 'string' && this.height.indexOf('%') >= 0) {
                var perc = this.height.substring(0, this.height.length - 1) / 100.0;
                var baseLineCalcHeight = Math.round(this.svg.node().parentNode.offsetHeight * perc) - 65;
                var newBaseLine = Math.round(baseLineCalcHeight * (this.originalBaseLine || 0.6));
                if (newBaseLine !== this.baseLine) {
                    this.baseLine = newBaseLine;
                    this.svg.attr('height', baseLineCalcHeight);
                }
            }
            this.translator.attr('transform', 'translate(0, '+ this.baseLine + ') scale(1)');
            this._calculatePositionData();
            this._renderCircles();
            this._renderIdLabels();
        },

        trim: function(pair) {
            var view = this,
                delta1 = view.commitRadius,
                delta2 = view.pointerMargin;

            var p1 = pair[0],
                p2 = pair[1];
            var w = p1.x - p2.x,
                h = p1.y - p2.y,
                l = Math.sqrt(w*w + h*h);
            
            return [{
                x: p1.x - delta1 * w/l,
                y: p1.y - delta1 * h/l,
            }, {
                x: p2.x + delta2 * w/l,
                y: p2.y + delta2 * h/l,
            }]
        },

        scale: function (pair) {
            var view = this;
            return [{
                    x: pair[0].x * view.spacingX, 
                    y: pair[0].y * view.spacingY
                }, {
                    x: pair[1].x * view.spacingX, 
                    y: pair[1].y * view.spacingY
                }]; 
        },

        _renderCircles: function () {
            var view = this;

            var existingCommits = this.commitBox.selectAll('g.commit')
                .data(this.commitData, function (d) { return d.id; })
            
            existingCommits
                .select("circle.commit")
                .attr('id', function (d) {
                    return view.name + '-' + d.id;
                })
               

            existingCommits.enter()
                .append("g")
                .classed("commit", true)
                .append('svg:circle')
                .attr('id', function (d) {
                    return view.name + '-' + d.id;
                })
                .classed('commit', true)
                .call(this.fixCirclePosition.bind(this))
                .attr('r', 1)
                .transition("inflate")
                .duration(500)
                .attr('r', this.commitRadius)

            var existingPointers = 
                existingCommits.selectAll('line.commit-pointer')
                .data(function(c) { return c.parents.map(function(p) {return [c,view.getCommit(p)]})}, function (pair) { return pair[0].id+"-"+pair[1].id; })
                
            var newPointers = 
                existingPointers.enter()
                .append('svg:line')
                .attr('id', function (pair) {
                    return view.name + '-' + pair[0].id + '-to-' + pair[1].id;
                })
                .classed('commit-pointer', true)
                .attr('x1', function (pair) { return view.trim(view.scale(pair))[0].x})
                .attr('y1', function (pair) {  return view.trim(view.scale(pair))[0].y})
                .attr('x2', function (pair) { return view.trim(view.scale(pair))[0].x})
                .attr('y2', function (pair) {  return view.trim(view.scale(pair))[0].y})
                .attr('marker-end', REG_MARKER_END)
                .transition()
                .duration(500)
                .attr('x2', function (pair) { return view.trim(view.scale(pair))[1].x})
                .attr('y2', function (pair) {  return view.trim(view.scale(pair))[1].y})

            var tags = this.tagBox.selectAll('g.branch-tag')
                .data(this.tags, function (t) { return t.id; })  

            tags.select("rect")
                .transition()
                .duration(1000)
                .attr('x', function(t) { return view.getCommit(t.commitId).x * view.spacingX;})
                .attr('y', function(t) { return view.getCommit(t.commitId).y * view.spacingY;})
            
            var newTags = tags.enter()
                .append("svg:g")
                .classed("branch-tag", true)
                .attr('transform', "translate(0, " + 2*view.commitRadius +")")
                .attr('id', function (t) {
                    return view.name + '-' + t.id;
                })
                .style("opacity", 0)
            
            newTags.transition()
                .delay(1000)
                .duration(500)
                .style("opacity", 1)

            newTags
                .append("svg:rect")
                .attr("width", 2.5*view.commitRadius)
                .attr("height", view.commitRadius)
                .attr('x', function(t) { return view.getCommit(t.commitId).x * view.spacingX;})
                .attr('y', function(t) { return view.getCommit(t.commitId).y * view.spacingY;})
            
            newTags
                .append("svg:text")
                .attr("width", 2.5*view.commitRadius)
                .attr("height", view.commitRadius)
                .attr('x', function(t) { return view.getCommit(t.commitId).x * view.spacingX;})
                .attr('y', function(t) { return view.getCommit(t.commitId).y * view.spacingY;})
                .text(function(t) { return t.id} )
        },

        _renderIdLabels: function () {
            this._renderText('id-label', function (d) { return d.id; }, 14);
            this._renderText('message-label', function (d) { return d.message; }, 24);
        },

        _renderText: function(className, getText, delta) {
            var view = this,
                existingTexts,
                newtexts;

            existingTexts = this.commitBox.selectAll('text.' + className)
                .data(this.commitData, function (d) { return d.id; })
                .text(getText);

            existingTexts.transition().call(this.fixIdPosition.bind(this), delta);

            newtexts = existingTexts.enter()
                .insert('svg:text', ':first-child')
                .classed(className, true)
                .text(getText)
                .call(this.fixIdPosition.bind(this), delta);
        }
    };

    return HistoryView;
});
