export {
	makeSection,
	getSection,
	createInfo,
	showProgressbar,
	hideProgressbar,
	ajaxErrorHandler,
	validateForm,
	generateFigureDownloadButtons,
	generateAllFigureDownloadButtons,
	getRegions,
	createHospitalsSelect,
	updateText,
	toTitlecase,
};

import {enableHiddenTextButtons} from "./figure_text.js";


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
	sectionHeaderSubtitle.className = "subtitle is-5 results-section-header-subtitle";

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
	document.getElementById("result-area").innerHTML = "";
}

async function getDates() {
	if (getDates.dates == null) {
		const dates = await (await fetch("/json/dates.json")).json();
		getDates.dates = dates;
		return dates;
	} else {
		return getDates.dates;
	}
}

async function setDefaultDates() {
	let start_date = new Date();
	getDates().then(dates => {
		document.getElementById("form-start-date").value = start_date.toISOString().slice(0, 10);
		document.getElementById("form-end-date").value = dates.forecast_end;
	});
}
setDefaultDates();

function fillDataDates() {
	for (let elem of document.querySelectorAll(".fill-value")) {
		const contentid = elem.dataset.contentid;
		if (contentid == "hhsdata_update_date") {
			getDates().then(d => {
				elem.textContent = d.hhsdata_update;
			});
		} else if (contentid == "forecast_update_date") {
			getDates().then(d => {
				elem.textContent = d.forecast_update;
			});
		}
	}
}
fillDataDates();

async function validateForm() {
	const data_dates = await getDates();
	const data_start_date = data_dates.hhsdata_start;
	const data_end_date   = data_dates.forecast_end;

	const start_date = new Date(Date.parse(document.getElementById("form-start-date").value));
	const end_date   = new Date(Date.parse(document.getElementById("form-end-date").value));

	const dates_valid = (new Date(data_start_date) <= start_date) && (end_date <= new Date(data_end_date));
	if (!dates_valid) {
		const valid_range_str = `${data_start_date} to ${data_end_date}`;
		alert(`Date selection outside of valid range. Valid date range is ${valid_range_str}.`);
	}

	const nHospitalsSelected = document.querySelectorAll(".hospitalselect-checkbox:checked").length;
	const nHospitalsAllowed = (2 <= nHospitalsSelected) && (nHospitalsSelected <= 200);
	if (!nHospitalsAllowed) {
		alert(`You have selected ${nHospitalsSelected} hospitals. The valid range is 2-200 hospitals.`);
	}

	return (dates_valid && nHospitalsAllowed);
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

function createInfo(parentElement, content) {
	let el = document.createElement("img");
	el.src = "img/info.svg";
	el.className = "info-icon";
	el.setAttribute("data-tippy-content", content);
	if (parentElement != null) {
		parentElement.appendChild(el);
	}
	tippy(el, {delay: [null, 250]});
	return el;
}

function getRegions(exclude=[]) {
	const default_region = {state: "MD", hospital_system: "HSI00000730", hrr: "56", hsa: "33014"};
	const regiontype = document.getElementById("form-regiontype").value;
	let request = $.get("/api/regions-list", {region_type: regiontype}, regions => {
		let region_select = document.getElementById("form-region");
		region_select.innerHTML = "";
		for (const region of regions) {
			let opt = document.createElement("option");
			opt.text = region.region_name;
			opt.value = region.region_id;
			if (region.region_id == default_region[regiontype]) {
				opt.selected = true;
			}
			if (exclude.indexOf(region.region_id) >= 0) {continue;}
			region_select.appendChild(opt);
		}
	});
	return request;
}

function createHospitalsSelect(data, staticPage=true, includeLabel=true) {
	const nDefaultSize = staticPage ? 50 : 10;
	const nDefaultLoad = staticPage ?  8 :  2;
	data = selectDefaultHospitals(data, nDefaultSize, nDefaultLoad);

	let selectAreaField = document.getElementById("hospital-select-field");
	selectAreaField.innerHTML = "";

	let selectAreaHeader = document.createElement("label");
	selectAreaHeader.className = "label";
	selectAreaHeader.style.marginBottom = "0.2rem";
	selectAreaHeader.textContent = "Hospitals to Display";
	selectAreaHeader.htmlFor = "hospitalselect";
	if (!staticPage) {
		selectAreaHeader.classList.add("column");
		selectAreaHeader.classList.add("is-one-third");
	}

	if (includeLabel) {
		selectAreaField.appendChild(selectAreaHeader);
		createInfo(selectAreaHeader, tooltip_content["hospitalselect"]);
	}

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

		tagText.innerText = h.hospital_name;
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
		if (h.is_default) {
			generateTag(h,i);
		}
	});

	let selectAreaSearchContainer = document.createElement("div");
	selectAreaSearchContainer.className = "control has-icons-left";
	selectAreaSearchContainer.style.marginTop = "5px";
	selectAreaSearchContainer.style.marginBottom = "5px";
	selectAreaContainer.appendChild(selectAreaSearchContainer);

	let selectAreaSearchInput = document.createElement("input");
	selectAreaSearchInput.type = "text";
	selectAreaSearchInput.className = "input";
	selectAreaSearchInput.placeholder = "Search";
	selectAreaSearchContainer.appendChild(selectAreaSearchInput);

	if (staticPage) {selectAreaSearchInput.classList.add("is-small");}

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
			if (h.hospital_name.toLowerCase().indexOf(searchText) >= 0) {
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
		checkbox.className = "hospitalselect-checkbox";
		checkbox.id = `hospitalselect-${i}`;
		checkbox.value = h.hospital_id;
		s.appendChild(checkbox);

		if (h.is_default) {
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
		label.textContent = h.hospital_name;
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

	if (staticPage) {
		selectArea.classList.add("static-page");
		selectAreaList.classList.add("static-page");
	}

	let buttonsContainer = document.createElement("div");
	buttonsContainer.id = "hospitalselect-buttons-container";
	buttonsContainer.className = "buttons";
	buttonsContainer.style.marginTop = "8px";
	buttonsContainer.style.display = "flex";
	buttonsContainer.style.justifyContent = "space-between";

	function addButton(buttonText, f) {
		let button = document.createElement("button");
		button.type = "button";
		button.className = "button is-light is-small";
		button.style.width = "32%";
		button.textContent = buttonText;
		if (f != null) {
			button.addEventListener("click", f);
		}
		buttonsContainer.appendChild(button);
		return button;
	}

	function checkElem(elem) {
		if (!elem.checked) {
			elem.click();
		}
	}
	function uncheckElem(elem) {
		if (elem.checked) {
			elem.click();
		}
	}

	addButton("Select All", () => document.querySelectorAll(".hospitalselect-checkbox").forEach(elem => checkElem(elem)));
	addButton("Select None", () => document.querySelectorAll(".hospitalselect-checkbox").forEach(elem => uncheckElem(elem)));
	addButton("Reset", () => {
		data.forEach((h,i) => {
			let elem = document.getElementById(`hospitalselect-${i}`);
			if (h.is_default) {
				checkElem(elem);
			} else {
				uncheckElem(elem);
			}
		});
	});

	let footerAreaContainer = document.createElement("div");
	footerAreaContainer.id = "hospitalselect-footer";

	footerAreaContainer.appendChild(buttonsContainer);
	selectAreaContainer.appendChild(footerAreaContainer);
}

function selectDefaultHospitals(hospitals, nSize=20, nLoad=4) {
	const N = hospitals.length;

	const byLoadInd = d3.range(N).sort((a,b) => hospitals[a].current_load - hospitals[b].current_load);
	const selectedByLoad = byLoadInd.slice((N > nLoad) ? N-nLoad : 0);

	const bySizeInd = d3.range(N).sort((a,b) => hospitals[a].total_beds - hospitals[b].total_beds);
	const selectedBySize = bySizeInd.slice((N > nSize) ? N-nSize : 0);

	const selected = selectedBySize.concat(selectedByLoad);
	selected.forEach(i => hospitals[i].is_default = true);

	d3.range(N).forEach(i => {
		if (hospitals[i].total_beds < 1.5) {
			hospitals[i].is_default = false;
		} else {
			if (hospitals[i].is_default == null) {
				hospitals[i].is_default = false;
			}
		}
	});

	return hospitals;
}

const tooltip_content = {
	"hospitalselect": "Hospitals to be included in our analysis. Note that all hospitals are included in our model, but only those selected here are visualized.",
};

const toTitlecase = s => s.split(" ").map(w => w[0].toUpperCase() + w.substr(1)).join(" ");

function updateText(response) {
	enableHiddenTextButtons();

	const isMobile = (window.innerWidth < 600);

	const region = toTitlecase(response.config.region.region_name);

	document.querySelector(".results-section-header[data-target=section-results-totalload] .results-section-header-title").textContent = `COVID-19 Occupancy in ${region}`;
	document.querySelector(".results-section-header[data-target=section-results-maps] .results-section-header-title").textContent = `Occupancy and Optimal Transfers in ${region}`;

	let mapTitle = `COVID-19 Capacity, Occupancy, and Optimal Transfers in ${region}`;
	if (isMobile) {mapTitle = `COVID-19 Occupancy, and Optimal Transfers`;}
	for (let map of document.querySelectorAll(".hospitalsmap")) {
		const metric = map.id.substring(13);
		if (metric.indexOf("_both") > 0) {
			map.querySelector(".map-title").textContent = mapTitle;
		} else {
			map.querySelector(".map-subtitle").textContent = mapTitle;
		}
	}

	for (let elem of document.querySelectorAll(".region-text")) {
		elem.textContent = region;
	}

	for (let elem of document.querySelectorAll(".fill-value")) {
		const contentid = elem.dataset.contentid;
		if (contentid == "start_date") {
			elem.textContent = response.config.start_date;
		} else if (contentid == "end_date") {
			elem.textContent = response.config.end_date;
		}
	}

	for (let elem of document.querySelectorAll(".abbrev-text")) {
		const fulltext = elem.dataset.fulltext;
		elem.setAttribute("data-tippy-content", fulltext);
		tippy(elem, {delay: [null, 250]});
	}

	for (let elem of document.querySelectorAll(".info-text")) {
		const text = elem.textContent;
		const info = createInfo(null, text);
		elem.replaceWith(info);
	}

	if (isMobile) {
		let selector = document.querySelector(`.description-hidden-label[data-for=static-page-p2]`);
		let p1 = document.getElementById("static-page-p1");
		let p2 = document.getElementById("static-page-p2");

		p1.parentElement.remove();
		selector.parentElement.insertBefore(p1, p2);
		p1.classList.add("is-hidden");
		p1.style.marginBottom = "1em";
		p1.style.display = "block";

		selector.addEventListener("click", e => {
			p1.classList.toggle("is-hidden");
		});

		document.querySelectorAll("#static-text-container .info-icon").forEach(e => e.classList.add("is-hidden"));
	}
}
