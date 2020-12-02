const admittedMargin = {left: 45, right: 5, top: 5, bottom: 5};

const admittedContainerWidth = 600;
const admittedSize = {"width": admittedContainerWidth, "height": 0.5*admittedContainerWidth};

const admittedAxisFont = "monospace";
const admittedDefaultFont = "Helvetica";

const admittedAxisFontSize = 8;
const admittedTitleFontSize = 10;

const admittedLineWidth = 2;

const admittedLineColors = {
	"BMC":  "#006C67",
	"HCGH": "#B9314F",
	"JHH":  "#454E9E",
	"SH":   "#95B46A",
	"SMH":  "#B6C2D9",
	"default": "blue",
};


function createAdmittedPlot(response, add_description=true) {
	const section = document.getElementById("section-results-admitted");
	if (add_description) {
		let description = document.createElement("p");
		description.innerHTML = admittedDescription;
		section.appendChild(description);
	}

	const fig = makeAdmittedPlot(response);
	section.appendChild(fig);

	let hr = document.createElement("hr");
	section.appendChild(hr);
}

function makeAdmittedPlot(response) {
	const svg = d3.create("svg").attr("viewBox", [0, 0, admittedSize.width, admittedSize.height]);

	const N = response.beds.length;
	const T = response.config.dates.length;

	const plotSize = {width: (admittedSize.width - admittedMargin.left - admittedMargin.right) / N, height: admittedSize.height};
	const plotMargin = {left: 5, right: 5, top: 12, bottom: 25};

	const data = computeAdmittedData(response);

	const maxAdmitted = d3.max(data.admitted, x => d3.max(x, y => y.value));
	const maxAdmittedNull = d3.max(data.admitted_null, x => d3.max(x, y => y.value));
	const maxY = d3.max([maxAdmitted, maxAdmittedNull]);

	const xScale = d3.scaleUtc()
		.domain(d3.extent(response.config.dates, d => new Date(Date.parse(d))))
		.range([plotMargin.left, plotSize.width - plotMargin.right]);
	const yScale = d3.scaleLinear()
		.domain([0, maxY]).nice()
		.range([plotSize.height - plotMargin.bottom, plotMargin.top]);

	let g1 = svg.append("g").attr("transform", `translate(0, ${admittedMargin.top})`);
	const marginSize = {width: admittedMargin.left, height: plotSize.height};
	g1 = makeYAxisAdmitted(g1, xScale, yScale, marginSize, plotMargin);

	const ind = d3.range(N).sort((i,j) => (response.config.node_names[i] <= response.config.node_names[j]) ? -1 : 1);
	let tooltips = [];
	for (let i = 0; i < N; i++) {
		const j = ind[i];
		let g = svg.append("g").attr("transform", `translate(${admittedMargin.left + (i*plotSize.width)}, ${admittedMargin.top})`);
		g,tooltips[i] = plotAdmitted(g, xScale, yScale, data, response, j, plotSize, plotMargin);
	}
	for (let i = 0; i < N; i++) {
		let g = svg.append("g").attr("transform", `translate(${admittedMargin.left + (i*plotSize.width)}, ${admittedMargin.top})`);
		g.append(() => tooltips[i].node);
	}

	return svg.node();
}

function plotAdmitted(svg, xScale, yScale, data, response, locIdx, plotSize, plotMargin) {

	const xAxis = g => g
		.attr("transform", `translate(0,${plotSize.height - plotMargin.bottom})`)
		.style("font-family", admittedAxisFont)
		.style("font-size", admittedAxisFontSize)
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
		.style("font-family", admittedDefaultFont)
		.style("font-size", admittedTitleFontSize+"px")
		.text(response.config.node_names[locIdx]);

	const line = d3.line()
		.defined(d => !isNaN(d.value))
		.x(d => xScale(d.date))
		.y(d => yScale(d.value));

	const locName = response.config.node_names[locIdx];
	const locColor = (locName in admittedLineColors) ? admittedLineColors[locName] : admittedLineColors["default"];

	svg.append("path")
		.datum(data["admitted"][locIdx])
		.attr("fill", "none")
		.attr("stroke", locColor)
		.attr("stroke-width", admittedLineWidth)
		.attr("stroke-linejoin", "round")
		.attr("stroke-linecap", "round")
		.attr("d", line);

	svg.append("path")
		.datum(data["admitted_null"][locIdx])
		.attr("fill", "none")
		.attr("stroke", locColor)
		.attr("stroke-width", lineWidth/1.5)
		.attr("stroke-linejoin", "round")
		.attr("stroke-linecap", "round")
		.attr("opacity", 0.25)
		.attr("d", line);

	const tooltip = new AdmittedTooltip(xScale,yScale);

	const locIdxAlt = response.config.node_names.slice(0).sort().indexOf(response.config.node_names[locIdx]);
	const xOffset = admittedMargin.left + (locIdxAlt * plotSize.width);
	const yOffset = admittedMargin.top;

	svg.append("rect")
		.attr("x", plotMargin.left)
		.attr("y", plotMargin.top)
		.attr("width", plotSize.width - plotMargin.left - plotMargin.right)
		.attr("height", plotSize.height - plotMargin.top - plotMargin.bottom)
		.attr("fill", "none")
		.attr("id", `box-${locIdx}`)
		.attr("pointer-events", "visible");

	const lines = [
		data["admitted"][locIdx],
		data["admitted_null"][locIdx],
	];

	let parentSVG = svg.node().parentElement;
	svg.selectAll(`#box-${locIdx}`).on("mousemove", event => {
		const svgWidth = parentSVG.clientWidth;
		const scaleFactor = admittedSize.width / svgWidth;
		const pointerX = ((event.offsetX * scaleFactor) - xOffset);
		const pointerY = ((event.offsetY * scaleFactor) - yOffset);
		if (pointerX < 0 || pointerX > plotSize.width || pointerY < 0 || pointerY > plotSize.height) {
			return;
		}
		const d = admittedBisect(lines, xScale.invert(pointerX), yScale.invert(pointerY));
		tooltip.show(d);
	});
	svg.select(`#box-${locIdx}`).on("mouseleave", () => tooltip.hide());

	return svg, tooltip;
}

function makeYAxisAdmitted(svg, xScale, yScale, plotSize, plotMargin) {
	const yAxis = g => g
	.attr("transform", `translate(35,0)`)
	.style("font-family", admittedAxisFont)
	.style("font-size", admittedAxisFontSize)
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
		.attr("transform", `translate(8,${admittedSize.height/2 + 50}) rotate(-90)`)
		.attr("font-family", admittedDefaultFont)
		.attr("font-size", 10)
		.text("COVID Patient Admissions");

	return svg;
}

function computeAdmittedData(response) {
	const N = response.beds.length;
	const T = response.config.dates.length;

	const nodeInds = d3.range(N);

	let admitted_data = [];
	let admitted_null_data = [];
	for (let i = 0; i < N; i++) {
		admitted_data[i] = [];
		admitted_null_data[i] = [];

		for (let t = 0; t < T; t++) {
			const d = new Date(Date.parse(response.config.dates[t]));
			admitted_data[i][t] = {
				"date": d,
				"value": (
					response.admitted[i][t]
					- d3.sum(nodeInds.map(j => response.sent[i][j][t]))
					+ d3.sum(nodeInds.map(j => response.sent[j][i][t]))
				),
				"data_type": "With Transfers",
				"node_name": response.config.node_names[i],
			};
			admitted_null_data[i][t] = {
				"date": d,
				"value": response.admitted[i][t],
				"data_type": "Without Transfers",
				"node_name": response.config.node_names[i],
			};
		}
	}
	const data = {
		"admitted": admitted_data,
		"admitted_null": admitted_null_data,
	};

	return data;
}

class AdmittedTooltip {
	constructor(x,y) {
		this.x = x;
		this.y = y;

		let tmpSVG = d3.create("svg");
		let tmpNode = tmpSVG.append("g")
			.attr("pointer-events", "none")
			.attr("display", "none")
			.attr("font-family", admittedAxisFont)
			.attr("font-size", admittedAxisFontSize)
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
		this.yvalElem.textContent = "Admissions: " + d.value.toFixed(0);
	}

	hide() {
		this.node.setAttribute("display", "none");
	}
}

const admittedBisectDate = d3.bisector(d => d.date).center;

function admittedBisect(lines, date, yval) {
	const line1 = lines[0];
	const i = admittedBisectDate(line1, date, 1);
	const d = line1[i].date;
	const v = lines.map(l => l.findIndex(x => x.date == d));
	const j = d3.minIndex(v.map((x,k) => Math.abs(lines[k][x].value - yval)));
	return lines[j][v[j]];
}
