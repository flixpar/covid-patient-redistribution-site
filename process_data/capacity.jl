using CSV
using Dates
using DataFrames


############################
#### Estimate Capacity #####
############################

function estimate_capacity()
	rawdata = DataFrame(CSV.File("../data/rawdata.csv"))
	select!(rawdata, :location_id, :date, :beds_total)
	dropmissing!(rawdata, :beds_total)

	mean_int(xs) = round(Int, sum(xs) / length(xs))
	capacity = combine(groupby(rawdata, :location_id), :beds_total => mean_int => :beds_total)

	metadata = DataFrame(CSV.File("../data/metadata.csv"))
	select!(metadata, :location_name, :location_id)

	capacity = outerjoin(metadata, capacity, on=:location_id)
	capacity.beds_total = coalesce.(capacity.beds_total, 0)

	sort!(capacity, :location_id)
	capacity |> CSV.write("../data/capacity.csv")

	return
end
