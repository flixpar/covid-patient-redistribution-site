console.log("Starting!");

let container = document.getElementById("result-area");
let recentResponse = null;


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
	sectionID = "section-" + sectionID;
	return document.getElementById(sectionID);
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
	"form-transferbudget": "Maximum number of patients that can be transferred from a hospital in a day.",
	"form-surgepreferences": "Preference for where to create additional capacity if it is necessary.",
	"form-utilization": "Percentage of the total capacity that can be used in practice.",
	"form-uncertainty": "Level of uncertainty in the forcast that we should plan for.",
	"form-integer": "Use the mixed-integer programming formulation or not.",
};
$("#form label").each((i, el) => {
	const k = el.getAttribute("for");
	if (k in tooltip_content) {
		createInfo(el, tooltip_content[k]);
	}
});
