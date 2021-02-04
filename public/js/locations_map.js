const mapboxStyle = "mapbox://styles/flixpar/ckji5ze386yqx19phi3ziiyya";
mapboxgl.accessToken = "pk.eyJ1IjoiZmxpeHBhciIsImEiOiJja2kyN2l5dHIxanF0MnNrYjltZXNzbDJyIn0._W2ABd-tjVMdDqncb9ny9A";

import {populateLocationsTable} from "./hospital_selection.js";


export function createLocationsMap(response) {

	const pos = response.current_location;
	let map = new mapboxgl.Map({
		container: "map",
		style: mapboxStyle,
		center: [pos.long, pos.lat],
		zoom: 9,
		pitch: 0,
		antialias: false,
	});

	map.addControl(
		new mapboxgl.NavigationControl({showCompass: false}),
		"top-left"
	);

	let geocoder = new MapboxGeocoder({
		accessToken: mapboxgl.accessToken,
		mapboxgl: mapboxgl,
		countries: "us",
		types: "region,postcode,district,place,address",
		marker: false,
		placeholder: "Search for a location",
	});
	document.getElementById("geocoder").appendChild(geocoder.onAdd(map));
	document.querySelector("#geocoder input").classList.add("input");

	geocoder.on("result", e => {
		const loc = {lat: e.result.center[1], long: e.result.center[0]};
		$.get("/api/hospital-selection", loc, g => {
			map.getContainer().dispatchEvent(new Event("clearMarkers"));
			addMarkers(map, g);
			populateLocationsTable(g);
		});
	});

	return map;
}

export async function addMarkers(map, response) {

	let locMarker = addLocMarker(map, response.current_location);

	const colorscale = getScoreColorscale(response);

	const markerImgElem = await getMarkerImg();

	let markers = response.data.map(h => {
		let el = document.createElement("div");
		el.id = "marker-" + h.hospital_id;
		el.className = "marker";

		let im = markerImgElem.cloneNode(true);
		const c = colorscale(h.score);
		im.querySelector("path").setAttribute("fill", c);
		im.querySelector("path").setAttribute("stroke", "black");
		im.querySelector("path").setAttribute("stroke-width", "20px");
		el.appendChild(im);

		const popupContent = `
			<h3>${h.hospital}</h3>
			<p>Score: ${(h.score*100).toFixed(0)}/100</p>
			<p>Occupancy: ${(h.total_load*100).toFixed(0)}%</p>
		`;
		const popup = new mapboxgl.Popup({offset: 15, focusAfterOpen: false}).setHTML(popupContent);

		let marker = new mapboxgl.Marker(el)
			.setLngLat([h.long, h.lat])
			.setPopup(popup)
			.addTo(map);
		return marker;
	});

	markers.push(locMarker);
	response.data.push(response.current_location);

	let openMarker = null;

	map.on("mousemove", e => {
		if (markers == null) {return;}

		let mousePoint = e.point;

		const points = response.data.map(h => map.project([h.long, h.lat]));
		const distances = points.map(p => l2distance(mousePoint, p));
		const minIdx = d3.minIndex(distances);
		const marker = markers[minIdx];
		const dist = distances[minIdx];

		if (openMarker != null && openMarker != marker) {
			openMarker.togglePopup();
			openMarker = null;
		}

		const popup = marker.getPopup();
		if (dist < 40) {
			if (!popup.isOpen()) {
				marker.togglePopup();
				openMarker = marker;
			}
		} else {
			if (popup.isOpen()) {
				marker.togglePopup();
				openMarker = null;
			}
		}
	});

	map.getContainer().addEventListener("clearMarkers", () => {
		if (markers == null) {return;}
		markers.forEach(m => m.remove());
		markers = null;
	});

}

function addLocMarker(map, loc) {
	let el = document.createElement("div");
	el.id = "marker-currentloc";
	el.className = "loc-marker";

	let svg = d3.create("svg").attr("viewBox", [0, 0, 20, 20]);
	svg.append("circle")
		.attr("cx", 10)
		.attr("cy", 10)
		.attr("r", 10)
		.attr("stroke", "white")
		.attr("stroke-width", 2)
		.attr("fill", "blue");
	el.appendChild(svg.node());

	const popupContent = `<h3>Current Location</h3>`;
	const popup = new mapboxgl.Popup({offset: 15, focusAfterOpen: false}).setHTML(popupContent);

	let marker = new mapboxgl.Marker(el)
		.setLngLat([loc.long, loc.lat])
		.setPopup(popup)
		.addTo(map);

	return marker;
}

function l2distance(loc1, loc2) {
	return Math.sqrt((loc1.x - loc2.x)**2 + (loc1.y - loc2.y)**2);
}

function haversine_distance(loc1, loc2) {
	const R = 6371e3;

	const phi1 = loc1.lat * (Math.PI/180);
	const phi2 = loc2.lat * (Math.PI/180);
	const deltaPhi = (loc2.lat-loc1.lat) * (Math.PI/180);
	const deltaLambda = (loc2.long-loc1.long) * (Math.PI/180);

	const a = (Math.sin(deltaPhi/2) * Math.sin(deltaPhi/2)) + (Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda/2) * Math.sin(deltaLambda/2));
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

	const dist = R * c / 1000;
	return dist;
}

async function getMarkerImg() {
	const markerImgContent = await (await fetch("/img/map-marker-solid.svg")).text();
	let elem = document.createElement("span");
	elem.innerHTML = markerImgContent;
	return elem.children[0];
}

function computeData(response) {
	let geojson = {
		type: "FeatureCollection",
		features: [],
	};

	for (const h of response.data) {
		const pt = {
			type: "feature",
			geometry: {
				type: "Point",
				coordinates: [h.long, h.lat],
			},
			properties: {
				name: h.hospital,
				id: h.hospital_id,
				score: h.score,
				distance: h.distance,
				occupancy: h.total_load,
			},
		};
		geojson.features.push(pt);
	}

	return geojson;
}

function getScoreColorscale(response) {
	const scores = response.data.map(h => h.score);
	const minScore = d3.min(scores);
	const maxScore = d3.max(scores);
	const colorscale = d3.scaleSequential(d3.interpolateRdYlGn).domain([minScore, maxScore]);
	return colorscale;
}
