import * as common from "./common.js";
import {createRegionChoropleth} from "./region_choropleths.js";


let mainSection = document.getElementById("main-content-area");

function createTable(table_data, cols) {

	let currentSort = {sortBy: "region_type", sortDir: true};

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
	let colheaders = {};

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
				colheaders[c].style.textDecoration = "underline";
			} else {
				arrows[c].up.classList.add("arrow-light");
				arrows[c].down.classList.add("arrow-light");
				colheaders[c].style.textDecoration = "none";
			}
		}
	}

	let header = document.createElement("tr");
	for (const [colid, colname] of Object.entries(cols)) {
		let el = document.createElement("th");
		el.style.cursor = "pointer";
		el.style.whiteSpace = "nowrap";
		header.appendChild(el);

		let elText = document.createElement("span");
		elText.innerHTML = colname;
		el.appendChild(elText);
		colheaders[colid] = elText;

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

const regionTypes = {
	"state": "State",
	"hrr": "HRR",
	"hsa": "HSA",
	"hospital_system": "Hospital System",
};

const metrics = {
	"overflow_total_pct": "Shortage %",
	"benefits": "Reduction",
};

const patientType = "icu";
const metricType = "beds";

const currentDate = "2022-01-15";
const startDate = common.addDays(currentDate, -6);
const endDate = common.addDays(currentDate, 6);
const baseParams = {"start_date": startDate, "end_date": endDate, "patient_type": patientType, "metric_type": metricType};

const ps = Object.keys(regionTypes).map(rt => $.getJSON("/api/region-selection", {"region_type": rt, ...baseParams}));
Promise.all(ps).then(resultsRaw => {
	common.hideProgressbar();

	const regionTypeKeys = Object.keys(regionTypes);

	const results = {};
	for (const result of resultsRaw) {
		results[result[0].region_type] = result;
	}

	createRegionChoropleth("hrr", results["hrr"]);

	for (const [metricId, metricName] of Object.entries(metrics)) {

		for (const rt of regionTypeKeys) {
			results[rt].sort((a,b) => b[metricId] - a[metricId]);
		}

		const pickTop2 = xs => xs.slice(0, Math.min(xs.length, 2));
		let resultsTop = regionTypeKeys.map(rt => pickTop2(results[rt]));
		resultsTop = Array().concat(...resultsTop);

		for (let i = 0; i < resultsTop.length; i++) {
			resultsTop[i].region_type = regionTypes[resultsTop[i].region_type];
		}

		let table = createTable(resultsTop, {region_name: "Region", region_type: "Region Type", [metricId]: metricName});

		mainSection.appendChild(table);
	}
});

$.getJSON("/api/status-report", {"date": currentDate}).then(statusReport => {
	const dateStr = new Date(statusReport.date_current).toLocaleDateString('en-us', {month: "long", day: "numeric", year: "numeric", timeZone: "UTC"});
	const risingFalling = (statusReport.arrivals_next > statusReport.arrivals_prev) ? "rising" : "falling";
	const overCapPctPrev = (statusReport.n_shortage_prev / statusReport.n_hospitals * 100).toFixed(1);
	const overCapPctNext = (statusReport.n_shortage_next / statusReport.n_hospitals * 100).toFixed(1);

	Promise.all(ps).then(resultsRaw => {
		let topRegions = resultsRaw.map(r => r[0]).filter(r => r.region_type != "Hospital System");
		for (let i = 0; i < topRegions.length; i++) {
			topRegions[i].region_name = topRegions[i].region_name.replace(",", " ");
			topRegions[i].benefits_pct_str = (topRegions[i].benefits_pct * 100).toFixed(1);
		}

		let text = `
		As of ${dateStr} COVID-19 hospitalizations are ${risingFalling} in the US. We estimate ${overCapPctPrev}% of hospitals exceeded their baseline COVID-19 ICU patient capacity over the past week, and ${overCapPctNext}% will exceed this capacity over the coming week. This means that approximately ${statusReport.n_shortage_next} additional beds will be required over the coming week without optimal transfers.
		<br><br>
		Some of the regions that are expected to have large shortages of ICU capacity for COVID-19 patients over the next two weeks are: ${topRegions[0].region_name}, ${topRegions[1].region_name}, and ${topRegions[2].region_name}. Using optimal patient transfers we can reduce the COVID-19 ICU capacity shortages in ${topRegions[0].region_name} by ${topRegions[0].benefits_pct_str}%, in ${topRegions[1].region_name} by ${topRegions[1].benefits_pct_str}%, and in ${topRegions[2].region_name} by ${topRegions[2].benefits_pct_str}%.
		`;

		let textEl = document.getElementById("status-report-text");
		textEl.innerHTML = text;
	});
});
