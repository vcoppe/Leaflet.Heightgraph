L.Control.Heightgraph = L.Control.extend({
    options: {
        position: "topleft",
        width: 800,
        height: 125,
        margins: {
            top: 20,
            right: 50,
            bottom: 25,
            left: 50
        },
        mappings: undefined
    },
    onAdd: function(map) {
        var opts = this.options;
        var container = this._container = L.DomUtil.create('div', 'heightgraph');
        L.DomEvent.disableClickPropagation(container);
        var buttonContainer = this._button = L.DomUtil.create('div', "heightgraph-toggle", container);
        var link = L.DomUtil.create('a', "heightgraph-toggle-icon", buttonContainer);
        var closeButton = this._closeButton = L.DomUtil.create('a', "heightgraph-close-icon", container);
        this._showState = false;
        this._initToggle();
        this._margin = this.options.margins;
        this._width = this.options.width - this._margin.left - this._margin.right;
        this._height = this.options.height - this._margin.top - this._margin.bottom;
        this._mappings = this.options.mappings;
        //var dynamicLegend = this._profile.legendList[y]; // this._dynamicLegend ist in createLegend undefined... warum?
        this._svgWidth = this._width - this._margin.left - this._margin.right;
        this._svgHeight = this._height - this._margin.top - this._margin.bottom;
        var svg = this._svg = d3.select(this._container).append("svg").attr("class", "background").attr("width", this._svgWidth + this._margin.left + this._margin.right).attr("height", this._svgHeight + this._margin.top + this._margin.bottom).append("g").attr("transform", "translate(" + this._margin.left + "," + this._margin.top + ")");
        return container;
    },
    onRemove: function(map) {
        this._container = null;
        this._svg = undefined;
    },
    /**
     * add Data from geoJson and call all functions
     * @param {Object} data
     */
    addData: function(data) {
        if (this._svg !== undefined) {
            this._svg.selectAll("*").remove();
            /** reset options */
            var options = document.querySelectorAll('.selection option');
            for (var i = 0, l = options.length; i < l; i++) {
                options[i].selected = options[i].defaultSelected;
            }
        }
        this._data = data;
        this._selection();
        this._prepareData();
        //this._createLegendList();
        this._computeStats();
        this._appendScales();
        this._appendGrid();
        this._createChart(this._selectedOption);
        //this._createLegend(this._svg);
    },
    _initToggle: function() {
        if (!L.Browser.touch) {
            L.DomEvent.disableClickPropagation(this._container);
        } else {
            L.DomEvent.on(this._container, 'click', L.DomEvent.stopPropagation);
        }
        if (!L.Browser.android) {
            L.DomEvent.on(this._button, 'click', this._expand, this);
            L.DomEvent.on(this._closeButton, 'click', this._expand, this);
        }
    },
    /**
     * expand container when button clicked and shrink when close-Button clicked
     */
    _expand: function() {
        for (var i = 0; i < this._container.children.length; i++) {
            if (!this._showState) {
                (i == 0) ? this._container.children[i].style.display = "none": this._container.children[i].style.display = "block";
            } else {
                (i == 0) ? this._container.children[i].style.display = "block": this._container.children[i].style.display = "none";
            }
        }
        this._showState = !this._showState;
    },
    /**
     * reacts on changes in selection box and updates heightprofile
     * @param {integer} selectedOption
     */
    _selection: function(selectedOption) {
        var data = this._data;
        this._selectedOption = selectedOption == undefined ? 0 : this._selectedOption;
        if (selectedOption !== undefined) {
            if (this._svg !== undefined) {
                // remove old graph
                this._svg.selectAll("*").remove();
            }
            // build new graph
            this._createBarChart();
            this._createLegend(this._svg);
        }
    },
    /**
     * Prepares the data needed for the height graph
     */
    _prepareData: function() {
        this._profile = {};
        this._profile.coordinates = [];
        this._profile.elevations = [];
        this._profile.ptDistances = [];
        this._profile.ptDistances.push(0);
        this._profile.blocks = [];
        var data = this._data;
        var cumDistance = 0;
        for (var y = 0; y < data.length; y++) {
            this._profile.blocks[y] = {};
            this._profile.blocks[y].info = {
                id: y,
                text: (data[y] === undefined) ? "none" : data[y].properties.summary
            };
            this._profile.blocks[y].distances = [];
            this._profile.blocks[y].attributes = [];
            this._profile.blocks[y].indices = [];
            this._profile.blocks[y].geometries = [];
            var cnt = 0;
            for (var i = 0; i < data[y].features.length; i++) {
                // data is redundant in every elemtent of data which is why we collect it once
                var startIdx, endIdx, altitude, ptA, ptB, ptDistance, blockDistance = 0,
                    geometry = [];
                var coordsLength = data[y].features[i].geometry.coordinates.length;
                for (var j = 0; j < coordsLength; j++) {
                    if (j === 0) {
                        startIdx = cnt;
                    }
                    ptA = new L.LatLng(data[y].features[i].geometry.coordinates[j][1], data[y].features[i].geometry.coordinates[j][0]);
                    altitude = data[y].features[i].geometry.coordinates[j][2];
                    // add elevations, coordinates and point distances only once
                    // last point in feature is first of next which is why we have to juggle with indices
                    if (j < coordsLength - 1) {
                        if (y === 0) {
                            ptB = new L.LatLng(data[y].features[i].geometry.coordinates[j + 1][1], data[y].features[i].geometry.coordinates[j + 1][0]);
                            ptDistance = ptA.distanceTo(ptB) / 1000;
                            // calculate distances of specific block
                            cumDistance += ptDistance;
                            blockDistance += ptDistance;
                            this._profile.elevations.push(altitude);
                            this._profile.coordinates.push(ptA);
                            this._profile.ptDistances.push(cumDistance);
                        
                        }
                        cnt += 1;
                    } else if (j == coordsLength - 1 && i == data[y].features.length - 1) {
                        if (y === 0) {
                            this._profile.elevations.push(altitude);
                            this._profile.coordinates.push(ptB);
                        }
                        cnt += 1;
                    }
                    // save the position which corresponds to the distance along
                    // the route. 
                    var position;
                    if (j === 0 && i > 0) {
                        position = this._profile.ptDistances[cnt - 2];
                    } else {
                        position = this._profile.ptDistances[cnt - 1];
                    }
                    geometry.push({
                        altitude: altitude,
                        position: position,
                        x: ptA.lng,
                        y: ptA.lat,
                        latlng: ptA
                    });
                }
                // save attribute types related to blocks
                var attributeType = data[y].features[i].properties.attributeType;
                this._profile.blocks[y].attributes.push({
                    type: attributeType,
                    text: this._mappings[data[y].properties.summary][attributeType].text,
                    color: this._mappings[data[y].properties.summary][attributeType].color
                });
                this._profile.blocks[y].distances.push(cumDistance);
                this._profile.blocks[y].indices.push([startIdx, cnt]);
                this._profile.blocks[y].geometries.push(geometry);
            }
        }
        this._profile.totalDistance = cumDistance;
    },
    /**
     * Creates a legend list with the proportion of each type, color, and name of type
     */
    _createLegendList: function() {
        var profileCount = this._data.length;
        this._profile.legendList = {};
        //for each profile
        for (var i = 0; i < profileCount; i++) {
            this._profile.legendList[i] = [];
            var dists = this._profile.blockInfo[i].blockDistancesOnce;
            var blockTypes = this._profile.blockInfo[i].blockTypesOnce;
            //remove duplicates
            var typesCleaned = blockTypes.filter(function(elem, index) {
                return index == blockTypes.indexOf(elem);
            });
            //parse string to int
            var types = typesCleaned.map(Number);
            //find max of types
            var maxTypes = d3.max(types);
            //create Array to be filled with added distances
            var distances = Array(maxTypes + 1).fill(0);
            //create random colours if not defined by user
            if (this._mappings === undefined) {
                this._profile.colorList = this._randomColors(typesCleaned);
            }
            for (var j = 0; j < dists.length; j++) {
                var value = parseInt(blockTypes[j]);
                distances[value] = distances[value] + dists[j];
            }
            for (var k = 0; k < distances.length; k++) {
                if (distances[k] !== 0) {
                    this._profile.legendList[i].push({
                        type: k,
                        blockDistanceSum: distances[k],
                        proportion: Math.round(distances[k] / this._profile.totalDistance * 100),
                        text: this._mappings === undefined ? this._profile.colorList[k].text : this._mappings[this._profile.ids[i].text][k].text,
                        color: this._mappings === undefined ? this._profile.colorList[k].color : this._mappings[this._profile.ids[i].text][k].color,
                    });
                }
            }
            this._profile.legendList[i].sort(function(a, b) {
                return b.blockDistanceSum - a.blockDistanceSum;
            });
        }
        this._profile.legendList[profileCount] = {
            text: "",
            color: "None"
        };
    },
    /**
     * creates a range of different random colors for highlighting the bar (when no colors are predefined)
     */
    _randomColors: function(types) {
        var values = types;
        var colorList = [];
        for (var i = 0; i < values.length; i++) {
            colorList[values[i]] = {
                color: chroma.random(),
                text: values[i]
            };
        }
        return colorList;
    },
    /**
     * Creates a list with four x,y coords and other important infos for the bars drawn with d3
     */
    _computeStats: function() {
        // highest and lowest elevation value for creating an invisible graph of maximum height 
        // for providing the info box in the whole diagramm while hovering
        var max = this._profile.maxElevation = d3.max(this._profile.elevations);
        var min = this._profile.minElevation = d3.min(this._profile.elevations);
        var quantile = this._profile.elevationQuantile = d3.quantile(this._profile.elevations, 0.75);
        // adapted min and max elevation values of graph 
        var yElevationMin = this._profile.yElevationMin = (quantile < (min + min / 10)) ? (min - max / 5 < 0 ? 0 : min - max / 5) : min - (max / 10);
        this._profile.yElevationMax = quantile > (max - max / 10) ? max + (max / 3) : max;
        console.log(this._profile);
    },
    /**
     * Creates a marker on the map while hovering
     * @param {Object} lat lon: actual coordinates of the route
     * @param {float} height: actual height
     * @param {string} color: color of graph-segment
     * @param {string} text: value of graph-segment
     */
    _showMarker: function(segmentCenter, height, color, text) {
        var layerpoint = this._map.latLngToLayerPoint(segmentCenter);
        var normalizedY = layerpoint.y - 75;
        if (!this._mouseHeightFocus) {
            var heightG = d3.select(".leaflet-overlay-pane svg").append("g");
            this._mouseHeightFocus = heightG.append('svg:line').attr('class', 'height-focus line').attr('x2', '0').attr('y2', '0').attr('x1', '0').attr('y1', '0');
            this._mouseHeightFocusLabel = heightG.append("g").attr('class', 'height-focus label');
            var pointG = this._pointG = heightG.append("g").attr('class', 'height-focus circle');
            pointG.append("svg:circle").attr("r", 5).attr("cx", 0).attr("cy", 0).attr("class", "height-focus circle-lower");
        }
        this._mouseHeightFocus.attr("x1", layerpoint.x).attr("x2", layerpoint.x).attr("y1", layerpoint.y).attr("y2", normalizedY);
        this._pointG.attr("transform", "translate(" + layerpoint.x + "," + layerpoint.y + ")").attr('fill', color);
        this._mouseHeightFocusLabel.selectAll("*").remove();
        this._mouseHeightFocusLabel.append("rect").attr("x", layerpoint.x + 3).attr("y", normalizedY).attr("class", 'bBox');
        this._mouseHeightFocusLabel.append("text").attr("x", layerpoint.x + 5).attr("y", normalizedY + 12).text(height + " m").attr("class", "tspan");
        this._mouseHeightFocusLabel.append("text").attr("x", layerpoint.x + 5).attr("y", normalizedY + 24).text(text).attr("class", "tspan");
        var maxWidth = d3.max([this._mouseHeightFocusLabel.nodes()[0].children[1].getBoundingClientRect().width, this._mouseHeightFocusLabel.nodes()[0].children[2].getBoundingClientRect().width]);
        var maxHeight = this._mouseHeightFocusLabel.nodes()[0].children[2].getBoundingClientRect().width === 0 ? 12 + 6 : 2 * 12 + 6;
        d3.selectAll('.bBox').attr("width", maxWidth + 10).attr("height", maxHeight);
    },
    /**
     * Creates the elevation profile with SVG
     */
    _createChart: function(idx) {
        console.log(idx)
        var areaBlocks = this._profile.blocks[idx].geometries; // this._polygonData ist in createBorderTopLine undefined... warum?
        console.log(areaBlocks)
        for (var i = 0; i < areaBlocks.length; i++) {
            console.log(i)
            this._appendAreas(areaBlocks[i], idx, i);
        }
       
        // // bar chart as path
        // this._svg.selectAll('hpath').data(this._profile.barData[y]).enter().append('path').attr('class', 'bars').attr('d', function(d, i) {
        //     return polygon(d.coords);
        // }).attr('fill', function(d) {
        //     return (d.color);
        // });
        // // bar chart invisible for hover as path
        // this._svg.selectAll('hpath').data(this._profile.barData[y]).enter().append('path').attr('class', 'bars-overlay').attr('d', function(d) {
        //     return polygon(d.coords_maxElevation);
        // }).on('mouseover', self._handleMouseOver.bind(this));
        // this._svg.on('mouseleave', self._handleMouseLeave.bind(this));
        // self._createBorderTopLine(this._profile.barData[y], svg);
        // self._createSelectionBox(svg);
        // self._createFocus();
    },
    // create focus Line and focus InfoBox while hovering
    _createFocus: function() {
        var self = this;
        var boxPosition = self._profile.yElevationMin;
        var textDistance = 15;
        this._focusWidth = 150;
        self._focus = self._svg.append("g").attr("class", "focus");
        //background box
        self._focus.append("rect").attr("x", 3).attr("y", -self._y(boxPosition)).attr("width", this._focusWidth).attr("display", "none");
        // text line 1
        self._focusDistance = self._focus.append("text").attr("x", 7).attr("y", -self._y(boxPosition) + 1 * textDistance).attr("id", "distance").text('Distance:');
        //text line 2
        self._focusHeight = self._focus.append("text").attr("x", 7).attr("y", -self._y(boxPosition) + 2 * textDistance).attr("id", "height").text('Elevation:');
        if (self._selectedOption < self._data.length) {
            // text line 3
            self._focusBlockDistance = self._focus.append("text").attr("x", 7).attr("y", -self._y(boxPosition) + 3 * textDistance).attr("id", "blockdistance").text('Segment length:');
            //text line 4
            self._focusType = self._focus.append("text").attr("x", 7).attr("y", -self._y(boxPosition) + 4 * textDistance).attr("id", "type").text('Type:');
            this._BlockDistanceTspan = self._focusBlockDistance.append('tspan').attr("class", "tspan");
            this._TypeTspan = self._focusType.append('tspan').attr("class", "tspan");
        }
        var height = self._dynamicBoxSize('.focus text')[0];
        d3.selectAll('.focus rect').attr("height", height * textDistance + (textDistance / 2)).attr("display", "block");
        self._focusLineGroup = self._svg.append("g").attr("class", "focusLine");
        self._focusLine = self._focusLineGroup.append("line").attr("y1", 0).attr("y2", self._y(self._profile.yElevationMin));
        this._DistanceTspan = self._focusDistance.append('tspan').attr("class", "tspan");
        this._HeightTspan = self._focusHeight.append('tspan').attr("class", "tspan");
    },
    /**
     * defines the ranges and format of x- and y- scales
     */
    _appendScales: function() {
        var yHeightMin = this._profile.yElevationMin;
        var yHeightMax = this._profile.yElevationMax;
        var margin = this._margins,
            width = this._width - this._margin.left - this._margin.right,
            height = this._height - this._margin.top - this._margin.bottom;
        this._x = d3.scaleLinear().range([0, width]);
        this._y = d3.scaleLinear().range([height, 0]);
        this._x.domain([0, this._profile.totalDistance]);
        this._y.domain([yHeightMin, yHeightMax]);
        console.log(this._x.domain(), this._y.domain())
        //this._yEnd = d3.scaleLinear().range([height, 0]).domain([yHeightmin, max]);
        this._xAxis = d3.axisBottom().scale(this._x).tickFormat(function(d) {
            return d / 1000 + " km";
            // var prefix = d3.formatPrefix(d);
            // return prefix.scale(d) //+ prefix.symbol;
        });
        this._yAxis = d3.axisLeft().scale(this._y).ticks(5).tickFormat(function(d) {
            return d + " m";
        });
        this._yEndAxis = d3.axisRight().scale(this._yEnd).ticks(0);
    },
    _appendGrid: function() {
        // append x grid
        this._svg.append("g").attr("class", "grid").attr("transform", "translate(0," + this._svgHeight + ")").call(this._make_x_axis().tickSize(-this._svgHeight, 0, 0).tickFormat(""));
        // append y grid
        this._svg.append("g").attr("class", "grid").call(this._make_y_axis().tickSize(-this._svgWidth, 0, 0).ticks(5).tickFormat(""));
        // axes and axes labels
        this._svg.append('g').attr("transform", "translate(0," + this._svgHeight + ")") // create a <g> element
            .attr('class', 'x axis') // specify classes
            .call(this._xAxis);
        this._svg.append('g').attr('class', 'y axis').call(this._yAxis);
    },
    _appendAreas: function(block, idx, eleIdx) {
        var c = this._profile.blocks[idx].attributes[eleIdx].color;
        var self = this;
        var area = this._area = d3.area().x(function(d) {
            var xDiagCoord = self._x(d.position);
            d.xDiagCoord = xDiagCoord;
            return xDiagCoord;
        }).y0(this._svgHeight).y1(function(d) {
            return self._y(d.altitude);
        }).curve(d3.curveLinear);
        this._areapath = this._svg.append("path").attr("class", "area");
        this._areapath.datum(block)
        .attr("d", this._area)
        .attr("stroke", c)
        .style("fill", c);
    },
    // gridlines in x axis function
    _make_x_axis: function() {
        return d3.axisBottom().scale(this._x);
    },
    // gridlines in y axis function
    _make_y_axis: function() {
        return d3.axisLeft().scale(this._y);
    },
    _createSelectionBox: function(svg) {
        var margin = this._margins,
            width = this._width - this._margin.left - this._margin.right,
            height = this._height - this._margin.top - this._margin.bottom;
        var jsonCircles = [{
            "x": 0,
            "y": height + 35,
            "color": "grey",
            "type": d3.symbolTriangle,
            "id": "leftArrowSelection",
            "angle": -90
        }, {
            "x": 80,
            "y": height + 35,
            "color": "grey",
            "type": d3.symbolTriangle,
            "id": "rightArrowSelection",
            "angle": 90
        }];
        var selectionSign = svg.selectAll('.selectSign').data(jsonCircles).enter().append('path').attr("class", "selectSign").attr("d", d3.symbol().type(function(d) {
            return d.type;
        })).attr("transform", function(d) {
            return "translate(" + d.x + "," + d.y + ") rotate(" + d.angle + ")";
        }).attr("id", function(d) {
            return d.id;
        }).style("fill", function(d) {
            return d.color;
        }).on("click", function(d) {
            if (d.id == "rightArrowSelection") arrowRight();
            if (d.id == "leftArrowSelection") arrowLeft();
        });
        var self = this;
        self._length = this._data.length;
        var id = this._selectedOption;
        chooseSelection(id);

        function arrowRight() {
            var counter = self._selectedOption += 1;
            if (counter == self._data.length + 1) {
                counter = 0;
                self._selectedOption = 0;
            }
            self._selection(self._selectedOption);
            chooseSelection(counter);
        }

        function arrowLeft() {
            var counter = self._selectedOption -= 1;
            if (counter == -1) {
                counter = self._data.length;
                self._selectedOption = self._data.length;
            }
            chooseSelection(counter);
            self._selection(self._selectedOption);
        }

        function chooseSelection(id) {
            var type = self._profile.ids[id];
            var data = [{
                "selection": type.text
            }];
            svg.selectAll('.text').data(data).enter().append('text').attr("x", 15).attr("y", height + 40).text(function(d) {
                return d.selection;
            }).attr("class", "legend-menu").attr("id", "selectionText");
        }
        this._selectedOption = self._selectedOption;
    },
    /**
     * create dynamic legend with d3
     */
    _createLegend: function(svg) {
        var margin = this._margins,
            width = this._width - this._margin.left - this._margin.right,
            height = this._height - this._margin.top - this._margin.bottom;
        var leg = [{
            "text": "Legend"
        }];
        var legendRectSize = 7;
        var legendSpacing = 7;
        var self = this;
        legendHover = svg.selectAll('.legend-hover').data(leg).enter().append('g').attr('class', 'legend-hover');
        if (self._selectedOption == self._data.length) {
            d3.selectAll('.legend-hover').style("display", "none");
        }
        var legend = svg.selectAll('.hlegend-hover').data(this._profile.legendList[this._selectedOption]).enter().append('g').attr('class', 'legend').style("display", "none").attr('transform', function(d, i) {
            var height = legendRectSize + legendSpacing;
            var offset = height * 2;
            var horz = legendRectSize - 15;
            var vert = i * height - offset;
            return 'translate(' + horz + ',' + vert + ')';
        });
        legend.append('rect').attr('class', 'legend-rect').attr('x', 500).attr('y', 6 * 6).attr('width', 6).attr('height', 6).style('fill', function(d, i) {
            return d.color;
        });
        legend.append('text').attr('class', 'legend-text').attr('x', 515).attr('y', 6 * 7).text(function(d, i) {
            var textProp = d.text + " (" + d.proportion + "%)";
            self._boxBoundY = (height - (2 * height / 3) + 7) * i;
            return textProp;
        });
        legendHover.append('text').attr('class', 'legend-menu').attr("class", "no-select").attr('x', width - 50).attr('y', height + 40).text(function(d, i) {
            return d.text;
        }).on('mouseover', function() {
            var dyn = self._dynamicBoxSize('.legend');
            var backgroundbox = svg.selectAll('.legend-hover').append('rect').attr('x', 485).attr('y', 0).attr('height', 13.6 * (dyn[0]) + (10)).attr('width', dyn[1] + legendRectSize + legendSpacing).attr('class', 'legend-box');
            d3.select('.legend-box').style("display", "block").style("stroke", "#888");
            d3.selectAll('.legend').style("display", "block");
        }).on('mouseleave', function() {
            d3.select('.legend-box').style("display", "none");
            d3.selectAll('.legend').style("display", "none");
        });
    },
    /**
     * calculates the margins of boxes 
     * @param {String} className: name of the class
     * @return {array} borders: number of text lines, widest range of text
     */
    _dynamicBoxSize: function(className) {
        var cnt = d3.selectAll(className).nodes().length;
        var widths = [];
        for (var i = 0; i < cnt; i++) {
            widths.push(d3.selectAll(className).nodes()[i].getBoundingClientRect().width);
        }
        var maxWidth = d3.max(widths);
        var borders = [cnt, maxWidth];
        return borders;
    },
    /**
     * create top border line on graph 
     * @param {array} polygonData: coords with x,y values 
     * @param {array} svg: existing graph
     */
    _createBorderTopLine: function(polygonData, svg) {
        var self = this;
        var borderTopLine = d3.line().x(function(d) {
            var x = self._x;
            return x(d.coords[0].x);
        }).y(function(d) {
            var y = self._y;
            return y(d.coords[0].y);
        }).curve(d3.curveBasis);
        //create second line to cover the last chart on the graph
        svg.append("svg:path").attr("d", borderTopLine(polygonData)).attr('class', 'borderTop');
        var borderTopLineAdd = d3.line().x(function(d) {
            var x = self._x;
            return x(d.coords[1].x);
        }).y(function(d) {
            var y = self._y;
            return y(d.coords[1].y);
        }).curve(d3.curveBasis);
        svg.append("svg:path").attr("d", borderTopLineAdd(polygonData)).attr('class', 'borderTop');
    },
    /**
     * creates Info-Boxes while hovering the graph
     * @param {Object} d: contains coords, type, text, blockdistance
     */
    _handleMouseOver: function(d) {
        var self = this;
        var x0 = self._x.invert(d3.mouse(d3.event.currentTarget)[0]); //distance in m
        var d0 = d.coords[0].x,
            d1 = d.coords[1].x;
        var d2 = d1 - x0 > x0 - d0 ? 0 : 1; // shortest distance between mouse and coords of polygon
        var y0 = (Math.round(((d.coords[0].y + d.coords[1].y) / 2) * 100) / 100); //height
        var color = d.color;
        var text = d.text;
        var LatLngCoords = d.LatLng;
        var segmentCenter = L.latLngBounds(LatLngCoords[0], LatLngCoords[1]).getCenter();
        self._showMarker(segmentCenter, y0, color, text);
        self._DistanceTspan.text(" " + Math.round((x0 / 1000) * 100) / 100 + ' km');
        self._HeightTspan.text(" " + y0.toFixed(0) + ' m');
        if (d.text.length > 0) self._BlockDistanceTspan.text(" " + (d.blockdist / 1000).toFixed(2) + ' km');
        self._TypeTspan.text(" " + d.text);
        var boxWidth = d3.max([self._DistanceTspan.nodes()[0].getBoundingClientRect().width,
            self._HeightTspan.nodes()[0].getBoundingClientRect().width,
            self._BlockDistanceTspan.nodes()[0].getBoundingClientRect().width,
            self._TypeTspan.nodes()[0].getBoundingClientRect().width
        ]);
        self._focusLine.style("display", "block").attr('x1', self._x(x0)).attr('x2', self._x(x0));
        if (self._mouseHeightFocus) {
            self._mouseHeightFocus.style("display", 'block');
            self._mouseHeightFocusLabel.style("display", 'block');
            self._pointG.style("display", 'block');
            self._focus.style('display', 'block');
            self._focusLine.style('display', 'block');
            d3.selectAll('.focus rect').attr("width", boxWidth + 10);
        }
        var xPositionBox = self._x(x0) - (boxWidth + 15);
        var totalWidth = self._width - self._margin.left - self._margin.right;
        if (self._x(x0) + self._focusWidth < totalWidth) {
            self._focus.style("display", "initial").attr("transform", "translate(" + self._x(x0) + "," + self._y(self._profile.yElevationMin) + ")");
        }
        if (self._x(x0) + self._focusWidth > totalWidth) {
            self._focus.style("display", "initial").attr("transform", "translate(" + xPositionBox + "," + self._y(self._profile.yElevationMin) + ")");
        }
    },
    /**
     * handles mouseLeave event with removing hover box and hover line
     */
    _handleMouseLeave: function() {
        var self = this;
        if (self._mouseHeightFocus) {
            self._mouseHeightFocus.style("display", "none");
            self._mouseHeightFocusLabel.style("display", "none");
            self._pointG.style("display", "none");
            self._focus.style('display', 'none');
            self._focusLine.style('display', 'none');
        }
    }
});
L.control.heightgraph = function(options) {
    return new L.Control.Heightgraph(options);
};