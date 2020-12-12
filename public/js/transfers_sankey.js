const transfersSankeySize = {height: 600, width: 1000};
const transfersSankeyMargins = {top: 25, bottom: 5, left: 30, right: 30};


function createTransfersSankey(response, add_description=true) {
	const graph = toGraph(response, false);
	const fig = makeTransfersSankey(graph);

	const section = document.getElementById("section-results-transfers");
	if (add_description) {
		let description = document.createElement("p");
		description.innerHTML = transfersSankeyDescription;
		section.appendChild(description);
	}

	section.appendChild(fig);

	let hr = document.createElement("hr");
	section.appendChild(hr);
}

function makeTransfersSankey(graph) {

	let svg = d3.create("svg").attr("viewBox", [0, 0, transfersSankeySize.width, transfersSankeySize.height]);

	const {nodes, links} = toSankey(graph);
	const nLocs = nodes.length;
	
	// Tooltip //
	let tooltip = new TransfersSankeyTooltip(svg, graph);
	
	// Title + Axis Labels //

	svg.append("text")
		.attr("x", transfersSankeySize.width/2)
		.attr("y", 15)
		.attr("text-anchor", "middle")
		.style("font-family", "Helvetica")
		.style("font-size", "18px")
		.text("Patient Transfers");

	svg.append("text")
		.attr("x", transfersSankeySize.width-transfersSankeyMargins.right+25)
		.attr("y", transfersSankeySize.height/2)
		.attr("text-anchor", "middle")
		.style("font-family", "Helvetica")
		.style("font-size", "18px")
		.attr("transform", `rotate(-90,${transfersSankeySize.width-transfersSankeyMargins.right+25},${transfersSankeySize.height/2})`)
		.text("Patients Received");

	svg.append("text")
		.attr("x", transfersSankeyMargins.right/2)
		.attr("y", transfersSankeySize.height/2)
		.attr("text-anchor", "middle")
		.style("font-family", "Helvetica")
		.style("font-size", "18px")
		.attr("transform", `rotate(-90,${transfersSankeyMargins.right/2},${transfersSankeySize.height/2})`)
		.text("Patients Sent");
	
	// color scale
	const colorScale = d3.scaleOrdinal()
		.domain(d3.range(nLocs))
		.range(d3.range(nLocs).map(x => d3.interpolatePlasma(x/nLocs)))

	// Nodes //
	
	// nodes
	svg.append("g")
		.selectAll("rect")
		.data(nodes)
		.join("rect")
		.attr("x", d => d.x0)
		.attr("y", d => d.y0)
		.attr("height", d => d.y1 - d.y0)
		.attr("width", d => d.x1 - d.x0)
		.attr("fill", d => colorScale(d.index))
		.append("title")
		.text(d => `${d.name.substring(0,d.name.length-4)}\n${d3.format(",.0f")(d.value)}`);
	
	// node titles
	svg.append("g")
		.attr("font-family", "sans-serif")
		.attr("font-size", 11)
		.selectAll("text")
		.data(nodes)
		.join("text")
		.attr("x", d => d.x0 < transfersSankeySize.width / 2 ? d.x1 + 6 : d.x0 - 6)
		.attr("y", d => (d.y1 + d.y0) / 2)
		.attr("dy", "0.35em")
		.attr("text-anchor", d => d.x0 < transfersSankeySize.width / 2 ? "start" : "end")
		.text(d => d.name.substring(0,d.name.length-4));

	// Links //
	
	// links
	const link = svg.append("g")
		.attr("fill", "none")
		.attr("stroke-opacity", 0.5)
		.selectAll("g")
		.data(links)
		.join("g")
		.style("mix-blend-mode", "multiply");

	// link gradients
	const gradient = link.append("linearGradient")
		.attr("id", d => (d.uid = "gradient-"+d.index))
		.attr("gradientUnits", "userSpaceOnUse")
		.attr("x1", d => d.source.x1)
		.attr("x2", d => d.target.x0);
	gradient.append("stop")
		.attr("offset", "0%")
		.attr("stop-color", d => colorScale(d.source.index));
	gradient.append("stop")
		.attr("offset", "100%")
		.attr("stop-color", d => colorScale(d.target.index));

	// link paths
	link.append("path")
		.attr("d", d3.sankeyLinkHorizontal())
		.attr("stroke", d => `url(#${d.uid})`)
		.attr("stroke-width", d => Math.max(1, d.width))
		.on("mouseover", (e,d) => tooltip.show(e,d))
	
	// Enable Tooltip //
	svg.append(() => tooltip.node);

	return svg.node();
}

function toSankey(graph) {
	const align = "justify";
	const sankey = d3.sankey()
		.nodeId(d => d.name)
		.nodeAlign(d3[`sankey${align[0].toUpperCase()}${align.slice(1)}`])
		.nodeWidth(15)
		.nodePadding(10)
		.extent([[transfersSankeyMargins.left, transfersSankeyMargins.top], [transfersSankeySize.width - transfersSankeyMargins.right, transfersSankeySize.height - transfersSankeyMargins.bottom]]);

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

class TransfersSankeyTooltip {
	constructor(svg, response) {
		this.svg = svg;
		this.response = response;
		this.highlight = null;

		let tmpSVG = d3.create("svg");
		let tooltipNode = tmpSVG.append("g")
			.attr("pointer-events", "none")
			.attr("display", "none")
			.attr("font-family", "monospace")
			.attr("font-size", 12)
			.attr("text-anchor", "middle");

		tooltipNode.append("rect")
			.attr("x", -60)
			.attr("y", 10)
			.attr("width", 120)
			.attr("height", 35)
			.attr("fill", "white")
			.attr("stroke", "gray")
			.attr("stroke-width", 1.5);
		this.topTab = tooltipNode.append("rect")
			.attr("transform", "translate(0, 2) rotate(45)")
			.attr("width", 12)
			.attr("height", 12)
			.attr("fill", "white")
			.attr("stroke", "gray")
			.attr("stroke-width", 1.0);
		this.bottomTab = tooltipNode.append("rect")
			.attr("transform", "translate(0, 35) rotate(45)")
			.attr("width", 12)
			.attr("height", 12)
			.attr("fill", "white")
			.attr("stroke", "gray")
			.attr("stroke-width", 1.0);
		tooltipNode.append("rect")
			.attr("x", -60)
			.attr("y", 10)
			.attr("width", 120)
			.attr("height", 35)
			.attr("fill", "white");
		
		this.tooltipNode = tooltipNode;

		this.textLine1 = tooltipNode.append("text").attr("y", "24").node();
		this.textLine2 = tooltipNode.append("text").attr("y", "38").node();

		this.node = tooltipNode.node();
	}

	show(e,d,locIdx) {
		this.node.removeAttribute("display");
		
		this.textLine1.textContent = `${d.source.name.substring(0,d.source.name.length-4)} → ${d.target.name.substring(0,d.target.name.length-4)}`;
		this.textLine2.textContent = "Transfers: " + d3.format(",.0f")(d.value);
		
		this.highlight = e.srcElement.cloneNode();
		this.highlight.setAttribute("stroke", "white");
		e.srcElement.parentElement.appendChild(this.highlight);
		this.highlight.addEventListener("mouseout", (e) => this.hide());
		
		const bbox = e.srcElement.getBBox();
		
		const xCenter = bbox.x + (bbox.width / 2);
		const yCenter = bbox.y + (bbox.height / 2);
		const yOffset = Math.max(1, d.width) / 2;

		const positionBottom = (yCenter+yOffset+40 <= transfersSankeySize.height);
		
		if (positionBottom) {
			this.node.setAttribute("transform", `translate(${xCenter},${yCenter+yOffset})`);
			this.topTab.node().removeAttribute("display");
			this.bottomTab.node().setAttribute("display", "none");
		} else {
			this.node.setAttribute("transform", `translate(${xCenter},${yCenter-yOffset-45-10})`);
			this.topTab.node().setAttribute("display", "none");
			this.bottomTab.node().removeAttribute("display");
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
