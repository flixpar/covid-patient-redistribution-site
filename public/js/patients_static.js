import * as common from "./patients_common.js";
import {createMap} from "./map_plots.js";
import {createSurgeTimeline} from "./surgetimeline.js";
import {createOverallLoadPlot, createLoadPlots} from "./loadplots.js";
import {createTransfersSankey} from "./transfers_sankey.js";
import {createStatsSummary} from "./metrics.js";
import {setupTable, setupTableFilter, setupDownloads} from "./tables.js";

let recentResponse = null;


function handleResponse(response, changeHospitalSelect=true) {
	recentResponse = response;
	if(changeHospitalSelect) {filterHospitalSelect(response);}
	const newResponse = filterResponse(response);
	common.hideProgressbar();
	generateContent(newResponse);
}

function generateContent(response) {
	console.log("Updating...");
	clearContent();

	createMap(response, "load", "transfers");
	createOverallLoadPlot(response);
	createLoadPlots(response);
	createTransfersSankey(response);
	createSurgeTimeline(response);

	createStatsSummary(response);

	setupTable(response.summary, true, "summary-table", "Summary Statistics");
	setupTable(response.full_results, true, "full-table", "Full Results");
	setupTableFilter("full-table");

	setupDownloads(response);

	common.updateText(response);

	console.log("Done.");
}

const sectionInfo = [
	{title: "Occupancy and Optimal Transfers Map", identifier: "results-maps",    reset:true,  showDefault: true, subtitle: "How busy are hospitals? Where are more beds needed?"},
	{title: "Select Displayed Locations",      identifier: "parameters",          reset:false, showDefault: true},
	{title: "Patient Transfer Flows",          identifier: "results-transfers",   reset:true,  showDefault: true, subtitle: "Where should patients be transferred?"},
	{title: "Capacity Timeline",               identifier: "results-surgetimeline", reset:true, showDefault: true, subtitle: "When are additional beds needed?"},
	{title: "Total COVID Occupancy",           identifier: "results-totalload",   reset:true,  showDefault: true},
	{title: "COVID-19 Occupancy by Location",  identifier: "results-load",        reset:true,  showDefault: true},
	{title: "Metrics",                         identifier: "results-metrics",     reset:true,  showDefault: false},
	{title: "Raw Results",                     identifier: "results-raw",         reset:true,  showDefault: false},
];

function makeSections() {
	for (const s of sectionInfo) {
		common.makeSection(s);
		let e = common.getSection(s.identifier);
	}
}
makeSections();

function clearContent() {
	for (const s of sectionInfo) {
		if (s.reset) {
			let section = common.getSection(s.identifier);
			section.innerHTML = "";
		}
	}
}

function getHospitals() {
	const data = {
		region_type: $("#form-regiontype")[0].value,
		region_id: $("#form-region")[0].value,
	};
	let request = $.get("/api/hospital-list", data, d => {
		common.createHospitalsSelect(d, true, false);
		addUpdateButton();
	});
	return request;
}

function createParametersForm() {
	let regionSelect = document.getElementById("form-region");
	let patienttypeSelect = document.getElementById("form-patient-type");

	let getRegionsRequest = common.getRegions();
	let getHospitalsRequest = getRegionsRequest.then(() => getHospitals());
	getHospitalsRequest.then(() => sendUpdateQuery());

	regionSelect.addEventListener("change", () => getHospitals().then(() => sendUpdateQuery()));
	patienttypeSelect.addEventListener("change", () => getHospitals().then(() => sendUpdateQuery()));

	let parametersFormSection = common.getSection("parameters");

	let hospitalSelectField = document.createElement("div");
	hospitalSelectField.id = "hospital-select-field";
	parametersFormSection.appendChild(hospitalSelectField);
}

function addUpdateButton() {
	let selectUpdateButton = document.createElement("button");
	selectUpdateButton.textContent = "Update Page";
	selectUpdateButton.type = "button";
	selectUpdateButton.className = "button is-info is-small";

	let updateButtonContainer = document.createElement("div");
	updateButtonContainer.className = "buttons";
	updateButtonContainer.style.marginTop = "4px";
	updateButtonContainer.style.marginBottom = "0px";
	updateButtonContainer.appendChild(selectUpdateButton);
	document.querySelector("#hospitalselect-footer").appendChild(updateButtonContainer);

	document.querySelector("#hospitalselect-buttons-container").style.display = "block";
	document.querySelector("#hospitalselect-buttons-container").style.marginBottom = "0px";
	document.querySelector("#hospitalselect-buttons-container").style.marginTop = "4px";
	document.querySelector("#hospitalselect-buttons-container").style.width = "32%";

	document.querySelector("#hospitalselect-footer").style.display = "flex";
	document.querySelector("#hospitalselect-footer").style.justifyContent = "space-between";

	document.querySelectorAll("#hospitalselect-buttons-container button").forEach(elem => elem.style.width = "31%");
	document.querySelectorAll("#hospitalselect-buttons-container button").forEach(elem => elem.style.marginRight = "2%");
	document.querySelectorAll("#hospitalselect-buttons-container button").forEach(elem => elem.style.minWidth = "100px");

	document.querySelectorAll("#hospitalselect-footer button").forEach(elem => elem.style.marginBottom = "0px");

	updateButtonContainer.style.width = "32%";
	selectUpdateButton.style.width = "100%";
	selectUpdateButton.style.minWidth = "100px";

	selectUpdateButton.addEventListener("click", () => {
		const nSelected = document.querySelectorAll(".hospitalselect-checkbox:checked").length;
		if (nSelected > 65) {
			warnManyHospitals(nSelected).then(c => {
				if (c) {handleResponse(recentResponse, false);}
			});
		} else {
			handleResponse(recentResponse, false);
		}
	});
}

function warnManyHospitals(n) {
	let overlay = document.createElement("div");
	overlay.id = "background-overlay";
	document.body.appendChild(overlay);

	const warningElemText = `
		<div class="message is-warning is-light warning-popup">
			<div class="message-header">
				<p>Warning</p>
				<button class="delete" aria-label="delete" id="warning-close"></button>
			</div>
			<div class="message-body">
				<p>You have selected more locations than is recommended. The page may run slow as a result.</p>
				<div style="float: right; margin-top: 10px; margin-bottom: 10px;">
					<button class="button is-warning is-light" id="warning-cancel">Cancel</button>
					<button class="button is-warning" id="warning-continue">Continue</button>
				</div>
			</div>
		</div>
	`;
	let tempElem = document.createElement("div");
	tempElem.innerHTML = warningElemText;
	let warningElem = tempElem.children[0];
	document.body.appendChild(warningElem);

	function removeWarning() {
		overlay.remove();
		warningElem.remove();
	}

	return new Promise(resolve => {
		overlay.addEventListener("click", () => {removeWarning(); resolve(true)});
		warningElem.querySelector("#warning-continue").addEventListener("click", () => {removeWarning(); resolve(true)});
		warningElem.querySelector("#warning-close").addEventListener("click", () => {removeWarning(); resolve(true)});
		warningElem.querySelector("#warning-cancel").addEventListener("click", () => {removeWarning(); resolve(false)});
	});
}

function createSelect(optionNames, defaultIdx, labelText, selectId) {
	let selectContainer = document.createElement("div");
	selectContainer.className = "field";

	let selectLabel = document.createElement("label");
	selectLabel.className = "label";
	selectLabel.htmlFor = selectId;
	selectLabel.textContent = labelText;
	selectLabel.style.marginBottom = "0.2rem";
	selectContainer.appendChild(selectLabel);

	let selectControl = document.createElement("div");
	selectControl.className = "control";
	selectContainer.appendChild(selectControl);

	let selectWrapper = document.createElement("div");
	selectWrapper.className = "select is-fullwidth";
	selectControl.appendChild(selectWrapper);

	let select = document.createElement("select");
	select.id = selectId;

	let options = optionNames.map(txt => {
		let s = document.createElement("option");
		s.text = txt;
		select.appendChild(s);
		return s;
	});

	if (defaultIdx != null) {
		options[defaultIdx].selected = true;
	}

	selectWrapper.appendChild(select);

	return selectContainer;
}

createParametersForm();

function listParameters(response) {
	const nDecimals = 5;

	let table = document.createElement("table");
	table.id = "parameters-table";
	table.className = "table is-hoverable";
	table.style.marginLeft = "auto";
	table.style.marginRight = "auto";

	let tableHead = document.createElement("thead");
	table.appendChild(tableHead);
	let tableHeader = document.createElement("tr");
	tableHead.appendChild(tableHeader);
	let keyHeader = document.createElement("th");
	let valueHeader = document.createElement("th");
	keyHeader.textContent = "Parameter";
	valueHeader.textContent = "Parameter Value";
	tableHeader.appendChild(keyHeader);
	tableHeader.appendChild(valueHeader);

	let tableBody = document.createElement("tbody");
	table.appendChild(tableBody);

	function addRow(k, v) {
		let row = document.createElement("tr");
		let col1 = document.createElement("td");
		let col2 = document.createElement("td");

		col1.className = "parameters-name-elem has-text-left";
		col2.className = "parameters-value-elem";

		col1.innerText = k;
		if (v != null && typeof v == "number") {
			col2.innerText = v.toFixed(nDecimals);
		} else {
			col2.innerText = v;
		}

		row.appendChild(col1);
		row.appendChild(col2);
		tableBody.appendChild(row);
	}
	function addSeparator() {
		let lastRow = tableBody.childNodes[tableBody.childElementCount-1];
		for (elem of lastRow.childNodes) {
			elem.style.borderBottom = "1px solid lightgray";
		}
	}

	const data = {
		scenario: $("#form-scenario")[0].value,
		patient_type: $("#form-patient-type")[0].value,
		objective: $("#form-objective")[0].value,
		integer: $("#form-integer")[0].value,
		transferbudget: $("#form-transferbudget")[0].value,
		utilization: $("#form-utilization")[0].value,
		uncertaintylevel: $("#form-uncertainty")[0].value,
		los: $("#form-los")[0].value,
		start_date: $("#form-start-date")[0].value,
		end_date: $("#form-end-date")[0].value,
	}

	const patient_type = (data.patient_type == "icu") ? "ICU" : toTitlecase(data.patient_type);

	addRow("Scenario", data.scenario);
	addRow("Patient Type", patient_type);
	addRow("Start Date", data.start_date);
	addRow("End Date", data.end_date);

	if (document.getElementById("parameters-table") != null) {
		document.getElementById("parameters-table").replaceWith(table);
	} else {
		let section = common.getSection("parameters");
		section.appendChild(table);
	}
}

function filterResponse(response_) {
	let response = JSON.parse(JSON.stringify(response_));

	const selectedHospitalIds = Array.from(document.querySelectorAll(".hospitalselect-checkbox:checked")).map(elem => elem.value);
	const selectedInd = selectedHospitalIds.map(i => response.config.nodes_meta.findIndex(h => h.hospital_id == i));
	const selectedHospitalNames = selectedInd.map(i => response.config.node_names[i]);

	const N = response_.config.node_names.length;
	const T = response_.admitted[0].length;
	const C = response_.capacity[0].length;

	const unselectedInd = d3.range(N).filter(i => selectedInd.indexOf(i) < 0);

	response.config.node_names = selectedInd.map(i => response.config.node_names[i]);
	response.config.node_names_abbrev = selectedInd.map(i => response.config.node_names_abbrev[i]);

	let node_locations = {};
	selectedHospitalNames.forEach(h => {
		node_locations[h] = response.config.node_locations[h];
	});
	response.config.node_locations = node_locations;

	response.beds = selectedInd.map(i => response.beds[i]);
	response.capacity = selectedInd.map(i => response.capacity[i]);
	response.active = selectedInd.map(i => response.active[i]);
	response.active_null = selectedInd.map(i => response.active_null[i]);
	response.admitted = selectedInd.map(i => response.admitted[i]);

	response.sent = selectedInd.map(i => selectedInd.map(j => response.sent[i][j]));

	const n = response.config.node_names.length;

	const otherHospitalsName = "Other Locations";

	response.config.node_names.push(otherHospitalsName);
	response.config.node_names_abbrev.push(otherHospitalsName);
	response.beds.push(d3.sum(unselectedInd, i => response_.beds[i]));
	response.capacity.push(d3.range(C).map(c => d3.sum(unselectedInd, i => response_.capacity[i][c])));
	response.active.push(d3.range(T).map(t => d3.sum(unselectedInd, i => response_.active[i][t])));
	response.active_null.push(d3.range(T).map(t => d3.sum(unselectedInd, i => response_.active_null[i][t])));
	response.admitted.push(d3.range(T).map(t => d3.sum(unselectedInd, i => response_.admitted[i][t])));
	response.config.node_locations[otherHospitalsName] = {
		lat: d3.mean(response_.config.node_names, h => response_.config.node_locations[h].lat),
		long: d3.mean(response_.config.node_names, h => response_.config.node_locations[h].long),
	};

	response.sent.push([]);
	for (let i = 0; i < n; i++) {
		response.sent[i].push(d3.range(T).map(t => d3.sum(unselectedInd, j => response_.sent[i][j][t])));
	}
	for (let i = 0; i < n; i++) {
		response.sent[n][i] = d3.range(T).map(t => d3.sum(unselectedInd, j => response_.sent[j][i][t]));
	}
	response.sent[n][n] = d3.range(T).map(t => d3.sum(unselectedInd, i => d3.sum(unselectedInd, j => response_.sent[i][j][t])));

	return response;
}

function filterHospitalSelect(response) {
	common.createHospitalsSelect(response.config.nodes_meta, true, false);
	addUpdateButton();
}

function sendUpdateQuery(latest=true) {
	console.log("Querying server...");
	const start_date = document.getElementById("form-start-date").value;
	const start_date_str = latest ? "latest" : start_date.replaceAll("-", "");
	const region = document.getElementById("form-region").value;
	const scenario = document.getElementById("form-scenario").value.toLowerCase();
	const patient_type = document.getElementById("form-patient-type").value.toLowerCase();
	const fn = `${start_date_str}_${scenario}_${patient_type}_state_${region}.json`;
	console.log(`Fetching: ${fn}`)
	let request = $.ajax({
		url: `/results-static/${fn}`,
		type: "get",
		contentType: "application/json; charset=utf-8",
		success: (r, ...x) => handleResponse(r, true),
		beforeSend: common.showProgressbar,
		error: common.ajaxErrorHandler,
	});
	return request;
}

const tooltip_content = {
	"form-patient-type": "Choose ICU or acute COVID-19 patients. Each patient type requires a certain level of care and beds, and hospitals have different capacities for each.",
	"form-scenario": "Each forecast scenario is a set of assumptions about the severity of the COVID outbreak which can be used to forecast hospitalizations.",
};
$("label").each((i, el) => {
	const k = el.getAttribute("for");
	if (k in tooltip_content) {
		common.createInfo(el, tooltip_content[k]);
	}
});
