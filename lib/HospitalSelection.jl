module HospitalSelection

using Serialization
using DataFrames
using Dates

using DataLoader: haversine_distance

projectbasepath = joinpath(@__DIR__, "../")

export score_hospitals


function score_hospitals(loc, n=30)
	data = deserialize(joinpath(projectbasepath, "data/data_hhs.jlser"))
	hospitals = data.location_ids

	default_loc = (lat = 0.0, long = 0.0)
	locations = [haskey(data.locations_latlong, h) ? data.locations_latlong[h] : default_loc for h in hospitals]
	distances = [haskey(data.locations_latlong, h) ? haversine_distance(loc, data.locations_latlong[h]) : Inf for h in hospitals]

	selected = sort(sortperm(distances)[1:n])

	hospitals = hospitals[selected]
	locations = locations[selected]
	distances = distances[selected]

	casesdata = data.casesdata[:moderate, :icu]
	day0_idx = (today() - data.start_date).value + 1
	initial = casesdata.active[selected, day0_idx]
	beds = casesdata.capacity[selected, 1] .* 0.4
	available = beds .- initial
	load = initial ./ beds
	load[beds .== 0] .= 1.0

	distance_scores = -distances
	distance_scores = distance_scores .- minimum(distance_scores)
	distance_scores = distance_scores ./ maximum(distance_scores)

	available_scores = available
	available_scores = available_scores .- minimum(available_scores)
	available_scores = available_scores ./ maximum(available_scores)

	load_scores = -load
	load_scores = load_scores .- minimum(load_scores)
	load_scores = load_scores ./ maximum(load_scores)

	weights = [0.4, 0.2, 0.4]
	scores = [sum(weights .* z) for z in zip(distance_scores, load_scores, available_scores)]

	response = (;
		hospitals,
		scores,
		locations,
		distances,
		load,
		current_location = loc,
	)
	return response
end

end