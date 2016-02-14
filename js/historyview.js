define(['d3'], function () {
    
    var REG_MARKER_END = 'url(#triangle)',
        MERGE_MARKER_END = 'url(#brown-triangle)',
        FADED_MARKER_END = 'url(#faded-triangle)';

    /**
     * @class HistoryView
     * @constructor
     */
    function HistoryView(config) {
        this.name = config.name || 'UnnamedHistoryView';
        this.history = {
            commits: [],
            branches: [],
            tags: [],
            head: {branchId: "master"}
        }
        this.width = config.width || "100%";
        this.height = config.height || 400;
        this.baseLine = this.height * (config.baseLine || 0.6);

        this.commitRadius = config.commitRadius || 20;
        this.pointerMargin = this.commitRadius * 1.8;
        this.spacingX = config.spacingX || 100 * 1.5;
        this.spacingY = config.spacingY || -100 * 1.5;
        this.offsetX = 0;
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
            for (var i = 0; i < this.history.commits.length; i++) {
                var commit = this.history.commits[i];
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
            this.refBox = this.translator.append('svg:g').classed('refs', true);
            this.renderCommits();
        },
        update: function (history) {
            this.history = history;
            this.renderCommits();
        },

        _calculatePositionData: function () {
            var view = this;

            var layers = [];
            for (var i = 0; i < this.history.commits.length; i++) {
                var commit = this.history.commits[i];
                
                commit.x = 1 + Math.max.apply(Math, [view.offsetX].concat(commit.parents.map(function(parentId) { return view.getCommit(parentId).x})));
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
                    commit.y = slot;
                    slots.splice(slots.indexOf(slot), 1);
                }
            });
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
            this._calculatePositionData();
            var graphWidth = Math.max.apply(null, [0].concat(this.history.commits.map(function(c) {return c.x}))) * this.spacingX
            var scrollOffset = -1 * Math.max(0, graphWidth + this.spacingX- this.svg.node().width.baseVal.value);
            this.translator.attr('transform', 'translate('+ 0+ ', '+ this.baseLine + ') scale(1)');
            this._renderCircles();
            this._renderIdLabels();
            // this.offsetX++;
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
            var graphWidth = Math.max.apply(null, [0].concat(this.history.commits.map(function(c) {return c.x}))) * this.spacingX
            var scrollOffset = Math.max(0, graphWidth + this.spacingX- this.svg.node().parentNode.clientWidth);
            
            this.svg.attr("width", graphWidth + this.spacingX);
            console.log(scrollOffset);
            d3.select(this.svg.node().parentNode)
                .property("scrollLeft", scrollOffset);
            

            var idOf = function(e) {
                if (Array.isArray(e)) {
                    return view.name + "-" + e.map(function(el) {return el.id}).join("-");
                }
                return view.name + "-" + e.id;
            }

            var existingCommits = this.commitBox.selectAll('g.commit')
                .data(this.history.commits, idOf)
            
            existingCommits
                .select("circle.commit")
                .transition()
                .duration(500)
                .call(this.fixCirclePosition.bind(this))

            existingCommits.enter()
                .append("g")
                .classed("commit", true)
                .classed('unreachable', function(c) {return c.unreachable})
                .append('svg:circle')
                .attr('id', idOf)
                .classed('commit', true)
                .call(this.fixCirclePosition.bind(this))
                .attr('r', 1)
                .transition("inflate")
                .duration(500)
                .attr('r', this.commitRadius)

            var makePointPositionSetter = function(dstIdx, srcIdx) {
                return function(sel, pair) {
                    return sel
                        .attr('x'+dstIdx, function (pair) { return view.trim(view.scale(pair))[srcIdx].x})
                        .attr('y'+dstIdx, function (pair) {  return view.trim(view.scale(pair))[srcIdx].y})
                }
            }

            var existingPointers = 
                existingCommits.selectAll('line.commit-pointer')
                .data(function(c) { 
                    return c.parents.map(function(p) {return [c,view.getCommit(p)]})}, 
                    idOf)

            existingPointers
                .transition()
                .duration(500)
                .call(makePointPositionSetter(1,0))
                .call(makePointPositionSetter(2,1))
                
            var newPointers = 
                existingPointers.enter()
                .append('svg:line')
                .attr('id', idOf)
                .classed('commit-pointer', true)
                .call(makePointPositionSetter(1,0))
                .call(makePointPositionSetter(2,0))
                .attr('marker-end', REG_MARKER_END)
                .transition()
                .duration(500)
                .call(makePointPositionSetter(2,1))


            var refIndexByCommit = function(ref) {
                var refs = view.history.branches.concat(view.history.tags)
                var pos = 0;
                for (var i=0; i < refs.length; i++) {
                    var candidate = refs[i];
                    if (candidate.commitId === ref.commitId) {
                        if (candidate.id === ref.id) {
                            return pos;
                        }
                        pos++;
                    }
                }
                return pos;
            }

            var setRefPosition = function(sel) {
                return sel
                    .attr('x', function(r) { return view.getCommit(r.commitId).x * view.spacingX;})
                    .attr('y', function(r) { return view.getCommit(r.commitId).y * view.spacingY;})
            }

            var refs = this.refBox.selectAll('g.branch,g.tag')
                .data(view.history.branches.concat(view.history.tags), idOf)
            
            refs.selectAll("rect,text")
                .data(function(t) { return [t,t];})
                .transition()
                .duration(500)
                .call(setRefPosition)

            var newRefs = refs.enter()
                .append("svg:g")
                .classed("branch", function(ref) { return view.history.branches.includes(ref)})
                .classed("tag", function(ref) { return view.history.tags.includes(ref)})
                .attr('transform', function(t) { var i = refIndexByCommit(t); return "translate(0, " + (2+i*1.2) *view.commitRadius +")"})
                .attr('id', idOf)
                .style("opacity", 0)
            
            newRefs.transition()
                .delay(300)
                .duration(500)
                .style("opacity", 1)

            newRefs
                .append("svg:rect")
                .attr("width", 2.5*view.commitRadius)
                .attr("height", view.commitRadius)
                .call(setRefPosition)
            
            newRefs
                .append("svg:text")
                .attr("width", 2.5*view.commitRadius)
                .attr("height", view.commitRadius)
                .call(setRefPosition)
                .text(function(t) { return t.id} )

            var setHeadPosition = function(sel) {
                return sel
                    .attr('x', function(h) { 
                        if (h.branchId) {
                            var t = view.history.branches.find(function(t) { return t.id === h.branchId});
                            return view.getCommit(t.commitId).x * view.spacingX;
                        } else {
                            return view.getCommit(h.commitId).x * view.spacingX;
                        }
                    })
                    .attr('y', function(h) { 
                        if (h.branchId) {
                            var t = view.history.branches.find(function(t) { return t.id === h.branchId});
                            return view.getCommit(t.commitId).y * view.spacingY;
                        } else {
                            return view.getCommit(h.commitId).y * view.spacingY;
                        }
                    })
            }

            var setHeadTransform = function(sel) {
                return sel
                    .attr('transform', function(h) {
                        if (h.branchId) {
                            var branchIndex = refIndexByCommit(view.history.branches.find(function(t) { return t.id === h.branchId}))
                            return "translate(" + 3*view.commitRadius + ", " + (2+branchIndex *1.2 ) *view.commitRadius +")"
                        }
                        var index = refIndexByCommit(h);
                        return "translate(0, " + (2+ index *1.2 )*view.commitRadius +")"
                    })
            }

            var head = this.refBox.selectAll('g.head')
                .data([view.history.head].filter(
                    function(h) { 
                        if (h.commitId) { 
                            return view.getCommit(h.commitId);
                        }
                        return view.history.branches.find(function(b){ return b.id === h.branchId})
                    }))

            head
                .transition()
                .duration(500)
                .call(setHeadTransform)
            head
                .selectAll("rect, text")
                .data(function(d) { return [d,d];})
                .transition()
                .duration(500)
                .call(setHeadPosition)

            var newHead = head.enter()
                .append("svg:g")
                .classed("head", true)
                .attr('id', view.name + "-head")
                .call(setHeadTransform)
            
            newHead
                .append("svg:rect")
                .attr("width", 2.5*view.commitRadius)
                .attr("height", view.commitRadius)
                .call(setHeadPosition)

            newHead
                .append("svg:text")
                .call(setHeadPosition)
                .text("HEAD")

        },

        _renderIdLabels: function () {
            this._renderText('id-label', function (d) { return d.id.substr(0,6); }, 14);
            this._renderText('message-label', function (d) { return d.message; }, 24);
        },

        _renderText: function(className, getText, delta) {
            var view = this,
                existingTexts,
                newtexts;

            existingTexts = this.commitBox.selectAll('text.' + className)
                .data(this.history.commits, function (d) { return d.id; })
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
