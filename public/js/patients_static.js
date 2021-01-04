function handleResponse(response, status, xhr) {
	recentResponse = response;
	const newResponse = filterResponse(response);
	hideProgressbar();
	generateContent(newResponse);
}

function generateContent(response) {
	console.log("Updating...");
	clearContent();

	const summary_data = response.summary;
	const full_results = response.full_results;
	const capacity     = response.capacity;
	const active_patients = response.active;
	const active_patients_nosent = response.active_null;
	const config       = response.config;

	createStatsSummary(response);

	createMap(response, "overflow_dynamic");

	createOverallLoadPlot(response);
	createLoadPlots(response);
	createTransfersSankey(response);
	createSurgeTimeline(response);

	setupTable(summary_data, is_wide=true, table_id="summary-table", title="Summary Statistics");
	setupTable(full_results, is_wide=true, table_id="full-table",    title="Full Results");
	setupTableFilter("full-table");

	setupDownloads(response);

	enableHowtoButtons();

	console.log("Done.");
}

const sectionInfo = [
	{title: "Parameters",                      identifier: "parameters",          reset:false, showDefault: true},
	{title: "Required Surge Capacity Map",     identifier: "results-overflowmap", reset:true,  showDefault: true, subtitle: "Where are additional COVID beds required?"},
	{title: "Patient Transfer Flows",          identifier: "results-transfers",   reset:true,  showDefault: true, subtitle: "Where should patients be transfered?"},
	{title: "Timeline",                        identifier: "results-surgetimeline", reset:true, showDefault: true, subtitle: "When is additional capacity needed?"},
	{title: "Total COVID Occupancy",           identifier: "results-totalload",   reset:true,  showDefault: true},
	{title: "Hospital COVID Occupancy",        identifier: "results-load",        reset:true,  showDefault: true},
	{title: "Metrics",                         identifier: "results-metrics",     reset:true,  showDefault: false},
	{title: "Raw Results",                     identifier: "results-raw",         reset:true,  showDefault: false},
];

function makeSections() {
	for (s of sectionInfo) {
		makeSection(s);
		let e = getSection(s.identifier);
	}
}
makeSections();

function clearContent() {
	for (s of sectionInfo) {
		if (s.reset) {
			let section = getSection(s.identifier);
			section.innerHTML = "";
		}
	}
}

function getHospitals() {
	const data = {
		region_type: $("#form-regiontype")[0].value,
		region: $("#form-region")[0].value,
	};
	let request = $.get("/api/hospital-list", data, d => createHospitalsSelect(d));
	return request;
}

function createParametersForm() {
	let section = getSection("parameters");

	let formContainer = document.createElement("div");
	formContainer.id = "static-params-form";
	section.appendChild(formContainer);

	let selectArea = document.createElement("div");
	selectArea.id = "static-params-form-select-area";

	let regionSelect = createSelect(["MD"], 0, "Region", "form-region");
	let scenarioSelect = createSelect(["Optimistic", "Moderate", "Pessimistic"], 1, "Forecast Scenario", "form-scenario");
	let patienttypeSelect = createSelect(["ICU", "Acute"], 0, "Patient Type", "form-patient-type");

	selectArea.appendChild(regionSelect);
	selectArea.appendChild(scenarioSelect);
	selectArea.appendChild(patienttypeSelect);

	formContainer.appendChild(selectArea);

	let genRegionsRequest = getRegions();
	let getHospitalsRequest = genRegionsRequest.then(() => getHospitals());

	regionSelect.addEventListener("change", () => getHospitals());

	let selectUpdateButton = document.createElement("button");
	selectUpdateButton.textContent = "Update";
	selectUpdateButton.type = "button";
	selectUpdateButton.className = "button is-info is-fullwidth";
	selectUpdateButton.id = "params-form-submit";
	formContainer.appendChild(selectUpdateButton);

	getHospitalsRequest.done(() => {
		sendUpdateQuery();
		selectUpdateButton.addEventListener("click", () => sendUpdateQuery());
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
		let section = getSection("parameters");
		section.appendChild(table);
	}
}

function filterResponse(response_) {
	let response = JSON.parse(JSON.stringify(response_));

	const selectedHospitalNames = response.config.nodes_meta.map((h,i) => {
		const j = response.config.node_names.indexOf(h.name);
		const c = document.getElementById(`hospitalselect-${j}`).checked;
		return c ? h.name : null;
	}).filter(x => x != null);
	const selectedInd = selectedHospitalNames.map(h => response.config.node_names.indexOf(h)).sort();

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

	const otherHospitalsName = "Other Hospitals";

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

function sendUpdateQuery(latest=false) {
	console.log("Querying server...");
	let start_date_str = document.getElementById("form-start-date").value.replaceAll("-", "");
	start_date_str = latest ? "latest" : start_date_str;
	const region = document.getElementById("form-region").value;
	const scenario = document.getElementById("form-scenario").value.toLowerCase();
	const patient_type = document.getElementById("form-patient-type").value.toLowerCase();
	const fn = `${start_date_str}_${scenario}_${patient_type}_state_${region}.json`;
	console.log(`Fetching: ${fn}`)
	$.ajax({
		url: `/results-static/${fn}`,
		type: "get",
		contentType: "application/json; charset=utf-8",
		success: handleResponse,
		beforeSend: showProgressbar,
		error: e => {
			if (!latest) {
				sendUpdateQuery(true);
			} else {
				ajaxErrorHandler(e);
			}
		},
	});
}

const tooltip_content = {
	"form-patient-type": "Restrict the focus to patients requiring a certain level of care, and the capacity available for those patients.",
	"form-scenario": "Each forecast scenario is a set of assumptions about the severity of the COVID outbreak which can be used to forecast hospitalizations.",
	"hospitalselect": "Hospitals to be included in our analysis. Note that all hospitals are included in our model, but only those selected here are visualized.",
};
$("label").each((i, el) => {
	const k = el.getAttribute("for");
	if (k in tooltip_content) {
		createInfo(el, tooltip_content[k]);
	}
});
