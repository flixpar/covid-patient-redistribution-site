export {
	getSection,
	createInfo,
	toTitlecase,
	dateStr,
	addDays,
	getDates,
	getMetadata,
	createSelect,
	showProgressbar,
	hideProgressbar,
	showError,
};


function getSection(sectionID) {
	sectionID = "section-" + sectionID;
	return document.getElementById(sectionID);
}

function createInfo(parentElement, content) {
	let el = document.createElement("img");
	el.src = "img/info.svg";
	el.className = "info-icon";
	el.setAttribute("data-tippy-content", content);
	if (parentElement != null) {
		parentElement.appendChild(el);
	}
	tippy(el, {delay: [null, 250]});
	return el;
}

const toTitlecase = s => s.split(" ").map(w => w[0].toUpperCase() + w.substr(1)).join(" ");

function dateStr(d) {
	return d.toISOString().slice(0, 10);
}

function addDays(d, t) {
	let date = new Date(d);
	date.setDate(d.getDate() + t);
	return date;
}

async function getDates() {
	if (getDates.dates == null) {
		const dates = await (await fetch("/json/dates.json")).json();
		getDates.dates = dates;
		return dates;
	} else {
		return getDates.dates;
	}
}

async function getMetadata() {
	if (getMetadata.meta == null) {
		const meta = await (await fetch("/json/metadata.json")).json();
		getMetadata.meta = meta;
		return meta;
	} else {
		return getMetadata.meta;
	}
}

function createSelect(optionNames, optionValues, defaultIdx, labelText, selectId) {
	let selectContainer = document.createElement("div");
	selectContainer.className = "field";

	let selectLabel = document.createElement("label");
	selectLabel.className = "label";
	selectLabel.htmlFor = selectId;
	selectLabel.textContent = labelText;
	selectLabel.style.marginBottom = "0.2rem";
	selectContainer.appendChild(selectLabel);

	let selectControl = document.createElement("div");
	selectControl.className = "control";
	selectContainer.appendChild(selectControl);

	let selectWrapper = document.createElement("div");
	selectWrapper.className = "select is-fullwidth";
	selectControl.appendChild(selectWrapper);

	let select = document.createElement("select");
	select.id = selectId;

	let options = optionNames.map((txt,i) => {
		let s = document.createElement("option");
		s.value = optionValues[i];
		s.text = txt;
		select.appendChild(s);
		return s;
	});

	if (defaultIdx != null) {
		options[defaultIdx].selected = true;
	}

	selectWrapper.appendChild(select);

	return selectContainer;
}

function showProgressbar() {
	$("#progressbar-area").show();
}

function hideProgressbar() {
	$("#progressbar-area").hide();
}

function showError() {
	$("#error-area").removeClass("is-hidden");
	$("#progressbar-area").hide();
	document.getElementById("result-area").innerHTML = "";
}
