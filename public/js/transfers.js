const tfrFigureSize = {width: 600, height: 400};
const tfrFigureMargin = {left: 35, right: 2, top: 2, bottom: 2};
const tfrBarColors = {
	"BMC":  "#006C67",
	"HCGH": "#B9314F",
	"JHH":  "#454E9E",
	"SH":   "#95B46A",
	"SMH":  "#B6C2D9",
	"default": "blue",
};


function createTransfersBreakdownPlot(response, add_description=true) {
	const section = document.getElementById("section-results-dashboard");
	if (add_description) {
		let description = document.createElement("p");
		description.innerHTML = transfersDescription;
		section.appendChild(description);
	}

	const fig = makeTransfersBreakdownPlot(response);
	section.appendChild(fig);

	const hospNames = response.config.node_names;
	const hospColors = response.config.node_names.map(h => tfrBarColors[h]);
	const hospColorscaleElem = makeHorizontalColorScale(hospNames, hospColors);
	hospColorscaleElem.style.marginTop = "20px";
	section.appendChild(hospColorscaleElem);

	let colorscaleTitleElem = document.createElement("p");
	colorscaleTitleElem.innerHTML = "Destination Hospital";
	colorscaleTitleElem.style.fontFamily = "Helvetica";
	colorscaleTitleElem.style.fontSize = "14px";
	colorscaleTitleElem.style.textAlign = "center";
	hospColorscaleElem.insertBefore(colorscaleTitleElem, hospColorscaleElem.childNodes[0]);
}

function makeTransfersBreakdownPlot(response) {
	let svg = d3.create("svg").attr("viewBox", [0, 0, tfrFigureSize.width, tfrFigureSize.height]);
	const plotMargin = {left: 50, right: 4, top: 5, bottom: 10};

	const N = response.config.node_names.length;

	const innerHeight = tfrFigureSize.height - (tfrFigureMargin.top + tfrFigureMargin.bottom) - N*(plotMargin.top + plotMargin.bottom);
	const plotSize = {width: tfrFigureSize.width, height: innerHeight / N};

	for (let i = 0; i < N; i++) {
		let g = svg.append("g").attr("transform", `translate(${tfrFigureMargin.left+plotMargin.left}, ${tfrFigureMargin.top + (i * (plotSize.height + plotMargin.top + plotMargin.bottom))})`);
		g = makeTransfersBreakdownSubplot(g, response, i, plotSize);
	}

	let axisG = svg.append("g").attr("transform", `translate(${tfrFigureMargin.left+plotMargin.left}, ${tfrFigureMargin.top + (N * (plotSize.height + plotMargin.top + plotMargin.bottom))})`);
	axisG = makeTransfersBreakdownXAxis(axisG, response, plotSize);

	svg.append("text")
		.attr("transform", `translate(10,${tfrFigureSize.height/2 + 40}) rotate(-90)`)
		.attr("font-family", "monospace")
		.attr("font-size", 10)
		.text("Origin Hospital");

	return svg.node();
}

function makeTransfersBreakdownSubplot(svg, response, locIdx, plotSize) {

	const dates = response.config.dates.map(d => new Date(d));
	const x = d3.scaleUtc()
		.domain(d3.extent(dates))
		.range([0, plotSize.width]);

	const maxY = d3.max(response.sent.flat().flat());
	const y = d3.scaleLinear()
		.domain([0, maxY]).nice()
		.range([plotSize.height, 0]);

	const xAxis = g => g
	.attr("transform", `translate(0,${plotSize.height})`)
	.style("font-family", "monospace")
	.style("font-size", "8px")
	.call(d3.axisBottom(x)
		.ticks(d3.utcWeek.every(1))
		.tickSize(-plotSize.height)
		.tickFormat("")
	)
	.call(g => g.select(".domain").remove())
	.call(g => g.selectAll(".tick line")
		.attr("stroke-width", 0.25)
		.attr("stroke-opacity", 0.5)
		.attr("stroke-dasharray", "4,4")
	);

	const yAxis = svg => svg
	.attr("transform", `translate(0,0)`)
	.style("font-family", "monospace")
	.style("font-size", "8px")
	.call(d3.axisRight(y)
		.ticks(4)
		.tickSize(plotSize.width)
	)
	.call(g => g.select(".domain")
		.remove()
	)
	.call(g => g.selectAll(".tick line")
		.attr("stroke-width", 0.25)
		.attr("stroke-opacity", 0.5)
		.attr("stroke-dasharray", "4,4")
	)
	.call(g => g.selectAll(".tick text")
		.attr("x", "-10px")
		.attr("dy", "4px")
		.attr("text-anchor", "end")
	);

	svg.append("g")
		.call(xAxis);
	svg.append("g")
		.call(yAxis);

	svg.append("text")
		.style("text-anchor", "center")
		.style("font-family", "monospace")
		.style("font-size", 8)
		.attr("transform", `translate(-25,${y(maxY/2)+20}) rotate(-90)`)
		.text("Transfers");

	svg.append("text")
		.style("text-anchor", "center")
		.style("font-family", "monospace")
		.style("font-size", 9)
		.attr("transform", `translate(-60,${y(maxY/2)})`)
		.text(response.config.node_names[locIdx]);

	const N = response.config.node_names.length;
	const T = response.config.dates.length;

	const data = d3.range(T).map(t => {
		let vals = d3.cumsum(response.sent[locIdx], a => a[t]);
		return {
			date: dates[t],
			values: vals,
		}
	});

	const series = d3.range(N).map(j => {
		return data.map(d => {
			return {
				date: d.date,
				key: j,
				color: tfrBarColors[response.config.node_names[j]],
				0: (j == 0) ? 0 : d.values[j-1],
				1: d.values[j],
			}
		});
	});

	// const binWidth = 5;
	const binWidth = 1.0 * (x(dates[1]) - x(dates[0]));

	svg.append("g")
		.selectAll("g")
		.data(series)
		.join("g")
		.selectAll("rect")
			.data(d => d)
			.join("rect")
				.attr("x", d => x(d.date))
				.attr("y", d => y(d[1]))
				.attr("height", d => y(d[0]) - y(d[1]))
				.attr("width", binWidth)
				.attr("fill", d => d.color);

	return svg;
}

function makeTransfersBreakdownXAxis(svg, response, plotSize) {
	const dates = response.config.dates.map(d => new Date(d));
	const x = d3.scaleUtc()
		.domain(d3.extent(dates))
		.range([0, plotSize.width]);

	const xAxis = g => g
	.style("font-family", "monospace")
	.style("font-size", "8px")
	.call(d3.axisBottom(x)
		.ticks(d3.utcWeek.every(1))
		.tickSize(0)
		.tickFormat(d3.timeFormat("%m/%d"))
	)
	.call(g => g.select(".domain").remove())
	.call(g => g.selectAll(".tick text")
		.attr("dy", -2)
	);

	svg.append("g")
		.call(xAxis);

	return svg;
}
