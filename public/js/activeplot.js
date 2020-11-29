const activePlotHeight = 400;
const activePlotWidth  = 600;
const activePlotMargin = ({top: 30, right: 30, bottom: 30, left: 40});

const font = "Helvetica";
const axisFontSize = "17px";
const titleFontSize = "22px";

const active_color = "#17AC7B";
const active_null_color = "#15ACF8";

const capacityColors = ["gold", "darkorange", "red", "black"];

const lineWidth = 4;
const bedsLineWidth = 8;

const addPoints = true;


function createActivePlot(active, active_null, capacity, config, add_description=true) {
	const N = capacity.length;
	const T = config.dates.length;
	const C = capacity[0].length;

	const ncols = 3;
	const nrows = Math.ceil(N / ncols);

	let tableEntries = [];
	let table = document.createElement("table");
	for (let i = 0; i < nrows; i++) {
		let row = document.createElement("tr");
		row.style.width = "100%";
		for (let j = 0; j < ncols; j++) {
			let entry = document.createElement("td");
			entry.style.width = "23%";
			row.appendChild(entry);
			tableEntries.push(entry);
		}
		table.appendChild(row);
	}
	table.className = "activeplots-table";

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
			const d = new Date(Date.parse(config.dates[t]));
			active_data[i][t] = {
				"date": d,
				"value": active[i][t],
			};
			active_null_data[i][t] = {
				"date": d,
				"value": active_null[i][t],
			};
			for (let c = 0; c < C; c++) {
				capacity_data[i][c][t] = {
					"date": d,
					"value": capacity[i][c],
				};
			}
		}
	}
	const data = {
		"active": active_data,
		"active_null": active_null_data,
		"capacity": capacity_data,
	};

	const x = d3.scaleUtc()
		.domain(d3.extent(config.dates, d => new Date(Date.parse(d))))
		.range([activePlotMargin.left, activePlotWidth - activePlotMargin.right]);

	const xAxis = g => g
		.attr("transform", `translate(0,${activePlotHeight - activePlotMargin.bottom})`)
		.style("font-family", font)
		.style("font-size", axisFontSize)
		.call(d3.axisBottom(x)
			.ticks(d3.timeWeek.every(1))
			.tickSize(-(activePlotHeight - activePlotMargin.top - activePlotMargin.bottom))
			.tickFormat(d3.timeFormat("%m/%d"))
		)
		.call(g => g.select(".domain").remove())
		.call(g => g.selectAll(".tick line")
			.attr("stroke-opacity", 0.5)
			.attr("stroke-dasharray", "4,4"))
		.call(g => g.selectAll(".tick text").attr("dy", "20px"));


	for (let i = 0; i < N; i++) {
		let svg = d3.create("svg")
			.attr("viewBox", [0, 0, activePlotWidth, activePlotHeight]);

		svg.append("text")
			.attr("x", activePlotWidth/2)
			.attr("y", 20)
			.attr("text-anchor", "middle")
			.style("font-family", font)
			.style("font-size", titleFontSize)
			.text(config.node_names[i]);

		const maxActive = d3.max(active[i]);
		const maxActiveNull = d3.max(active_null[i]);
		const maxY = d3.max([maxActive, maxActiveNull, capacity[i][C-1]]);

		const y = d3.scaleLinear()
			.domain([0, maxY]).nice()
			.range([activePlotHeight - activePlotMargin.bottom, activePlotMargin.top]);

		const yAxis = g => g
			.attr("transform", `translate(${activePlotMargin.left},0)`)
			.style("font-family", font)
			.style("font-size", axisFontSize)
			.call(d3.axisRight(y)
				.ticks(4)
				.tickSize(activePlotWidth - activePlotMargin.left - activePlotMargin.right)
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

		const line = d3.line()
			.defined(d => !isNaN(d.value))
			.x(d => x(d.date))
			.y(d => y(d.value));

		svg.append("g")
			.call(xAxis);

		svg.append("g")
			.call(yAxis);

		for (let c = 0; c < C; c++) {
			svg.append("path")
			.datum(data["capacity"][i][c])
			.attr("fill", "none")
			.attr("stroke", capacityColors[c])
			.attr("stroke-width", bedsLineWidth)
			.attr("stroke-linejoin", "round")
			.attr("stroke-linecap", "square")
			.attr("d", line);
		}

		svg.append("path")
			.datum(data["active"][i])
			.attr("fill", "none")
			.attr("stroke", active_color)
			.attr("stroke-width", lineWidth)
			.attr("stroke-linejoin", "round")
			.attr("stroke-linecap", "round")
			.attr("d", line);

		svg.append("path")
			.datum(data["active_null"][i])
			.attr("fill", "none")
			.attr("stroke", active_null_color)
			.attr("stroke-width", lineWidth)
			.attr("stroke-linejoin", "round")
			.attr("stroke-linecap", "round")
			.attr("d", line);

		if (addPoints) {
			svg.selectAll(".point")
				.data(data["active"][i])
				.enter().append("svg:circle")
				.attr("fill", active_color)
				.attr("stroke", "white")
				.attr("stroke-width", 2)
				.attr("cx", d => x(d.date))
				.attr("cy", d => y(d.value))
				.attr("r", lineWidth+2);

			svg.selectAll(".point")
				.data(data["active_null"][i])
				.enter().append("svg:circle")
				.attr("fill", active_null_color)
				.attr("stroke", "white")
				.attr("stroke-width", 2)
				.attr("cx", d => x(d.date))
				.attr("cy", d => y(d.value))
				.attr("r", lineWidth+2);
		}

		let svgNode = svg.node();

		const tooltip = new Tooltip(x,y);
		svg.append(() => tooltip.node);

		svgNode.addEventListener("mousemove", event => {
			const tdWidth = svgNode.clientWidth;
			const z = (event.offsetX / tdWidth) * activePlotWidth;
			const w = event.offsetY * (activePlotWidth / tdWidth);
			const d = bisect([data["active"][i], data["active_null"][i]], x.invert(z), y.invert(w));
			tooltip.show(d);
		});
		svgNode.addEventListener("mouseleave", () => tooltip.hide());

		svgNode.style.width = "100%";
		tableEntries[i].appendChild(svgNode);
	}

	const section = document.getElementById("section-results-active");

	if (add_description) {
		let description = document.createElement("p");
		description.innerHTML = activeplotDescription;
		section.appendChild(description);
	}

	const activeLabels = ["Active Patients", "Active Patients (Without Transfers)"];
	const activeColors = [active_color, active_null_color];
	const patientsColorscaleElem = makeHorizontalColorScale(activeLabels, activeColors);
	section.appendChild(patientsColorscaleElem);

	const capacityNames = [
		"Baseline Capacity",
		"Ramp-Up Capacity",
		"Surge Capacity",
		"Max Capacity",
	];
	const capacityColorscaleElem = makeHorizontalColorScale(capacityNames, capacityColors);
	section.appendChild(capacityColorscaleElem);

	section.appendChild(table);
}

function makeHorizontalColorScale(labels, colors) {
	const C = labels.length;

	const totalWidth = 0.5 * document.getElementById("results-container").offsetWidth;

	const maxLabelLength = d3.max(labels, x => x.length);
	const colWidth = (maxLabelLength * 4.5) + 14 + 20;

	const actualWidth = colWidth * C;
	const marginLeft  = (totalWidth - actualWidth) / 2;

	const svg = d3.create("svg")
		.attr("viewBox", [0, 0, totalWidth, 20]);

	for (let c = 0; c < C; c++) {

		const offset = c * colWidth;

		svg.append("rect")
			.attr("x", marginLeft + 2 + offset)
			.attr("y", 2)
			.attr("width", 10)
			.attr("height", 10)
			.attr("fill", colors[c])
			.attr("stroke", "none");

		svg.append("text")
			.attr("x", marginLeft + 18 + offset)
			.attr("y", 10)
			.attr("text-anchor", "start")
			.style("font-family", font)
			.style("font-size", "10px")
			.text(labels[c]);

	}

	let colorscale = svg.node();

	let colorscaleElem = document.createElement("div");
	colorscaleElem.className = "column is-6 is-offset-3";
	colorscaleElem.style.padding = "0";
	colorscaleElem.appendChild(colorscale);

	return colorscaleElem;
}

const bisectDate = d3.bisector(d => d.date).left;
function bisect(lines, date, yval) {
	const line1 = lines[0];
	const i = bisectDate(line1, date, 1);
	const a = line1[i - 1], b = line1[i];
	const d = date - a.date > b.date - date ? b.date : a.date;
	const v = lines.map(l => l.findIndex(x => x.date == d));
	const j = d3.minIndex(v.map((x,k) => Math.abs(lines[k][x].value - yval)));
	return lines[j][v[j]];
}

class Tooltip {
	constructor(x,y) {
		this._x = x;
		this._y = y;

		let tmpSVG = d3.create("svg");
		let tmpNode = tmpSVG.append("g")
			.attr("pointer-events", "none")
			.attr("display", "none")
			.attr("font-family", font)
			.attr("font-size", "20px")
			.attr("text-anchor", "middle");

		tmpNode.append("rect")
			.attr("x", -60)
			.attr("y", -70)
			.attr("width", 120)
			.attr("height", 50)
			.attr("fill", "white")
			.attr("stroke", "gray")
			.attr("stroke-width", 1.5);
		tmpNode.append("rect")
			.attr("transform", "translate(0, -35) rotate(45)")
			.attr("width", 18)
			.attr("height", 18)
			.attr("fill", "white")
			.attr("stroke", "gray")
			.attr("stroke-width", 1.5);
		tmpNode.append("rect")
			.attr("x", -60)
			.attr("y", -70)
			.attr("width", 120)
			.attr("height", 50)
			.attr("fill", "white");

		this._date = tmpNode.append("text").attr("y", "-50").node();
		this._yval = tmpNode.append("text").attr("y", "-25").node();

		tmpNode.append("circle")
			.attr("stroke", "black")
			.attr("fill", "none")
			.attr("r", 6);

		this.node = tmpNode.node();
	}

	show(d) {
		this.node.removeAttribute("display");
		this.node.setAttribute("transform", `translate(${this._x(d.date)},${this._y(d.value)})`);
		this._date.textContent = d3.timeFormat("%Y-%m-%d")(d.date);
		this._yval.textContent = d.value.toFixed(0);
	}

	hide() {
		this.node.setAttribute("display", "none");
	}
}
