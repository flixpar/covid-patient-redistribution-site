import * as common from "./common.js";
export {
	makeSection,
	getParams,
	validateForm,
	getRegions,
	createHospitalsSelect,
	updateText,
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

function getParams() {
	if (!validateForm()) {
		return;
	}

	const selectedHospitalIds = Array.from(document.querySelectorAll(".hospitalselect-checkbox"))
		.map(c => c.checked ? c.value : null)
		.filter(x => x != null);
	const use_smoothness = selectedHospitalIds < 32;

	const params = {
		alloclevel: $("#form-level")[0].value,
		region_type: $("#form-regiontype")[0].value,
		region_id: $("#form-region")[0].value,
		hospitals: selectedHospitalIds,
		scenario: $("#form-scenario")[0].value,
		patient_type: $("#form-patient-type")[0].value,
		objective: $("#form-objective")[0].value,
		integer: $("#form-integer")[0].value,
		transferbudget: $("#form-transferbudget")[0].value,
		totaltransferbudget: $("#form-totaltransferbudget")[0].value,
		utilization: $("#form-utilization")[0].value,
		covid_capacity_estimate: $("#form-covidcapacity")[0].value,
		dist_threshold: ($("#form-transferdistance")[0].value * 1.61).toString(),
		dist_cost: $("#form-distancepenalty")[0].value,
		uncertaintylevel: $("#form-uncertainty")[0].value,
		los: $("#form-los")[0].value,
		smoothness: use_smoothness,
		start_date: $("#form-start-date")[0].value,
		end_date: $("#form-end-date")[0].value,
	};

	return params;
}

async function setDefaults() {
	common.getMetadata().then(meta => {
		let startDateElem = document.getElementById("form-start-date");
		let endDateElem = document.getElementById("form-end-date");
		
		startDateElem.value = "2021-12-15";
		endDateElem.value = "2022-02-15";
		
		startDateElem.min = meta.dates.hhsdata_start;
		startDateElem.max = common.addDays(meta.dates.forecast_end, -14);
		
		endDateElem.min = common.addDays(meta.dates.hhsdata_start, 14);
		endDateElem.max = meta.dates.forecast_end;
		
		// let today = common.dateStr(new Date());
		// document.getElementById("form-start-date").value = today;
		// document.getElementById("form-end-date").value = meta.dates.forecast_end;

		const pagetype = document.getElementById("form-page").value;
		const regiontype = (pagetype == "interactive") ? meta.location_defaults.region_type : "state";
		document.getElementById("form-regiontype").value = regiontype;
		document.getElementById("form-region").value = meta.location_defaults[regiontype];
	});
}
setDefaults();

function fillDataDates() {
	for (let elem of document.querySelectorAll(".fill-value")) {
		const contentid = elem.dataset.contentid;
		if (contentid == "hhsdata_update_date") {
			common.getDates().then(d => {
				elem.textContent = d.hhsdata_update;
			});
		} else if (contentid == "forecast_update_date") {
			common.getDates().then(d => {
				elem.textContent = d.forecast_update;
			});
		}
	}
}
fillDataDates();

async function validateForm() {
	const data_dates = await common.getDates();
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

function getRegions(exclude=[]) {
	return common.getMetadata().then(meta => {
		const regiontype = document.getElementById("form-regiontype").value;
		const default_region = meta.location_defaults[regiontype];

		return $.getJSON("/api/regions-list", {region_type: regiontype}, regions => {
			let region_select = document.getElementById("form-region");
			region_select.innerHTML = "";
			for (const region of regions) {
				let opt = document.createElement("option");
				opt.text = region.region_name;
				opt.value = region.region_id;
				if (region.region_id == default_region) {
					opt.selected = true;
				}
				if (exclude.indexOf(region.region_id) >= 0) {continue;}
				region_select.appendChild(opt);
			}
			region_select.dispatchEvent(new Event("regionSelectUpdate"));
		});
	});
}

function createHospitalsSelect(data, staticPage=true, includeLabel=true) {
	const nDefaultSize = staticPage ? 50 : 10;
	const nDefaultLoad = staticPage ? 16 :  5;
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
		common.createInfo(selectAreaHeader, tooltip_content["hospitalselect"]);
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

	selectAreaField.dispatchEvent(new Event("hospitalListUpdate"));
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

function updateText(response) {
	enableHiddenTextButtons();

	const isMobile = (window.innerWidth < 600);

	const region = common.toTitlecase(response.config.region.region_name);

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
		const info = common.createInfo(null, text);
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
