using Downloads
using JSON
using Dates


function download_rawdata()

	Downloads.download("https://flattening-the-curve-backend.apps.hmf.q7z3.p1.openshiftapps.com/api/times", "../rawdata/latest_dates.json")
	dates = JSON.parsefile("../rawdata/latest_dates.json")
	update_date_str = dates["critical_care_pct"][1] * " 2021"
	update_date = Date(update_date_str, "U dd yyyy")

	if isdir("../rawdata/$(update_date)/")
		return false
	end

	base_url = "https://flattening-the-curve-backend.apps.hmf.q7z3.p1.openshiftapps.com/api/summary"
	query_url(x) = "$(base_url)?HR_UID=$(x)"

	Downloads.download(query_url(-1), "../rawdata/latest_summary.json")

	meta = JSON.parsefile("../rawdata/latest_summary.json")
	location_ids = [m["HR_UID"] for m in meta]
	location_ids = sort(unique(filter(x -> x > 0, location_ids)))

	mkdir("../rawdata/$(update_date)/")
	for location_id in location_ids
		Downloads.download(query_url(location_id), "../rawdata/$(update_date)/$(location_id).json")
	end

	return true
end
