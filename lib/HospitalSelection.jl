module HospitalSelection

using Serialization
using DataFrames
using Dates

using DataLoader: haversine_distance

projectbasepath = joinpath(@__DIR__, "../")

export score_hospitals


function score_hospitals(loc, n=20)
	data = deserialize(joinpath(projectbasepath, "data/current_load.jlser"))

	locations = [(lat=h.lat, long=h.long) for h in data]
	distances = [haversine_distance(loc, h) for h in locations]

	available_scores = [h.total_beds - h.total_occupancy for h in data]
	available_scores_extrema = extrema(available_scores)

	load_scores = [-h.total_load for h in data]
	load_scores_extrema = extrema(load_scores)

	selected = sort(partialsortperm(distances, 1:n))

	data = data[selected]
	distances = distances[selected]

	distance_scores = -distances
	distance_scores = distance_scores .- minimum(distance_scores)
	distance_scores = distance_scores ./ maximum(distance_scores)

	available_scores = available_scores[selected]
	available_scores = available_scores .- available_scores_extrema[1]
	available_scores = available_scores ./ (available_scores_extrema[2] - available_scores_extrema[1])

	load_scores = load_scores[selected]
	load_scores = load_scores .- load_scores_extrema[1]
	load_scores = load_scores ./ (load_scores_extrema[2] - load_scores_extrema[1])

	weights = [0.2, 0.4, 0.4]
	scores = [sum(weights .* z) for z in zip(distance_scores, load_scores, available_scores)]

	full_ind = [h.total_load > 1 for h in data]
	scores[full_ind] = map(s -> min(0.2, s/2), scores[full_ind])

	data = [merge(h, (
		distance = distances[i],
		distance_score = distance_scores[i],
		available_score = available_scores[i],
		load_score = load_scores[i],
		score = scores[i],
	)) for (i,h) in enumerate(data)]

	response = (;
		data,
		current_location = loc,
	)
	return response
end

end