import {createSelect} from "./common.js";
import {generateFigureDownloadButtons} from "./figure_downloads.js";
export {createRegionChoropleth};


function createRegionChoropleth(regionType, response) {
	const mapId = `map-${regionType}`;

	let choropleth;
	if (regionType == "hrr") {
		choropleth = hrrChoropleth(response);
	} else if (regionType == "hsa") {
		choropleth = hsaChoropleth(response);
	} else if (regionType == "state") {
		choropleth = stateChoropleth(response);
	}

	choropleth.then(figContainer => {
		if (document.getElementById(mapId) == null) {
			document.getElementById(`maparea-${regionType}`).appendChild(figContainer);
		} else {
			document.getElementById(mapId).replaceWith(figContainer);
		}
		figContainer.id = mapId;

		let fig = figContainer.firstChild;
		let buttonsContainer = generateFigureDownloadButtons(fig, `regionchoropleth-${regionType}`);
		buttonsContainer.style.marginBottom = "0";
	});
}

function stateChoropleth(response) {
	return fetch("/json/state_boundaries.json").then(q => q.json()).then(stateGeo => {
		const stateGeoFeatures = topojson.feature(stateGeo, stateGeo.objects.states).features;

		function genFigure(metric) {
			let overflowLookup = new Map(response.map(r => [r.region_name, r[metric]]));
			let valueLookup = (d) => {
				if (overflowLookup.has(d.properties.name)) {
					return overflowLookup.get(d.properties.name);
				} else {
					return 0;
				}
			};
			const nameLookup = (d) => d.properties.name;

			return generateChoropleth(stateGeoFeatures, nameLookup, valueLookup, metric);
		}

		let fig = genFigure("overflow_total_pct");
		let figOptions = createRegionChoroplethOptions(fig, genFigure);

		let figWrapper = document.createElement("div");
		figWrapper.appendChild(fig);
		figWrapper.appendChild(figOptions);

		fig.id = "state-choropleth";

		return figWrapper;
	});
}

function hrrChoropleth(response) {
	return fetch("/json/hrr_boundaries.json").then(q => q.json()).then(hrrGeo => {
		const hrrGeoFeatures = topojson.feature(hrrGeo, hrrGeo.objects.Hrr98Bdry_AK_HI_unmodified).features;

		function genFigure(metric) {
			const overflowLookup = new Map(response.map(r => [parseInt(r.region_id), r[metric]]));
			const valueLookup = (d) => overflowLookup.get(d.properties.hrrnum);
			const nameLookup = (d) => d.properties.HRR_lbl;
	
			return generateChoropleth(hrrGeoFeatures, nameLookup, valueLookup, metric);
		}

		let fig = genFigure("overflow_total_pct");
		let figOptions = createRegionChoroplethOptions(fig, genFigure);

		let figWrapper = document.createElement("div");
		figWrapper.appendChild(fig);
		figWrapper.appendChild(figOptions);

		fig.id = "hrr-choropleth";

		return figWrapper;
	});
}

function hsaChoropleth(response) {
	return fetch("/json/hsa_boundaries.json").then(q => q.json()).then(hsaGeo => {
		const hsaGeoFeatures = topojson.feature(hsaGeo, hsaGeo.objects.HsaBdry_AK_HI_unmodified).features;

		function genFigure(metric) {
			const overflowLookup = new Map(response.map(r => [parseInt(r.region_id), r[metric]]));
			const valueLookup = (d) => {
				if (overflowLookup.has(d.properties.HSA93)) {
					const x = overflowLookup.get(d.properties.HSA93);
					return (x) ? x : -1;
				} else {
					return -1;
				}
			};
			const nameLookup = (d) => d.properties.HSA_label;

			return generateChoropleth(hsaGeoFeatures, nameLookup, valueLookup, metric);
		}

		let fig = genFigure("overflow_total_pct");
		let figOptions = createRegionChoroplethOptions(fig, genFigure);

		let figWrapper = document.createElement("div");
		figWrapper.appendChild(fig);
		figWrapper.appendChild(figOptions);

		fig.id = "hsa-choropleth";

		return figWrapper;
	});
}

function generateChoropleth(geoFeatures, nameLookup, valueLookup, metricName) {
	const vals = geoFeatures.map(d => valueLookup(d));
	const colorscale = computeColorscale(vals, metricName);

	const isPct = metricName.indexOf("pct") > 0;
	const legendFmt = (x) => (isPct) ? `${(x*100).toFixed(1)}%` : `${x.toFixed(0)}`;
	const legendMetricName = metricNames[metricName].split(" (%)")[0];

	const path = d3.geoPath(d3.geoAlbersUsa());

	const svg = d3.create("svg")
		.attr("viewBox", [0, 0, 975, 510]);

	svg.append("g")
		.selectAll("path")
		.data(geoFeatures)
		.join("path")
			.attr("fill", d => colorscale(valueLookup(d)))
			.attr("stroke", "white")
			.attr("stroke-linejoin", "round")
			.attr("d", path)
		.append("title")
			.text(d => `${nameLookup(d)}\n${legendMetricName}: ${legendFmt(valueLookup(d))}`);

	generateLegend(svg, colorscale, vals, metricName);

	return svg.node();
}

function computeColorscale(vals, metricName) {

	let colorscale = null;
	if (metricName.indexOf("load") >= 0) {
		// const colorscaleGreens = d3.scaleSequential(d3.interpolateGreens).domain([0.0, 0.95]);
		// const colorscaleReds = d3.scaleSequential(d3.interpolateReds).domain([0.9, scaleMax]);
		// colorscale = x => (x >= 0 && x <= 0.95) ? colorscaleGreens(x) : (x <= 1.05) ? "gold" : colorscaleReds(x);

		const colorscaleRaw = d3.scaleSequential(d3.interpolateRdYlGn).domain([0.0, 1.0]);
		colorscale = x => (x <= 1) ? colorscaleRaw(1 - ((x**1)/2)) : colorscaleRaw(1 - ((x**3)/2));
	} else if (metricName.indexOf("occupancy") >= 0 || metricName.indexOf("capacity") >= 0) {
		const scaleMax = Math.max(d3.max(vals), 1);
		colorscale = d3.scaleSequential(d3.interpolateBlues).domain([0, scaleMax]);
	} else {
		const scaleMin = 0;
		const scaleMax = Math.max(d3.max(vals), 0.05);

		// const scaleMin = percentile(vals, 0.05);
		// const scaleMax = percentile(vals, 0.97);
		// const scaleMax = percentile(vals.filter(x => x > 10), 0.97);
		// const scaleMax = d3.max(vals);

		const colorscaleRaw = d3.scaleSequential(d3.interpolateReds).domain([scaleMin, scaleMax]);
		colorscale = x => (x >= 0) ? colorscaleRaw(x) : "#efefef";
	}

	return colorscale;
}

function generateLegend(svg, colorscale, vals, metricName) {

	const legendMin = 0;
	const legendMax = Math.max(d3.max(vals), 0.05);

	const x = d3.scaleLinear()
		.domain([legendMin, legendMax])
		.rangeRound([0, 260]);

	const legend = svg.append("g")
		.style("font-size", "0.8rem")
		.style("font-family", "sans-serif")
		.attr("transform", "translate(540,30)");

	legend.selectAll("rect")
		.data(d3.range(legendMin, legendMax, (legendMax-legendMin)/200))
		.enter().append("rect")
			.attr("height", 10)
			.attr("x", d => x(d))
			.attr("width", (260 / 200) * 2)
			.attr("stroke", "none")
			.attr("fill", d => colorscale(d));

	const label = legend.append("g")
		.attr("fill", "#000")
		.attr("text-anchor", "start")

	label.append("text")
		.attr("y", -8)
		.text(metricNames[metricName]);

	if (metricName.indexOf("pct") > 0) {
		legend.append("g")
			.call(d3.axisBottom(x).ticks(6).tickFormat(d => (d*100).toFixed(0) + "%").tickSize(15))
			.select(".domain").remove();
	} else {
		legend.append("g")
			.call(d3.axisBottom(x).ticks(6).tickSize(15))
			.select(".domain").remove();
	}
}

function percentile(xs, p) {
	xs.sort((a, b) => a - b);
	const i = Math.round(xs.length * p);
	return xs[i];
}

const metricNames = {
	"overflow_total": "Shortage",
	"overflow_total_pct": "Shortage (%)",
	"overflow_ideal_total": "Optimal Shortage",
	"overflow_ideal_total_pct": "Optimal Shortage (%)",
	"benefits": "Reduction",
	"benefits_pct": "Reduction (%)",
	"load_peak_pct": "Peak Load (%)",
	"load_avg_pct": "Average Load (%)",
	"occupancy_peak": "Occupancy (Peak)",
	"occupancy_total": "Occupancy (Total)",
	"capacity": "Capacity",
};

function createRegionChoroplethOptions(fig, genFigure, defaultOption=1) {
	const metrics = ["overflow_total", "overflow_total_pct", "overflow_ideal_total", "overflow_ideal_total_pct", "benefits", "benefits_pct", "load_peak_pct", "load_avg_pct", "occupancy_peak", "occupancy_total", "capacity"];
	let options = createSelect(metrics.map(m => metricNames[m]), metrics, defaultOption, "Metric");
	let sel = options.querySelector("select");

	sel.addEventListener("change", () => {
		let newMetric = sel.value;
		let newFig = genFigure(newMetric);
		newFig.id = fig.id;
		fig.replaceWith(newFig);
		fig = newFig;
	});

	return options;
}
