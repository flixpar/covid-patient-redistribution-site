const mapHeight = 650;
const mapWidth  = 1000;

const mapPlotMargin = ({top: 25, right:  0, bottom:  0, left:  0});
const mapPadding    = ({top: 10, right: 10, bottom: 10, left: 10});
const mapMargin     = ({top: 25, right: 10, bottom: 10, left: 10});

const mapPlotFont = "CMU Serif";

const mapAnimationTime = 30000;
const mapAnimationDelayTime = 2000;

const debugMap = false;

let mapPlotIntervals = [];

let storedGeometry = null;

function createMap(rawdata, metric, transfers="both", add_description=true) {
	let data1, data2;
	let colorscale;
	let plotTitle, colorbarLabel;
	let dynamic;
	let description = null;

	if (metric == "load") {
		dynamic = true;
		const data = extractDataDynamic(rawdata);
		data1 = data.load_null;
		data2 = data.load;
		colorscale = getLoadColorscale(data.load_null);
		plotTitle = "COVID Patient Load";
		colorbarLabel = "Normalized Load";
	} else if (metric == "max_load") {
		dynamic = false;
		const data = extractDataStatic(rawdata);
		data1 = data.max_load_null;
		data2 = data.max_load;
		colorscale = getLoadColorscale(data.max_load_null);
		plotTitle = "Max COVID Patient Load";
		colorbarLabel = "Normalized Load";
	} else if (metric == "mean_load") {
		dynamic = false;
		const data = extractDataStatic(rawdata);
		data1 = data.mean_load_null;
		data2 = data.mean_load;
		colorscale = getLoadColorscale(data.mean_load_null);
		plotTitle = "Mean COVID Patient Load";
		colorbarLabel = "Normalized Load";
	} else if (metric == "median_load") {
		dynamic = false;
		const data = extractDataStatic(rawdata);
		data1 = data.median_load_null;
		data2 = data.median_load;
		colorscale = getLoadColorscale(data.median_load_null);
		plotTitle = "Median COVID Patient Load";
		colorbarLabel = "Normalized Load";
	} else if (metric == "overflow_dynamic") {
		dynamic = true;
		const data = extractDataDynamic(rawdata);
		data1 = data.overflow_null;
		data2 = data.overflow;
		colorscale = getOverflowColorscale(data.overflow_null);
		plotTitle = "Required Surge Capacity";
		colorbarLabel = "Required Surge Capacity (Bed-Days)";
		description = overflowmapDescription;
	} else if (metric == "overflow" || metric == "overflow_static") {
		dynamic = false;
		const data = extractDataStatic(rawdata);
		data1 = data.overflow_null;
		data2 = data.overflow;
		colorscale = getOverflowColorscale(data.overflow_null);
		plotTitle = "Required Surge Capacity";
		colorbarLabel = "Required Surge Capacity (Bed-Days)";
	} else {
		console.log("Invalid map metric");
		return;
	}

	let links;
	if (dynamic) {
		links = createDynamicLinks(rawdata.sent, rawdata.config);
	} else {
		links = createStaticLinks(rawdata.sent, rawdata.config);
	}

	const section = document.getElementById("section-results-overflowmap");

	let figContainer = document.createElement("div");
	section.appendChild(figContainer);

	if (add_description && description != null) {
		let descriptionElem = document.createElement("p");
		descriptionElem.innerHTML = description;
		section.appendChild(descriptionElem);
	}

	loadGeometry().then(geometry => {
		let fig;
		if (transfers == "both") {
			fig = makeGroupedChoropleth(dynamic, rawdata, data1, data2, links, colorscale, geometry, plotTitle, colorbarLabel);
		} else if (transfers == "no_transfers") {
			fig = makeSingleChoropleth(dynamic, rawdata, data1, links, colorscale, geometry, plotTitle, colorbarLabel);
		} else if (transfers == "transfers") {
			fig = makeSingleChoropleth(dynamic, rawdata, data2, links, colorscale, geometry, plotTitle, colorbarLabel);
		}
		figContainer.appendChild(fig);
	});
}

////////////////////////////
////// Plot Components /////
////////////////////////////

function makeGroupedChoropleth(make_dynamic, rawdata, _data1, _data2, _links, _colorscale, _geometries, _plot_title, _colorbar_label) {
	let svg = d3.create("svg").attr("viewBox", [0, 0, mapWidth, mapHeight]);

	const plotWidth = 0.45 * mapWidth;
	const plotHeight = mapHeight - mapPlotMargin.top - mapPlotMargin.bottom;

	let g1 = svg.append("g").attr("transform", `translate(${mapPlotMargin.left}, ${mapPlotMargin.top})`);
	let g2 = svg.append("g").attr("transform", `translate(${mapPlotMargin.left + plotWidth}, ${mapPlotMargin.top})`);
	let g3 = svg.append("g").attr("transform", `translate(${mapPlotMargin.left + 2*plotWidth}, ${mapPlotMargin.top})`);

	g1 = makeMap(g1, rawdata, _data1,   null, _colorscale, _geometries, plotWidth, plotHeight, make_dynamic, "(Without Transfers)");
	g2 = makeMap(g2, rawdata, _data2, _links, _colorscale, _geometries, plotWidth, plotHeight, make_dynamic, "(With Transfers)");
	g3 = makeColorbar(g3, _colorscale, _colorbar_label);

	if (debugMap) {
		svg.append("rect")
			.attr("x", 0)
			.attr("y", 0)
			.attr("width", mapWidth)
			.attr("height", mapHeight)
			.attr("fill", "none")
			.attr("stroke", "black")
			.attr("stroke-width", 2.0);
	}

	svg.append("text")
		.attr("x", (0.9*mapWidth)/2)
		.attr("y", 20)
		.attr("text-anchor", "middle")
		.style("font-family", mapPlotFont)
		.style("font-size", "20px")
		.text(_plot_title);

	return svg.node();
}

function makeSingleChoropleth(make_dynamic, rawdata, _data1, _links, _colorscale, _geometries, _plot_title) {
	let svg = d3.create("svg").attr("viewBox", [0, 0, mapWidth, mapHeight]);

	const plotWidth = 0.9 * mapWidth;

	let g1 = svg.append("g");
	let g2 = svg.append("g").attr("transform", `translate(${plotWidth},0)`);

	g1 = makeMap(g1, rawdata, _data1, _links, _colorscale, _geometries, plotWidth, mapHeight, make_dynamic, _plot_title);
	g2 = makeColorbar(g2, _colorscale, "Required Surge Capacity (Bed-Days)");

	return svg.node();
}

function makeColorbar(svg, _colorscale, _colorbarLabel=null) {
	const cbarHeight = 0.8 * mapHeight;

	const randomID = Math.random().toString(36).substring(7);
	const gradId = "linear-gradient" + "-" + randomID;

	let defs = svg.append("defs");
	let linearGradient = defs.append("linearGradient")
		.attr("id", gradId)
		.attr("x1", 0)
		.attr("x2", 0)
		.attr("y1", 1)
		.attr("y2", 0);
	linearGradient.selectAll("stop")
		.data(_colorscale.ticks())
		.join("stop")
		.attr("offset", d => d / _colorscale.maxValue)
		.attr("stop-color", d => _colorscale(d));
	const colorbarScale = d3.scaleLinear()
		.domain([0, _colorscale.maxValue])
		.range([(mapHeight/2) + (cbarHeight/2), (mapHeight/2) - (cbarHeight/2)]);

	svg.append("rect")
		.attr("x", 0)
		.attr("y", (mapHeight/2) - (cbarHeight/2))
		.attr("width", 20)
		.attr("height", cbarHeight)
		.style("fill", `url(#${gradId})`);
	const colorAxis = g => g
		.attr("transform", `translate(20,0)`)
		.style("font-family", mapPlotFont)
		.style("font-size", "11px")
		.call(d3.axisRight(colorbarScale).ticks(5))
		.call(g => g.select(".domain").remove());
	svg.append("g").call(colorAxis);

	if (_colorbarLabel != null) {
		svg.append("text")
			.attr("text-anchor", "middle")
			.attr("transform", `rotate(90) translate(${mapHeight/2},-65)`)
			.style("font-family", mapPlotFont)
			.style("font-size", "13px")
			.text(_colorbarLabel);
	}

	return svg;
}

////////////////////////////
///////// Plot Maps ////////
////////////////////////////

function makeMap(svg, rawdata, data, links, colorscale, geometries, plotWidth, plotHeight, dynamic=true, title=null) {

	if (dynamic) {
		while (mapPlotIntervals.length != 0) {
			let _interval = mapPlotIntervals.pop();
			_interval.stop();
		}
	}

	const dates = rawdata.config.dates.map(d => new Date(Date.parse(d)))
	const T = dates.length;

	const selected_extent = getExtent(rawdata.config, geometries);
	let map_projection = d3.geoAlbers().fitExtent(
		[
			[mapMargin.left+mapPadding.left, mapMargin.top+mapPadding.top],
			[plotWidth-mapMargin.right-mapPadding.right, plotHeight-mapMargin.bottom-mapPadding.bottom]
		],
		selected_extent
	);
	map_projection.clipExtent([
		[mapMargin.left, mapMargin.top],
		[plotWidth-mapMargin.right, plotHeight-mapMargin.bottom]
	]);
	let p = d3.geoPath().projection(map_projection);

	let primaryGeometries, secondaryGeometries;
	let colorRegions = true;
	if (rawdata.config.node_type.indexOf("state") >= 0) {
		primaryGeometries = geometries.states;
		secondaryGeometries = null;
	} else if (rawdata.config.node_type.indexOf("county") >= 0) {
		primaryGeometries = geometries.counties;
		secondaryGeometries = null;
	} else if (rawdata.config.node_type.indexOf("hospital") >= 0) {
		primaryGeometries = geometries.states;
		secondaryGeometries = null;
		colorRegions = false;
	} else {
		primaryGeometries = geometries.states;
		secondaryGeometries = geometries.counties;
		colorRegions = false;
	}

	const linkWidthScale = getLinkWidthScale(links);
	const nodeSizeScale  = getNodeSizeScale(rawdata.beds, colorRegions);

	if (debugMap) {
		svg.append("rect")
			.attr("x", 0)
			.attr("y", 0)
			.attr("width", plotWidth)
			.attr("height", plotHeight)
			.attr("fill", "none")
			.attr("stroke", "gray")
			.attr("stroke-width", 1.0);
	}

	let primaryRegions = svg.append("g")
		.selectAll("path")
		.data(primaryGeometries.features)
		.join("path")
		.attr("class", "borders-main")
		.attr("fill", d => {
			if (colorRegions) {
				const j = rawdata.config.node_names.indexOf(d.properties.name);
				if (j >= 0) {
					if (dynamic) {
						return colorscale(data[j][0]);
					} else {
						return colorscale(data[j]);
					}
				}
			}
			return "lightgray";
		})
		.attr("stroke", "white")
		.attr("stroke-width", 0.75)
		.attr("d", p);

	let pts = svg.selectAll("points")
		.data(rawdata.config.node_names)
		.enter().append("path")
		.style("fill", d => {
			if (!colorRegions) {
				const j = rawdata.config.node_names.indexOf(d);
				if (j >= 0) {
					if (dynamic) {
						return colorscale(data[j][0]);
					} else {
						return colorscale(data[j]);
					}
				}
			}
			return "lightgray";
		})
		.style("stroke", "white")
		.style("stroke-width", "0.5px")
		.style("transform-box", "fill-box")
		.attr("d", (d,i) => {
			const l = rawdata.config.node_locations[d];
			const r = nodeSizeScale(i);
			const _p = p.pointRadius(r);
			return _p({type: "Point", coordinates: [l.long, l.lat]});
		});

	if (secondaryGeometries != null) {
		svg.append("path")
			.datum(secondaryGeometries)
			.attr("fill", "none")
			.attr("stroke", "darkgray")
			.attr("stroke-width", 1.0)
			.attr("stroke-linejoin", "round")
			.attr("d", p);
	}

	let defs = svg.append("defs");
	let linearGradient = defs.append("linearGradient")
		.attr("id", "linear-gradient")
		.attr("x1", 0)
		.attr("x2", 0)
		.attr("y1", 1)
		.attr("y2", 0);
	linearGradient.selectAll("stop")
		.data(colorscale.ticks())
		.join("stop")
		.attr("offset", d => d / colorscale.maxValue)
		.attr("stop-color", d => colorscale(d));

	if (title != null) {
		svg.append("text")
			.attr("x", plotWidth/2)
			.attr("y", 20)
			.attr("text-anchor", "middle")
			.style("font-family", mapPlotFont)
			.style("font-size", "18px")
			.text(title);
	}

	// setup arrow
	const markerBoxWidth = 4
	const markerBoxHeight = 4
	const refX = markerBoxWidth + 0.1
	const refY = markerBoxHeight / 2
	const arrowPoints = [[0, 0], [0, markerBoxHeight], [markerBoxWidth, markerBoxHeight/2]];
	svg
		.append("defs")
		.append("marker")
		.attr("id", "arrow")
		.attr("viewBox", [0, 0, markerBoxWidth, markerBoxHeight])
		.attr("refX", refX)
		.attr("refY", refY)
		.attr("markerWidth", markerBoxWidth)
		.attr("markerHeight", markerBoxHeight)
		.attr("orient", "auto-start-reverse")
		.append("path")
		.attr("d", d3.line()(arrowPoints))
		.attr("fill", "black");

	const linkColor = colorRegions ? "lightgray" : "gray";

	if (!dynamic && links != null) {
		svg.selectAll("path.edge").remove();
		svg.selectAll("edges")
			.data(links)
			.enter().append("path")
			.attr("class", "edge")
			.attr("d", d => p(d))
			.style("fill", "none")
			.style("stroke", linkColor)
			.style("stroke-width", d => linkWidthScale(d.weight))
			.attr("stroke-linecap", "butt")
			.attr("marker-end", "url(#arrow)");
	}

	function animate(t) {
		if (colorRegions) {
			primaryRegions.style("fill", d => {
				const j = rawdata.config.node_names.indexOf(d.properties.name);
				if (j >= 0) {
					return colorscale(data[j][t]);
				}
				return "lightgray";
			});
		}

		if (!colorRegions) {
			pts.style("fill", (d,i) => colorscale(data[i][t]));
		}

		svg.selectAll("#date-label").remove();
		const dateString = dates[t].toISOString().split("T")[0];
		svg.append("text")
			.attr("id", "date-label")
			.attr("x", plotWidth/2)
			.attr("y", 40)
			.attr("text-anchor", "middle")
			.style("font-size", 15)
			// .style("font-family", "monospace")
			.style("font-family", mapPlotFont)
			.text("Date: " + dateString);

		if (links != null) {
			svg.selectAll("path.edge").remove();
			svg.selectAll("edges")
				.data(links[t])
				.enter().append("path")
				.attr("class", "edge")
				.attr("d", d => p(d))
				.style("fill", "none")
				.style("stroke", linkColor)
				.style("stroke-width", d => linkWidthScale(d.weight))
				.attr("stroke-linecap", "butt")
				.attr("marker-end", "url(#arrow)");
		}
	}

	if (dynamic) {
		const delay = d3.scaleTime()
			.domain([dates[0], dates[T-1]])
			.range([0, mapAnimationTime]);

		for (const i of d3.range(T)) {
			d3.timeout(() => {
				animate(i);
				let _interval = d3.interval(() => {
					animate(i);
				}, mapAnimationTime + mapAnimationDelayTime);
				mapPlotIntervals.push(_interval);
			}, delay(dates[i]));
		}

		svg.transition()
			.ease(d3.easeLinear)
			.duration(delay.range()[1])
			.tween("date", () => {
				const i = d3.interpolateDate(...delay.domain());
				return t => d3.timeDay(i(t));
			});
	}

	return svg.node();
}

////////////////////////////
/////// Extract Data ///////
////////////////////////////

function extractDataStatic(rawdata) {
	const N = rawdata.beds.length;

	const max_load = d3.range(N).map(i => d3.max(rawdata.active[i]) / rawdata.beds[i]);
	const max_load_null = d3.range(N).map(i => d3.max(rawdata.active_null[i]) / rawdata.beds[i]);

	const mean_load = d3.range(N).map(i => d3.mean(rawdata.active[i]) / rawdata.beds[i]);
	const mean_load_null = d3.range(N).map(i => d3.mean(rawdata.active_null[i]) / rawdata.beds[i]);

	const median_load = d3.range(N).map(i => d3.median(rawdata.active[i]) / rawdata.beds[i]);
	const median_load_null = d3.range(N).map(i => d3.median(rawdata.active_null[i]) / rawdata.beds[i]);

	const overflow = d3.range(N).map(i => d3.sum(rawdata.active[i], x => Math.max(0,x-rawdata.beds[i])));
	const overflow_null = d3.range(N).map(i => d3.sum(rawdata.active_null[i], x => Math.max(0,x-rawdata.beds[i])));

	return {
		max_load: max_load,
		max_load_null: max_load_null,
		mean_load: mean_load,
		mean_load_null: mean_load_null,
		median_load: median_load,
		median_load_null: median_load_null,
		overflow: overflow,
		overflow_null: overflow_null,
	};
}

function extractDataDynamic(rawdata) {
	const N = rawdata.beds.length;
	const T = rawdata.config.dates.length;

	let load_data = [];
	let load_null_data = [];
	let overflow_data = [];
	let overflow_null_data = [];

	for (let i = 0; i < N; i++) {
		load_data[i]      = d3.range(T).map(t => rawdata.active[i][t]      / rawdata.beds[i]);
		load_null_data[i] = d3.range(T).map(t => rawdata.active_null[i][t] / rawdata.beds[i]);
		overflow_data[i]      = d3.range(T).map(t => Math.max(0, rawdata.active[i][t]      - rawdata.beds[i]));
		overflow_null_data[i] = d3.range(T).map(t => Math.max(0, rawdata.active_null[i][t] - rawdata.beds[i]));
	}

	return {
		load: load_data,
		load_null: load_null_data,
		overflow: overflow_data,
		overflow_null: overflow_null_data,
	};
}

function createDynamicLinks(sent, config) {
	const N = config.node_names.length;
	const T = sent[0][0].length;
	let links = [];
	for (let t = 0; t < T; t++) {
		let l = [];
		for (let i = 0; i < N; i++) {
			for (let j = 0; j < N; j++) {
				if (i == j) continue;
				const s1 = config.node_names[i];
				const s2 = config.node_names[j];
				const p1 = config.node_locations[s1];
				const p2 = config.node_locations[s2];
				const v = sent[i][j][t];
				if (v <= 0) continue;
				let link = {type: "LineString", coordinates: [[p1.long, p1.lat], [p2.long, p2.lat]], weight: v};
				l.push(link);
			}
		}
		links.push(l);
	}
	return links;
}

function createStaticLinks(sent, config) {
	const N = config.node_names.length;
	let links = [];
	for (let i = 0; i < N; i++) {
	  for (let j = i+1; j < N; j++) {
		if (i == j) continue;

		const v1 = d3.sum(sent[i][j]);
		const v2 = d3.sum(sent[j][i]);
		if (v1 + v2 <= 0) continue;

		let v = v1 - v2;
		let s1 = config.node_names[i];
		let s2 = config.node_names[j];

		if (v1 < v2) {
		  v = v2 - v1;
		  s1 = config.node_names[j];
		  s2 = config.node_names[i];
		}

		const p1 = config.node_locations[s1];
		const p2 = config.node_locations[s2];

		let link = {type: "LineString", coordinates: [[p1.long, p1.lat], [p2.long, p2.lat]], weight: v};
		links.push(link);
	  }
	}
	return links;
}

////////////////////////////
///// Geometry Helpers /////
////////////////////////////

function loadGeometry(load_counties=false) {
	let geo_url = load_counties ? "json/us-counties.json" : "json/us.json";
	return new Promise((resolve, reject) => {
		if (storedGeometry != null && (!load_counties || (storedGeometry.counties != null))) {
			resolve(storedGeometry);
		} else {
			$.ajax({
				url: geo_url,
				type: "GET",
				dataType: "json",
				success: function(_geometry) {
					let data = {states: topojson.feature(_geometry, _geometry.objects.states), counties: null};
					if (load_counties) {
						data["counties"] = topojson.feature(_geometry, _geometry.objects.counties);
					}
					storedGeometry = data;
					resolve(data);
				},
				error: function(error) {
					reject(error);
				},
			});
		}
	});
}

function getExtent(config, geometries) {
	if (config.extent.extent_type == "states") {
		const selected_states = geometries.states.features.filter(s => {
			return config.extent.extent_regions.indexOf(s.properties.name) >= 0
		});
		return {type: "FeatureCollection", features: selected_states};
	} else {
		return pointsToGeoJSON(config.node_locations);
	}
}

function pointsToGeoJSON(locations) {
	let geojson = {};
	geojson.type = "FeatureCollection";
	geojson.features = [];
	for (const loc_name in locations) {
		const loc = locations[loc_name];
		geojson.features.push({
			"type": "Feature",
			"properties": {},
			"geometry": {
				"type": "Point",
				"coordinates": [
					loc.long,
					loc.lat
				]
			}
		});
	}
	return geojson;
}

////////////////////////////
////////// Scales //////////
////////////////////////////

function getOverflowColorscale(data) {
	const maxValue = d3.max(data.flat());
	const overflow_thresh = 5;

	function _overflowColorscale(x) {
		if (x >= 0 && x <= overflow_thresh) {
			return "green";
		} else if (x > overflow_thresh) {
			return d3.scaleSequential(d3.interpolateReds).domain([overflow_thresh, maxValue])(x);
		} else {
			return null;
		}
	}

	const tickSize = maxValue / 100;
	_overflowColorscale.ticks = function() {
		return d3.range(0.0, maxValue+tickSize, tickSize)
	}
	_overflowColorscale.maxValue = maxValue;

	return _overflowColorscale;
}

function getLoadColorscale(data) {
	const maxValue = Math.min(4.0, d3.max(data.flat()));

	function _colorscale(x) {
		if (x >= 0 && x <= 1) {
			return "green";
		} else if (x > 1) {
			return d3.scaleSequential(d3.interpolateReds).domain([1-(0.5*maxValue), maxValue])(x);
		} else {
			return null;
		}
	}

	const tickSize = maxValue / 500;
	_colorscale.ticks = function() {
		return d3.range(0.0, maxValue+tickSize, tickSize)
	}
	_colorscale.maxValue = maxValue;

	return _colorscale;
}

function getLinkWidthScale(links) {
	const linksNull = (links == null);
	const m = linksNull ? 1 : d3.max(links.flat(), l => l.weight);
	const z = 0, r1 = 1.05, r2 = 8.5, r3 = 3.0, r4 = -0.06;
	const q = 10.0;
	function _sizeScale(w) {
		if (linksNull || w <= z) {
			return 0.0;
		} else {
			w = w / m;
			w = (r1 / (1 + Math.exp((-r2 * w) + r3))) - r4;
			return w * q;
		}
	}
	return _sizeScale;
}

function getNodeSizeScale(beds, colorRegions) {
	const r = 1.0 / 1.8;
	const n = beds.length;
	const q = 10.0 * n;

	let ys = beds;
	ys = ys.map(y => Math.pow(y, r));

	const s = d3.sum(ys);
	ys = ys.map(y => y * q / s);
	ys = ys.map(y => Math.max(Math.min(y, 40), 2));

	function _sizeScale(i) {
		if (colorRegions) {
			return 4;
		} else {
			return ys[i];
		}
	}

	return _sizeScale;
}
