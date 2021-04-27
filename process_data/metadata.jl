using CSV
using JSON
using Serialization
using DataFrames

include("util.jl")


###########################
#### Extract Metadata #####
###########################

function extract_metadata()
	summary = JSON.parsefile("../rawdata/latest_summary.json")
	summary = [(location_name = row["phu"], location_id = row["HR_UID"]) for row in summary]
	filter!(r -> r.location_id > 3500, summary)

	meta = DataFrame(summary)
	sort!(meta, [:location_id])

	locations_data = JSON.parsefile("../public/json/region_centroids.json")
	meta.lat = map(r -> locations_data[string(r)]["lat"], meta.location_id)
	meta.long = map(r -> locations_data[string(r)]["long"], meta.location_id)

	meta |> CSV.write("../data/metadata.csv")

	return
end

function extract_dates_metadata()
	rawdata = DataFrame(CSV.File("../data/rawdata.csv"))
	dropmissing!(rawdata, :occupancy_covid)

	dates = (;
		data_update = latest_update_date(),
		data_start = minimum(rawdata.date),
		data_end = maximum(rawdata.date),
	)

	open("../public/json/dates.json", "w") do f
		JSON.print(f, dates, 4)
	end

	return
end

function extract_regions_metadata()
	regions = [(region_type = :province, region_name = "Ontario", region_id = "ontario")]
	serialize("../data/regions.jlser", regions)
	return
end
