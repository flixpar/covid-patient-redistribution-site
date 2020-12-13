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
	createHospitalsSelect();

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
			let s = document.createElement("span");
			s.className = "hospital-select-item";

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

			let label = document.createElement("label");
			label.textContent = h.name;
			label.htmlFor = `hospitalselect-${h.name}`;
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
