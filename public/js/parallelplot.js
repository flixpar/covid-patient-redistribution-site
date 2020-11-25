const sankeyHeight = 600;
const sankeyWidth = 1000;
const sankeyMargins = {top: 25, bottom: 5, left: 30, right: 30};

function createParallelPlot(response, resource, add_description=true) {
	const graph = toGraph(response, false);
	const fig = buildChart(graph, resource);

	const section = document.getElementById("section-results-transfers");
	if (add_description) {
		let description = document.createElement("p");
		description.innerHTML = parallelplotDescription;
		section.appendChild(description);
	}

	section.appendChild(fig);

	let hr = document.createElement("hr");
	section.appendChild(hr);
}

function buildChart(graph, resource) {

	let title = "";
	let lhs = "";
	let rhs = "";
	if (resource === "patients") {
		title = "Patient Transfers";
		lhs = "Patients Sent";
		rhs = "Patients Received";
	} else if (resource == "nurses") {
		title = "Net Nurse Transfers";
		lhs = "Nurses Sent";
		rhs = "Nurses Received";
	}

	let svg = d3.create("svg")
		.attr("viewBox", [0, 0, sankeyWidth, sankeyHeight]);

	const {nodes, links} = toSankey(graph);
	const nLocs = nodes.length;

	format = d3.format(",.0f");

	svg.append("text")
		.attr("x", sankeyWidth/2)
		.attr("y", 15)
		.attr("text-anchor", "middle")
		.style("font-family", "Helvetica")
		.style("font-size", "18px")
		.text(title);

	svg.append("text")
		.attr("x", sankeyWidth-sankeyMargins.right+25)
		.attr("y", sankeyHeight/2)
		.attr("text-anchor", "middle")
		.style("font-family", "Helvetica")
		.style("font-size", "18px")
		.attr("transform", `rotate(-90,${sankeyWidth-sankeyMargins.right+25},${sankeyHeight/2})`)
		.text(rhs);

	svg.append("text")
		.attr("x", sankeyMargins.right/2)
		.attr("y", sankeyHeight/2)
		.attr("text-anchor", "middle")
		.style("font-family", "Helvetica")
		.style("font-size", "18px")
		.attr("transform", `rotate(-90,${sankeyMargins.right/2},${sankeyHeight/2})`)
		.text(lhs);

	let color = d3.scaleOrdinal()
	    .domain(d3.range(nLocs))
	    .range(d3.range(nLocs).map(x => d3.interpolatePlasma(x/nLocs)))

	svg.append("g")
		.selectAll("rect")
		.data(nodes)
		.join("rect")
			.attr("x", d => d.x0)
			.attr("y", d => d.y0)
			.attr("height", d => d.y1 - d.y0)
			.attr("width", d => d.x1 - d.x0)
			.attr("fill", d => color(d.index))
		.append("title")
			.text(d => `${d.name.substring(0,d.name.length-4)}\n${format(d.value)}`);

	const link = svg.append("g")
			.attr("fill", "none")
			.attr("stroke-opacity", 0.5)
			.selectAll("g")
		.data(links)
		.join("g")
			.style("mix-blend-mode", "multiply");

	const gradient = link.append("linearGradient")
		.attr("id", d => (d.uid = "gradient-"+d.index))
		.attr("gradientUnits", "userSpaceOnUse")
		.attr("x1", d => d.source.x1)
		.attr("x2", d => d.target.x0);

	gradient.append("stop")
		.attr("offset", "0%")
		.attr("stop-color", d => color(d.source.index));

	gradient.append("stop")
		.attr("offset", "100%")
		.attr("stop-color", d => color(d.target.index));

	const edgeColor = "path";
	link.append("path")
		.attr("d", d3.sankeyLinkHorizontal())
		.attr("stroke", d => edgeColor === "none" ? "#aaa"
			: edgeColor === "path" ? `url(#${d.uid})`
			: edgeColor === "input" ? color(d.index)
			: color(d.target))
		.attr("stroke-width", d => Math.max(1, d.width));

	link.append("title")
		.text(d => `${d.source.name.substring(0,d.source.name.length-4)} → ${d.target.name.substring(0,d.target.name.length-4)}\n${format(d.value)}`);

	svg.append("g")
			.attr("font-family", "sans-serif")
			.attr("font-size", 11)
			.selectAll("text")
		.data(nodes)
		.join("text")
			.attr("x", d => d.x0 < sankeyWidth / 2 ? d.x1 + 6 : d.x0 - 6)
			.attr("y", d => (d.y1 + d.y0) / 2)
			.attr("dy", "0.35em")
			.attr("text-anchor", d => d.x0 < sankeyWidth / 2 ? "start" : "end")
		.text(d => d.name.substring(0,d.name.length-4));

	return svg.node();
}

function toSankey(graph) {
	const align = "justify";
	const sankey = d3.sankey()
		.nodeId(d => d.name)
		.nodeAlign(d3[`sankey${align[0].toUpperCase()}${align.slice(1)}`])
		.nodeWidth(15)
		.nodePadding(10)
		.extent([[sankeyMargins.left, sankeyMargins.top], [sankeyWidth - sankeyMargins.right, sankeyHeight - sankeyMargins.bottom]]);

	const {nodes, links} = graph;
	return sankey({
		nodes: nodes.map(d => Object.assign({}, d)),
		links: links.map(d => Object.assign({}, d))
	});
}

function toGraph(response, excludeSelf=false) {
	const N = response.config.node_names.length;
	const locNames = response.config.node_names;
	const locInd = d3.range(N);

	const totalSent = locInd.map(i => locInd.map(j => {
		return d3.sum(response.sent[i][j]);
	}));

	const srcNames = locNames.filter((_,i) => {
		return d3.sum(totalSent[i]) > 0;
	});
	const dstNames = locNames.filter((_, i) => {
		return d3.sum(locInd.map(j => totalSent[j][i])) > 0;
	});

	const srcNodes = srcNames.map(colName => {return {name: colName+"-src"}});
	const dstNodes = dstNames.map(colName => {return {name: colName+"-dst"}});
	const nodes = srcNodes.concat(dstNodes);

	let links = [];
	locNames.forEach((locName, i) => {
		for (let j = 0; j < N; j++) {
			const v = totalSent[i][j];
			if (v == 0) {continue;}
			if (excludeSelf && i == j) {continue;}
			links.push({source: locName+"-src", target: locNames[j]+"-dst", value: v});
		}
	});

	return {nodes, links}
}
