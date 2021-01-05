const mapboxStyle = "mapbox://styles/flixpar/ckji5ze386yqx19phi3ziiyya";
mapboxgl.accessToken = "pk.eyJ1IjoiZmxpeHBhciIsImEiOiJja2kyN2l5dHIxanF0MnNrYjltZXNzbDJyIn0._W2ABd-tjVMdDqncb9ny9A";


export function createLocationsMap(response) {
	let mapContainer = document.createElement("div");
	let mapContent = document.createElement("div");

	mapContainer.className = "map-wrapper";
	mapContent.id = "map";

	mapContainer.appendChild(mapContent);
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

	map.on("load", e => {
		addMarkers(map, response);
	});

	return mapContainer;
}

async function addMarkers(map, response) {
	const hospitals_geojson = computeData(response);
	map.addSource("hospitals", {
		type: "geojson",
		data: hospitals_geojson,
	});

	const colorscale = getScoreColorscale(response);

	const markerImgElem = await getMarkerImg();

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
			<p>Score: ${pt.properties.score.toFixed(2)}</p>
		`;
		const popup = new mapboxgl.Popup({offset: 15}).setHTML(popupContent);

		let marker = new mapboxgl.Marker(el)
			.setLngLat(pt.geometry.coordinates)
			.setPopup(popup)
			.addTo(map);
	});

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

	const n = response.hospitals.length;
	for (let i = 0; i < n; i++) {
		const pt = {
			type: "feature",
			geometry: {
				type: "Point",
				coordinates: [response.locations[i].long, response.locations[i].lat],
			},
			properties: {
				name: response.hospitals[i][0],
				id: response.hospitals[i][1],
				score: response.scores[i],
			},
		};
		geojson.features.push(pt);
	}

	return geojson;
}

function getScoreColorscale(response) {
	const minScore = d3.min(response.scores);
	const maxScore = d3.max(response.scores);
	const colorscale = d3.scaleSequential(d3.interpolateRdYlGn).domain([maxScore, minScore]);
	return colorscale;
}
