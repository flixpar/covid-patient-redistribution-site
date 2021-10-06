import {createSelect} from "./patients_common.js";
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

	choropleth.then(fig => {
		if (document.getElementById(mapId) == null) {
			document.getElementById(`maparea-${regionType}`).appendChild(fig);
		} else {
			document.getElementById(mapId).replaceWith(fig);
		}
		fig.id = mapId;
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
					return (x) ? x : 0;
				} else {
					return 0;
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

		return figWrapper;
	});
}

function generateChoropleth(geoFeatures, nameLookup, valueLookup, metricName="") {
	const vals = geoFeatures.map(d => valueLookup(d));
	const scaleMin = 0;
	// const scaleMin = percentile(vals, 0.05);
	// const scaleMax = percentile(vals, 0.97);
	// const scaleMax = percentile(vals.filter(x => x > 10), 0.97);
	const scaleMax = d3.max(vals);
	const colorscale = d3.scaleSequential(d3.interpolateReds).domain([scaleMin, scaleMax]);

	const path = d3.geoPath(d3.geoAlbersUsa());

	const svg = d3.create("svg")
		.attr("viewBox", [0, 0, 975, 540]);

	svg.append("g")
		.selectAll("path")
		.data(geoFeatures)
		.join("path")
			.attr("fill", d => colorscale(valueLookup(d)))
			.attr("stroke", "white")
			.attr("stroke-linejoin", "round")
			.attr("d", path)
		.append("title")
			.text(d => `${nameLookup(d)}\n${valueLookup(d).toFixed(0)}`);

	generateLegend(svg, colorscale, vals, metricName);

	return svg.node();
}

function generateLegend(svg, colorscale, vals, metricName) {
	// const legendMin = Math.round(colorscale.domain()[0]);
	// const legendMax = Math.round(colorscale.domain()[1]);

	const legendMin = 0;
	const legendMax = d3.max(vals);

	const x = d3.scaleLinear()
		.domain([legendMin, legendMax])
		.rangeRound([0, 260]);

	const legend = svg.append("g")
		.style("font-size", "0.8rem")
		.style("font-family", "sans-serif")
		.attr("transform", "translate(550,40)");

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
			.call(d3.axisBottom(x).ticks(6).tickFormat(d => d*100 + "%").tickSize(15))
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
};

function createRegionChoroplethOptions(fig, genFigure, defaultOption=1) {
	const metrics = ["overflow_total", "overflow_total_pct", "overflow_ideal_total", "overflow_ideal_total_pct", "benefits", "benefits_pct"];
	let options = createSelect(metrics.map(m => metricNames[m]), metrics, defaultOption, "Metric");
	let sel = options.querySelector("select");

	sel.addEventListener("change", () => {
		let newMetric = sel.value;
		let newFig = genFigure(newMetric);
		fig.replaceWith(newFig);
		fig = newFig;
	});

	return options;
}

function createSelect(optionNames, optionValues, defaultIdx, labelText, selectId) {
	let selectContainer = document.createElement("div");
	selectContainer.className = "field";

	let selectLabel = document.createElement("label");
	selectLabel.className = "label";
	selectLabel.htmlFor = selectId;
	selectLabel.textContent = labelText;
	selectLabel.style.marginBottom = "0.2rem";
	selectContainer.appendChild(selectLabel);

	let selectControl = document.createElement("div");
	selectControl.className = "control";
	selectContainer.appendChild(selectControl);

	let selectWrapper = document.createElement("div");
	selectWrapper.className = "select is-fullwidth";
	selectControl.appendChild(selectWrapper);

	let select = document.createElement("select");
	select.id = selectId;

	let options = optionNames.map((txt,i) => {
		let s = document.createElement("option");
		s.value = optionValues[i];
		s.text = txt;
		select.appendChild(s);
		return s;
	});

	if (defaultIdx != null) {
		options[defaultIdx].selected = true;
	}

	selectWrapper.appendChild(select);

	return selectContainer;
}
