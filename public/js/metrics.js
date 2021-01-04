function createSurgeCapacityMetrics(rawdata) {
	const N = rawdata.config.node_names.length;
	const T = rawdata.config.dates.length;
	const C = rawdata.capacity[0].length;
	const nDecimals = 0;

	const max_active_wtfr = d3.range(N).map(i => d3.max(rawdata.active[i]));
	const max_active_notfr = d3.range(N).map(i => d3.max(rawdata.active_null[i]));
	const max_overflows_wtfr = max_active_wtfr.map((a,i) => Math.max(0, a - rawdata.capacity[i][C-1]));
	const max_overflows_notfr = max_active_notfr.map((a,i) => Math.max(0, a - rawdata.capacity[i][C-1]));
	const max_capacitylevels_wtfr = max_active_wtfr.map((m,i) => rawdata.capacity[i].findIndex(c => c > m)).map(x => (x == -1) ? C-1 : x-1);

	let table = document.createElement("table");
	table.id = "surgemetrics-table";
	table.className = "table is-hoverable";
	table.style.marginLeft = "auto";
	table.style.marginRight = "auto";

	let tableBody = document.createElement("tbody");
	table.appendChild(tableBody);

	let rows = [];
	function addColumn(values) {
		const nVals = values.length;
		for (let i = 0; i < nVals; i++) {
			if (rows[i] == null) {
				rows[i] = document.createElement("tr");
			}

			let elem = document.createElement("td");

			const val = values[i];
			if (val != null && typeof val == "number") {
				elem.innerText = val.toFixed(nDecimals);
			} else {
				elem.innerText = val;
			}

			rows[i].appendChild(elem);
		}
	}

	addColumn(["Hospital", "Required Surge Capacity With Transfers (Beds)", "Required Surge Capacity Without Transfers (Beds)", "Maximum Required Capacity Level"]);
	for (let i = 0; i < N; i++) {
		const nodeName = rawdata.config.node_names[i];
		const maxOverflowValueWithTfr = max_overflows_wtfr[i];
		const maxOverflowValueWithoutTfr = max_overflows_notfr[i];
		const capLevel = max_capacitylevels_wtfr[i];
		const capLevelName = rawdata.config.capacity_names[capLevel];
		addColumn([nodeName, maxOverflowValueWithTfr, maxOverflowValueWithoutTfr, capLevelName]);
	}

	const maxCapLevelName = rawdata.config.capacity_names[d3.max(max_capacitylevels_wtfr)];
	addColumn(["Total", d3.sum(max_overflows_wtfr), d3.sum(max_overflows_notfr), maxCapLevelName]);

	const totalActive = d3.range(T).map(t => d3.sum(rawdata.active, a => a[t]));
	const maxActive = d3.max(totalActive);
	const totalCapacity = d3.range(C).map(c => d3.sum(rawdata.capacity, x => x[c]));
	const idealOverflow = Math.max(0, maxActive - totalCapacity[C-1]);
	const idealCapLevel = totalCapacity.findIndex(c => c > maxActive);
	const idealCapLevelIdx = (idealCapLevel == -1) ? C-1 : idealCapLevel-1;
	const idealCapLevelName = rawdata.config.capacity_names[idealCapLevelIdx];
	addColumn(["Ideal", idealOverflow, "–", idealCapLevelName]);

	for (row of rows) {
		tableBody.appendChild(row);
	}
	for (row of rows) {
		let elem = row.children[0];
		elem.style.fontWeight = "bold";
		elem.style.borderRight = "1px solid lightgray";
	}

	firstColWidth = 30;
	for (row of rows) {
		const nCols = row.children.length;
		for (let i = 0; i < nCols; i++) {
			let elem = row.children[i];
			if (i == 0) {
				elem.style.width = `${firstColWidth}%`;
			} else {
				elem.style.width = `${(100-firstColWidth)/nCols}%`;
			}
		}
	}

	const section = getSection("results-metrics");
	section.appendChild(table);
}

function createStatsSummary(rawdata, add_description=true) {
	const N = rawdata.config.node_names.length;
	const T = rawdata.config.dates.length;
	const nDecimals = 0;

	let table = document.createElement("table");
	table.id = "metrics-table";
	function addMetric(m_name, m_value) {
		let row = document.createElement("tr");
		let col1 = document.createElement("td");
		let col2 = document.createElement("td");

		col1.className = "metric-name-elem";
		col2.className = "metric-value-elem";

		col1.innerText = m_name;
		if (m_value != null && typeof m_value == "number") {
			col2.innerText = m_value.toFixed(nDecimals);
		} else {
			col2.innerText = m_value;
		}

		row.appendChild(col1);
		row.appendChild(col2);
		table.appendChild(row);
	}

	function addMetricSeparator() {
		let lastRow = table.childNodes[table.childElementCount-1];
		for (elem of lastRow.childNodes) {
			elem.style.borderBottom = "1px solid lightgray";
		}
	}

	const overflow_byloc = d3.range(N).map(i => rawdata.active[i].map(x => Math.max(0, x - rawdata.beds[i])));
	const overflow_nosent_byloc = d3.range(N).map(i => rawdata.active_null[i].map(x => Math.max(0, x - rawdata.beds[i])));

	const overflow_nosent = d3.sum(d3.merge(overflow_nosent_byloc));
	const overflow_sent = d3.sum(d3.merge(overflow_byloc));
	const overflow_reduction = (overflow_nosent - overflow_sent) / overflow_nosent;

	const maxoverflow_nosent = d3.sum(d3.range(N).map(i => d3.max(overflow_nosent_byloc[i])));
	const maxoverflow_sent = d3.sum(d3.range(N).map(i => d3.max(overflow_byloc[i])));;

	const sent_total = d3.sum(rawdata.sent, x => d3.sum(x, z => d3.sum(z)));
	const sent_pct = sent_total / rawdata.total_patients;

	addMetric("Required Surge Capacity (Without Optimal Transfers)", overflow_nosent);
	addMetric("Required Surge Capacity (With Optimal Transfers)", overflow_sent);
	addMetric("Reduction in Required Surge Capacity", (overflow_reduction * 100).toFixed(2) + "%");
	addMetricSeparator();
	addMetric("Max Required Surge Capacity (Without Optimal Transfers)", maxoverflow_nosent);
	addMetric("Max Required Surge Capacity (With Optimal Transfers)", maxoverflow_sent);
	addMetricSeparator();
	addMetric("Transferred Patients", sent_total);
	addMetric("Perecent of Patients Transferred", (sent_pct * 100).toFixed(2) + "%");

	const section = getSection("results-metrics");

	if (add_description) {
		let description = document.createElement("p");
		description.innerHTML = metricsDescription;
		section.appendChild(description);
	}

	section.appendChild(table);

	let hr = document.createElement("hr");
	section.appendChild(hr);
}
