export const transfersSankeyDescription = (response) => `
For the public health units (PHU) you selected to display, the ribbons show the total number of patients that should be moved between locations (from the left-hand side to the right-hand side locations) from ${response.config.start_date} to ${response.config.end_date}."Other Locations" refers to PHUs that were not selected for display.
`;

export const activeplotDescription = `
The following figures illustrate the number of hospitalized COVID patients (per day) for each selected location. The blue curve shows the forecasted number of patients (without any transfers) and the green shows this number assuming optimal transfers are made. The horizontal line shows the reported capacity for each facility. Note that locations that are over capacity (blue curve above the capacity line) can expect that the load will be lightened with optimal transfers as patients are transferred out. Locations that are within capacity (blue curve under the capacity line) will receive additional patients and the green curve will be closer (but still under) the capacity line. The goal is to distribute the load within the system instead of having some healthcare facilities be overwhelmed with patients while others have excess capacity that can be used.
`;

export const overallloadplotDescription = (response) => {

	const regionTypeLookup = {state: "state", hospital_system: "hospital system", hrr: "hospital referral region (HRR)", hsa: "hospital service area (HSA)", province: "province"};
	const regionType = regionTypeLookup[response.config.region.region_type];
	const regionName = response.config.region.region_name;

	let startDate = response.config.start_date;
	let endDate = response.config.end_date;

	const bedtype = (response.config.params.bedtype == "icu") ? "ICU" : response.config.params.bedtype;

	const T = response.config.dates.length;
	const maxTotalActive = d3.max(d3.range(T).map(t => d3.sum(response.active_null, x => x[t])));
	const totalCapacity = d3.sum(response.beds);
	const systemOverflow = maxTotalActive - totalCapacity;

	let overflowStr = "";
	let dynamicSentence = "";

	if (systemOverflow > 0) {
		overflowStr = "over capacity";
		dynamicSentence = `While using optimal transfers may help some locations, the ${regionType} needs to add at least ${systemOverflow.toFixed(0)} more ${bedtype} beds during this time.`;
	} else {
		overflowStr = "within capacity";
		dynamicSentence = `Utilizing optimal patient transfers will reduce the number of over-capacity locations by moving patients to locations with available beds.`;
	}	

	const text = `
		The COVID-19 ${bedtype} demand in ${regionName} is ${overflowStr} during this time period. ${dynamicSentence}
		<br><br>
		<b>Insights:</b> This figure considers the combined capacity of the ${regionType}. If the blue curve is in the green region, the ${regionType} has enough beds to meet patient demands. In this case, using optimal patient transfers can greatly help locations that are currently over-capacity. When the curve enters the red region, then just transferring patients will not be enough. Additional beds need to be added to the current capacity to be able to meet the demand.
	`;
	return text;
}

export const loadplotsDescription = (response) => `
The occupancy forecast for each selected location from ${response.config.start_date} to ${response.config.end_date}. The left figure displays the occupancy assuming that patients are not transferred, and the right figure displays occupancy assuming that optimal patient transfers are utilized.
<br><br>
<b>Insights for individual locations:</b> If a location enters the red region, there will be a COVID bed shortage at that location. The shortage can be mitigated by either adding more COVID-19 beds (left figure) or optimally transferring patients to other locations that have extra capacity (right figure).
<br><br>
${generateHiddenText("When the occupancy of a location enters the green region, the occupancy level of that location is within the capacity of that location.")}
`;

export const metricsDescription = ``;

export const surgeTimelineDescription = (response) => `
This timeline shows the ${response.config.params.bedtype == "icu" ? "ICU" : response.config.params.bedtype} capacity levels for the selected locations. You can toggle between using optimal transfers and no transfers from the menu below to see the difference in results. Locations shown in red are over-capacity and require additional beds to meet their patients' needs.
`;

export function generateHiddenText(text) {
	const descriptionId = "description-hidden-" + Math.random().toString(36).substr(2, 5);;
	const contentStr = `
	<span class="description-hidden-label" data-for="${descriptionId}">
		<i>How to read this figure</i>
		<ion-icon class="icon-expand-text" name="caret-forward-outline"></ion-icon>
		<ion-icon class="icon-expand-text is-hidden" name="caret-down-outline"></ion-icon>
	</span>
	<br>
	<span id="${descriptionId}" class="description-hidden-text is-hidden">${text}</span>
	`;
	return contentStr;
}

export function enableHiddenTextButtons() {
	document.querySelectorAll(".description-hidden-label").forEach(elem => {
		// document.getElementById(elem.dataset.for).classList.add("is-hidden");
		elem.addEventListener("click", e => {
			document.getElementById(elem.dataset.for).classList.toggle("is-hidden");
			elem.querySelectorAll(".icon-expand-text").forEach(i => {
				i.classList.toggle("is-hidden");
			});
		});
	});
}
