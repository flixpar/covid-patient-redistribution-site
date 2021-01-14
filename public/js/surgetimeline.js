const surgeTimelineBarHeight = 15;
const surgeTimelinePlotWidth = 600;

const surgeTimelinePlotMargins = {left: 0, right: 0, top: 0, bottom: 0};
const surgeTimelineBarPadding = {height: 0.1, width: 0};

const surgeTimelineColorscale = {
	"-1": "black",
	0: "seagreen",
	1: "gold",
	2: "red",
};

import {generateFigureDownloadButtons} from "./patients_common.js";
import {surgeTimelineDescription} from "./figure_text.js";
import {getDateIntervals} from "./loadplots.js";


export function createSurgeTimeline(response, add_description=true) {
	const section = document.getElementById("section-results-surgetimeline");
	if (add_description) {
		let description = document.createElement("p");
		description.innerHTML = surgeTimelineDescription(response);
		section.appendChild(description);
	}

	const figOptions = addSurgeTimelineOptions(response);
	section.appendChild(figOptions);

	const fig = makeSurgeTimeline(response, true, true);
	section.appendChild(fig);

	fig.classList.add("figure");
	fig.setAttribute("figure-name", "surgetimeline");
}

function makeSurgeTimeline(response, addLabels=false, withTransfers=true) {
	const N = response.config.node_names.length;

	let svg = d3.create("svg").attr("viewBox", [0, 0, surgeTimelinePlotWidth, N*surgeTimelineBarHeight]);
	svg.attr("id", "surgetimeline-figure");

	const yScale = d3.scaleBand()
		.domain(d3.range(N))
		.rangeRound([0, N*surgeTimelineBarHeight])
		.padding(surgeTimelineBarPadding.height);

	const dates = response.config.dates.map(d => new Date(d));
	const xScale = d3.scaleUtc()
		.domain(d3.extent(dates))
		.range([0, surgeTimelinePlotWidth]);

	const timelineData = computeSurgeTimelineData(response, withTransfers);

	const tooltip = new SurgeTimelineTooltip(svg, response);

	Date.prototype.addDays = function(days) {
		let date = new Date(this.valueOf());
		date.setDate(date.getDate() + days);
		return date;
	}

	svg.append("g")
		.selectAll("rect")
		.data(timelineData)
		.join("rect")
		.attr("x", d => xScale(d.startDate) + surgeTimelineBarPadding.width)
		.attr("y", d => yScale(d.locIdx))
		.attr("height", yScale.bandwidth())
		.attr("width", d => xScale(d.endDate.addDays(1)) - xScale(d.startDate) - 2*surgeTimelineBarPadding.width)
		.attr("fill", d => d.color)
		.attr("cursor", "pointer")
		.on("mouseover", (e,d) => tooltip.show(e,d))
		.on("mouseout", (e,d) => tooltip.hide(e,d));

	svg = makeSurgeTimelineAxis(svg, xScale, response);

	svg = makeSurgeTimelineLegend(svg, response);

	if (addLabels) {
		svg = makeSurgeTimelineLabels(svg, yScale, response);
	}

	svg.append(() => tooltip.node);

	return svg.node();
}

function makeSurgeTimelineLabels(svg, yScale, response) {
	const labels = response.config.node_names;

	const maxTextLength = d3.max(labels, l => l.length);
	const fontSize = surgeTimelineBarHeight * (2/3);
	const maxLength = maxTextLength * fontSize * 0.5;

	svg.append("g")
		.selectAll("rect")
		.data(labels)
		.join("text")
		.attr("x", -5)
		.attr("y", (d,i) => yScale(i) + (surgeTimelineBarHeight/2))
		.attr("text-anchor", "end")
		.attr("alignment-baseline", "middle")
		.style("font-family", "sans-serif")
		.style("font-size", fontSize + "px")
		.text(d => d);

	let viewBox = svg.attr("viewBox").split(",").map(z => parseFloat(z));
	viewBox[0] -= maxLength + 10;
	viewBox[2] += maxLength + 10;
	svg.attr("viewBox", viewBox);

	return svg;
}

function makeSurgeTimelineAxis(svg, xScale, response, debug=false) {

	const axisHeight = 20;

	let viewBox = svg.attr("viewBox").split(",").map(z => parseFloat(z));
	const width = viewBox[2];
	const offsetY = viewBox[3];

	if (debug) {
		svg.append("rect")
			.attr("x", 0)
			.attr("y", offsetY)
			.attr("width", width)
			.attr("height", axisHeight)
			.attr("fill", "none")
			.attr("stroke", "black");
	}

	const xAxis = g => g
		.attr("transform", `translate(${surgeTimelinePlotMargins.left},${offsetY})`)
		.call(d3.axisBottom(xScale)
			.ticks(d3.utcDay.every(1))
			.tickSize(6)
			.tickFormat("")
		)
		.call(g => g.select(".domain").remove())
		.call(g => g.selectAll(".tick line")
			.attr("stroke-width", 0.25)
			.attr("stroke-opacity", 0.65)
			.attr("stroke", "black")
		);

	svg.append("g")
		.call(xAxis);

	// const dateFormat = "%m/%d";
	const dateFormat = "%m/%d/%y";
	// const dateFormat = "%Y-%m-%d";

	const dates = response.config.dates.map(d => new Date(Date.parse(d)));
	const xInterval = getDateIntervals(dates);

	const xAxisLabels = g => g
		.attr("transform", `translate(${surgeTimelinePlotMargins.left},${offsetY})`)
		.style("font-family", "monospace")
		.style("font-size", "8px")
		.call(d3.axisBottom(xScale)
			.ticks(xInterval)
			.tickSize(6)
			.tickFormat(d3.timeFormat(dateFormat))
		)
		.call(g => g.select(".domain").remove())
		.call(g => g.selectAll(".tick line")
			.attr("stroke-width", 0.5)
			.attr("stroke-opacity", 1.0)
			.attr("stroke", "black")
		)
		.call(g => g.selectAll(".tick text")
			.attr("fill", "black")
		);

	svg.append("g")
		.call(xAxisLabels);

	viewBox[3] += axisHeight;
	svg.attr("viewBox", viewBox);

	return svg;
}

function makeSurgeTimelineLegend(svg, response) {
	let viewBox = svg.attr("viewBox").split(",").map(z => parseFloat(z));
	const width = viewBox[2];
	const offsetY = viewBox[3];

	let legendHeight;
	let legendG = svg.append("g").attr("transform", `translate(0,${offsetY})`);

	let legendLabels = ["Within Capacity", "At Capacity", "Over Capacity"];
	let legendColors = d3.range(3).map(i => surgeTimelineColorscale[i]);

	legendG, legendHeight = makeMultiRowLegend(legendG, legendLabels, legendColors, width);

	viewBox[3] += legendHeight;
	svg.attr("viewBox", viewBox);

	return svg;
}

function makeMultiRowLegend(svg, labels, colors, totalWidth) {
	const N = labels.length;

	const maxNameLength = d3.max(labels, x => x.length);
	const rowHeight = 9;
	const colWidth = (maxNameLength * (rowHeight-2) * 0.5) + rowHeight + 5 + 10;

	const maxCols = Math.floor(totalWidth / colWidth);
	const nRows = Math.ceil(N / maxCols);
	const nCols = Math.min(maxCols, N);

	const actualWidth = colWidth * nCols;
	const marginLeft  = (totalWidth - actualWidth) / 2;
	const marginTop   = 10;

	const totalHeight = (nRows * rowHeight) + marginTop + 5;

	const debug = false;

	for (let i = 0; i < nRows; i++) {
		for (let j = 0; j < nCols; j++) {
			const k = (i*nCols) + j;
			if (k >= N) continue;

			svg.append("rect")
				.attr("x", marginLeft + ( colWidth * j))
				.attr("y", marginTop  + (rowHeight * i))
				.attr("width", rowHeight)
				.attr("height", rowHeight)
				.attr("rx", 3)
				.attr("ry", 3)
				.attr("fill", colors[k])
				.attr("stroke", "none");

			svg.append("text")
				.attr("x", marginLeft + ( colWidth * j) + rowHeight + 4)
				.attr("y", marginTop  + (rowHeight * (i+0.5)))
				.attr("text-anchor", "start")
				.attr("alignment-baseline", "central")
				.style("font-family", "sans-serif")
				.style("font-size", rowHeight-2)
				.text(labels[k]);

			if (debug) {
				svg.append("rect")
					.attr("x", marginLeft + ( colWidth * j))
					.attr("y", marginTop  + (rowHeight * i))
					.attr("width", colWidth)
					.attr("height", rowHeight)
					.attr("fill", "none")
					.attr("stroke", "gray");
			}
		}
	}

	if (debug) {
		svg.append("rect")
			.attr("x", marginLeft)
			.attr("y", 0)
			.attr("width", actualWidth)
			.attr("height", totalHeight)
			.attr("fill", "none")
			.attr("stroke", "blue");
	}

	return svg, totalHeight;
}

class SurgeTimelineTooltip {
	constructor(svg, response) {
		this.svg = svg;
		this.response = response;
		this.highlight = null;

		this.svgHeight = parseInt(svg.attr("viewBox").split(",")[3]);

		let tmpSVG = d3.create("svg");
		let tooltipNode = tmpSVG.append("g")
			.attr("pointer-events", "none")
			.attr("display", "none")
			.attr("font-family", "monospace")
			.attr("font-size", "7px")
			.attr("text-anchor", "middle");

		this.bubble = tooltipNode.append("rect")
			.attr("x", -60)
			.attr("y", -35)
			.attr("width", 120)
			.attr("height", 30)
			.attr("fill", "white")
			.attr("stroke", "gray")
			.attr("stroke-width", 1.5);
		this.topTab = tooltipNode.append("rect")
			.attr("transform", "translate(0, -39) rotate(45)")
			.attr("width", 12)
			.attr("height", 12)
			.attr("fill", "white")
			.attr("stroke", "gray")
			.attr("stroke-width", 1.0);
		this.bottomTab = tooltipNode.append("rect")
			.attr("transform", "translate(0, -18) rotate(45)")
			.attr("width", 12)
			.attr("height", 12)
			.attr("fill", "white")
			.attr("stroke", "gray")
			.attr("stroke-width", 1.0);
		this.bubbleBackground = tooltipNode.append("rect")
			.attr("x", -60)
			.attr("y", -35)
			.attr("width", 120)
			.attr("height", 30)
			.attr("fill", "white");

		this.tooltipNode = tooltipNode;

		this.textLine1 = tooltipNode.append("text").attr("y", "-26").node();
		this.textLine2 = tooltipNode.append("text").attr("y", "-17").node();
		this.textLine3 = tooltipNode.append("text").attr("y", "-8").node();

		this.capacityLevels = ["Within Capacity", "At Capacity", "Over Capacity"];

		this.node = tooltipNode.node();
	}

	show(e,d) {
		this.node.removeAttribute("display");

		this.textLine1.textContent = this.response.config.node_names[d.locIdx];
		this.textLine2.textContent = this.capacityLevels[d.capacityLevel];
		this.textLine3.textContent = d.startDate.toISOString().substr(0,10) + " - " + d.endDate.toISOString().substr(0,10);

		this.highlight = e.srcElement.cloneNode();
		this.highlight.setAttribute("fill", "none");
		this.highlight.setAttribute("stroke", "gray");
		this.highlight.setAttribute("stroke-width", "1.5px");
		e.srcElement.parentElement.appendChild(this.highlight);

		const bbox = e.srcElement.getBBox();
		const xCenter = bbox.x + (bbox.width / 2);
		const yOffset = bbox.y;
		const barHeight = bbox.height;

		const positionBottom = (yOffset+(2*barHeight)+28 <= this.svgHeight);

		if (positionBottom) {
			this.node.setAttribute("transform", `translate(${xCenter},${yOffset+(2*barHeight)+28})`);
			this.topTab.node().removeAttribute("display");
			this.bottomTab.node().setAttribute("display", "none");
		} else {
			this.node.setAttribute("transform", `translate(${xCenter},${yOffset})`);
			this.topTab.node().setAttribute("display", "none");
			this.bottomTab.node().removeAttribute("display");
		}

		const textWidth = this.textLine1.textContent.length * 7 * 0.6 + 20;
		if (textWidth > 120) {
			this.bubble.attr("width", textWidth);
			this.bubble.attr("x", -textWidth/2);
			this.bubbleBackground.attr("width", textWidth);
			this.bubbleBackground.attr("x", -textWidth/2);
		}
	}

	hide(e,d) {
		if (this.highlight != null) {
			this.highlight.remove();
			this.highlight = null;
		}
		this.node.setAttribute("display", "none");
	}
}

function computeSurgeTimelineData(response, withTransfers=true) {
	const dates = response.config.dates.map(d => new Date(d));
	const T = dates.length;

	const N = response.config.node_names.length;

	let timelineData = [];
	for (let locIdx = 0; locIdx < N; locIdx++) {
		const capacity = response.capacity[locIdx];
		let prevLevel = null;
		let startDate = 0;

		for (let t = 0; t < T; t++) {
			const activeToday = withTransfers ? response.active[locIdx][t] : response.active_null[locIdx][t];

			let currentLevel = -1;
			if (activeToday <= 0.9 * capacity) {
				currentLevel = 0;
			} else if (activeToday <= 1.05 * capacity) {
				currentLevel = 1;
			} else {
				currentLevel = 2;
			}

			if (currentLevel != prevLevel && t != 0) {
				timelineData.push({
					startDate: dates[startDate],
					endDate: dates[t-1],
					capacityLevel: prevLevel,
					color: surgeTimelineColorscale[prevLevel],
					locIdx: locIdx,
				});
				startDate = t;
				prevLevel = currentLevel;
			}
			if (t == 0) {
				prevLevel = currentLevel;
			}
		}

		timelineData.push({
			startDate: dates[startDate],
			endDate: dates[T-1],
			capacityLevel: prevLevel,
			color: surgeTimelineColorscale[prevLevel],
			locIdx: locIdx,
		});
	}

	return timelineData;
}

function addSurgeTimelineOptions(response) {
	let select = document.createElement("select");
	select.id = "surgetimeline-options-select";
	select.className = "select-bold-text";

	const optionNames = ["With Optimal Transfers", "Without Optimal Transfers"];
	for (let c = 0; c < optionNames.length; c++) {
		let opt = document.createElement("option");
		opt.text = optionNames[c];
		opt.value = c;
		select.appendChild(opt);
	}

	select.addEventListener("change", e => {
		e.preventDefault();

		const sel = e.target;
		const includeTransfers = (sel.options[sel.selectedIndex].value == 0);

		const fig = makeSurgeTimeline(response, true, includeTransfers);
		document.getElementById("surgetimeline-figure").replaceWith(fig);
	});

	let selectField = document.createElement("div");
	selectField.className = "select is-fullwidth";
	selectField.style.width = "40%";
	selectField.style.marginLeft = "30%";
	selectField.style.marginTop= "15px";

	selectField.appendChild(select);

	return selectField;
}
