import requests

URL = "https://ontario.covid-hospital-operations.com"

regions = requests.get(f"{URL}/api/regions-list", params={"region_type": "province"}).json()
regions = [r["region_id"] for r in regions]

patient_types = ["icu"]
covid_capacity_proportions = {"icu": "0.5", "acute": "0.3", "all": "0.4"}

dates = requests.get(f"{URL}/json/dates.json").json()
start_date = "2021-03-01"
end_date = dates["data_end"]

scenario = "moderate"

default_params = {
	"region_type": "province",
	"locations": [],
	"scenario": scenario,
	"objective": "minoverflow",
	"integer": "false",
	"transferbudget": "1000",
	"utilization": "1.0",
	"dist_threshold": "1000",
	"uncertaintylevel": "default",
	"los": "default_dist",
	"start_date": start_date,
	"end_date": end_date,
	"max_locations": 150,
	"smoothness": "false",
	"verbose": "false",
}

for patient_type in patient_types:
	print("Patient type:", patient_type)
	covid_capacity_proportion = covid_capacity_proportions[patient_type]
	for region_id in regions:
		print("Region:", region_id)

		locations = requests.get(f"{URL}/api/locations-list", params={"region_type": default_params["region_type"], "region_id": region_id}).json()
		if len(locations) > default_params["max_locations"]:
			locations = sorted(locations, key=(lambda h: h["beds"]), reverse=True)
			locations_ids = [h["location_id"] for h in locations[:default_params["max_locations"]]]
			locations_list = {"locations": locations_ids}
		else:
			locations_list = {}

		params = {**default_params, **locations_list,
			"region_id": region_id,
			"patient_type": patient_type,
			"covid_capacity_proportion": covid_capacity_proportion,
		}

		region_type = default_params["region_type"]
		fn = f"../public/results-static/latest_{scenario}_{patient_type}_{region_type}_{region_id}.json"

		response = requests.post(f"{URL}/api/patients", json=params)
		with open(fn, "w") as f:
			f.write(response.text)

