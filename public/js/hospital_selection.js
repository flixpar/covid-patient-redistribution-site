let recentResponse = null;
const apiKey = "d8c1e45132c880c51bd4310f76b12ad9cf21d04c5ae1f1a2ccbb8c4c";

import {createLocationsMap, addMarkers} from "./locations_map.js";


function handleResponse(response, status, xhr) {
	console.log(response);
	recentResponse = response;
	generateContent(response);
}

function generateContent(response) {
	console.log("Updating...");
	let map = createLocationsMap(response);
	map.on("load", () => {
		map.resize();
		addMarkers(map, response);
	});
	populateLocationsTable(response);
}

export function populateLocationsTable(response) {
	if (document.getElementById("locations-table") != null) {
		document.getElementById("locations-table").remove();
	}

	let section = document.getElementById("table-area");

	let table = document.createElement("table");
	let tableHeader = document.createElement("thead");
	let tableBody = document.createElement("tbody");

	table.id = "locations-table";
	table.className = "table is-hoverable";
	table.appendChild(tableHeader);
	table.appendChild(tableBody);

	function addRow(rowData, header=false) {
		let row = document.createElement("tr");

		if (header) {
			tableHeader.appendChild(row);
		} else {
			tableBody.appendChild(row);
		}

		rowData.forEach(text => {
			let entry = document.createElement(header ? "th" : "td");
			row.appendChild(entry);
			entry.textContent = text;
		});
	}

	addRow(["Hospital", "Score", "Current Occupancy"], true);

	const hospitals_data = response.data.sort((a,b) => a.score > b.score ? -1 : 1);
	for (const h of hospitals_data) {
		addRow([
			h.hospital,
			(h.score * 100).toFixed(0) + "/100",
			(h.total_load * 100).toFixed(0) + "%",
		]);
	}

	section.appendChild(table);
}

function fillMissingText() {
	for (let elem of document.querySelectorAll(".fill-value")) {
		const contentid = elem.dataset.contentid;
		if (contentid == "hhsdata_update_date") {
			fetch("/json/dates.json").then(r => r.json()).then(dates => {
				elem.textContent = dates.hhsdata_update;
			});
		}
	}
}
fillMissingText();

function getData() {
	$.ajax({
		url: `https://api.ipdata.co/?api-key=${apiKey}`,
		success: (d) => {
			const loc = {lat: d.latitude, long: d.longitude};
			$.get("/api/hospital-selection", loc, handleResponse);
		},
		error: () => {
			const loc = {lat: 39.3299013, long: -76.6205177};
			$.get("/api/hospital-selection", loc, handleResponse);
		}
	});
}
getData();
