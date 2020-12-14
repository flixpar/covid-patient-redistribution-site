function handleResponse(response, status, xhr) {
	recentResponse = response;
	hideProgressbar();
	generateContent(response);
}

function generateContent(response) {
	console.log("Updating...");
	container.innerHTML = "";

	const summary_data = response.summary;
	const full_results = response.full_results;
	const capacity     = response.capacity;
	const active_patients = response.active;
	const active_patients_nosent = response.active_null;
	const config       = response.config;

	makeSections();
	createHospitalsSelect(response.config.nodes_meta);
	listParameters(response);

	createStatsSummary(response);

	createMap(response, "overflow_dynamic");

	createActivePlot(active_patients, active_patients_nosent, capacity, config);
	createOverallLoadPlot(response);
	createLoadPlots(response);
	createTransfersSankey(response);

	setupTable(summary_data, is_wide=true, table_id="summary-table", title="Summary Statistics");
	setupTable(full_results, is_wide=true, table_id="full-table",    title="Full Results");
	setupTableFilter("full-table");

	setupDownloads(response);

	console.log("Done.");
}

function makeSections() {
	const sectionInfo = [
		{title: "Info",                                   identifier: "casestudy-info",      showDefault: true},
		{title: "Healthcare System Load",                 identifier: "results-load",        showDefault: true},
		{title: "Required Surge Capacity Map",            identifier: "results-overflowmap", showDefault: true},
		{title: "Active COVID Patients",                  identifier: "results-active",      showDefault: true},
		{title: "Patient Transfer Flows",                 identifier: "results-transfers",   showDefault: true},
		{title: "Metrics",                                identifier: "results-metrics",     showDefault: false},
		{title: "Raw Results",                            identifier: "results-raw",         showDefault: false},
	]

	for (s of sectionInfo) {
		makeSection(s)
	}
}

function createHospitalsSelect() {
	let section = getSection("casestudy-info");

	let selectAreaTitle = document.createElement("h5");
	selectAreaTitle.className = "title is-5";
	selectAreaTitle.style.textAlign = "center";
	selectAreaTitle.style.marginBottom = "10px";
	selectAreaTitle.textContent = "Hospital Selection";
	section.appendChild(selectAreaTitle);

	let selectArea = document.createElement("div");
	selectArea.className = "hospital-select-container";
	section.appendChild(selectArea);

	$.get("/api/hospital-list", data => {
		for (h of data) {
			let s = document.createElement("label");
			s.className = "hospital-select-item";
			s.htmlFor = `hospitalselect-${h.name}`;

			let checkbox = document.createElement("input");
			checkbox.type = "checkbox";
			checkbox.id = `hospitalselect-${h.name}`;
			s.appendChild(checkbox);

			if (h.default) {
				checkbox.checked = true;
				s.classList.add("hospital-select-item-selected");
			}

			checkbox.addEventListener("change", e => {
				s.classList.toggle("hospital-select-item-selected");
			});

			let label = document.createElement("span");
			label.textContent = h.name;
			s.appendChild(label);

			if (h.current_load < 0.9) {
				s.style.backgroundColor = "#6cc777";
			} else if (h.current_load < 1.05) {
				s.style.backgroundColor = "#ffeb3b87";
			} else {
				s.style.backgroundColor = "red";
			}

			selectArea.appendChild(s);
		}
	});

	section.appendChild(document.createElement("hr"));
}

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

	addRow("Patient Type", patient_type);
	addRow("Start Date", data.start_date);
	addRow("End Date", data.end_date);

	let section = getSection("casestudy-info");
	section.appendChild(table);
}

function sendUpdateQuery() {
	if (!validateForm()) {
		return;
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
sendUpdateQuery();
