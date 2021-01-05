let recentResponse = null;
const apiKey = "d8c1e45132c880c51bd4310f76b12ad9cf21d04c5ae1f1a2ccbb8c4c";

import {createLocationsMap} from "./locations_map.js";


function handleResponse(response, status, xhr) {
	console.log(response);
	recentResponse = response;
	hideProgressbar();
	generateContent(response);
}

function generateContent(response) {
	console.log("Updating...");
	clearContent();
	createLocationsMap(response);
}

function clearContent() {
}

function hideProgressbar() {
	$("#progressbar-area").hide();
}

function getData() {
	$.get(`https://api.ipdata.co/?api-key=${apiKey}`, d => {
		const loc = {lat: d.latitude, long: d.longitude};
		$.get("/api/hospital-selection", loc, handleResponse);
	});
}
getData();
