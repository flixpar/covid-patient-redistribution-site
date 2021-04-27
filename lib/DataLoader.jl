module DataLoader

using CSV
using JSON
using Serialization
using DataFrames
using Distributions
using Dates
using LinearAlgebra

export load_data
export los_dist_default
export locations_list
export regions_list

projectbasepath = joinpath(@__DIR__, "../")


function load_data(
		region::NamedTuple,
		locations_list::Array{String,1},
		scenario::Symbol,
		patient_type::Symbol,
		start_date::Date,
		end_date::Date,
		covid_capacity_proportion::Real=0.4,
		dist_threshold::Real=1000,
	)
	@assert(start_date < end_date)
	@assert(patient_type == :icu)
	@assert(scenario == :moderate)

	data = deserialize(joinpath(projectbasepath, "data/data.jlser"))
	@assert data.start_date <= start_date < end_date <= data.end_date

	node_inds = filter_nodes(data, region=region, ids=locations_list)
	node_ids = data.node_ids[node_inds]
	node_names = data.node_names[node_inds]

	N = length(node_inds)
	T = (end_date - start_date).value + 1

	start_date_idx = (start_date - data.start_date).value + 1
	end_date_idx   = (end_date   - data.start_date).value + 1

	active = data.active[node_inds, start_date_idx:end_date_idx]
	admitted = data.admitted[node_inds, start_date_idx:end_date_idx]

	day0 = max(data.start_date, start_date - Day(1))
	day0_idx = (day0 - data.start_date).value + 1
	initial = data.active[node_inds, day0_idx]

	los_dist = los_dist_default(patient_type)
	discharged_ratio = pdf.(los_dist, 0:T-1)
	discharged_ratio[1] = isinf(discharged_ratio[1]) ? 0 : discharged_ratio[1]
	discharged = initial * discharged_ratio'

	default_capacity_level = 1
	beds = data.capacity[node_inds, default_capacity_level] .* covid_capacity_proportion
	capacity = data.capacity[node_inds,:] .* covid_capacity_proportion
	capacity_names = data.capacity_names

	node_locations = Dict(n => haskey(data.node_locations, i) ? data.node_locations[i] : (lat=0.0, long=0.0) for (n, i) in zip(node_names, node_ids))

	locs = [node_locations[n] for n in node_names]
	dist_matrix = haversine_distance_matrix(locs)
	adj = (0 .< dist_matrix .<= dist_threshold)

	extent = (extent_type = :points, extent_regions = [])
	region = (region_type = :province, region_id = "ontario", region_name = "Ontario")

	return (;
		initial,
		discharged,
		admitted,
		beds,
		capacity,
		adj,
		node_locations,
		node_names,
		node_names_abbrev = node_names,
		node_ids,
		extent,
		region,
		capacity_names,
	)
end

function los_dist_default(bedtype::Symbol)
	return Gamma(1.75, 6.0)
end

function locations_list(;region=nothing, names=nothing, ids=nothing)
	nodes = deserialize(joinpath(projectbasepath, "data/current_covid_load.jlser"))

	if !isnothing(region) && region.region_id != "ontario"
		error("Invalid region")
	end
	if !isnothing(names) && !isempty(names)
		filter!(n -> n.location_name in names, nodes)
	end
	if !isnothing(ids) && !isempty(ids)
		filter!(n -> string(n.location_id) in ids, nodes)
	end

	return nodes
end

function regions_list(region_type::Symbol=:all)
	data = deserialize(joinpath(projectbasepath, "data/regions.jlser"))
	if region_type != :all
		filter!(r -> r.region_type == region_type, data)
	end
	return data
end

function filter_nodes(data; region=nothing, names=nothing, ids=nothing)
	nodes = [(index = i, id = data.node_ids[i], name = data.node_names[i]) for i in 1:length(data.node_ids)]

	if !isnothing(region) && region.region_id != "ontario"
		error("Invalid region")
	end
	if !isnothing(names) && !isempty(names)
		filter!(n -> n.name in names, nodes)
	end
	if !isnothing(ids) && !isempty(ids)
		filter!(n -> string(n.id) in ids, nodes)
	end

	node_inds = [n.index for n in nodes]
	sort!(node_inds)

	return node_inds
end

function haversine_distance(loc1, loc2)
	R = 6371e3

	φ1 = loc1.lat * π/180
	φ2 = loc2.lat * π/180
	Δφ = (loc2.lat-loc1.lat) * π/180
	Δλ = (loc2.long-loc1.long) * π/180

	a = (sin(Δφ/2) * sin(Δφ/2)) + (cos(φ1) * cos(φ2) * sin(Δλ/2) * sin(Δλ/2))
	c = 2 * atan(sqrt(a), sqrt(1-a))

	dist = R * c / 1000

	return dist
end

function haversine_distance_matrix(locations)
	N = length(locations)
	distancematrix = zeros(Float32, N, N)
	for i in 1:N
		for j in i+1:N
			dist = haversine_distance(locations[i], locations[j])
			distancematrix[i,j] = dist
			distancematrix[j,i] = dist
		end
	end
	return distancematrix
end

function fully_connected(n::Int; self_edges::Bool=false)
	if (self_edges) return BitArray(ones(Bool, n, n)) end
	adj = BitArray(ones(Bool, n, n) - diagm(ones(Bool, n)))
	return adj
end

end
