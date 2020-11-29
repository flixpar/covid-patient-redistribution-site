const dashboardMargin = {left: 40, right: 5, top: 5, bottom: 5};

const dashboardContainerWidth = 600;
const dashboardSize = {"width": dashboardContainerWidth, "height": 0.7*dashboardContainerWidth};

const dashboardAxisFont = "monospace";
const dashboardDefaultFont = "Helvetica";

const dashboardAxisFontSize = 8;
const dashboardTitleFontSize = 10;

const dashboardLineWidth = 2;
const dashboardCapacityLineWidth = 1;

const dashboardCapacityColors = ["gold", "darkorange", "red", "black"];
const dashboardLineColors = {
	"BMC":  "#006C67",
	"HCGH": "#B9314F",
	"JHH":  "#454E9E",
	"SH":   "#95B46A",
	"SMH":  "#B6C2D9",
	"default": "blue",
};


function createJHHSDashboard(response, add_description=true) {
	const section = document.getElementById("section-results-dashboard");
	if (add_description) {
		let description = document.createElement("p");
		description.innerHTML = dashboardDescription;
		section.appendChild(description);
	}

	const fig = makeJHHSDashboard(response);
	section.appendChild(fig);

	const capacityNames = response.config.capacity_names;
	const capacityColorscaleElem = makeHorizontalColorScale(capacityNames, dashboardCapacityColors);
	capacityColorscaleElem.style.marginTop = "20px";
	section.appendChild(capacityColorscaleElem);

	let hr = document.createElement("hr");
	section.appendChild(hr);
}

function makeJHHSDashboard(response) {
	const svg = d3.create("svg").attr("viewBox", [0, 0, dashboardSize.width, dashboardSize.height]);

	const N = response.beds.length;
	const T = response.config.dates.length;
	const C = response.capacity[0].length;

	const plotSize = {width: (dashboardSize.width - dashboardMargin.left - dashboardMargin.right) / N, height: dashboardSize.height};
	const plotMargin = {left: 5, right: 5, top: 12, bottom: 25};

	const maxActive = d3.max(response.active, x => d3.max(x));
	const maxActiveNull = d3.max(response.active_null, x => d3.max(x));
	const maxCapacity = d3.max(response.capacity, x => x[C-1]);
	const maxY = d3.max([maxActive, maxActiveNull, maxCapacity]);

	const xScale = d3.scaleUtc()
		.domain(d3.extent(response.config.dates, d => new Date(Date.parse(d))))
		.range([plotMargin.left, plotSize.width - plotMargin.right]);
	const yScale = d3.scaleLinear()
		.domain([0, maxY]).nice()
		.range([plotSize.height - plotMargin.bottom, plotMargin.top]);

	const data = computeDashboardData(response);

	let g1 = svg.append("g").attr("transform", `translate(0, ${dashboardMargin.top})`);
	const marginSize = {width: dashboardMargin.left, height: plotSize.height};
	g1 = makeYAxis(g1, xScale, yScale, marginSize, plotMargin);

	const ind = d3.range(N).sort((i,j) => (response.config.node_names[i] <= response.config.node_names[j]) ? -1 : 1);
	let tooltips = [];
	for (let i = 0; i < N; i++) {
		const j = ind[i];
		let g = svg.append("g").attr("transform", `translate(${dashboardMargin.left + (i*plotSize.width)}, ${dashboardMargin.top})`);
		g,tooltips[i] = plotActive(g, xScale, yScale, data, response, j, plotSize, plotMargin);
	}
	for (let i = 0; i < N; i++) {
		let g = svg.append("g").attr("transform", `translate(${dashboardMargin.left + (i*plotSize.width)}, ${dashboardMargin.top})`);
		g.append(() => tooltips[i].node);
	}

	return svg.node();
}

function plotActive(svg, xScale, yScale, data, response, locIdx, plotSize, plotMargin) {

	const xAxis = g => g
		.attr("transform", `translate(0,${plotSize.height - plotMargin.bottom})`)
		.style("font-family", dashboardAxisFont)
		.style("font-size", dashboardAxisFontSize)
		.call(d3.axisBottom(xScale)
					.ticks(d3.timeWeek.every(3))
					.tickSizeOuter(4)
					.tickFormat(d3.timeFormat("%m/%d"))
				 )
		.call(g => g.select(".domain").remove())
		.call(g => g.selectAll(".tick line")
					.attr("stroke-width", 0.5)
					.attr("stroke-opacity", 0.75)
				 )
		.call(g => g.selectAll(".tick text").attr("dy", 10));

	const yAxis = g => g
		.attr("transform", `translate(${plotMargin.left},0)`)
		.call(d3.axisRight(yScale)
					.ticks(4)
					.tickSize(plotSize.width - plotMargin.left - plotMargin.right)
					.tickFormat("")
				 )
		.call(g => g.select(".domain").remove())
		.call(g => g.selectAll(".tick line")
					.attr("stroke-width", 0.5)
					.attr("stroke-opacity", 0.5)
					.attr("stroke-dasharray", "4,4")
				 );

	svg.append("g")
		.call(xAxis);
	svg.append("g")
		.call(yAxis);

	svg.append("text")
		.attr("x", plotSize.width/2)
		.attr("y", 5)
		.attr("text-anchor", "middle")
		.style("font-family", dashboardDefaultFont)
		.style("font-size", dashboardTitleFontSize+"px")
		.text(response.config.node_names[locIdx]);

	const line = d3.line()
		.defined(d => !isNaN(d.value))
		.x(d => xScale(d.date))
		.y(d => yScale(d.value));

	const C = response.capacity[0].length;
	for (let c = 0; c < C; c++) {
		svg.append("path")
			.datum(data["capacity"][locIdx][c])
			.attr("fill", "none")
			.attr("stroke", dashboardCapacityColors[c])
			.attr("stroke-width", dashboardCapacityLineWidth)
			.attr("stroke-linejoin", "round")
			.attr("stroke-linecap", "square")
			.attr("d", line);
		}

	const locName = response.config.node_names[locIdx];
	const locColor = (locName in dashboardLineColors) ? dashboardLineColors[locName] : dashboardLineColors["default"];

	svg.append("path")
		.datum(data["active"][locIdx])
		.attr("fill", "none")
		.attr("stroke", locColor)
		.attr("stroke-width", dashboardLineWidth)
		.attr("stroke-linejoin", "round")
		.attr("stroke-linecap", "round")
		.attr("d", line);

	svg.append("path")
		.datum(data["active_null"][locIdx])
		.attr("fill", "none")
		.attr("stroke", locColor)
		.attr("stroke-width", lineWidth/1.5)
		.attr("stroke-linejoin", "round")
		.attr("stroke-linecap", "round")
		.attr("opacity", 0.25)
		.attr("d", line);

	const tooltip = new DashboardTooltip(xScale,yScale);

	const locIdxAlt = response.config.node_names.slice(0).sort().indexOf(response.config.node_names[locIdx]);
	const xOffset = dashboardMargin.left + (locIdxAlt * plotSize.width);
	const yOffset = dashboardMargin.top;

	svg.append("rect")
		.attr("x", plotMargin.left)
		.attr("y", plotMargin.top)
		.attr("width", plotSize.width - plotMargin.left - plotMargin.right)
		.attr("height", plotSize.height - plotMargin.top - plotMargin.bottom)
		.attr("fill", "none")
		.attr("id", `box-${locIdx}`)
		.attr("pointer-events", "visible");

	const lines = [
		data["active"][locIdx],
		data["active_null"][locIdx],
	];
	for (let c = 0; c < C; c++) {
		lines.push(data["capacity"][locIdx][c]);
	}

	let parentSVG = svg.node().parentElement;
	svg.selectAll(`#box-${locIdx}`).on("mousemove", event => {
		const svgWidth = parentSVG.clientWidth;
		const scaleFactor = dashboardSize.width / svgWidth;
		const pointerX = ((event.offsetX * scaleFactor) - xOffset);
		const pointerY = ((event.offsetY * scaleFactor) - yOffset);
		if (pointerX < 0 || pointerX > plotSize.width || pointerY < 0 || pointerY > plotSize.height) {
			return;
		}
		const d = dashboardBisect(lines, xScale.invert(pointerX), yScale.invert(pointerY));
		tooltip.show(d);
	});
	svg.select(`#box-${locIdx}`).on("mouseleave", () => tooltip.hide());

	return svg, tooltip;
}

function makeYAxis(svg, xScale, yScale, plotSize, plotMargin) {
	const yAxis = g => g
	.attr("transform", `translate(30,0)`)
	.style("font-family", dashboardAxisFont)
	.style("font-size", dashboardAxisFontSize)
	.call(d3.axisRight(yScale)
				.ticks(4)
				.tickSize(6)
			 )
	.call(g => g.selectAll(".domain")
				.attr("stroke-width", 0.5)
				.attr("stroke-opacity", 0.75)
			 )
	.call(g => g.selectAll(".tick line")
				.attr("stroke-width", 0.5)
				.attr("stroke-opacity", 0.75)
			 )
	.call(g => g.selectAll(".tick text")
				.attr("x", -20)
				.attr("dy", 2)
				.attr("text-anchor", "start")
			 );

	svg.append("g")
		.call(yAxis);

	svg.append("text")
		.attr("transform", `translate(8,${dashboardSize.height/2}) rotate(-90)`)
		.attr("font-family", dashboardDefaultFont)
		.attr("font-size", 10)
		.text("Beds");

	return svg;
}

function computeDashboardData(response) {
	const N = response.beds.length;
	const T = response.config.dates.length;
	const C = response.capacity[0].length;

	let active_data = [];
	let active_null_data = [];
	let capacity_data = [];
	for (let i = 0; i < N; i++) {
		active_data[i] = [];
		active_null_data[i] = [];
		capacity_data[i] = [];
		for (let c = 0; c < C; c++) {
		capacity_data[i][c] = [];
		}

		for (let t = 0; t < T; t++) {
			const d = new Date(Date.parse(response.config.dates[t]));
			active_data[i][t] = {
				"date": d,
				"value": response.active[i][t],
				"data_type": "With Transfers",
				"node_name": response.config.node_names[i],
			};
			active_null_data[i][t] = {
				"date": d,
				"value": response.active_null[i][t],
				"data_type": "Without Transfers",
				"node_name": response.config.node_names[i],
			};
			for (let c = 0; c < C; c++) {
				capacity_data[i][c][t] = {
					"date": d,
					"value": response.capacity[i][c],
					"data_type": response.config.capacity_names[c],
					"node_name": response.config.node_names[i],
				};
			}
		}
	}
	const data = {
		"active": active_data,
		"active_null": active_null_data,
		"capacity": capacity_data,
	};

	return data;
}

class DashboardTooltip {
	constructor(x,y) {
		this.x = x;
		this.y = y;

		let tmpSVG = d3.create("svg");
		let tmpNode = tmpSVG.append("g")
			.attr("pointer-events", "none")
			.attr("display", "none")
			.attr("font-family", dashboardAxisFont)
			.attr("font-size", dashboardAxisFontSize)
			.attr("text-anchor", "middle");

		tmpNode.append("rect")
			.attr("x", -50)
			.attr("y", -65)
			.attr("width", 100)
			.attr("height", 45)
			.attr("fill", "white")
			.attr("stroke", "gray")
			.attr("stroke-width", 1.5);
		tmpNode.append("rect")
			.attr("transform", "translate(0, -30) rotate(45)")
			.attr("width", 12)
			.attr("height", 12)
			.attr("fill", "white")
			.attr("stroke", "gray")
			.attr("stroke-width", 1.0);
		tmpNode.append("rect")
			.attr("x", -50)
			.attr("y", -65)
			.attr("width", 100)
			.attr("height", 45)
			.attr("fill", "white");

		this.hospNameElem = tmpNode.append("text").attr("y", "-55").node();
		this.tfrElem      = tmpNode.append("text").attr("y", "-45").node();
		this.dateElem     = tmpNode.append("text").attr("y", "-35").node();
		this.yvalElem     = tmpNode.append("text").attr("y", "-25").node();

		tmpNode.append("circle")
			.attr("stroke", "black")
			.attr("fill", "none")
			.attr("r", 2);

		this.node = tmpNode.node();
	}

	show(d) {
		this.node.removeAttribute("display");
		this.node.setAttribute("transform", `translate(${this.x(d.date)},${this.y(d.value)})`);
		this.hospNameElem.textContent = d.node_name;
		this.tfrElem.textContent = d.data_type;
		this.dateElem.textContent = d3.timeFormat("%Y-%m-%d")(d.date);
		const yval_prefix = (d.data_type.indexOf("Capacity") > 0) ? "Beds: " : "Patients: ";
		this.yvalElem.textContent = yval_prefix + d.value.toFixed(0);
	}

	hide() {
		this.node.setAttribute("display", "none");
	}
}

const dashboardBisectDate = d3.bisector(d => d.date).center;

function dashboardBisect(lines, date, yval) {
	const line1 = lines[0];
	const i = dashboardBisectDate(line1, date, 1);
	const d = line1[i].date;
	const v = lines.map(l => l.findIndex(x => x.date == d));
	const j = d3.minIndex(v.map((x,k) => Math.abs(lines[k][x].value - yval)));
	return lines[j][v[j]];
}

