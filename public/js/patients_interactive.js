import * as common from "./patients_common.js";
import {createMap} from "./map_plots.js";
import {createSurgeTimeline} from "./surgetimeline.js";
import {createOverallLoadPlot, createLoadPlots} from "./loadplots.js";
import {createTransfersSankey} from "./transfers_sankey.js";
import {createActivePlot} from "./activeplot.js";
import {createStatsSummary} from "./metrics.js";
import {setupTable, setupTableFilter, setupDownloads} from "./tables.js";

let hospitals_meta_list = null;
let recentResponse = null;


function handleResponse(response, status, xhr) {
	console.log("Updating...");
	common.hideProgressbar();
	document.getElementById("result-area").innerHTML = "";
	recentResponse = response;

	makeSections();

	let section = common.getSection("casestudy-info");
	let sectionContainer = section.parentElement;
	sectionContainer.remove();

	createStatsSummary(response);

	createMap(response, "load", "transfers");

	createActivePlot(response.active, response.active_null, response.capacity, response.config);
	createOverallLoadPlot(response);
	createLoadPlots(response);
	createTransfersSankey(response);
	createSurgeTimeline(response);

	setupTable(response.summary, true, "summary-table", "Summary Statistics");
	setupTable(response.full_results, true, "full-table", "Full Results");
	setupTableFilter("full-table");

	setupDownloads(response);

	common.generateAllFigureDownloadButtons();
	common.updateText(response);

	console.log("Done.");
}

function makeSections() {
	const sectionInfo = [
		{title: "Info",                         identifier: "casestudy-info",      showDefault: true},
		{title: "Occupancy and Surge Capacity Map", identifier: "results-maps",    showDefault: true, subtitle: "Where are additional COVID beds required?"},
		{title: "Patient Transfer Flows",       identifier: "results-transfers",   showDefault: true, subtitle: "Where should patients be transferred?"},
		{title: "Capacity Timeline",            identifier: "results-surgetimeline", showDefault: true, subtitle: "When is additional capacity needed?"},
		{title: "Metrics",                      identifier: "results-metrics",     showDefault: true},
		{title: "Total COVID Occupancy",        identifier: "results-totalload",   showDefault: true},
		{title: "Hospital COIVD Occupancy",     identifier: "results-load",        showDefault: true},
		{title: "Active COVID Patients",        identifier: "results-active",      showDefault: true},
		{title: "Raw Results",                  identifier: "results-raw",         showDefault: false},
	]

	for (const s of sectionInfo) {
		common.makeSection(s)
	}
}

function getHospitals() {
	const data = {
		region_type: $("#form-regiontype")[0].value,
		region_id: $("#form-region")[0].value,
	};
	let request = $.getJSON("/api/hospital-list", data, d => {
		hospitals_meta_list = d;
		common.createHospitalsSelect(d, false);
	});
	return request;
}

common.getRegions();
let getHospitalsRequest = getHospitals();

document.getElementById("form-region").addEventListener("change", () => getHospitals());
document.getElementById("form-regiontype").addEventListener("change", () => {
	let req = common.getRegions();
	req.done(() => getHospitals());
});

function sendUpdateQuery() {
	if (!common.validateForm()) {
		return;
	}

	const selectedHospitalIds = Array.from(document.querySelectorAll(".hospitalselect-checkbox"))
		.map(c => c.checked ? c.value : null)
		.filter(x => x != null);
	const use_smoothness = selectedHospitalIds < 32;

	const data = {
		alloclevel: $("#form-level")[0].value,
		region_type: $("#form-regiontype")[0].value,
		region_id: $("#form-region")[0].value,
		hospitals: selectedHospitalIds,
		scenario: $("#form-scenario")[0].value,
		patient_type: $("#form-patient-type")[0].value,
		objective: $("#form-objective")[0].value,
		integer: $("#form-integer")[0].value,
		transferbudget: $("#form-transferbudget")[0].value,
		utilization: $("#form-utilization")[0].value,
		covid_capacity_proportion: ($("#form-covidcapacity")[0].value / 100).toString(),
		dist_threshold: ($("#form-transferdistance")[0].value * 1.61).toString(),
		dist_cost: $("#form-distancepenalty")[0].value,
		uncertaintylevel: $("#form-uncertainty")[0].value,
		los: $("#form-los")[0].value,
		smoothness: use_smoothness,
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
		beforeSend: common.showProgressbar,
		error: common.ajaxErrorHandler,
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
	"form-covidcapacity": "The percent of total capacity that a hospital can devote to COVID patients.",
	"form-transferdistance": "The maximum distance that a patient can be transferred.",
};
$("label").each((i, el) => {
	const k = el.getAttribute("for");
	if (k in tooltip_content) {
		common.createInfo(el, tooltip_content[k]);
	}
});
