import {getParams} from "./patients_interactive.js";
import {getSection} from "./patients_common.js";
export {setupDownloads, downloadObjectAsJSON};


function setupDownloads(rawdata) {
	const section = getSection("results-raw");

	let downloadContainer = document.createElement("div");
	section.appendChild(downloadContainer);

	let downloadTitle = document.createElement("h5");
	downloadTitle.className = "title is-5";
	downloadTitle.textContent = "Download";
	downloadContainer.appendChild(downloadTitle);

	let downloadAllButton = document.createElement("button");
	downloadAllButton.className = "button is-info";
	downloadAllButton.style.marginRight = "10px";
	downloadAllButton.textContent = "Download Raw Response";
	downloadAllButton.type = "button";
	downloadAllButton.addEventListener("click", _ => {
		console.log("download raw");
		const data = {
			id: randStr(),
			params: getParams(),
			response: rawdata,
		};
		downloadObjectAsJSON(data, "patient_alloc_raw.json");
	});
	downloadContainer.appendChild(downloadAllButton);

	let downloadTableButton = document.createElement("button");
	downloadTableButton.className = "button is-info";
	downloadTableButton.style.marginRight = "10px";
	downloadTableButton.textContent = "Download Table";
	downloadTableButton.type = "button";
	downloadTableButton.addEventListener("click", _ => {
		console.log("download table");
		downloadTableAsCSV(rawdata.full_results, "patient_alloc_table.csv");
	});
	downloadContainer.appendChild(downloadTableButton);

	let downloadSummaryButton = document.createElement("button");
	downloadSummaryButton.className = "button is-info";
	downloadSummaryButton.style.marginRight = "10px";
	downloadSummaryButton.textContent = "Download Summary Table";
	downloadSummaryButton.type = "button";
	downloadSummaryButton.addEventListener("click", _ => {
		console.log("download summary table");
		downloadTableAsCSV(rawdata.summary, "patient_alloc_summary.csv");
	});
	downloadContainer.appendChild(downloadSummaryButton);

	let hr = document.createElement("hr");
	section.appendChild(hr);
}

function downloadObjectAsJSON(exportObj, fn) {
	const data = JSON.stringify(exportObj, null, 4);
	const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(data);
	let downloadAnchorNode = document.createElement("a");
	downloadAnchorNode.setAttribute("href",     dataStr);
	downloadAnchorNode.setAttribute("download", fn);
	document.body.appendChild(downloadAnchorNode);
	downloadAnchorNode.click();
	downloadAnchorNode.remove();
}

function downloadTableAsCSV(table, fn) {
	const cols = Object.keys(table);
	const nrows = table[cols[0]].length;
	const data = d3.range(nrows).map(i => {
		let row = {};
		for (col of cols) {
			row[col] = table[col][i];
		}
		return row;
	});

	const csvData = d3.csvFormat(data);
	const dataStr = "data:text/csv;charset=utf-8," + encodeURIComponent(csvData);
	let downloadAnchorNode = document.createElement("a");
	downloadAnchorNode.setAttribute("href",     dataStr);
	downloadAnchorNode.setAttribute("download", fn);
	document.body.appendChild(downloadAnchorNode);
	downloadAnchorNode.click();
	downloadAnchorNode.remove();
}

function randStr() {
	return Math.random().toString(36).substr(2, 5);
}
