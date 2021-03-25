import requests

regions = requests.get("https://covid-hospital-operations.com/api/regions-list", params={"region_type": "state"}).json()
regions = [r["region_id"] for r in regions]
regions = regions[:3]

patient_types = ["icu", "acute", "all"]
covid_capacity_proportions = {"icu": "0.5", "acute": "0.3", "all": "0.4"}

dates = requests.get("https://covid-hospital-operations.com/json/dates.json").json()
start_date = dates["forecast_start"]
end_date = dates["forecast_end"]

scenario = "moderate"

default_params = {
	"region_type": "state",
	"hospitals": [],
	"scenario": scenario,
	"objective": "minoverflow",
	"integer": "false",
	"transferbudget": "1000",
	"utilization": "1.0",
	"dist_threshold": "600",
	"uncertaintylevel": "default",
	"los": "default_dist",
	"start_date": start_date,
	"end_date": end_date,
	"smoothness": "false",
	"verbose": "false",
}

for patient_type in patient_types:
	print("Patient type:", patient_type)
	covid_capacity_proportion = covid_capacity_proportions[patient_type]
	for region_id in regions:
		print("Region:", region_id)
		params = {**default_params,
			"region_id": region_id,
			"patient_type": patient_type,
			"covid_capacity_proportion": covid_capacity_proportion,
		}

		fn = f"../public/results-static/latest_{scenario}_{patient_type}_state_{region_id}.json"

		response = requests.post("https://covid-hospital-operations.com/api/patients", json=params)
		with open(fn, "w") as f:
			f.write(response.text)
