const mapHeight = 500;
const mapWidth  = 1000;

const mapPlotMargin = ({top: 0, right:  0, bottom:  0, left:  0});
const mapPadding    = ({top: 30, right: 20, bottom: 20, left: 20});
const mapMargin     = ({top: 25, right: 20, bottom: 10, left: 5});

const stackHorizontal = true;

const styleID = "flixpar/ckjny4kzy3alx19o4bi0von7c";
const accessToken = "pk.eyJ1IjoiZmxpeHBhciIsImEiOiJja2kyN2l5dHIxanF0MnNrYjltZXNzbDJyIn0._W2ABd-tjVMdDqncb9ny9A";

const pointSizeUniform = true;
const pointSizeMult = 0.75;
const thicknessMult = 0.5;

const showAmbulance = true;
const moveAmbulance = true;

const mapPlotFont = "sans-serif";

const mapAnimationFrameTime = 1000;
const mapAnimationDelayTime = 2000;

const debugMap = false;

let storedGeometry = null;

import {overflowmapDescription} from "./figure_text.js";
import {generateFigureDownloadButtons} from "./patients_common.js";
import {getDateIntervals} from "./loadplots.js";


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

	svg = makeTimeline(svg, rawdata);

	if (make_dynamic) {
		setupMapAnimations(svg, rawdata);
	}
	svg.node().dispatchEvent(new Event("buildTooltips"));

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

	svg = makeTimeline(svg, rawdata);

	if (make_dynamic) {
		setupMapAnimations(svg, rawdata);
	}
	svg.node().dispatchEvent(new Event("buildTooltips"));

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

function makeTimeline(svg, response) {
	let viewBox = svg.attr("viewBox").split(",").map(z => parseFloat(z));

	const timelineHeight = 50;

	Date.prototype.addDays = function(days) {
		let date = new Date(this.valueOf());
		date.setDate(date.getDate() + days);
		return date;
	}

	let dates = response.config.dates.map(d => new Date(Date.parse(d)));
	dates.shift();
	dates.push(dates[dates.length-1].addDays(1));
	dates.shift();
	dates.push(dates[dates.length-1].addDays(1));
	const T = dates.length;

	const xInterval = getDateIntervals(dates);
	const dateFormat = "%m/%d/%y";

	const xScale = d3.scaleUtc()
		.domain(d3.extent(dates))
		.range([mapMargin.left + 30, mapMargin.left + (0.88*mapWidth)]);

	const xAxis = g => g
		.attr("transform", `translate(0, ${viewBox[3]+20})`)
		.call(d3.axisBottom(xScale)
			.ticks(d3.utcDay.every(1))
			.tickSize(15)
			.tickFormat("")
		)
		.call(g => g.select(".domain").remove())
		.call(g => g.selectAll(".tick line")
			.attr("stroke-width", 1.0)
			.attr("stroke-opacity", 0.65)
			.attr("stroke", "black")
		);

	const xAxisLabels = g => g
		.attr("transform", `translate(0, ${viewBox[3]+20})`)
		.style("font-family", "monospace")
		.style("font-size", "11px")
		.call(d3.axisBottom(xScale)
			.ticks(xInterval)
			.tickSize(15)
			.tickFormat(d3.timeFormat(dateFormat))
		)
		.call(g => g.select(".domain").remove())
		.call(g => g.selectAll(".tick line")
			.attr("stroke-width", 1.0)
			.attr("stroke-opacity", 1.0)
			.attr("stroke", "black")
		)
		.call(g => g.selectAll(".tick text")
			.attr("dy", "10px")
			.attr("fill", "black")
		);

	svg.append("g").call(xAxis);
	svg.append("g").call(xAxisLabels);

	const buttonPadding = 4;
	let buttonBackground = svg.append("rect")
		.attr("transform", `translate(${mapMargin.left}, ${viewBox[3]+20})`)
		.attr("x", 0)
		.attr("y", -buttonPadding)
		.attr("width", 12 + (2*buttonPadding))
		.attr("height", 15 + (2*buttonPadding))
		.attr("rx", 4)
		.attr("fill", "#ebebeb")
		.attr("stroke", "none");

	let playButton = svg.append("polygon")
		.attr("transform", `translate(${mapMargin.left+buttonPadding}, ${viewBox[3]+20})`)
		.attr("fill", "black")
		.attr("stroke", "none")
		.attr("cursor", "pointer")
		.attr("visibility", "hidden")
		.attr("points", "0,0 0,15 11,7.5");

	let pauseButton = svg.append("g")
		.attr("transform", `translate(${mapMargin.left+buttonPadding}, ${viewBox[3]+20})`)
		.attr("fill", "black")
		.attr("stroke", "none");
	pauseButton
		.append("rect")
		.attr("width", "3")
		.attr("height", "15");
	pauseButton
		.append("rect")
		.attr("x", "8")
		.attr("width", "3")
		.attr("height", "15");
	pauseButton
		.append("rect")
		.attr("fill-opacity", "0%")
		.attr("width", "12")
		.attr("height", "15")
		.attr("cursor", "pointer");

	pauseButton.on("click", e => {
		pauseButton.attr("visibility", "hidden");
		playButton.attr("visibility", "visible");
		svg.node().dispatchEvent(new Event("pauseMap"));
	});
	playButton.on("click", e => {
		playButton.attr("visibility", "hidden");
		pauseButton.attr("visibility", "visible");
		svg.node().dispatchEvent(new Event("playMap"));
	});

	let line = svg.append("line")
		.attr("transform", `translate(${xScale(dates[0])})`)
		.attr("y1", viewBox[3]+20)
		.attr("y2", viewBox[3]+20+15)
		.attr("stroke", "red")
		.attr("stroke-width", 1.5);

	function animate(e) {
		const t = e.detail.t;
		if (t == 0) {
			line.attr("transform", `translate(${xScale(dates[t])})`);
		} else {
			line.transition()
				.duration(mapAnimationFrameTime)
				.ease(d3.easeLinear)
				.attr("transform", `translate(${xScale(dates[t])})`);
		}
	}
	svg.node().addEventListener("updateMap", animate);

	let hoverLineComponent = svg.append("g")
		.attr("transform", `translate(${xScale(dates[0])})`)
		.attr("visibility", "hidden");
	let hoverLine = hoverLineComponent.append("line")
		.attr("y1", viewBox[3]+20)
		.attr("y2", viewBox[3]+20+15)
		.attr("stroke", "red")
		.attr("stroke-width", 1)
		.attr("stroke-opacity", 0.7);
	let hoverLineText = hoverLineComponent.append("text")
		.attr("y", viewBox[3]+20+11)
		.attr("fill", "red")
		.attr("dx", "12px")
		.style("font-family", "monospace")
		.style("font-size", "11px")
		.text("");

	let xAxisArea = svg.append("rect")
		.attr("x", xScale(dates[0]))
		.attr("y", viewBox[3]+20)
		.attr("width", xScale(dates[T-1]) - xScale(dates[0]))
		.attr("height", 32)
		.attr("fill", "black")
		.attr("fill-opacity", 0)
		.attr("stroke", "none");

	xAxisArea.on("mouseover", () => hoverLineComponent.attr("visibility", "visible"));
	xAxisArea.on("mouseleave", () => hoverLineComponent.attr("visibility", "hidden"));
	xAxisArea.on("mousemove", e => {
		const scaleFactor = mapWidth / svg.node().clientWidth;
		const xPos = e.layerX * scaleFactor;
		const date = xScale.invert(xPos).addDays(-1);
		hoverLineText.text(date.toISOString().slice(0,10));
		hoverLineComponent.attr("transform", `translate(${xPos})`);
	});

	viewBox[3] += timelineHeight;
	svg.attr("viewBox", viewBox);

	return svg;
}

////////////////////////////
///////// Plot Maps ////////
////////////////////////////

function makeMap(svg, globalSVG, rawdata, data, links, colorscale, geometries, plotWidth, plotHeight, metric_name, dynamic=true, title=null, titlePosition="top") {

	const colorRegions = false;

	const dates = rawdata.config.dates.map(d => new Date(Date.parse(d)))
	const T = dates.length;

	const edgeTooltip = new MapEdgeTooltip(svg, globalSVG, rawdata);
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

	let pts = svg.append("g")
		.attr("id", "map-points")
		.selectAll("points")
		.data(rawdata.config.node_names)
		.enter().append("path")
		.attr("class", "map-point")
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
		});

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

	const ambulancePathStr = "M624 352h-16V243.9c0-12.7-5.1-24.9-14.1-33.9L494 110.1c-9-9-21.2-14.1-33.9-14.1H416V48c0-26.5-21.5-48-48-48H48C21.5 0 0 21.5 0 48v320c0 26.5 21.5 48 48 48h16c0 53 43 96 96 96s96-43 96-96h128c0 53 43 96 96 96s96-43 96-96h48c8.8 0 16-7.2 16-16v-32c0-8.8-7.2-16-16-16zM160 464c-26.5 0-48-21.5-48-48s21.5-48 48-48 48 21.5 48 48-21.5 48-48 48zm144-248c0 4.4-3.6 8-8 8h-56v56c0 4.4-3.6 8-8 8h-48c-4.4 0-8-3.6-8-8v-56h-56c-4.4 0-8-3.6-8-8v-48c0-4.4 3.6-8 8-8h56v-56c0-4.4 3.6-8 8-8h48c4.4 0 8 3.6 8 8v56h56c4.4 0 8 3.6 8 8v48zm176 248c-26.5 0-48-21.5-48-48s21.5-48 48-48 48 21.5 48 48-21.5 48-48 48zm80-208H416V144h44.1l99.9 99.9V256z";

	function animate(e) {
		const t = e.detail.t;

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
			pts.attr("fill", (d, i) => colorscale(data[i][t]))
				.transition()
					.duration(mapAnimationFrameTime)
					.ease(d3.easeLinear)
					.attr("fill", (d, i) => colorscale(data[i][Math.min(t+1,T-1)]));
		}

		svg.selectAll("#date-label").remove();
		const dateString = dates[t].toISOString().split("T")[0];
		svg.append("text")
			.attr("id", "date-label")
			.attr("x", plotWidth/2)
			.attr("y", 40)
			.attr("text-anchor", "middle")
			.style("font-size", 15)
			.style("font-family", mapPlotFont)
			.text("Date: " + dateString);

		if (links != null) {
			svg.selectAll(".map-edges").remove();
			svg.append("g")
				.attr("class", "map-edges")
				.selectAll("edges")
				.data(links[t])
				.enter()
				.append("path")
				.attr("class", "map-edge")
				.attr("d", d => p(d))
				.attr("fill", "none")
				.attr("stroke", linkColor)
				.attr("opacity", 0.65)
				.attr("stroke-width", d => linkWidthScale(d.weight) * thicknessMult)
				.attr("stroke-linecap", "butt")
				.attr("marker-end", "url(#arrow)");

			edgeTooltip.update();

			if (showAmbulance) {
				svg.selectAll(".map-edges-amb").remove();
				svg.append("g")
					.attr("class", "map-edges-amb")
					.selectAll("edges")
					.data(links[t])
					.enter()
					.append("path")
					.attr("class", "edge-amb")
					.style("transform-box", "fill-box")
					.attr("transform", d => {
						const ptA = p.centroid({type: "Point", coordinates: [d.coordinates[0][0], d.coordinates[0][1]]});
						const ptB = p.centroid({type: "Point", coordinates: [d.coordinates[1][0], d.coordinates[1][1]]});
						const pt = [(ptA[0]+ptB[0])/2, (ptA[1]+ptB[1])/2];

						const scale = 0.005 * linkWidthScale(d.weight) * thicknessMult;
						const angle = Math.atan2(ptB[1]-ptA[1], ptB[0]-ptA[0]) * (180 / Math.PI);

						return `translate(${pt[0]}, ${pt[1]}) rotate(${angle}) scale(${scale}) translate(0,-256)`;
					})
					.attr("fill", "darkred")
					.attr("stroke", "none")
					.attr("d", ambulancePathStr);

				if (moveAmbulance) {
					const sR = 0.2;
					const eR = 0.7;
					svg.selectAll(".edge-amb")
						.attr("transform", d => {
							const ptA = p.centroid({type: "Point", coordinates: [d.coordinates[0][0], d.coordinates[0][1]]});
							const ptB = p.centroid({type: "Point", coordinates: [d.coordinates[1][0], d.coordinates[1][1]]});
							const pt = [((1-sR)*ptA[0])+(sR*ptB[0]), ((1-sR)*ptA[1])+(sR*ptB[1])];

							const scale = 0.005 * linkWidthScale(d.weight) * thicknessMult;
							const angle = Math.atan2(ptB[1]-ptA[1], ptB[0]-ptA[0]) * (180 / Math.PI);

							return `translate(${pt[0]}, ${pt[1]}) rotate(${angle}) scale(${scale}) translate(0,-256)`;
						})
						.transition()
							.duration(mapAnimationFrameTime)
							.ease(d3.easeLinear)
							.attr("transform", d => {
								const ptA = p.centroid({type: "Point", coordinates: [d.coordinates[0][0], d.coordinates[0][1]]});
								const ptB = p.centroid({type: "Point", coordinates: [d.coordinates[1][0], d.coordinates[1][1]]});
								const pt = [((1-eR)*ptA[0])+(eR*ptB[0]), ((1-eR)*ptA[1])+(eR*ptB[1])];

								const scale = 0.005 * linkWidthScale(d.weight) * thicknessMult;
								const angle = Math.atan2(ptB[1]-ptA[1], ptB[0]-ptA[0]) * (180 / Math.PI);

								return `translate(${pt[0]}, ${pt[1]}) rotate(${angle}) scale(${scale}) translate(0,-256)`;
							});
				}
			}
		}
	}
	globalSVG.node().addEventListener("updateMap", animate);

	return svg.node();
}

function setupMapAnimations(svg, response) {
	const dates = response.config.dates.map(d => new Date(Date.parse(d)));
	const T = dates.length;

	svg.attr("anim-state", "play");
	svg.attr("timestep", 0);

	function executeTimestep(t) {
		if (svg.attr("anim-state") == "play") {
			svg.attr("timestep", t);
			svg.node().dispatchEvent(new CustomEvent("updateMap", {detail: {t: t}}));

			const stepTime = (t != T-1) ? mapAnimationFrameTime : mapAnimationDelayTime;
			const next_t = (t != T-1) ? t+1 : 0;
			d3.timeout(() => executeTimestep(next_t), stepTime);
		}
	}

	svg.node().addEventListener("pauseMap", e => {
		svg.attr("anim-state", "paused");
		svg.selectAll("*").interrupt();
	});
	svg.node().addEventListener("playMap", e => {
		if (svg.attr("anim-state") == "paused") {
			svg.attr("anim-state", "play");
			executeTimestep(parseInt(svg.attr("timestep")));
		}
	});

	executeTimestep(0);
}

////////////////////////////
///////// Tooltip //////////
////////////////////////////

class MapTooltip {
	constructor(svg, globalSVG, response, metric_name) {
		this.svg = svg;
		this.globalSVG = globalSVG;
		this.response = response;
		this.metric_name = metric_name;
		this.highlight = null;
		this.current_t = 0;
		this.current_loc = 0;

		let tmpSVG = d3.create("svg");
		let tooltipContainer = tmpSVG.append("g")
			.attr("transform", svg.node().getAttribute("transform"));

		let tooltipNode = tooltipContainer.append("g")
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

		globalSVG.node().addEventListener("buildTooltips", () => this.build());

		globalSVG.node().addEventListener("updateMap", e => {
			const t = e.detail.t;
			this.update(t);
		});
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
		this.highlight.setAttribute("transform", "");
		e.srcElement.parentElement.insertBefore(this.highlight, e.srcElement);

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
		this.globalSVG.append(() => this.tooltipContainer);

		this.pointsContainer = this.svg.node().cloneNode(false);
		this.pointsContainer.id = "map-point-listeners-container";
		this.globalSVG.append(() => this.pointsContainer);

		let thisObj = this;     
		this.points = this.svg
			.selectAll(".map-point")
			.select(function() {
				return thisObj.pointsContainer.appendChild(this.cloneNode(true));
			})
			.attr("class", "map-point-listener")
			.attr("stroke", "none")
			.attr("fill", "black")
			.attr("fill-opacity", 0)
			.attr("transform-origin", "center")
			.attr("transform", "scale(2.5)")
			.on("mouseover", (e, d) => this.show(e, d))
			.on("mouseleave", (e, d) => this.hide(e, d));
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

class MapEdgeTooltip {
	constructor(svg, globalSVG, response) {
		this.svg = svg;
		this.globalSVG = globalSVG;
		this.response = response;

		let tmpSVG = d3.create("svg");
		let tooltipContainer = tmpSVG.append("g").attr("transform", svg.node().getAttribute("transform"));

		let tooltipNode = tooltipContainer.append("g")
			.attr("pointer-events", "none")
			.attr("display", "none")
			.attr("font-family", "monospace")
			.attr("font-size", 12)
			.attr("text-anchor", "middle");

		this.bubble = tooltipNode.append("rect")
			.attr("x", -60)
			.attr("y", 8)
			.attr("width", 120)
			.attr("height", 40)
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
			.attr("height", 40)
			.attr("fill", "white");

		this.tooltipNode = tooltipNode;

		this.textLine1 = tooltipNode.append("text").attr("y", 24).node();
		this.textLine2 = tooltipNode.append("text").attr("y", 40).node();

		this.node = tooltipNode.node();
		this.tooltipContainer = tooltipContainer.node();

		this.edgesContainer = null;

		globalSVG.node().addEventListener("buildTooltips", () => this.build());
		// globalSVG.node().addEventListener("updateMap", () => this.update());
	}

	show(e,d) {
		this.node.removeAttribute("display");

		this.textLine1.textContent = `${d.nameA} → ${d.nameB}`;
		this.textLine2.textContent = `Transfers: ${d.weight.toFixed(2)}`;

		const bbox = e.srcElement.getBBox();
		const xCenter = bbox.x + (bbox.width / 2);
		const yCenter = bbox.y + (bbox.height / 2);
		const yOffset = 0;

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

		const maxTextLength = d3.max([this.textLine1, this.textLine2].map(l => l.textContent.length));
		const labelWidth = maxTextLength * 12 * 0.6 + 20;
		if (labelWidth > 120) {
			this.bubble.attr("width", labelWidth);
			this.bubble.attr("x", -labelWidth/2);
			this.bubbleBackground.attr("width", labelWidth);
			this.bubbleBackground.attr("x", -labelWidth/2);
		}
	}

	hide(e,d) {
		this.node.setAttribute("display", "none");
	}

	build() {
		this.globalSVG.append(() => this.tooltipContainer);

		this.edgesContainer = this.svg.node().cloneNode(false);
		this.edgesContainer.id = "map-edges-listeners-container";
		this.globalSVG.append(() => this.edgesContainer);
	}

	update() {
		let edgesContainer = this.edgesContainer;
		if (this.edgesContainer != null) {
			this.edgesContainer.querySelectorAll(".map-edge-listener").forEach(e => e.remove());
			this.svg
				.selectAll(".map-edge")
				.select(function() {
					return edgesContainer.appendChild(this.cloneNode(true));
				})
				.attr("class", "map-edge-listener")
				.attr("stroke", "red")
				.attr("stroke-width", 10)
				.attr("stroke-opacity", 0.0)
				.attr("marker-end", "")
				.on("mouseover", (e, d) => this.show(e, d))
				.on("mouseleave", (e, d) => this.hide(e, d));
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
				let link = {
					type: "LineString",
					coordinates: [[p1.long, p1.lat], [p2.long, p2.lat]],
					weight: v,
					nameA: s1,
					nameB: s2,
				};
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
