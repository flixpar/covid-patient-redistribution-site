let hospitals_meta_list = null;

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

	let section = getSection("casestudy-info");
	let sectionContainer = section.parentElement;
	sectionContainer.remove();

	createStatsSummary(response);

	createMap(response, "overflow_dynamic");
	createMap(response, "load", "transfers", false);

	createActivePlot(active_patients, active_patients_nosent, capacity, config);
	createOverallLoadPlot(response);
	createLoadPlots(response);
	createTransfersSankey(response);

	setupTable(summary_data, is_wide=true, table_id="summary-table", title="Summary Statistics");
	setupTable(full_results, is_wide=true, table_id="full-table",    title="Full Results");
	setupTableFilter("full-table");

	setupDownloads(response);

	enableHowtoButtons();

	console.log("Done.");
}

function makeSections() {
	const sectionInfo = [
		{title: "Info",                         identifier: "casestudy-info",      showDefault: true},
		{title: "System Map",                   identifier: "results-overflowmap", showDefault: true, subtitle: "Where are additional COVID beds required?"},
		{title: "Patient Transfer Flows",       identifier: "results-transfers",   showDefault: true, subtitle: "Where should patients be transfered?"},
		{title: "Total COVID Occupancy",        identifier: "results-totalload",   showDefault: true},
		{title: "Hospital COIVD Occupancy",     identifier: "results-load",        showDefault: true},
		{title: "Active COVID Patients",        identifier: "results-active",      showDefault: true},
		{title: "Metrics",                      identifier: "results-metrics",     showDefault: false},
		{title: "Raw Results",                  identifier: "results-raw",         showDefault: false},
	]

	for (s of sectionInfo) {
		makeSection(s)
	}
}

function getHospitals() {
	const data = {
		region_type: $("#form-regiontype")[0].value,
		region: $("#form-region")[0].value,
	};
	let request = $.get("/api/hospital-list", data, d => {
		hospitals_meta_list = d;
		createHospitalsSelect(d, false);
	});
	return request;
}

getRegions();
let getHospitalsRequest = getHospitals();

document.getElementById("form-region").addEventListener("change", () => getHospitals());
document.getElementById("form-regiontype").addEventListener("change", () => {
	let req = getRegions();
	req.done(() => getHospitals());
});

function sendUpdateQuery() {
	if (!validateForm()) {
		return;
	}

	const selectedHospitalNames = hospitals_meta_list.map((h,i) => {
		const c = document.getElementById(`hospitalselect-${i}`).checked;
		return c ? h.name : null;
	}).filter(x => x != null);

	const data = {
		alloclevel: $("#form-level")[0].value,
		region: $("#form-region")[0].value,
		regiontype: $("#form-regiontype")[0].value,
		hospitals: selectedHospitalNames,
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

getHospitalsRequest.done(() => {
	$("#form-submit").click(sendUpdateQuery);
	sendUpdateQuery();
});

const tooltip_content = {
	"form-start-date": "Date to start the patient allocation model.",
	"form-end-date"  : "Date to end the patient allocation model.",
	"form-los"       : "Expected number of days that a patient will have to stay in the hospital.",
	"form-patient-type": "Restrict focus to patients requiring a certain level of care.",
	"form-scenario": "Forecast scenario to use.",
	"form-objective": "Primary objective for the optimization model.",
	"form-weights": "Preferences for where to transfer patients to if the system runs out of capacity.",
	"form-transferbudget": "Maximum number of patients that can be transferred from a hospital in a day.",
	"form-surgepreferences": "Preference for where to create additional capacity if it is necessary.",
	"form-utilization": "Percentage of the total capacity that can be used in practice.",
	"form-uncertainty": "Level of uncertainty in the forcast that we should plan for.",
	"form-integer": "Use the mixed-integer programming formulation or not.",
};
$("label").each((i, el) => {
	const k = el.getAttribute("for");
	if (k in tooltip_content) {
		createInfo(el, tooltip_content[k]);
	}
});
