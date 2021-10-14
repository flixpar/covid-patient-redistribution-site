import * as common from "./common.js";
import {createRegionChoropleth} from "./region_choropleths.js";


let mainSection = document.getElementById("main-content-area");

function createTable(table_data, cols) {

	let currentSort = {sortBy: "benefits", sortDir: true};

	function rowCompare(a,b) {
		if (currentSort.sortDir) {
			return b[currentSort.sortBy] - a[currentSort.sortBy];
		} else {
			return a[currentSort.sortBy] - b[currentSort.sortBy];
		}
	}
	table_data.sort(rowCompare);

	const colIds = Object.keys(cols);
	const colNames = Object.values(cols);

	let table = document.createElement("table");
	table.className = "table is-hoverable is-fullwidth";

	let tablehead = document.createElement("thead");
	let tablebody = document.createElement("tbody");

	tablebody.className = "is-family-monospace";

	function generateRows() {
		const nrows = table_data.length;
		for (let i = 0; i < nrows; i++) {
			let row = document.createElement("tr");
			for (const colId of colIds) {
				const val = table_data[i][colId];
				let el = document.createElement("td");
				if (typeof val == "string") {
					el.innerHTML = val;
				} else if (val == null) {
					el.innerHTML = "NaN";
				} else {
					if (colId.indexOf("pct") > 0) {
						el.innerHTML = (val * 100).toFixed(1) + "%";
					} else {
						el.innerHTML = val.toFixed(0);
					}
				}
				row.appendChild(el);
			}
			tablebody.appendChild(row);
		}
	}

	let arrows = {};
	function updateArrows() {
		for (const c in arrows) {
			if (c == currentSort.sortBy) {
				if (currentSort.sortDir) {
					arrows[c].up.classList.remove("arrow-light");
					arrows[c].down.classList.add("arrow-light");
				} else {
					arrows[c].up.classList.add("arrow-light");
					arrows[c].down.classList.remove("arrow-light");
				}
			} else {
				arrows[c].up.classList.add("arrow-light");
				arrows[c].down.classList.add("arrow-light");
			}
		}
	}

	function updateSort(colId) {
		if (currentSort.sortBy == colId) {
			currentSort.sortDir = !currentSort.sortDir;
		} else {
			currentSort.sortBy = colId;
			currentSort.sortDir = true;
		}

		table_data.sort(rowCompare);
		tablebody.innerHTML = "";
		generateRows();
		updateArrows();
	}

	let header = document.createElement("tr");
	for (const [colid, colname] of Object.entries(cols)) {
		let el = document.createElement("th");
		el.style.cursor = "pointer";
		header.appendChild(el);

		let elText = document.createElement("span");
		elText.innerHTML = colname;
		el.appendChild(elText);

		let arrowsContainer = document.createElement("span");
		let upArrow = document.createElement("ion-icon");
		let downArrow = document.createElement("ion-icon");
		arrows[colid] = {up: upArrow, down: downArrow};

		upArrow.name = "caret-up-outline";
		downArrow.name = "caret-down-outline";

		upArrow.className = "arrow arrow-up arrow-light";
		downArrow.className = "arrow arrow-down arrow-light";
		arrowsContainer.className = "arrow-container";

		arrowsContainer.appendChild(upArrow);
		arrowsContainer.appendChild(downArrow);
		el.appendChild(arrowsContainer);

		el.addEventListener("click", () => {updateSort(colid);});
	}
	tablehead.appendChild(header);

	generateRows();
	updateArrows();


	table.appendChild(tablehead);
	table.appendChild(tablebody);

	return table;
}

function createRegionTypeSection(regionType) {
	const sectionId = `section-regiontype-${regionType}`;
	if (document.getElementById(sectionId) != null) {return true;}

	let section = document.createElement("div");
	section.id = sectionId;
	mainSection.appendChild(section);

	let title = "";
	if (regionType == "state") {
		title = "States";
	} else if (regionType == "hrr") {
		title = "Hospital Referral Regions";
	} else if (regionType == "hsa") {
		title = "Hospital Service Areas";
	} else if (regionType == "hospital_system") {
		title = "Hospital Systems";
	}

	let titleElem = document.createElement("h5");
	titleElem.className = "title is-5";
	titleElem.textContent = title;
	section.appendChild(titleElem);

	let mapArea = document.createElement("div");
	mapArea.id = `maparea-${regionType}`;
	mapArea.className = "maparea";
	section.appendChild(mapArea);

	let tableArea = document.createElement("div");
	tableArea.id = `tablearea-${regionType}`;
	tableArea.className = "table-area";
	section.appendChild(tableArea);

	return true;
}

function generateRegionTable(regionType) {
	createRegionTypeSection(regionType);

	const requestData = {
		region_type: regionType,
		start_date: document.getElementById("form-start-date").value,
		end_date: document.getElementById("form-end-date").value,
		patient_type: document.getElementById("form-patienttype").value,
		metric_type: document.getElementById("form-metrictype").value,
	};

	$.ajax({
		url: "/api/region-selection",
		dataType: "json",
		data: requestData,
		beforeSend: common.showProgressbar,
		error: common.showError,
		success: response => {
			common.hideProgressbar();

			let table = createTable(response, {region_name: "Region", overflow_total_pct: "Shortage %", overflow_total: "Shortage", overflow_ideal_total: "Optimal Shortage", benefits: "Reduction", benefits_pct: "Reduction %"});
	
			const tableId = `table-${regionType}`;
			if (document.getElementById(tableId) == null) {
				document.getElementById(`tablearea-${regionType}`).appendChild(table);
			} else {
				document.getElementById(tableId).replaceWith(table);
			}
			table.id = tableId;
	
			if (regionType == "hrr" || regionType == "hsa" || regionType == "state") {
				createRegionChoropleth(regionType, response);
			}
		},
	});
}

function updateTables() {
	generateRegionTable("state");
	generateRegionTable("hrr");
	generateRegionTable("hsa");
	generateRegionTable("hospital_system");
}

$.getJSON("/json/metadata.json", metadata => {
	const maxDate = new Date(metadata.dates.forecast_end);

	let startDate = new Date();
	let endDate = common.addDays(startDate, 7);

	if (endDate > maxDate) {
		endDate = maxDate;
		startDate = common.addDays(maxDate, -7);
	}

	document.getElementById("form-start-date").value = common.dateStr(startDate);
	document.getElementById("form-end-date").value = common.dateStr(endDate);

	document.getElementById("form-start-date").min = metadata.dates.hhsdata_start;
	document.getElementById("form-start-date").max = metadata.dates.forecast_end;
	document.getElementById("form-end-date").min = metadata.dates.hhsdata_start;
	document.getElementById("form-end-date").max = metadata.dates.forecast_end;

	updateTables();

	document.getElementById("form-start-date").addEventListener("change", updateTables);
	document.getElementById("form-end-date").addEventListener("change", updateTables);
	document.getElementById("form-patienttype").addEventListener("change", updateTables);
	document.getElementById("form-metrictype").addEventListener("change", updateTables);
});
