function createRidgePlot(table, location_names, resource, add_description=true) {
	const data = convertData(table, location_names);
	const fig = buildRidgePlot(data, resource);

	const section = document.getElementById("section-results-transfers");
	if (add_description) {
		let description = document.createElement("p");
		description.innerHTML = ridgeplotDescription;
		section.appendChild(description);
	}

	section.appendChild(fig);

	let hr = document.createElement("hr");
	section.appendChild(hr);
}

function convertData(table, location_names) {
	const dates = Object.keys(table);
	return {
		dates: dates.map(d => Date.parse(d)),
		series: location_names.map((s,i) => { return {name: s, values: dates.map(d => table[d][i])} })
	}
}

function buildRidgePlot(data, resource) {

	const margin = {top: 60, right: 120, bottom: 30, left: 100};
	const scaleFactor = 0.8;
	const width = 1000;
	const heght_scale = 60;

	const height = data.series.length * heght_scale;
	const colorscale_height = Math.min(300, 0.8 * height);

	let title = "";
	let colorLabel = "";
	if (resource === "patients") {
		title = "Net Patients Recieved per Location over Time";
		colorLabel = "Net Patients";
	} else if (resource == "nurses") {
		title = "Net Nurses per Location over Time";
		colorLabel = "Net Nurses";
	}

	const maxElem = Math.max(Math.abs(d3.min(data.series, d => d3.min(d.values))), Math.abs(d3.max(data.series, d => d3.max(d.values))))

	const x = d3.scaleTime()
		.domain(d3.extent(data.dates))
		.range([margin.left, width - margin.right]);
	const y = d3.scalePoint()
		.domain(data.series.map(d => d.name))
		.range([margin.top, height - margin.bottom]);
	const z = d3.scaleLinear()
		.domain([-maxElem, maxElem]).nice()
		.range([-scaleFactor*y.step(), scaleFactor*y.step()])

	xAxis = g => g
		.attr("transform", `translate(0,${height - margin.bottom})`)
		.style("font-size","12px")
		.call(d3.axisBottom(x)
			.ticks(width / 100)
			.tickSizeOuter(0)
			.tickFormat(d3.timeFormat("%m/%d"))
		);
	yAxis = g => g
		.attr("transform", `translate(${margin.left},0)`)
		.style("font-size","12px")
		.call(d3.axisLeft(y).tickSize(0).tickPadding(10))
		.call(g => g.select(".domain").remove());

	const colorbarScale = d3.scalePoint()
		.domain(d3.range(Math.round(maxElem), -Math.round(maxElem)-1, -Math.round(maxElem/1)))
		.range([(height/2) - (colorscale_height/2), (height/2) + (colorscale_height/2)]);
	colorAxis = g => g
		.attr("transform", `translate(${width-margin.right+50},0)`)
		.style("font-size","11px")
		.call(d3.axisRight(colorbarScale)
		.tickPadding(4))
		.call(g => g.select(".domain").remove());
	const color = d3.scaleSequential([1,0], d3.interpolateRdYlGn);

	const area = d3.area()
		.curve(d3.curveBasis)
		.defined(d => !isNaN(d))
		.x((d, i) => x(data.dates[i]))
		.y0(0)
		.y1(d => z(d));
	const line = area.lineY1();


	const svg = d3.create("svg")
		.attr("viewBox", [0, 0, width, height]);

	svg.append("g")
		.call(xAxis);

	svg.append("g")
		.call(yAxis);

	svg.append("g")
		.call(colorAxis);

	svg.append("text")
		.attr("x", (width)/2)
		.attr("y", 20)
		.attr("text-anchor", "middle")
		.style("font-family", "Helvetica")
		.style("font-size", "18px")
		.text(title);

	svg.append("text")
		.attr("x", width-80)
		.attr("y", (height/2) - (colorscale_height/2) - 10)
		.attr("text-anchor", "middle")
		.style("font-family", "Helvetica")
		.style("font-size", "12px")
		.text(colorLabel);

	const group = svg.append("g")
		.selectAll("g")
		.data(data.series)
		.join("g")
			.attr("transform", d => `translate(0,${y(d.name) + 1})`);

	const gradient = group.append("linearGradient")
		.attr("id", (d,i) => (d.uid = "grad-"+i))
		.attr("gradientUnits", "userSpaceOnUse")
		.attr("x1", 0)
		.attr("x2", width)
		.attr("y1", 0)
		.attr("y2", 0)
		.selectAll("stop")
		.data((d,i) => data.series[i].values)
		.join("stop")
			.attr("offset", (d,i) => x(data.dates[i]) / width)
			.attr("stop-color", d => color((d / maxElem) + 0.5));

	group.append("path")
		.attr("fill", d => `url(#${d.uid})`)
		.attr("d", d => area(d.values));

	group.append("path")
		.attr("fill", "none")
		.attr("stroke", "black")
		.attr("d", d => line(d.values));

	const defs = svg.append("defs");
	let linearGradient = defs.append("linearGradient")
		.attr("id", "linear-gradient")
		.attr("x1", 0)
		.attr("x2", 0)
		.attr("y1", 0)
		.attr("y2", 1);
	linearGradient.selectAll("stop")
		.data(color.ticks().reverse())
		.join("stop")
			.attr("offset", d => d)
			.attr("stop-color", d => color(d));
		svg.append("rect")
			.attr("x", width - margin.right + 30)
			.attr("y", (height/2) - (colorscale_height/2))
			.attr("width", 20)
			.attr("height", colorscale_height)
			.style("fill", "url(#linear-gradient)");

	return svg.node();
}
