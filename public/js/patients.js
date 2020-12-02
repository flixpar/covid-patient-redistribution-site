console.log("Starting!");

let container = document.getElementById("result-area");
let recentResponse = null;

toTitlecase = s => s.split(' ').map(w => w[0].toUpperCase() + w.substr(1)).join(' ');


function handleResponse(response, status, xhr) {
	console.log("Updating...");
	hideProgressbar();
	container.innerHTML = "";

	recentResponse = response;

	const summary_data = response.summary;
	const full_results = response.full_results;
	const sent_matrix  = response.sent_matrix;
	const net_sent     = response.net_sent;
	const sent         = response.sent;
	const beds         = response.beds;
	const capacity     = response.capacity;
	const active_patients = response.active;
	const active_patients_nosent = response.active_null;
	const config       = response.config;

	makeSections();

	if (response.config.region == "new_jersey") {
		const d = njCaseDescription(response.config.start_date, response.config.end_date);
		let description = document.createElement("p");
		description.innerHTML = d;
		getSection("casestudy-info").appendChild(description);
	} else if (response.config.region == "northeast") {
		const d = neCaseDescription(response.config.start_date, response.config.end_date);
		let description = document.createElement("p");
		description.innerHTML = d;
		getSection("casestudy-info").appendChild(description);
	} else {
		let section = getSection("casestudy-info");
		let sectionContainer = section.parentElement;
		sectionContainer.remove();
	}

	createStatsSummary(response);
	createSurgeCapacityMetrics(response);

	createMap(response, "overflow_dynamic");

	createJHHSDashboard(response);
	createTransfersBreakdownPlot(response);

	createActivePlot(active_patients, active_patients_nosent, capacity, config);
	createOverallLoadPlot(response);
	createLoadPlots(response);
	createParallelPlot(response, "patients");
	createRidgePlot(net_sent, config.node_names, "patients");

	setupTable(summary_data, is_wide=true, table_id="summary-table", title="Summary Statistics");
	setupTable(full_results, is_wide=true, table_id="full-table",    title="Full Results");
	setupTableFilter("full-table");

	setupDownloads(response);

	console.log("Done.");
}

function makeSections() {
	const sectionInfo = [
		{title: "Info",                                   identifier: "casestudy-info",      showDefault: true},
		{title: "Main Results",                           identifier: "results-dashboard",   showDefault: true},
		{title: "Surge Metrics",                          identifier: "results-surgemetrics",showDefault: true},
		{title: "Required Surge Capacity Map",            identifier: "results-overflowmap", showDefault: true},
		{title: "Healthcare System Load",                 identifier: "results-load",        showDefault: true},
		{title: "Patient Transfer Flows",                 identifier: "results-transfers",   showDefault: true},
		{title: "Number of Active COVID Patients",        identifier: "results-active",      showDefault: false},
		{title: "Metrics",                                identifier: "results-metrics",     showDefault: false},
		{title: "Raw Results",                            identifier: "results-raw",         showDefault: false},
	]

	for (s of sectionInfo) {
		makeSection(s)
	}
}

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
	// sectionID = "result-area";
	sectionID = "section-" + sectionID;
	return document.getElementById(sectionID);
}

function setupTable(table_data, is_wide=false, table_id=null, title=null, replace=false) {

	const cols = Object.keys(table_data);
	const colNames = cols.map(c => toTitlecase(c.replace(/_/g, " ")));

	let table = document.createElement("table");
	table.id = table_id;
	table.className = "table is-hoverable is-fullwidth";

	let tablehead = document.createElement("thead");
	let tablebody = document.createElement("tbody");

	tablebody.className = "is-family-monospace";

	let header = document.createElement("tr");
	colNames.forEach(colname => {
		let el = document.createElement("th");
		el.innerHTML = colname;
		header.appendChild(el);
	});
	tablehead.appendChild(header);

	const nrows = table_data[cols[0]].length;
	for (let i = 0; i < nrows; i++) {
		let row = document.createElement("tr");
		for (colName of cols) {
			const val = table_data[colName][i];
			let el = document.createElement("td");
			if (typeof val == "string") {
				el.innerHTML = val;
			} else if (val == null) {
				console.log(i, colName, "NULL!!");
				el.innerHTML = "NaN";
			} else {
				el.innerHTML = val.toFixed(3);
			}
			row.appendChild(el);
		}
		tablebody.appendChild(row);
	}

	table.appendChild(tablehead);
	table.appendChild(tablebody);

	const section = getSection("results-raw");

	if (!replace) {
		if (is_wide) {
			let _table = table;
			table = document.createElement("div");
			table.className = "table-container";
			table.appendChild(_table);
		}
	
		if (title != null) {
			let titleElement = document.createElement("h5");
			titleElement.className = "title is-5";
			titleElement.innerHTML = title;
			section.appendChild(titleElement);
		}

		section.appendChild(table);

		let hr = document.createElement("hr");
		section.appendChild(hr);
	} else {
		let prevTable = document.getElementById(table_id);
		prevTable.replaceWith(table);
	}

	addColumnTooltips(table_id);

	return table;
}

function setupTableFilter(table_id) {
	let form = document.createElement("div");
	let filterByLabel = document.createElement("label");
	let filterBySelect = document.createElement("select");
	let filterButton = document.createElement("button");

	let op1 = document.createElement("option");
	let op2 = document.createElement("option");
	let op3 = document.createElement("option");
	op1.text = "None";
	op1.value = "none";
	op2.text = "Location";
	op2.value = "location";
	op3.text = "Date";
	op3.value = "date";
	op1.selected = true;
	filterBySelect.appendChild(op1);
	filterBySelect.appendChild(op2);
	filterBySelect.appendChild(op3);
	filterBySelect.id = "filter-by-select";

	filterBySelect.addEventListener("change", updateFilterBy);

	let filterBySelectWrapper = document.createElement("span");
	filterBySelectWrapper.className = "select is-fullwidth";
	filterBySelectWrapper.appendChild(filterBySelect);

	filterByLabel.innerHTML = "Filter by:";
	filterByLabel.htmlFor = "filter-by-select";
	filterByLabel.className = "label";

	filterButton.innerHTML = "Filter";
	filterButton.type = "button";
	filterButton.className = "button is-info is-fullwidth";
	filterButton.id = "filter-button";

	filterButton.addEventListener("click", filterFullTable);

	let filterByField = wrapField(filterByLabel, filterBySelectWrapper, 3);
	let filterButtonField = wrapField(filterButton, null, 3);

	filterByField.id = "filter-by-field";
	filterButtonField.id = "filter-button-field";
	filterButtonField.style = "display: flex; flex-direction: column; justify-content: flex-end;";

	form.appendChild(filterByField);
	form.appendChild(filterButtonField);
	form.className = "field is-horizontal";

	const table = document.getElementById(table_id);
	table.parentElement.insertBefore(form, table);
}

function updateFilterBy() {
	let temp = document.getElementById("filter-value-field");
	if (temp !== null) {
		temp.remove();
	}

	const filterby = document.getElementById("filter-by-select").value;
	if (filterby === "none") return;

	let filterValueSelect = document.createElement("select");
	let filterValueLabel = document.createElement("label");

	filterValueSelect.id = "filter-value-select";

	filterValueLabel.innerHTML = "Value:";
	filterValueLabel.htmlFor = "filter-value-select";
	filterValueLabel.className = "label";

	let filterValueSelectWrapper = document.createElement("span");
	filterValueSelectWrapper.className = "select is-fullwidth";
	filterValueSelectWrapper.appendChild(filterValueSelect);

	let filterValueField = wrapField(filterValueLabel, filterValueSelectWrapper, 3);
	filterValueField.id = "filter-value-field";

	let filterByField = document.getElementById("filter-by-field");
	filterByField.parentElement.insertBefore(filterValueField, filterByField.nextSibling);

	if (filterby === "location") {
		let options = recentResponse.config.node_names;
		createOptions(options, filterValueSelect);
	} else if (filterby === "date") {
		let allDates = recentResponse.full_results.columns[1];
		let uniqueDates = allDates.filter(function(item, pos){
			return allDates.indexOf(item) == pos; 
		});
		let options = uniqueDates.sort();
		createOptions(options, filterValueSelect);
	}
}

function wrapField(firstField, secondField=null, fieldWidth=null) {
	let fieldContainer = document.createElement("div");
	fieldContainer.className = "field";
	fieldContainer.appendChild(firstField);
	if (secondField !== null) {
		fieldContainer.appendChild(secondField);
	}
	if (fieldWidth !== null) {
		fieldContainer.classList.add("column", "is-"+fieldWidth);
	}
	return fieldContainer;
}

function createOptions(opts, select) {
	for (let i in opts) {
		let option = document.createElement("option");
		option.text = opts[i];
		option.value = opts[i];
		select.appendChild(option);
	}
}

function filterFullTable() {
	const filterby = document.getElementById("filter-by-select").value;
	if (filterby === "none") {
		setupTable(recentResponse.full_results, is_wide=true, table_id="full-table", title="Full Results", replace=true);
		return;
	};

	let tableData = JSON.parse(JSON.stringify(recentResponse.full_results));
	let colIdx = -1;
	if (filterby === "location") {
		colIdx = tableData.colindex.lookup.location - 1;
	} else {
		colIdx = tableData.colindex.lookup.day - 1;
	}

	const filterValue = document.getElementById("filter-value-select").value;

	let values = tableData.columns[colIdx];
	console.log(values);
	let filterInd = [];
	for (let i = 0; i < values.length; i++) {
		if (values[i] == filterValue) {
			filterInd.push(i);
		}
	}

	for (const i in tableData.columns) {
		tableData.columns[i] = tableData.columns[i].filter((_,j) => filterInd.indexOf(j) >= 0);
	}

	setupTable(tableData, is_wide=true, table_id="full-table", title="Full Results", replace=true);
}

function setupDownloads(rawdata) {
	const section = getSection("results-raw");

	let downloadContainer = document.createElement("div");
	section.appendChild(downloadContainer);

	let downloadTitle = document.createElement("h5");
	downloadTitle.className = "title is-5";
	downloadTitle.textContent = "Download";
	downloadContainer.appendChild(downloadTitle);

	let downloadAllButton = document.createElement("button");
	downloadAllButton.className = "button is-info";
	downloadAllButton.style.marginRight = "10px";
	downloadAllButton.textContent = "Download Raw Response";
	downloadAllButton.type = "button";
	downloadAllButton.addEventListener("click", _ => {
		console.log("download raw");
		downloadObjectAsJSON(rawdata, "patient_alloc_raw.json");
	});
	downloadContainer.appendChild(downloadAllButton);

	let downloadTableButton = document.createElement("button");
	downloadTableButton.className = "button is-info";
	downloadTableButton.style.marginRight = "10px";
	downloadTableButton.textContent = "Download Table";
	downloadTableButton.type = "button";
	downloadTableButton.addEventListener("click", _ => {
		console.log("download table");
		downloadTableAsCSV(rawdata.full_results, "patient_alloc_table.json");
	});
	downloadContainer.appendChild(downloadTableButton);

	let downloadSummaryButton = document.createElement("button");
	downloadSummaryButton.className = "button is-info";
	downloadSummaryButton.style.marginRight = "10px";
	downloadSummaryButton.textContent = "Download Summary Table";
	downloadSummaryButton.type = "button";
	downloadSummaryButton.addEventListener("click", _ => {
		console.log("download table");
		downloadTableAsCSV(rawdata.summary, "patient_alloc_summary.json");
	});
	downloadContainer.appendChild(downloadSummaryButton);

	let hr = document.createElement("hr");
	section.appendChild(hr);
}

function downloadObjectAsJSON(exportObj, fn) {
	const data = JSON.stringify(exportObj, null, 4);
	const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(data);
	let downloadAnchorNode = document.createElement("a");
	downloadAnchorNode.setAttribute("href",     dataStr);
	downloadAnchorNode.setAttribute("download", fn);
	document.body.appendChild(downloadAnchorNode);
	downloadAnchorNode.click();
	downloadAnchorNode.remove();
}

function downloadTableAsCSV(table, fn) {
	const cols = Object.keys(table);
	const nrows = table[cols[0]].length;
	const data = d3.range(nrows).map(i => {
		let row = {};
		for (col of cols) {
			row[col] = table[col][i];
		}
		return row;
	});

	const csvData = d3.csvFormat(data);
	const dataStr = "data:text/csv;charset=utf-8," + encodeURIComponent(csvData);
	let downloadAnchorNode = document.createElement("a");
	downloadAnchorNode.setAttribute("href",     dataStr);
	downloadAnchorNode.setAttribute("download", fn);
	document.body.appendChild(downloadAnchorNode);
	downloadAnchorNode.click();
	downloadAnchorNode.remove();
}

function createSurgeCapacityMetrics(rawdata) {
	const N = rawdata.config.node_names.length;
	const T = rawdata.config.dates.length;
	const nDecimals = 0;

	const maxoverflow_byloc_sent = d3.range(N).map(i => d3.max(rawdata.active[i].map(x => Math.max(0, x - rawdata.beds[i]))));
	const maxoverflow_byloc_nosent = d3.range(N).map(i => d3.max(rawdata.active_null[i].map(x => Math.max(0, x - rawdata.beds[i]))));

	let table = document.createElement("table");
	table.id = "surgemetrics-table";
	table.className = "table";
	table.style.marginLeft = "auto";
	table.style.marginRight = "auto";

	let titleRow = document.createElement("tr");
	let titleRowElem = document.createElement("td");
	titleRowElem.innerText = "Required Surge Capacity (Beds)";
	titleRowElem.colSpan = N+1;
	titleRowElem.className = "text-centered";
	titleRow.appendChild(titleRowElem);
	table.appendChild(titleRow);

	let keyRow = document.createElement("tr");
	let valueRow = document.createElement("tr");
	table.appendChild(keyRow);
	table.appendChild(valueRow);

	function addMetric(mName, mValue) {
		let keyElem = document.createElement("td");
		let valueElem = document.createElement("td");

		keyElem.innerText = mName;
		if (mValue != null && typeof mValue == "number") {
			valueElem.innerText = mValue.toFixed(nDecimals);
		} else {
			valueElem.innerText = mValue;
		}

		keyRow.appendChild(keyElem);
		valueRow.appendChild(valueElem);
	}

	for (let i = 0; i < N; i++) {
		addMetric(rawdata.config.node_names[i], maxoverflow_byloc_sent[i]);
	}
	addMetric("Total", d3.sum(maxoverflow_byloc_sent));

	const section = getSection("results-surgemetrics");
	section.appendChild(table);
}

function createStatsSummary(rawdata, add_description=true) {
	const N = rawdata.config.node_names.length;
	const T = rawdata.config.dates.length;
	const nDecimals = 0;

	let table = document.createElement("table");
	table.id = "metrics-table";
	function addMetric(m_name, m_value) {
		let row = document.createElement("tr");
		let col1 = document.createElement("td");
		let col2 = document.createElement("td");

		col1.className = "metric-name-elem";
		col2.className = "metric-value-elem";

		col1.innerText = m_name;
		if (m_value != null && typeof m_value == "number") {
			col2.innerText = m_value.toFixed(nDecimals);
		} else {
			col2.innerText = m_value;
		}

		row.appendChild(col1);
		row.appendChild(col2);
		table.appendChild(row);
	}

	const overflow_byloc = d3.range(N).map(i => rawdata.active[i].map(x => Math.max(0, x - rawdata.beds[i])));
	const overflow_nosent_byloc = d3.range(N).map(i => rawdata.active_null[i].map(x => Math.max(0, x - rawdata.beds[i])));

	const overflow_nosent = d3.sum(d3.merge(overflow_nosent_byloc));
	const overflow_sent = d3.sum(d3.merge(overflow_byloc));
	const overflow_reduction = (overflow_nosent - overflow_sent) / overflow_nosent;

	const maxoverflow_nosent = d3.sum(d3.range(N).map(i => d3.max(overflow_nosent_byloc[i])));
	const maxoverflow_sent = d3.sum(d3.range(N).map(i => d3.max(overflow_byloc[i])));;

	const sent_total = d3.sum(rawdata.sent, x => d3.sum(x, z => d3.sum(z)));
	const sent_pct = sent_total / rawdata.total_patients;

	addMetric("Required Surge Capacity (Without Transfers)", overflow_nosent);
	addMetric("Required Surge Capacity (With Transfers)", overflow_sent);
	addMetric("Reduction in Required Surge Capacity", (overflow_reduction * 100).toFixed(2) + "%");
	addMetric("Max Required Surge Capacity (Without Transfers)", maxoverflow_nosent);
	addMetric("Max Required Surge Capacity (With Transfers)", maxoverflow_sent);
	addMetric("Transferred Patients", sent_total);
	addMetric("Perecent of Patients Transferred", (sent_pct * 100).toFixed(2) + "%");

	const section = getSection("results-metrics");

	if (add_description) {
		let description = document.createElement("p");
		description.innerHTML = metricsDescription;
		section.appendChild(description);
	}

	section.appendChild(table);
}

function showProgressbar() {
	$("#progressbar-area").show();
	container.innerHTML = "";
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

function sendUpdateQuery() {
	if (!validateForm()) {
		return;
	}
	const surgepreferences = {
		bmc: document.getElementById("form-surgepreferences-bmc").value,
		hcgh: document.getElementById("form-surgepreferences-hcgh").value,
		jhh: document.getElementById("form-surgepreferences-jhh").value,
		sh: document.getElementById("form-surgepreferences-sh").value,
		smh: document.getElementById("form-surgepreferences-smh").value,
	};
	const data = {
		scenario: $("#form-scenario")[0].value,
		patient_type: $("#form-patient-type")[0].value,
		objective: $("#form-objective")[0].value,
		surgepreferences: surgepreferences,
		utilization: $("#form-utilization")[0].value,
		uncertaintylevel: $("#form-uncertainty")[0].value,
		los: $("#form-los")[0].value,
		start_date: $("#form-start-date")[0].value,
		end_date: $("#form-end-date")[0].value,
	}
	console.log("Querying server...");
	$.ajax({
		url: "/api/patients",
		type: "post",
		contentType: "application/json; charset=utf-8",
		dataType: "json",
		data: JSON.stringify(data),
		success: handleResponse,
		beforeSend: showProgressbar,
		error: ajaxErrorHandler,
	});
}

$("#form-submit").click(sendUpdateQuery);
sendUpdateQuery();


function createInfo(parentElement, content) {
	let el = document.createElement("img");
	el.src = "img/info.svg";
	el.className = "info-icon";
	el.setAttribute("data-tippy-content", content);
	parentElement.appendChild(el);
	tippy(el, {delay: [null, 250]});
}

const tooltip_content = {
	"form-start-date": "Date to start the patient allocation model.",
	"form-end-date"  : "Date to end the patient allocation model.",
	"form-los"       : "Expected number of days that a patient will have to stay in the hospital.",
	"form-patient-type": "Restrict focus to patients requiring a certain level of care.",
	"form-scenario": "Forecast scenario to use.",
	"form-objective": "Primary objective for the optimization model.",
	"form-weights": "Preferences for where to transfer patients to if the system runs out of capacity.",
	"form-surgepreferences": "Preference for where to create additional capacity if it is necessary.",
	"form-utilization": "Percentage of the total capacity that can be used in practice.",
	"form-uncertainty": "Level of uncertainty in the forcast that we should plan for.",
};
$("#form label").each((i, el) => {
	const k = el.getAttribute("for");
	if (k in tooltip_content) {
		createInfo(el, tooltip_content[k]);
	}
});

const column_descriptions = {
	"Total Sent": "Total number of patients that should be sent to another state according to our model.",
	"Total Received": "Total number of patients that would be received from another state under our model.",
	"Overflow": "Number of patient-days where a patient does not have a hospital bed available to them.",
	"Capacity": "Number of hospital beds in the state.",
	"New Patients": "Forecasted number of people who need to be admitted to the hospital on a given day in a given state.",
	"Sent": "Number of patients that should be sent to another state on a given day according to our model.",
	"Received": "Number of patients that would be received from another state on a given day under our model.",
	"Active Patients": "Expected number of patients in a given state on a given day after re-distribution.",
	"Average Load" : "Percentage of beds dedicated to COVID patients that are filled, on average.",
	"Load" : "Percentage of beds dedicated to COVID patients that are filled.",
	"Date": "Date in YYYY-MM-DD format.",
};
function addColumnTooltips(tableId) {
	$("#" + tableId + " th").each((i, el) => {
		const k = el.innerText;
		if (k in column_descriptions) {
			createInfo(el, column_descriptions[k]);
		}
	});
}
