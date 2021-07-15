import requests

URL = "https://covid-hospital-operations.com"

regions = requests.get(f"{URL}/api/regions-list", params={"region_type": "state"}).json()
regions = [r["region_id"] for r in regions]

patient_types = ["icu", "acute", "all"]
covid_capacity_proportions = {"icu": "0.5", "acute": "0.3", "all": "0.4"}

dates = requests.get(f"{URL}/json/dates.json").json()
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
	"dist_cost": "0.05",
	"uncertaintylevel": "default",
	"los": "regional_dist",
	"start_date": start_date,
	"end_date": end_date,
	"max_hospitals": 150,
	"smoothness": "false",
	"verbose": "false",
}

for patient_type in patient_types:
	print("Patient type:", patient_type)
	covid_capacity_proportion = covid_capacity_proportions[patient_type]
	for region_id in regions:
		print("Region:", region_id)

		hospitals = requests.get(f"{URL}/api/hospital-list", params={"region_type": default_params["region_type"], "region_id": region_id}).json()
		if len(hospitals) > default_params["max_hospitals"]:
			hospitals = sorted(hospitals, key=(lambda h: h["total_beds"]), reverse=True)
			hospital_ids = [h["hospital_id"] for h in hospitals[:default_params["max_hospitals"]]]
			hospitals_list = {"hospitals": hospital_ids}
		else:
			hospitals_list = {}

		params = {**default_params, **hospitals_list,
			"region_id": region_id,
			"patient_type": patient_type,
			"covid_capacity_proportion": covid_capacity_proportion,
		}

		fn = f"../public/results-static/latest_{scenario}_{patient_type}_state_{region_id}.json"

		response = requests.post(f"{URL}/api/patients", json=params)
		with open(fn, "w") as f:
			f.write(response.text)

