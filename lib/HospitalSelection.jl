module HospitalSelection

using Serialization
using DataFrames

using DataLoader: haversine_distance

projectbasepath = joinpath(@__DIR__, "../")

export score_hospitals


function score_hospitals(loc, n=30)
	data = deserialize(joinpath(projectbasepath, "data/data_hhs.jlser"))

	hospitals = data.location_ids
	sort!(hospitals)

	default_loc = (lat = 0.0, long = 0.0)
	locations = [haskey(data.locations_latlong, h) ? data.locations_latlong[h] : default_loc for h in hospitals]
	distances = [haskey(data.locations_latlong, h) ? haversine_distance(loc, data.locations_latlong[h]) : Inf for h in hospitals]

	scores = distances

	selected = sort(sortperm(scores)[1:n])
	hospitals = hospitals[selected]
	locations = locations[selected]
	scores = scores[selected]

	response = (;
		hospitals,
		scores,
		locations,
		current_location = loc,
	)
	return response
end

end