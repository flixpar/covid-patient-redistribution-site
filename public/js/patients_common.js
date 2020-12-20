console.log("Starting!");

let container = document.getElementById("result-area");
let recentResponse = null;


function makeSection(sectionInfo) {
	let sectionContainer = document.createElement("div");
	let sectionHeader = document.createElement("div");
	let sectionHeaderText = document.createElement("h3");
	let sectionContent = document.createElement("div");

	sectionContainer.className = "results-section";
	sectionContent.className = "results-section-content is-collapsible";
	sectionHeader.className = "results-section-header";
	sectionHeaderText.className = "title is-3 results-section-header-text";

	const sectionID = "section-" + sectionInfo.identifier;
	sectionContent.id = sectionID;

	sectionHeaderText.innerText = sectionInfo.title;
	sectionHeader.appendChild(sectionHeaderText);

	let toggleButton = document.createElement("a");
	toggleButton.className = "section-toggle-button";
	toggleButton.dataset.target = sectionID;
	const iconDir = sectionInfo.showDefault ? "chevron-down-outline" : "chevron-back-outline";
	toggleButton.innerHTML = `
		<span class="icon section-toggle-icon">
			<ion-icon name="${iconDir}"></ion-icon>
		</span>
	`;
	sectionHeader.appendChild(toggleButton);

	sectionHeader.dataset.target = sectionID;
	sectionHeader.addEventListener("click", function(e) {
		e.stopPropagation();
		const i = this.dataset.target;
		const c = document.getElementById(i);
		const icon = this.querySelector("ion-icon");
		if (c.style.display != "none") {
			c.style.display = "none";
			icon.setAttribute("name", "chevron-back-outline");
		} else {
			c.style.display = "block";
			icon.setAttribute("name", "chevron-down-outline");
		}
	});

	if (!sectionInfo.showDefault) {
		sectionContent.style.display = "none";
	}

	sectionContainer.appendChild(sectionHeader);
	sectionContainer.appendChild(sectionContent);

	document.getElementById("result-area").appendChild(sectionContainer);
}

function getSection(sectionID) {
	sectionID = "section-" + sectionID;
	return document.getElementById(sectionID);
}

function showProgressbar() {
	$("#progressbar-area").show();
}

function hideProgressbar() {
	$("#progressbar-area").hide();
}

function ajaxErrorHandler() {
	$("#error-area").removeClass("is-hidden");
	$("#progressbar-area").hide();
	container.innerHTML = "";
}

function setDefaultDates() {
	let start_date = new Date();
	let end_date   = new Date();
	end_date.setMonth(end_date.getMonth() + 2);
	document.getElementById("form-start-date").value = start_date.toISOString().slice(0, 10);
	document.getElementById("form-end-date").value = end_date.toISOString().slice(0, 10);
}
setDefaultDates();

function validateForm() {
	const data_start_date = "2020-03-25";
	const data_end_date   = "2021-06-30";

	const start_date = new Date(Date.parse(document.getElementById("form-start-date").value));
	const end_date   = new Date(Date.parse(document.getElementById("form-end-date").value));

	const dates_valid = (new Date(data_start_date) <= start_date) && (end_date < new Date(data_end_date));
	if (!dates_valid) {
		const valid_range_str = `${data_start_date} to ${data_end_date}`;
		alert(`Date selection outside of valid range. Valid date range for ${region} is ${valid_range_str}.`);
	}

	return dates_valid;
}

function generateFigureDownloadButtons(figureNode, figureName) {
	let buttonsContainer = document.createElement("div");
	buttonsContainer.className = "buttons";
	buttonsContainer.style.width = "100%";
	buttonsContainer.style.textAlign = "center";
	buttonsContainer.style.display = "block";
	figureNode.parentElement.appendChild(buttonsContainer);

	let svgButton = document.createElement("button");
	svgButton.textContent = "Download SVG";
	svgButton.type = "button";
	svgButton.className = "button is-light is-small";
	svgButton.addEventListener("click", () => downloadFigureAsSVG(figureNode, figureName+".svg"))
	buttonsContainer.appendChild(svgButton);

	let pngButton = document.createElement("button");
	pngButton.textContent = "Download PNG";
	pngButton.type = "button";
	pngButton.className = "button is-light is-small";
	pngButton.addEventListener("click", () => downloadFigureAsPNG(figureNode, figureName+".png"))
	buttonsContainer.appendChild(pngButton);

	let pdfButton = document.createElement("button");
	pdfButton.textContent = "Download PDF";
	pdfButton.type = "button";
	pdfButton.className = "button is-light is-small";
	pdfButton.addEventListener("click", () => downloadFigureAsPDF(figureNode, figureName+".pdf"))
	buttonsContainer.appendChild(pdfButton);
}

async function getSVGData(svg) {
	let imgCvt = {};
	for (imgNode of svg.querySelectorAll("image")) {
		const u = imgNode.href.baseVal;
		if (imgCvt[u] == null) {
			imgCvt[u] = await encodeImage(u);
		}
	}

	let serializer = new XMLSerializer();
	let source = serializer.serializeToString(svg);

	for (k in imgCvt) {
		const v = imgCvt[k];
		source = source.replaceAll(k, v);
	}

	if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)){
		source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
	}
	if (!source.match(/^<svg[^>]+"http\:\/\/www\.w3\.org\/1999\/xlink"/)) {
		source = source.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
	}
	source = '<?xml version="1.0" standalone="no"?>\r\n' + source;

	const dataStr = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(source);
	return dataStr;
}

function encodeImage(imgURL) {
	let canvas = document.createElement("canvas");
	canvas.style.display = "none";
	canvas.width = 1024;
	canvas.height = 1024;
	document.getElementById("results-container").appendChild(canvas);

	let ctx = canvas.getContext("2d");

	let img = new Image();
	img.setAttribute('crossOrigin', 'anonymous');
	img.src = imgURL;

	let p = new Promise((resolve, reject) => {
		img.onload = function() {
			ctx.drawImage(img, 0, 0);
			const dataURL = canvas.toDataURL("image/png");
			canvas.remove();
			resolve(dataURL);
		}
	});
	return p;
}

async function downloadFigureAsSVG(svg, fn) {
	const dataStr = await getSVGData(svg);

	let downloadAnchorNode = document.createElement("a");
	downloadAnchorNode.setAttribute("href", dataStr);
	downloadAnchorNode.setAttribute("download", fn);
	document.body.appendChild(downloadAnchorNode);
	downloadAnchorNode.click();
	downloadAnchorNode.remove();
}

async function downloadFigureAsPNG(svg, fn) {
	const scaleFactor = 3.0;
	const width = svg.clientWidth;
	const height = svg.clientHeight;
	const canvas = new OffscreenCanvas(width*scaleFactor, height*scaleFactor);

	let ctx = canvas.getContext("2d");

	ctx.fillStyle = "white";
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	const dataStr = await getSVGData(svg);

	let img = new Image();
	img.src = dataStr;
	img.onload = function() {
		ctx.drawImage(img, 0, 0);

		canvas.convertToBlob().then(blob => {
			const pngUrl = URL.createObjectURL(blob);

			let downloadAnchorNode = document.createElement("a");
			downloadAnchorNode.setAttribute("href", pngUrl);
			downloadAnchorNode.setAttribute("download", fn);
			document.body.appendChild(downloadAnchorNode);
			downloadAnchorNode.click();
			downloadAnchorNode.remove();
		});
	}
}

async function downloadFigureAsPDF(figureNode, fn) {
	let svg = figureNode.cloneNode(true);

	let imgCvt = {};
	for (imgNode of svg.querySelectorAll("image")) {
		const u = imgNode.href.baseVal;
		if (imgCvt[u] == null) {
			imgCvt[u] = await encodeImage(u);
		}
		imgNode.href.baseVal = imgCvt[u];
		imgNode.href.animVal = imgCvt[u];
	}

	let doc = new PDFDocument({size: [figureNode.clientWidth, figureNode.clientHeight]});
	SVGtoPDF(doc, svg, 0, 0, {});
	doc.end();

	const chunks = [];
	const stream = doc.pipe({
		write: (chunk) => chunks.push(chunk),
		end: () => {
			const pdfBlob = new Blob(chunks, {
				type: 'application/octet-stream'
			});
			const blobUrl = URL.createObjectURL(pdfBlob);

			let downloadAnchorNode = document.createElement("a");
			downloadAnchorNode.setAttribute("href", blobUrl);
			downloadAnchorNode.setAttribute("download", fn);
			document.body.appendChild(downloadAnchorNode);
			downloadAnchorNode.click();
			downloadAnchorNode.remove();
		},
		on: (event, action) => {},
		once: (...args) => {},
		emit: (...args) => {},
	});
}

function createInfo(parentElement, content) {
	let el = document.createElement("img");
	el.src = "img/info.svg";
	el.className = "info-icon";
	el.setAttribute("data-tippy-content", content);
	parentElement.appendChild(el);
	tippy(el, {delay: [null, 250]});
}
