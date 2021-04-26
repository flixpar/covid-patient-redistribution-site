using JSON
using CSV
using DataFrames
using Dates

include("util.jl")


#######################
#### Convert Data #####
#######################

function convert_data()
	meta = DataFrame(CSV.File("../data/metadata.csv"))
	location_ids = sort(meta.location_id)

	update_date = latest_update_date()

	fixnothing(x) = isnothing(x) ? missing : x

	data_rows = []
	for location_id in location_ids
		d = JSON.parsefile("../rawdata/$(update_date)/$(location_id).json")
		r = map(d) do row
			(
				location_name = row["phu"],
				location_id = row["HR_UID"],
				date = Date(DateTime(row["date"], "yyyy-mm-ddTHH:MM:SS.sssZ")),
				beds_total = fixnothing(row["critical_care_beds"]),
				occupancy_total = fixnothing(row["critical_care_patients"]), 
				occupancy_covid = fixnothing(row["confirmed_positive"]),
			)
		end
		append!(data_rows, r)
	end

	data = DataFrame(data_rows)
	sort!(data, [:location_id, :date])
	data |> CSV.write("../data/rawdata.csv")

	return
end
