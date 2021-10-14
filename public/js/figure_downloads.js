export {
	generateFigureDownloadButtons,
	generateAllFigureDownloadButtons,
};


function generateFigureDownloadButtons(figureNode, figureName) {
	let buttonsContainer = document.createElement("div");
	buttonsContainer.className = "buttons";
	buttonsContainer.style.width = "100%";
	buttonsContainer.style.textAlign = "center";
	buttonsContainer.style.display = "block";
	figureNode.parentElement.insertBefore(buttonsContainer, figureNode.nextSibling);

	const figureId = figureNode.id;

	let svgButton = document.createElement("button");
	svgButton.textContent = "Download SVG";
	svgButton.type = "button";
	svgButton.className = "button is-light is-small";
	svgButton.addEventListener("click", () => downloadFigureAsSVG(document.getElementById(figureId), figureName+".svg"))
	buttonsContainer.appendChild(svgButton);

	let pngButton = document.createElement("button");
	pngButton.textContent = "Download PNG";
	pngButton.type = "button";
	pngButton.className = "button is-light is-small";
	pngButton.addEventListener("click", () => downloadFigureAsPNG(document.getElementById(figureId), figureName+".png"))
	buttonsContainer.appendChild(pngButton);

	let pdfButton = document.createElement("button");
	pdfButton.textContent = "Download PDF";
	pdfButton.type = "button";
	pdfButton.className = "button is-light is-small";
	pdfButton.addEventListener("click", () => downloadFigureAsPDF(document.getElementById(figureId), figureName+".pdf"))
	buttonsContainer.appendChild(pdfButton);

	return buttonsContainer;
}

function generateAllFigureDownloadButtons() {
	for (const fig of document.querySelectorAll(".figure")) {
		const figName = fig.getAttribute("figure-name");
		generateFigureDownloadButtons(fig, figName);
	}
}

async function getSVGData(svg) {
	let imgCvt = {};
	for (const imgNode of svg.querySelectorAll("image")) {
		const u = imgNode.href.baseVal;
		if (imgCvt[u] == null) {
			imgCvt[u] = await encodeImage(u);
		}
	}

	let serializer = new XMLSerializer();
	let source = serializer.serializeToString(svg);

	for (const k in imgCvt) {
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
	for (const imgNode of svg.querySelectorAll("image")) {
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
