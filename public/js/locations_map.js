const mapboxStyle = "mapbox://styles/flixpar/ckji5ze386yqx19phi3ziiyya";
mapboxgl.accessToken = "pk.eyJ1IjoiZmxpeHBhciIsImEiOiJja2kyN2l5dHIxanF0MnNrYjltZXNzbDJyIn0._W2ABd-tjVMdDqncb9ny9A";

import {populateLocationsTable} from "./hospital_selection.js";

export function createLocationsMap(response) {
	let mapContainer = document.createElement("div");
	let mapContent = document.createElement("div");
	let geocoderElem = document.createElement("div");

	mapContainer.className = "map-wrapper";
	mapContent.id = "map";
	geocoderElem.id = "geocoder";
	geocoderElem.className = "geocoder";

	mapContainer.appendChild(mapContent);
	mapContainer.appendChild(geocoderElem);
	document.getElementById("result-area").appendChild(mapContainer);

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
		marker: true,
	});
	document.getElementById("geocoder").appendChild(geocoder.onAdd(map));

	geocoder.on("result", e => {
		const loc = {lat: e.result.center[1], long: e.result.center[0]};
		$.get("/api/hospital-selection", loc, g => {
			addMarkers(map, g);
			populateLocationsTable(g);
		});
	});

	return map;
}

export async function addMarkers(map, response) {
	const randomID = Math.random().toString(36).substring(7);

	const hospitals_geojson = computeData(response);
	map.addSource(`hospitals-${randomID}`, {
		type: "geojson",
		data: hospitals_geojson,
	});

	const colorscale = getScoreColorscale(response);

	const markerImgElem = await getMarkerImg();

	let markers = [];
	hospitals_geojson.features.forEach(pt => {
		let el = document.createElement("div");
		el.id = "marker-" + pt.properties.id;
		el.className = "marker";

		let im = markerImgElem.cloneNode(true);
		const c = colorscale(pt.properties.score);
		im.querySelector("path").setAttribute("fill", c);
		im.querySelector("path").setAttribute("stroke", "black");
		im.querySelector("path").setAttribute("stroke-width", "20px");
		el.appendChild(im);

		const popupContent = `
			<h3>${pt.properties.name}</h3>
			<p>Score: ${(pt.properties.score*100).toFixed(0)}/100</p>
			<p>Occupancy: ${(pt.properties.occupancy*100).toFixed(0)}%</p>
		`;
		const popup = new mapboxgl.Popup({offset: 15, focusAfterOpen: false}).setHTML(popupContent);

		let marker = new mapboxgl.Marker(el)
			.setLngLat(pt.geometry.coordinates)
			.setPopup(popup)
			.addTo(map);
		markers.push(marker);
	});

	const mapBBox = map._canvas.getBoundingClientRect();
	let openMarker = null;

	map.on("mousemove", e => {
		let pt = e.lngLat.wrap();
		pt.long = pt.lng;

		const distances = response.locations.map(l => haversine_distance(pt, l));
		const minIdx = d3.minIndex(distances);
		const marker = markers[minIdx];

		const mouseXY = e.point;
		const markerBBox = marker.getElement().getBoundingClientRect();
		const dist = Math.sqrt((mouseXY.x - markerBBox.x + mapBBox.x)**2 + (mouseXY.y - markerBBox.y + mapBBox.y)**2);

		if (openMarker != marker && openMarker != null) {
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
