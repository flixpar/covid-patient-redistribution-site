const loadPlotsWidth = 800;
const loadPlotsHeight = 400;
const loadPlotsMargin = ({top: 35, right: 30, bottom: 30, left: 50})
const loadPlotsFont = "Helvetica";
const loadPlotsLegendFont = "Monospace";

function createOverallLoadPlot(rawdata, add_description=true) {
	const section = document.getElementById("section-results-load");

	if (add_description) {
		let description = document.createElement("p");
		description.innerHTML = overallloadplotDescription;
		section.appendChild(description);
	}

	const overallData = extractOverallLoadData(rawdata, 3);
	const overallLoadPlot = _createOverallLoadPlot(overallData);
	overallLoadPlot.id = "overallloadplot";

	section.appendChild(overallLoadPlot);
	createCapacityOption("overallloadplot", rawdata);

	const hr = document.createElement("hr");
	section.appendChild(hr);
}

function createLoadPlots(rawdata, add_description=true) {
	const loadData = extractLoadData(rawdata);

	const loadSentPlot = _createLoadPlot(loadData.load, "COVID Patient Load by Location (With Transfers)");
	const loadNoSentPlot = _createLoadPlot(loadData.load_null, "COVID Patient Load by Location (Without Transfers)");
	const legend = createLoadPlotsLegend(rawdata.config.node_names);

	const section = document.getElementById("section-results-load");

	let table = document.createElement("div");
	let row1 = document.createElement("div");
	let row2 = document.createElement("div");
	table.appendChild(row1);
	table.appendChild(row2);
	row1.appendChild(loadNoSentPlot);
	row1.appendChild(loadSentPlot);
	row2.appendChild(legend);

	row1.style.display = "flex";
	row1.style.flexDirection = "row";
	loadSentPlot.style.width = "50%";
	loadNoSentPlot.style.width = "50%";
	row2.className = "column is-8 is-offset-2";

	if (add_description) {
		let description = document.createElement("p");
		description.innerHTML = loadplotsDescription;
		section.appendChild(description);
	}

	section.appendChild(table);

	const hr = document.createElement("hr");
	section.appendChild(hr);
}

function _createLoadPlot(load, title="COVID Patient Load by Location") {
	const svg = d3.create("svg").attr("viewBox", [0, 0, loadPlotsWidth, loadPlotsHeight]);

	svg.append("text")
		.attr("x", loadPlotsWidth/2)
		.attr("y", 20)
		.attr("text-anchor", "middle")
		.style("font-family", loadPlotsFont)
		.style("font-size", "22px")
		.text(title);

	const maxLoadVal = d3.max(load, x => d3.max(x, y => y.value))
	const maxY = Math.min(5.0, Math.max(2.0, Math.ceil(maxLoadVal)));
	// const maxY = 3.0;

	const y = d3.scaleLinear()
		.domain([0, maxY]).nice()
		.range([loadPlotsHeight - loadPlotsMargin.bottom, loadPlotsMargin.top])

	const yAxis = svg => svg
		.attr("transform", `translate(${loadPlotsMargin.left},0)`)
		.style("font-family", loadPlotsFont)
		.style("font-size", "18px")
		.call(d3.axisRight(y)
			.ticks(5)
			.tickSize(loadPlotsWidth - loadPlotsMargin.left - loadPlotsMargin.right)
		)
		.call(g => g.select(".domain").remove())
		.call(g => g.selectAll(".tick line")
			.attr("stroke-opacity", 0.5)
			.attr("stroke-dasharray", "4,4"))
		.call(g => g.selectAll(".tick text")
			.attr("x", "-10px")
			.attr("dy", "4px")
			.attr("text-anchor", "end")
		);

	const dates = load[0].map(d => d.date);
	const N = load.length;

	const x = d3.scaleUtc()
		.domain(d3.extent(dates))
		.range([loadPlotsMargin.left, loadPlotsWidth - loadPlotsMargin.right]);

	const xAxis = g => g
		.attr("transform", `translate(0,${loadPlotsHeight - loadPlotsMargin.bottom})`)
		.style("font-family", loadPlotsFont)
		.style("font-size", "16px")
		.call(d3.axisBottom(x)
			.ticks(d3.timeWeek.every(1))
			.tickSize(-(loadPlotsHeight - loadPlotsMargin.top - loadPlotsMargin.bottom))
			.tickFormat(d3.timeFormat("%m/%d"))
		)
		.call(g => g.select(".domain").remove())
		.call(g => g.selectAll(".tick line")
			.attr("stroke-opacity", 0.5)
			.attr("stroke-dasharray", "4,4"))
		.call(g => g.selectAll(".tick text").attr("dy", "20px"));

	const colorscale = d3.scaleSequential(d3.interpolateRainbow).domain([0,N]);

	const line = d3.line()
		.defined(d => !isNaN(d.value))
		.x(d => x(d.date))
		.y(d => y(d.value))

	svg.append("g").call(xAxis);
	svg.append("g").call(yAxis);

	svg.append("rect")
		.attr("x", loadPlotsMargin.left)
		.attr("y", y(1.0))
		.attr("width", loadPlotsWidth-loadPlotsMargin.right-loadPlotsMargin.left)
		.attr("height", y(0.0)-y(1.0))
		.attr("stroke", "none")
		.attr("fill", "green")
		.attr("opacity", 0.2);

	svg.append("rect")
		.attr("x", loadPlotsMargin.left)
		.attr("y", y(maxY))
		.attr("width", loadPlotsWidth-loadPlotsMargin.right-loadPlotsMargin.left)
		.attr("height", y(1.0)-y(maxY))
		.attr("stroke", "none")
		.attr("fill", "red")
		.attr("opacity", 0.2);

	for (let i = 0; i < N; i++) {

		svg.append("path")
			.datum(load[i])
			.attr("fill", "none")
			.attr("stroke", colorscale(i))
			.attr("stroke-width", 2)
			.attr("d", line);

		svg.selectAll(".point")
			.data(load[i])
			.enter().append("svg:circle")
			.attr("fill", colorscale(i))
			.attr("cx", d => x(d.date))
			.attr("cy", d => y(d.value))
			.attr("r", 3);

	}

	svg.append("line")
		.attr("x1", loadPlotsMargin.left)
		.attr("x2", loadPlotsWidth-loadPlotsMargin.right)
		.attr("y1", y(1.0))
		.attr("y2", y(1.0))
		.attr("stroke-width", 6)
		.attr("stroke", "red");

	return svg.node();
}

function _createOverallLoadPlot(overall_load) {
	const svg = d3.create("svg").attr("viewBox", [0, 0, loadPlotsWidth, loadPlotsHeight]);

	svg.append("text")
		.attr("x", loadPlotsWidth/2)
		.attr("y", 20)
		.attr("text-anchor", "middle")
		.style("font-family", loadPlotsFont)
		.style("font-size", "22px")
		.text("Overall System Load");

	const maxLoadVal = d3.max(overall_load, y => y.value)
	const maxY = Math.min(5.0, Math.max(2.0, Math.ceil(maxLoadVal)));
	// const maxY = 3.0;

	const y = d3.scaleLinear()
		.domain([0, maxY]).nice()
		.range([loadPlotsHeight - loadPlotsMargin.bottom, loadPlotsMargin.top])

	const yAxis = svg => svg
		.attr("transform", `translate(${loadPlotsMargin.left},0)`)
		.style("font-family", loadPlotsFont)
		.style("font-size", "18px")
		.call(d3.axisRight(y)
			.ticks(5)
			.tickSize(loadPlotsWidth - loadPlotsMargin.left - loadPlotsMargin.right)
		)
		.call(g => g.select(".domain").remove())
		.call(g => g.selectAll(".tick line")
			.attr("stroke-opacity", 0.5)
			.attr("stroke-dasharray", "4,4"))
		.call(g => g.selectAll(".tick text")
			.attr("x", "-10px")
			.attr("dy", "4px")
			.attr("text-anchor", "end")
		);

	const dates = overall_load.map(d => d.date);

	const x = d3.scaleUtc()
		.domain(d3.extent(dates))
		.range([loadPlotsMargin.left, loadPlotsWidth - loadPlotsMargin.right]);

	const xAxis = g => g
		.attr("transform", `translate(0,${loadPlotsHeight - loadPlotsMargin.bottom})`)
		.style("font-family", loadPlotsFont)
		.style("font-size", "16px")
		.call(d3.axisBottom(x)
			.ticks(d3.timeWeek.every(1))
			.tickSize(-(loadPlotsHeight - loadPlotsMargin.top - loadPlotsMargin.bottom))
			.tickFormat(d3.timeFormat("%m/%d"))
		)
		.call(g => g.select(".domain").remove())
		.call(g => g.selectAll(".tick line")
			.attr("stroke-opacity", 0.5)
			.attr("stroke-dasharray", "4,4"))
		.call(g => g.selectAll(".tick text").attr("dy", "20px"));

	const line = d3.line()
		.defined(d => !isNaN(d.value))
		.x(d => x(d.date))
		.y(d => y(d.value));

	svg.append("g")
		.call(xAxis);

	svg.append("g")
		.call(yAxis);

	svg.append("rect")
		.attr("x", loadPlotsMargin.left)
		.attr("y", y(1.0))
		.attr("width", loadPlotsWidth-loadPlotsMargin.right-loadPlotsMargin.left)
		.attr("height", y(0.0)-y(1.0))
		.attr("stroke", "none")
		.attr("fill", "green")
		.attr("opacity", 0.2);

	svg.append("rect")
		.attr("x", loadPlotsMargin.left)
		.attr("y", y(maxY))
		.attr("width", loadPlotsWidth-loadPlotsMargin.right-loadPlotsMargin.left)
		.attr("height", y(1.0)-y(maxY))
		.attr("stroke", "none")
		.attr("fill", "red")
		.attr("opacity", 0.2);

	svg.append("path")
		.datum(overall_load)
		.attr("fill", "none")
		.attr("stroke", "darkblue")
		.attr("stroke-width", 4)
		.attr("stroke-linejoin", "round")
		.attr("stroke-linecap", "round")
		.attr("d", line);

	svg.selectAll(".point")
		.data(overall_load)
		.enter().append("svg:circle")
		.attr("fill", "darkblue")
		.attr("stroke", "white")
		.attr("stroke-width", 1)
		.attr("cx", d => x(d.date))
		.attr("cy", d => y(d.value))
		.attr("r", 6);

	svg.append("line")
		.attr("x1", loadPlotsMargin.left)
		.attr("x2", loadPlotsWidth-loadPlotsMargin.right)
		.attr("y1", y(1.0))
		.attr("y2", y(1.0))
		.attr("stroke-width", 5)
		.attr("stroke", "red");

	return svg.node();
}

function createLoadPlotsLegend(location_names) {
	const N = location_names.length;

	const maxNameLength = d3.max(location_names, x => x.length);
	const rowHeight = 20;
	const colWidth = (maxNameLength * 8) + 10 + 10;

	const totalWidth = 0.66 * document.getElementById("results-container").offsetWidth;

	const maxCols = Math.floor(totalWidth / colWidth);
	const nRows = Math.ceil(N / maxCols);
	const nCols = Math.min(maxCols, N);

	const actualWidth = colWidth * nCols;
	const marginLeft  = (totalWidth - actualWidth) / 2;
	const marginTop   = 2;

	const debug = false;

	const colorscale = d3.scaleSequential(d3.interpolateRainbow).domain([0,N]);

	const svg = d3.create("svg").attr("viewBox", [0, 0, maxCols*colWidth, nRows*rowHeight]);

	for (let i = 0; i < nRows; i++) {
		for (let j = 0; j < nCols; j++) {
			const k = (i*nCols) + j;
			if (k >= N) continue;

			svg.append("rect")
				.attr("x", marginLeft + ( colWidth * j))
				.attr("y", marginTop  + (rowHeight * i))
				.attr("width", 10)
				.attr("height", 10)
				.attr("fill", colorscale(k))
				.attr("stroke", "none");

			svg.append("text")
				.attr("x", marginLeft + 14 + ( colWidth * j))
				.attr("y", marginTop  +  8 + (rowHeight * i))
				.attr("text-anchor", "start")
				.style("font-family", loadPlotsLegendFont)
				.style("font-size", "10px")
				.text(location_names[k]);

			if (debug) {
				svg.append("rect")
					.attr("x", marginLeft + ( colWidth * j))
					.attr("y", marginTop  + (rowHeight * i))
					.attr("width", colWidth)
					.attr("height", 10)
					.attr("fill", "none")
					.attr("stroke", "gray");
			}
		}
	}

	if (debug) {
		svg.append("rect")
			.attr("x", marginLeft)
			.attr("y", marginTop)
			.attr("width", nCols * colWidth)
			.attr("height", 10)
			.attr("fill", "none")
			.attr("stroke", "black");
	}

	return svg.node();
}

function extractLoadData(rawdata) {
	const N = rawdata.beds.length;
	const T = rawdata.config.dates.length;

	let load_data = [];
	let load_null_data = [];

	for (let i = 0; i < N; i++) {
		load_data[i] = [];
		load_null_data[i] = [];

		for (let t = 0; t < T; t++) {
			const d = new Date(Date.parse(rawdata.config.dates[t]));
			if (rawdata.beds[i] == 0) {
				continue;
			}
			load_data[i][t] = {
				"date": d,
				"value": rawdata.active[i][t] / rawdata.beds[i],
			};
			load_null_data[i][t] = {
				"date": d,
				"value": rawdata.active_null[i][t] / rawdata.beds[i],
			};
		}
	}

	return {
		"load": load_data,
		"load_null": load_null_data,
	};
}

function extractOverallLoadData(rawdata, capacityLevel) {
	const N = rawdata.beds.length;
	const T = rawdata.config.dates.length;

	let overall_load = [];
	const totBeds = d3.sum(rawdata.capacity, x => x[capacityLevel]);
	const activeNullByDay = d3.transpose(rawdata.active_null);
	for (let t = 0; t < T; t++) {
		const d = new Date(Date.parse(rawdata.config.dates[t]));
		overall_load[t] = {
			"date": d,
			"value": d3.sum(activeNullByDay[t]) / totBeds,
		};
	}

	return overall_load;
}

function createCapacityOption(plotName, rawdata) {
	let capacitySelect = document.createElement("select");
	capacitySelect.id = plotName + "-capacitylevel";

	const capacityNames = ["Baseline Capacity", "Ramp-Up Capacity", "Surge Capacity", "Max Capacity"];
	for (let c = 0; c < capacityNames.length; c++) {
		let opt = document.createElement("option");
		opt.text = capacityNames[c];
		opt.value = c;
		if (c == 3) {
			opt.selected = true;
		}
		capacitySelect.appendChild(opt);
	}

	let capacitySelectLabel = document.createElement("label");
	capacitySelectLabel.innerHTML = "Capacity Level:";
	capacitySelectLabel.for = plotName + "-capacitylevel";

	if (plotName == "overallloadplot") {
		capacitySelect.addEventListener("change", e => {
			e.preventDefault();

			const sel = e.target;
			const capacityLevel = sel.options[sel.selectedIndex].value;

			const overallData = extractOverallLoadData(rawdata, capacityLevel);
			const overallLoadPlot = _createOverallLoadPlot(overallData);

			document.getElementById("overallloadplot").replaceWith(overallLoadPlot);
			overallLoadPlot.id = "overallloadplot";
		});
	}

	const section = document.getElementById("section-results-load");

	let capacitySelectField = document.createElement("div");
	capacitySelectField.style.textAlign = "center";
	capacitySelectLabel.style.marginRight = "20px";

	capacitySelectField.appendChild(capacitySelectLabel);
	capacitySelectField.appendChild(capacitySelect);
	section.appendChild(capacitySelectField);
}
