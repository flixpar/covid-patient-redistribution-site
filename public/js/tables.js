toTitlecase = s => s.split(' ').map(w => w[0].toUpperCase() + w.substr(1)).join(' ');

function setupTable(table_data, is_wide=false, table_id=null, title=null, replace=false) {

	const cols = Object.keys(table_data);
	const colNames = cols.map(c => toTitlecase(c.replace(/_/g, " ")));

	let table = document.createElement("table");
	table.id = table_id;
	table.className = "table is-hoverable is-fullwidth";

	let tablehead = document.createElement("thead");
	let tablebody = document.createElement("tbody");

	tablebody.className = "is-family-monospace";

	let header = document.createElement("tr");
	colNames.forEach(colname => {
		let el = document.createElement("th");
		el.innerHTML = colname;
		header.appendChild(el);
	});
	tablehead.appendChild(header);

	const nrows = table_data[cols[0]].length;
	for (let i = 0; i < nrows; i++) {
		let row = document.createElement("tr");
		for (colName of cols) {
			const val = table_data[colName][i];
			let el = document.createElement("td");
			if (typeof val == "string") {
				el.innerHTML = val;
			} else if (val == null) {
				console.log(i, colName, "NULL!!");
				el.innerHTML = "NaN";
			} else {
				el.innerHTML = val.toFixed(3);
			}
			row.appendChild(el);
		}
		tablebody.appendChild(row);
	}

	table.appendChild(tablehead);
	table.appendChild(tablebody);

	const section = getSection("results-raw");

	if (!replace) {
		if (is_wide) {
			let _table = table;
			table = document.createElement("div");
			table.className = "table-container";
			table.appendChild(_table);
		}
	
		if (title != null) {
			let titleElement = document.createElement("h5");
			titleElement.className = "title is-5";
			titleElement.innerHTML = title;
			section.appendChild(titleElement);
		}

		section.appendChild(table);

		let hr = document.createElement("hr");
		section.appendChild(hr);
	} else {
		let prevTable = document.getElementById(table_id);
		prevTable.replaceWith(table);
	}

	addColumnTooltips(table_id);

	return table;
}

function setupTableFilter(table_id) {
	let form = document.createElement("div");
	let filterByLabel = document.createElement("label");
	let filterBySelect = document.createElement("select");
	let filterButton = document.createElement("button");

	let op1 = document.createElement("option");
	let op2 = document.createElement("option");
	let op3 = document.createElement("option");
	op1.text = "None";
	op1.value = "none";
	op2.text = "Location";
	op2.value = "location";
	op3.text = "Date";
	op3.value = "date";
	op1.selected = true;
	filterBySelect.appendChild(op1);
	filterBySelect.appendChild(op2);
	filterBySelect.appendChild(op3);
	filterBySelect.id = "filter-by-select";

	filterBySelect.addEventListener("change", updateFilterBy);

	let filterBySelectWrapper = document.createElement("span");
	filterBySelectWrapper.className = "select is-fullwidth";
	filterBySelectWrapper.appendChild(filterBySelect);

	filterByLabel.innerHTML = "Filter by:";
	filterByLabel.htmlFor = "filter-by-select";
	filterByLabel.className = "label";

	filterButton.innerHTML = "Filter";
	filterButton.type = "button";
	filterButton.className = "button is-info is-fullwidth";
	filterButton.id = "filter-button";

	filterButton.addEventListener("click", filterFullTable);

	let filterByField = wrapField(filterByLabel, filterBySelectWrapper, 3);
	let filterButtonField = wrapField(filterButton, null, 3);

	filterByField.id = "filter-by-field";
	filterButtonField.id = "filter-button-field";
	filterButtonField.style = "display: flex; flex-direction: column; justify-content: flex-end;";

	form.appendChild(filterByField);
	form.appendChild(filterButtonField);
	form.className = "field is-horizontal";

	const table = document.getElementById(table_id);
	table.parentElement.insertBefore(form, table);
}

function updateFilterBy() {
	let temp = document.getElementById("filter-value-field");
	if (temp !== null) {
		temp.remove();
	}

	const filterby = document.getElementById("filter-by-select").value;
	if (filterby === "none") return;

	let filterValueSelect = document.createElement("select");
	let filterValueLabel = document.createElement("label");

	filterValueSelect.id = "filter-value-select";

	filterValueLabel.innerHTML = "Value:";
	filterValueLabel.htmlFor = "filter-value-select";
	filterValueLabel.className = "label";

	let filterValueSelectWrapper = document.createElement("span");
	filterValueSelectWrapper.className = "select is-fullwidth";
	filterValueSelectWrapper.appendChild(filterValueSelect);

	let filterValueField = wrapField(filterValueLabel, filterValueSelectWrapper, 3);
	filterValueField.id = "filter-value-field";

	let filterByField = document.getElementById("filter-by-field");
	filterByField.parentElement.insertBefore(filterValueField, filterByField.nextSibling);

	if (filterby === "location") {
		let options = recentResponse.config.node_names;
		createOptions(options, filterValueSelect);
	} else if (filterby === "date") {
		let allDates = recentResponse.full_results.columns[1];
		let uniqueDates = allDates.filter(function(item, pos){
			return allDates.indexOf(item) == pos; 
		});
		let options = uniqueDates.sort();
		createOptions(options, filterValueSelect);
	}
}

function wrapField(firstField, secondField=null, fieldWidth=null) {
	let fieldContainer = document.createElement("div");
	fieldContainer.className = "field";
	fieldContainer.appendChild(firstField);
	if (secondField !== null) {
		fieldContainer.appendChild(secondField);
	}
	if (fieldWidth !== null) {
		fieldContainer.classList.add("column", "is-"+fieldWidth);
	}
	return fieldContainer;
}

function createOptions(opts, select) {
	for (let i in opts) {
		let option = document.createElement("option");
		option.text = opts[i];
		option.value = opts[i];
		select.appendChild(option);
	}
}

function filterFullTable() {
	const filterby = document.getElementById("filter-by-select").value;
	if (filterby === "none") {
		setupTable(recentResponse.full_results, is_wide=true, table_id="full-table", title="Full Results", replace=true);
		return;
	};

	let tableData = JSON.parse(JSON.stringify(recentResponse.full_results));
	let colIdx = -1;
	if (filterby === "location") {
		colIdx = tableData.colindex.lookup.location - 1;
	} else {
		colIdx = tableData.colindex.lookup.day - 1;
	}

	const filterValue = document.getElementById("filter-value-select").value;

	let values = tableData.columns[colIdx];
	console.log(values);
	let filterInd = [];
	for (let i = 0; i < values.length; i++) {
		if (values[i] == filterValue) {
			filterInd.push(i);
		}
	}

	for (const i in tableData.columns) {
		tableData.columns[i] = tableData.columns[i].filter((_,j) => filterInd.indexOf(j) >= 0);
	}

	setupTable(tableData, is_wide=true, table_id="full-table", title="Full Results", replace=true);
}

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
		downloadObjectAsJSON(rawdata, "patient_alloc_raw.json");
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
		console.log("download table");
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

const column_descriptions = {
	"Total Sent": "Total number of patients that should be sent to another state according to our model.",
	"Total Received": "Total number of patients that would be received from another state under our model.",
	"Overflow": "Number of patient-days where a patient does not have a hospital bed available to them.",
	"Capacity": "Number of hospital beds in the state.",
	"New Patients": "Forecasted number of people who need to be admitted to the hospital on a given day in a given state.",
	"Sent": "Number of patients that should be sent to another state on a given day according to our model.",
	"Received": "Number of patients that would be received from another state on a given day under our model.",
	"Active Patients": "Expected number of patients in a given state on a given day after re-distribution.",
	"Average Load" : "Percentage of beds dedicated to COVID patients that are filled, on average.",
	"Load" : "Percentage of beds dedicated to COVID patients that are filled.",
	"Date": "Date in YYYY-MM-DD format.",
};
function addColumnTooltips(tableId) {
	$("#" + tableId + " th").each((i, el) => {
		const k = el.innerText;
		if (k in column_descriptions) {
			createInfo(el, column_descriptions[k]);
		}
	});
}
