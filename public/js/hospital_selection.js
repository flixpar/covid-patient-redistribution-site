let recentResponse = null;
const ipstackAPIKey = "5b8931a3a0e596a8a1bf3a1a2a531cfe";


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
	$.get(`http://api.ipstack.com/check?access_key=${ipstackAPIKey}`, d => {
		const loc = {lat: d.latitude, long: d.longitude};
		$.get("/api/hospital-selection", loc, handleResponse);
	});
}
getData();
