console.log("Starting!");

let container = document.getElementById("result-area");
let recentResponse = null;


function makeSection(sectionInfo) {
	let sectionContainer = document.createElement("div");
	let sectionHeader = document.createElement("div");
	let sectionHeaderTitleArea = document.createElement("span");
	let sectionHeaderTitle = document.createElement("h3");
	let sectionHeaderSubtitle = document.createElement("h5");
	let sectionContent = document.createElement("div");

	sectionContainer.className = "results-section";
	sectionContent.className = "results-section-content is-collapsible";
	sectionHeader.className = "results-section-header";
	sectionHeaderTitle.className = "title is-3 results-section-header-title";
	sectionHeaderSubtitle.className = "title is-5 results-section-header-subtitle";

	const sectionID = "section-" + sectionInfo.identifier;
	sectionContent.id = sectionID;

	sectionHeaderTitle.innerText = sectionInfo.title;
	sectionHeaderTitleArea.appendChild(sectionHeaderTitle);

	if (sectionInfo.subtitle != null) {
		sectionHeaderSubtitle.innerText = sectionInfo.subtitle;
		sectionHeaderTitleArea.appendChild(sectionHeaderSubtitle);
	}

	sectionHeader.appendChild(sectionHeaderTitleArea);

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
	let end_date   = new Date(2021, 0, 16);
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

function getRegions() {
	const default_region = "MD";
	const regiontype = document.getElementById("form-regiontype").value;
	let request = $.get("/api/regions-list", {region_type: regiontype}, regions => {
		let region_select = document.getElementById("form-region");
		region_select.innerHTML = "";
		for (region of regions) {
			let opt = document.createElement("option");
			opt.text = region.region_name;
			if (region.region_name == default_region) {
				opt.selected = true;
			}
			region_select.appendChild(opt);
		}
	});
	return request;
}

function createHospitalsSelect(data, staticPage=true) {
	if (document.getElementById("hospital-select-container") != null) {
		if (staticPage) {
			document.getElementById("hospital-select-field").remove();
		} else {
			document.getElementById("hospital-select-field").innerHTML = "";
		}
	}

	let selectAreaField;
	if (staticPage) {
		selectAreaField = document.createElement("div");
		selectAreaField.className = "field";
		selectAreaField.id = "hospital-select-field";

		let section = document.getElementById("static-params-form");
		section.insertBefore(selectAreaField, document.getElementById("params-form-submit"));
	} else {
		selectAreaField = document.getElementById("hospital-select-field");
	}

	let selectAreaHeader = document.createElement("label");
	selectAreaHeader.className = "label";
	selectAreaHeader.style.marginBottom = "0.2rem";
	selectAreaHeader.textContent = "Hospitals";
	selectAreaHeader.htmlFor = "hospitalselect";
	selectAreaField.appendChild(selectAreaHeader);
	if (!staticPage) {
		selectAreaHeader.classList.add("column");
		selectAreaHeader.classList.add("is-one-third");
	}

	createInfo(selectAreaHeader, tooltip_content["hospitalselect"]);

	let selectAreaContainer = document.createElement("div");
	selectAreaContainer.className = "hospital-select-container";
	selectAreaContainer.id = "hospital-select-container";
	selectAreaField.appendChild(selectAreaContainer);

	let selectAreaList = document.createElement("div");
	selectAreaList.className = "hospital-select-list field is-grouped is-grouped-multiline";
	selectAreaContainer.appendChild(selectAreaList);

	function generateTag(h,i) {
		let tagContainer = document.createElement("div");
		let tag = document.createElement("div");
		let tagText = document.createElement("span");
		let tagDelete = document.createElement("a");

		tagContainer.id = `hospitalselect-tag-${i}`;

		tagContainer.className = "hospitalselect-tag control";
		tag.className = "tags has-addons";
		tagText.className = "tag";
		tagDelete.className = "tag is-delete is-danger is-light";

		tagText.innerText = h.name;
		tagDelete.addEventListener("click", e => {
			document.getElementById(`hospitalselect-${i}`).checked = false;
			document.getElementById(`hospitalselect-label-${i}`).classList.remove("hospital-select-item-selected");
			tagContainer.remove();
		});

		tag.appendChild(tagDelete);
		tag.appendChild(tagText);
		tagContainer.appendChild(tag);
		selectAreaList.appendChild(tagContainer);
	}

	data.forEach((h,i) => {
		if (h.default) {
			generateTag(h,i);
		}
	});

	let selectAreaSearchContainer = document.createElement("div");
	selectAreaSearchContainer.className = "control has-icons-left";
	selectAreaSearchContainer.style.marginBottom = "5px";
	selectAreaContainer.appendChild(selectAreaSearchContainer);

	let selectAreaSearchInput = document.createElement("input");
	selectAreaSearchInput.type = "text";
	selectAreaSearchInput.className = "input";
	selectAreaSearchInput.placeholder = "Search";
	selectAreaSearchContainer.appendChild(selectAreaSearchInput);

	let selectAreaSearchIconContainer = document.createElement("span");
	selectAreaSearchIconContainer.className = "icon is-left";
	let selectAreaSearchIcon = document.createElement("ion-icon");
	selectAreaSearchIcon.name = "search-outline";
	selectAreaSearchIcon.setAttribute("aria-hidden", "true");
	selectAreaSearchContainer.appendChild(selectAreaSearchIconContainer);
	selectAreaSearchIconContainer.appendChild(selectAreaSearchIcon);

	selectAreaSearchInput.addEventListener("keyup", e => {
		const searchText = selectAreaSearchInput.value.toLowerCase();

		let nshow = 0;
		for (let i = 0; i < data.length; i++) {
			const h = data[i];
			if (h.name.toLowerCase().indexOf(searchText) >= 0) {
				document.getElementById(`hospitalselect-label-${i}`).style.display = "block";
				nshow += 1;
			} else {
				document.getElementById(`hospitalselect-label-${i}`).style.display = "none";
			}
		}

		if (nshow == 0) {
			if (document.getElementById("hospitalselect-empty-text") == null) {
				let p = document.createElement("p");
				p.id = "hospitalselect-empty-text";
				p.textContent = "No Results";
				selectAreaContainer.appendChild(p);
			}
		} else {
			if (document.getElementById("hospitalselect-empty-text") != null) {
				document.getElementById("hospitalselect-empty-text").remove();
			}
		}
	});

	let selectArea = document.createElement("div");
	selectArea.className = "hospital-select-area";
	selectAreaContainer.appendChild(selectArea);

	data.forEach((h,i) => {
		let s = document.createElement("label");
		s.className = "hospital-select-item";
		s.htmlFor = `hospitalselect-${i}`;
		s.id = `hospitalselect-label-${i}`;

		let checkbox = document.createElement("input");
		checkbox.type = "checkbox";
		checkbox.id = `hospitalselect-${i}`;
		s.appendChild(checkbox);

		if (h.default) {
			checkbox.checked = true;
			s.classList.add("hospital-select-item-selected");
		}

		checkbox.addEventListener("change", e => {
			s.classList.toggle("hospital-select-item-selected");
			if (e.target.checked) {
				generateTag(h,i);
			} else {
				document.getElementById(`hospitalselect-tag-${i}`).remove();
			}
		});

		let label = document.createElement("span");
		label.textContent = h.name;
		s.appendChild(label);

		let loadLabel = document.createElement("span");
		loadLabel.style.float = "right";
		loadLabel.textContent = `(Occupancy = ${(h.current_load*100).toFixed(0)}%)`;
		s.appendChild(loadLabel);

		if (h.current_load < 0.9) {
			s.style.backgroundColor = "#6cc777";
		} else if (h.current_load < 1.05) {
			s.style.backgroundColor = "#ffeb3b87";
		} else {
			s.style.backgroundColor = "red";
		}

		selectArea.appendChild(s);
	});
}

