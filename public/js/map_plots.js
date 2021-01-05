const mapHeight = 500;
const mapWidth  = 1000;

const mapPlotMargin = ({top: 25, right:  0, bottom:  0, left:  0});
const mapPadding    = ({top: 20, right: 20, bottom: 20, left: 20});
const mapMargin     = ({top: 25, right: 20, bottom: 10, left: 10});

const stackHorizontal = true;

const styleID = "flixpar/ckix2q40h5dur19p54z64ts67";
const accessToken = "pk.eyJ1IjoiZmxpeHBhciIsImEiOiJja2kyN2l5dHIxanF0MnNrYjltZXNzbDJyIn0._W2ABd-tjVMdDqncb9ny9A";

const pointSizeUniform = true;
const pointSizeMult = 0.75;
const thicknessMult = 0.5;

const mapPlotFont = "sans-serif";

const mapAnimationFrameTime = 1000;
const mapAnimationDelayTime = 2000;

const debugMap = false;

let mapPlotIntervals = [];

let storedGeometry = null;

import {overflowmapDescription} from "./figure_text.js";
import {generateFigureDownloadButtons} from "./patients_common.js";


export function createMap(rawdata, metric, transfers="both", add_description=true) {
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
		plotTitle = "COVID Patient Occupancy";
		colorbarLabel = "Normalized Occupancy";
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
		plotTitle = "Required Additional COVID Beds";
		colorbarLabel = "Number of Additional Beds";
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
		descriptionElem.className = "caption";
		descriptionElem.innerHTML = description;
		section.appendChild(descriptionElem);
	}

	loadGeometry().then(geometry => {
		let fig;
		if (transfers == "both") {
			fig = makeGroupedChoropleth(dynamic, rawdata, data1, data2, links, colorscale, geometry, metric, plotTitle, colorbarLabel);
		} else if (transfers == "no_transfers") {
			plotTitle += " (Without Optimal Transfers)";
			fig = makeSingleChoropleth(dynamic, rawdata, data1, links, colorscale, geometry, metric+"_notransfers", plotTitle, colorbarLabel);
		} else if (transfers == "transfers") {
			plotTitle += " (With Optimal Transfers)";
			fig = makeSingleChoropleth(dynamic, rawdata, data2, links, colorscale, geometry, metric+"_transfers", plotTitle, colorbarLabel);
		}
		figContainer.appendChild(fig);
		generateFigureDownloadButtons(fig, "hospitals-map");
	});
}

////////////////////////////
////// Plot Components /////
////////////////////////////

function makeGroupedChoropleth(make_dynamic, rawdata, data1, data2, links, colorscale, geometries, metric_name, plot_title, colorbar_label) {
	let svg = d3.create("svg").attr("viewBox", [0, 0, mapWidth, mapHeight]);

	let plotWidth, plotHeight;
	let g1, g2, g3;
	let labelPosition;
	if (stackHorizontal) {
		plotWidth = 0.45 * mapWidth;
		plotHeight = mapHeight - mapPlotMargin.top - mapPlotMargin.bottom;

		g1 = svg.append("g").attr("transform", `translate(${mapPlotMargin.left}, ${mapPlotMargin.top})`);
		g2 = svg.append("g").attr("transform", `translate(${mapPlotMargin.left + plotWidth}, ${mapPlotMargin.top})`);
		g3 = svg.append("g").attr("transform", `translate(${mapPlotMargin.left + 2*plotWidth}, ${mapPlotMargin.top})`);

		labelPosition = "top";
	} else {
		plotWidth = 0.9 * mapWidth;
		plotHeight = 0.5 * (mapHeight - mapPlotMargin.top - mapPlotMargin.bottom);

		g1 = svg.append("g").attr("transform", `translate(${mapPlotMargin.left + 10}, ${mapPlotMargin.top - 15})`);
		g2 = svg.append("g").attr("transform", `translate(${mapPlotMargin.left + 10}, ${mapPlotMargin.top - 15 + plotHeight})`);
		g3 = svg.append("g").attr("transform", `translate(${mapPlotMargin.left + 10 + plotWidth}, ${mapPlotMargin.top})`);

		labelPosition = "left";
	}

	g1 = makeMap(g1, svg, rawdata, data1, null, colorscale, geometries, plotWidth, plotHeight, metric_name+"_notransfers", make_dynamic, "(Without Optimal Transfers)", labelPosition);
	g2 = makeMap(g2, svg, rawdata, data2, links, colorscale, geometries, plotWidth, plotHeight, metric_name+"_transfers", make_dynamic, "(With Optimal Transfers)", labelPosition);
	g3 = makeColorbar(g3, colorscale, colorbar_label);

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
		.text(plot_title);

	return svg.node();
}

function makeSingleChoropleth(make_dynamic, rawdata, data1, links, colorscale, geometries, metric_name, plot_title, colorbarLabel) {
	let svg = d3.create("svg").attr("viewBox", [0, 0, mapWidth, mapHeight]);

	const plotWidth = 0.9 * mapWidth;
	const plotHeight = mapHeight - mapPlotMargin.top - mapPlotMargin.bottom;

	let g1 = svg.append("g").attr("transform", `translate(${mapPlotMargin.left}, ${mapPlotMargin.top})`);
	let g2 = svg.append("g").attr("transform", `translate(${mapPlotMargin.left + plotWidth}, ${mapPlotMargin.top})`);

	g1 = makeMap(g1, svg, rawdata, data1, links, colorscale, geometries, plotWidth, plotHeight, metric_name, make_dynamic, plot_title);
	g2 = makeColorbar(g2, colorscale, colorbarLabel);

	return svg.node();
}

function makeColorbar(svg, colorscale, colorbarLabel=null) {
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
		.data(colorscale.ticks())
		.join("stop")
		.attr("offset", d => d / colorscale.maxValue)
		.attr("stop-color", d => colorscale(d));
	const colorbarScale = d3.scaleLinear()
		.domain([0, colorscale.maxValue])
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
		.call(g => g.select(".domain").remove())
		.call(g => g.selectAll(".tick line").attr("stroke", "#4a4a4a"))
		.call(g => g.selectAll(".tick text").attr("fill", "#4a4a4a"));
	svg.append("g").call(colorAxis);

	if (colorbarLabel != null) {
		svg.append("text")
			.attr("text-anchor", "middle")
			.attr("transform", `rotate(90) translate(${mapHeight/2},-65)`)
			.style("font-family", mapPlotFont)
			.style("font-size", "13px")
			.text(colorbarLabel);
	}

	return svg;
}

////////////////////////////
///////// Plot Maps ////////
////////////////////////////

function makeMap(svg, globalSVG, rawdata, data, links, colorscale, geometries, plotWidth, plotHeight, metric_name, dynamic=true, title=null, titlePosition="top") {

	if (dynamic) {
		while (mapPlotIntervals.length != 0) {
			let interval = mapPlotIntervals.pop();
			interval.stop();
		}
	}

	const colorRegions = false;

	const dates = rawdata.config.dates.map(d => new Date(Date.parse(d)))
	const T = dates.length;

	const tooltip = new MapTooltip(svg, globalSVG, rawdata, metric_name);

	const selected_extent = getExtent(rawdata.config, geometries);
	let map_projection = d3.geoMercator().fitExtent(
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

	const tile = d3.tile()
		.scale(map_projection.scale() * 2 * Math.PI)
		.translate(map_projection([0, 0]).map(Math.round))
		.extent([
			[mapMargin.left, mapMargin.top],
			[plotWidth-mapMargin.right, plotHeight-mapMargin.bottom]
		])
		.clamp(true);
	const tiles = tile();

	const randomID = Math.random().toString(36).substring(7);
	const clipId = "clip-rect-def" + "-" + randomID;
	const clipRectId = "clip-rect" + "-" + randomID;

	svg.append("defs")
		.append("clipPath")
		.attr("id", clipId)
		.append("rect")
		.attr("id", clipRectId)
		.attr("x", mapMargin.left)
		.attr("y", mapMargin.top)
		.attr("width", plotWidth-mapMargin.right)
		.attr("height", plotHeight-mapMargin.bottom)
		.attr("fill", "none");

	svg.append("use")
		.attr("xlink:href", `#${clipRectId}`)
		.attr("y", 0)
		.attr("x", 0);

	const mapURL = (x, y, z) => `https://api.mapbox.com/styles/v1/${styleID}/tiles/${z}/${x}/${y}@2x?access_token=${accessToken}`

	svg.append("g")
		.attr("pointer-events", "none")
		.selectAll("image")
		.data(tiles, d => d).join("image")
			.attr("xlink:href", d => mapURL(...d3.tileWrap(d)))
			.attr("x", ([x]) => (x + tiles.translate[0]) * tiles.scale)
			.attr("y", ([, y]) => (y + tiles.translate[1]) * tiles.scale)
			.attr("width", tiles.scale)
			.attr("height", tiles.scale)
			.attr("clip-path", `url(#${clipId})`);

	const C = rawdata.capacity[0].length;

	const linkWidthScale = getLinkWidthScale(links);
	const nodeSizeScale  = getNodeSizeScale(rawdata.capacity.map(c => c[C-1]), colorRegions);

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

	let pts = svg.selectAll("points")
		.data(rawdata.config.node_names)
		.enter().append("path")
		.attr("fill", d => {
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
		.attr("stroke", "white")
		.attr("stroke-width", "0.5px")
		.attr("opacity", 0.95)
		.style("transform-box", "fill-box")
		.attr("d", (d,i) => {
			const l = rawdata.config.node_locations[d];
			const r = nodeSizeScale(i) * pointSizeMult;
			const _p = p.pointRadius(r);
			return _p({type: "Point", coordinates: [l.long, l.lat]});
		})
		.on("mouseover", (e,d) => tooltip.show(e,d))
		.on("mouseout",  (e,d) => tooltip.hide(e,d));

	if (title != null) {
		if (titlePosition == "top") {
			svg.append("text")
				.attr("x", plotWidth/2)
				.attr("y", 20)
				.attr("text-anchor", "middle")
				.style("font-family", mapPlotFont)
				.style("font-size", "16px")
				.text(title);
		} else if (titlePosition == "left") {
			svg.append("text")
				.attr("transform", `translate(4,${plotHeight/2}) rotate(-90)`)
				.attr("text-anchor", "middle")
				.style("font-family", mapPlotFont)
				.style("font-size", "16px")
				.text(title);
		}
	}

	// date background
	svg.append("rect")
		.attr("id", "date-background")
		.attr("x", (plotWidth/2) - 70)
		.attr("y", 24)
		.attr("width", 140)
		.attr("height", 20)
		.attr("rx", 5).attr("ry", 5)
		.attr("fill", "white")
		.attr("opacity", 0.65)
		.attr("stroke", "none");

	// setup arrow
	const markerBoxWidth = 2
	const markerBoxHeight = 2.8
	const refX = markerBoxWidth + 0.2
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
		.attr("fill", "#525252");

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
			.style("stroke-width", d => linkWidthScale(d.weight) * thicknessMult)
			.attr("stroke-linecap", "butt")
			.attr("marker-end", "url(#arrow)");
	}

	function animate(t) {
		tooltip.update(t);

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
			pts.attr("fill", (d,i) => colorscale(data[i][t]));
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
				.attr("opacity", 0.65)
				.style("stroke-width", d => linkWidthScale(d.weight) * thicknessMult)
				.attr("stroke-linecap", "butt")
				.attr("marker-end", "url(#arrow)");
		}
	}

	if (dynamic) {
		const mapAnimationTime = mapAnimationFrameTime * T;

		const delay = d3.scaleTime()
			.domain([dates[0], dates[T-1]])
			.range([0, mapAnimationTime]);

		for (const i of d3.range(T)) {
			d3.timeout(() => {
				animate(i);
				let interval = d3.interval(() => {
					animate(i);
				}, mapAnimationTime + mapAnimationDelayTime);
				mapPlotIntervals.push(interval);
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

	tooltip.build();

	return svg.node();
}

////////////////////////////
///////// Tooltip //////////
////////////////////////////

class MapTooltip {
	constructor(svg, globalSVG, response, metric_name) {
		this.svg = globalSVG;
		this.response = response;
		this.metric_name = metric_name;
		this.highlight = null;
		this.current_t = 0;
		this.current_loc = 0;

		let tmpSVG = d3.create("svg");
		let tooltipContainer = tmpSVG.append("g")
			.attr("transform", svg.node().getAttribute("transform"));

		let tooltipNode = tooltipContainer.append("g")
			// .attr("transform", svg.node().getAttribute("transform"))
			.attr("pointer-events", "none")
			.attr("display", "none")
			.attr("font-family", "monospace")
			.attr("font-size", 12)
			.attr("text-anchor", "middle");

		this.bubble = tooltipNode.append("rect")
			.attr("x", -60)
			.attr("y", 8)
			.attr("width", 120)
			.attr("height", 56)
			.attr("fill", "white")
			.attr("stroke", "gray")
			.attr("stroke-width", 1.5);
		this.topTab = tooltipNode.append("rect")
			.attr("transform", "translate(0, 2) rotate(45)")
			.attr("width", 12)
			.attr("height", 12)
			.attr("fill", "white")
			.attr("stroke", "gray")
			.attr("stroke-width", 1.0);
		this.bottomTab = tooltipNode.append("rect")
			.attr("transform", "translate(0, 35) rotate(45)")
			.attr("width", 12)
			.attr("height", 12)
			.attr("fill", "white")
			.attr("stroke", "gray")
			.attr("stroke-width", 1.0);
		this.bubbleBackground = tooltipNode.append("rect")
			.attr("x", -60)
			.attr("y", 8)
			.attr("width", 120)
			.attr("height", 56)
			.attr("fill", "white");

		this.tooltipNode = tooltipNode;

		this.textLine1 = tooltipNode.append("text").attr("y", 24).node();
		this.textLine2 = tooltipNode.append("text").attr("y", 40).node();
		this.textLine3 = tooltipNode.append("text").attr("y", 56).node();

		this.node = tooltipNode.node();
		this.tooltipContainer = tooltipContainer.node();
	}

	show(e,d) {
		this.node.removeAttribute("display");

		this.current_loc = this.response.config.node_names.indexOf(d);

		this.textLine1.textContent = d;
		this.textLine2.textContent = `Capacity: ${this.response.beds[this.current_loc].toFixed(0)}`;
		this.update(this.current_t);

		this.highlight = e.srcElement.cloneNode();
		this.highlight.setAttribute("fill", "none");
		this.highlight.setAttribute("stroke", "white");
		this.highlight.setAttribute("stroke-width", "2px");
		e.srcElement.parentElement.insertBefore(this.highlight, e.srcElement.nextSibling);

		const bbox = e.srcElement.getBBox();

		const xCenter = bbox.x + (bbox.width / 2);
		const yCenter = bbox.y + (bbox.height / 2);
		const yOffset = bbox.height / 2;

		const positionBottom = (yCenter+yOffset+40 <= mapHeight);

		if (positionBottom) {
			this.node.setAttribute("transform", `translate(${xCenter},${yCenter+yOffset})`);
			this.topTab.node().removeAttribute("display");
			this.bottomTab.node().setAttribute("display", "none");
		} else {
			this.node.setAttribute("transform", `translate(${xCenter},${yCenter-yOffset-45-10})`);
			this.topTab.node().setAttribute("display", "none");
			this.bottomTab.node().removeAttribute("display");
		}

		const maxTextLength = d3.max([this.textLine1, this.textLine2, this.textLine3].map(l => l.textContent.length));
		const labelWidth = maxTextLength * 12 * 0.6 + 20;
		if (labelWidth > 120) {
			this.bubble.attr("width", labelWidth);
			this.bubble.attr("x", -labelWidth/2);
			this.bubbleBackground.attr("width", labelWidth);
			this.bubbleBackground.attr("x", -labelWidth/2);
		}
	}

	hide(e,d) {
		if (this.highlight != null) {
			this.highlight.remove();
			this.highlight = null;
		}
		this.node.setAttribute("display", "none");
	}

	build() {
		this.svg.append(() => this.tooltipContainer);
	}

	update(t) {
		this.current_t = t;

		const locIdx = this.current_loc;
		const capacity = this.response.beds[locIdx];

		if (this.metric_name == "overflow_dynamic_notransfers") {
			const required_capacity = this.response.active_null[locIdx][this.current_t];
			this.textLine3.textContent = `Required Capacity: ${required_capacity.toFixed(0)}`;
		} else if (this.metric_name == "overflow_dynamic_transfers") {
			const required_capacity = this.response.active[locIdx][this.current_t];
			this.textLine3.textContent = `Required Capacity: ${required_capacity.toFixed(0)}`;
		} else if (this.metric_name == "load_notransfers") {
			const active = this.response.active_null[locIdx][this.current_t];
			const load = active / capacity;
			this.textLine3.textContent = `Occupancy: ${(load * 100).toFixed(0)}%`;
		} else if (this.metric_name == "load_transfers") {
			const active = this.response.active[locIdx][this.current_t];
			const load = active / capacity;
			this.textLine3.textContent = `Occupancy: ${(load * 100).toFixed(0)}%`;
		}
	}
}


////////////////////////////
/////// Extract Data ///////
////////////////////////////

function extractDataStatic(rawdata) {
	const N = rawdata.capacity.length;
	const C = rawdata.capacity[0].length;

	const max_load = d3.range(N).map(i => d3.max(rawdata.active[i]) / rawdata.capacity[i][C-1]);
	const max_load_null = d3.range(N).map(i => d3.max(rawdata.active_null[i]) / rawdata.capacity[i][C-1]);

	const mean_load = d3.range(N).map(i => d3.mean(rawdata.active[i]) / rawdata.capacity[i][C-1]);
	const mean_load_null = d3.range(N).map(i => d3.mean(rawdata.active_null[i]) / rawdata.capacity[i][C-1]);

	const median_load = d3.range(N).map(i => d3.median(rawdata.active[i]) / rawdata.capacity[i][C-1]);
	const median_load_null = d3.range(N).map(i => d3.median(rawdata.active_null[i]) / rawdata.capacity[i][C-1]);

	const overflow = d3.range(N).map(i => d3.sum(rawdata.active[i], x => Math.max(0,x-rawdata.capacity[i][C-1])));
	const overflow_null = d3.range(N).map(i => d3.sum(rawdata.active_null[i], x => Math.max(0,x-rawdata.capacity[i][C-1])));

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
	const N = rawdata.capacity.length;
	const T = rawdata.config.dates.length;
	const C = rawdata.capacity[0].length;

	let load_data = [];
	let load_null_data = [];
	let overflow_data = [];
	let overflow_null_data = [];

	for (let i = 0; i < N; i++) {
		load_data[i]      = d3.range(T).map(t => rawdata.active[i][t]      / rawdata.capacity[i][C-1]);
		load_null_data[i] = d3.range(T).map(t => rawdata.active_null[i][t] / rawdata.capacity[i][C-1]);
		overflow_data[i]      = d3.range(T).map(t => Math.max(0, rawdata.active[i][t]      - rawdata.capacity[i][C-1]));
		overflow_null_data[i] = d3.range(T).map(t => Math.max(0, rawdata.active_null[i][t] - rawdata.capacity[i][C-1]));
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
				success: function(geometry) {
					let data = {states: topojson.feature(geometry, geometry.objects.states), counties: null};
					if (load_counties) {
						data["counties"] = topojson.feature(geometry, geometry.objects.counties);
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
		if (loc.lat == 0 && loc.long == 0) {
			continue;
		}
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
	const overflow_thresh = 2;

	function overflowColorscale(x) {
		if (x >= 0 && x <= overflow_thresh) {
			return "green";
		} else if (x > overflow_thresh) {
			return d3.scaleSequential(d3.interpolateReds).domain([overflow_thresh-(maxValue/2), maxValue])(x);
		} else {
			return null;
		}
	}

	const tickSize = maxValue / 200;
	overflowColorscale.ticks = function() {
		return d3.range(0.0, maxValue+tickSize, tickSize)
	}
	overflowColorscale.maxValue = maxValue;

	return overflowColorscale;
}

function getLoadColorscale(data) {
	const maxValue = Math.min(4.0, d3.max(data.flat()));

	function colorscale(x) {
		if (x >= 0 && x <= 1) {
			return "green";
		} else if (x > 1) {
			return d3.scaleSequential(d3.interpolateReds).domain([1-(0.5*maxValue), maxValue])(x);
		} else {
			return null;
		}
	}

	const tickSize = maxValue / 500;
	colorscale.ticks = function() {
		return d3.range(0.0, maxValue+tickSize, tickSize)
	}
	colorscale.maxValue = maxValue;

	return colorscale;
}

function getLinkWidthScale(links) {
	const linksNull = (links == null);
	const m = linksNull ? 1 : d3.max(links.flat(), l => l.weight);
	const z = 0, r1 = 1.05, r2 = 8.5, r3 = 3.0, r4 = -0.06;
	const q = 10.0;
	function sizeScale(w) {
		if (linksNull || w <= z) {
			return 0.0;
		} else {
			w = w / m;
			w = (r1 / (1 + Math.exp((-r2 * w) + r3))) - r4;
			return w * q;
		}
	}
	return sizeScale;
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

	function sizeScale(i) {
		if (colorRegions || pointSizeUniform) {
			return 6;
		} else {
			return ys[i];
		}
	}

	return sizeScale;
}
