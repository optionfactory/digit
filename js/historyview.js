define(['d3'], function () {
    
    var REG_MARKER_END = 'url(#triangle)',
        MERGE_MARKER_END = 'url(#brown-triangle)',
        FADED_MARKER_END = 'url(#faded-triangle)';

    /**
     * @class HistoryView
     * @constructor
     */

    function trim(pair, delta1, delta2) {
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
    } 

    function HistoryView(config) {
        this.commitData = config.commitData;
        this.name = config.name || 'UnnamedHistoryView';
        this.branches = config.branches;
        this.head = config.head;

        this.width = config.width || "100%";
        this.height = config.height || 400;
        this.baseLine = this.height * (config.baseLine || 0.6);

        this.commitRadius = config.commitRadius || 20;
        this.pointerMargin = this.commitRadius * 1.3;
    }

    HistoryView.generateId = function () {
        return Math.floor((1 + Math.random()) * 0x10000000).toString(16).substring(1);
    };

    HistoryView.prototype = {
        fixCirclePosition: function (selection) {
            var view = this;
            selection
                .attr('cx', function (d) {
                    return d.x * view.commitRadius * 4.5;
                })
                .attr('cy', function (d) {
                    return view.baseLine - (d.y * view.commitRadius * 4);
                });
        },

        fixIdPosition: function (selection, delta) {
            var view = this;
            selection.attr('x', function (d) {
                return d.x * view.commitRadius * 4.5;
            }).attr('y', function (d) {
                return view.baseLine - (d.y * view.commitRadius * 4 - view.commitRadius - delta);
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
            
            svg.append('svg:text')
                .classed('remote-name-display', true)
                .text('Local Repository')
                .attr('x', 10)
                .attr('y', 25);

            svg.append('svg:text')
                .classed('current-branch-display', true)
                .attr('x', 10)
                .attr('y', 45);

            this.svgContainer = svgContainer;
            this.svg = svg;
            this.arrowBox = svg.append('svg:g').classed('pointers', true);
            this.commitBox = svg.append('svg:g').classed('commits', true);
            this.tagBox = svg.append('svg:g').classed('tags', true);
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
        
        _resizeSvg: function() {
            var ele = document.getElementById(this.svg.node().id);
            var container = ele.parentNode;
            var currentWidth = ele.offsetWidth;
            var newWidth;

            if (ele.getBBox().width > container.offsetWidth)
                newWidth = Math.round(ele.getBBox().width);
            else
                newWidth = container.offsetWidth - 5;

            if (currentWidth != newWidth) {
                this.svg.attr('width', newWidth);
                container.scrollLeft = container.scrollWidth;
            }
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
            this._renderCircles();
            this._renderIdLabels();
            this._resizeSvg();
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
                .transition()
                .duration(500)
                .call(this.fixCirclePosition.bind(this))

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
                .attr('id', function (pair) {
                    return view.name + '-' + pair[0].id + '-to-' + pair[1].id;
                });

            existingPointers
                .transition()
                .duration(500)
                .attr('x1', function (pair) { return pair[0].x * view.commitRadius * 4.5})
                .attr('y1', function (pair) {  return view.baseLine - (pair[0].y * view.commitRadius * 4)})
                .attr('marker-end', REG_MARKER_END)
                .transition()
                .duration(500)
                .attr('x2', function (pair) { return pair[1].x * view.commitRadius * 4.5})
                .attr('y2', function (pair) {  return view.baseLine - (pair[1].y * view.commitRadius * 4)})

            var newPointers = 
                existingPointers.enter()
                .append('svg:line')
                .attr('id', function (pair) {
                    return view.name + '-' + pair[0].id + '-to-' + pair[1].id;
                })
                .classed('commit-pointer', true)
                .datum(function(pair) { return trim([{
                        x: pair[0].x * view.commitRadius * 4.5, 
                        y: view.baseLine - (pair[0].y * view.commitRadius * 4)
                    }, {
                        x: pair[1].x * view.commitRadius * 4.5, 
                        y: view.baseLine - (pair[1].y * view.commitRadius * 4)
                    }], 20, 30); 
                })
                .attr('x1', function (pair) { return pair[0].x})
                .attr('y1', function (pair) {  return pair[0].y})
                .attr('marker-end', REG_MARKER_END)
                .transition()
                .duration(500)
                .attr('x2', function (pair) { return pair[1].x})
                .attr('y2', function (pair) {  return pair[1].y})
            
                

        },
        _renderArrows: function () {
            var view = this,
                existingPointers,
                newPointers;

            existingPointers = this.arrowBox.selectAll('line.commit-pointer')
                .data(this.commitData, function (d) { return d.id; })
                .attr('id', function (d) {
                    return view.name + '-' + d.id + '-to-' + d.parent;
                });

            existingPointers.transition()
                .duration(500)
                .call(fixPointerStartPosition, view)
                .call(fixPointerEndPosition, view);

            newPointers = existingPointers.enter()
                .append('svg:line')
                .attr('id', function (d) {
                    return view.name + '-' + d.id + '-to-' + d.parent;
                })
                .classed('commit-pointer', true)
                .call(fixPointerStartPosition, view)
                .attr('x2', function () { return d3.select(this).attr('x1'); })
                .attr('y2', function () {  return d3.select(this).attr('y1'); })
                .attr('marker-end', REG_MARKER_END)
                .transition()
                .duration(500)
                .call(fixPointerEndPosition, view);
        },


        _renderIdLabels: function () {
            this._renderText('id-label', function (d) { return d.id + '..'; }, 14);
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
