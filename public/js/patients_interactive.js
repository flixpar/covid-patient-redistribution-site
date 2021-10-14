import * as patientsCommon from "./patients_common.js";
import * as common from "./common.js";
import {createMap} from "./map_plots.js";
import {createSurgeTimeline} from "./surgetimeline.js";
import {createOverallLoadPlot, createLoadPlots} from "./loadplots.js";
import {createTransfersSankey} from "./transfers_sankey.js";
import {createActivePlot} from "./activeplot.js";
import {createStatsSummary} from "./metrics.js";
import {setupTable, setupTableFilter} from "./tables.js";
import {setupDownloads, downloadObjectAsJSON} from "./downloads.js";
import {generateAllFigureDownloadButtons} from "./figure_downloads.js";

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

	generateAllFigureDownloadButtons();
	patientsCommon.updateText(response);

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
		patientsCommon.makeSection(s)
	}
}

function getHospitals() {
	const data = {
		region_type: $("#form-regiontype")[0].value,
		region_id: $("#form-region")[0].value,
	};
	let request = $.getJSON("/api/hospital-list", data, d => {
		hospitals_meta_list = d;
		patientsCommon.createHospitalsSelect(d, false);
	});
	return request;
}

let regionsRequest = patientsCommon.getRegions();
let getHospitalsRequest = regionsRequest.then(() => getHospitals());

document.getElementById("form-region").addEventListener("change", () => getHospitals());
document.getElementById("form-regiontype").addEventListener("change", () => {
	let req = patientsCommon.getRegions();
	req.then(() => getHospitals());
});

function sendUpdateQuery() {
	const data = patientsCommon.getParams();
	console.log("Querying server...");
	$.ajax({
		url: "/api/patients",
		type: "post",
		contentType: "application/json; charset=utf-8",
		dataType: "json",
		data: JSON.stringify(data),
		success: handleResponse,
		beforeSend: common.showProgressbar,
		error: common.showError,
	});
}

getHospitalsRequest.then(() => {
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
	"form-totaltransferbudget": "Maximum number of patients that can be transferred in total.",
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

document.getElementById("params-download-button").addEventListener("click", () => {
	const params = patientsCommon.getParams();
	const data = {params: params};
	downloadObjectAsJSON(data, "patient-redistribution-params.json");
});

function setParams(params) {
	document.getElementById("form-region").addEventListener("regionSelectUpdate", () => {
		$("#form-region")[0].value = params.region_id;
		$("#form-region")[0].dispatchEvent(new Event("change"));
	}, {once: true});
	let count = 0;
	document.getElementById("hospital-select-field").addEventListener("hospitalListUpdate", () => {
		if (count >= 2) {return;}
		count += 1;
		document.querySelectorAll(".hospitalselect-checkbox").forEach(c => {
			if (params.hospitals.indexOf(c.value) >= 0) {
				c.checked = true;
			} else {
				c.checked = false;
			}
			c.dispatchEvent(new Event("change"));
		});
	}, {once: false});

	$("#form-level")[0].value = params.alloclevel;
	$("#form-regiontype")[0].value = params.region_type;
	$("#form-scenario")[0].value = params.scenario;
	$("#form-patient-type")[0].value = params.patient_type;
	$("#form-objective")[0].value = params.objective;
	$("#form-integer")[0].value = params.integer;
	$("#form-transferbudget")[0].value = params.transferbudget;
	$("#form-totaltransferbudget")[0].value = params.totaltransferbudget;
	$("#form-utilization")[0].value = params.utilization;
	$("#form-covidcapacity")[0].value = params.covid_capacity_proportion * 100;
	$("#form-transferdistance")[0].value = params.dist_threshold / 1.61;
	$("#form-distancepenalty")[0].value = params.dist_cost;
	$("#form-uncertainty")[0].value = params.uncertaintylevel;
	$("#form-los")[0].value = params.los;
	$("#form-start-date")[0].value = params.start_date;
	$("#form-end-date")[0].value = params.end_date;

	$("#form-regiontype")[0].dispatchEvent(new Event("change"));
}

document.getElementById("uploadElem").addEventListener("change", () => {
	let fileInput = document.getElementById("uploadElem");
	let file = fileInput.files[0];

	file.text().then(text => {
		const data = JSON.parse(text);

		if (data.params != null) {
			setParams(data.params);
		}
		if (data.response != null) {
			handleResponse(data.response);
		}
	});
});
