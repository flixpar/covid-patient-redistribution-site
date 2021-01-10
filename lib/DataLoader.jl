module DataLoader

using CSV
using JSON
using Serialization
using DataFrames
using Distributions
using Dates
using LinearAlgebra

export load_hhs
export los_dist_default
export hospitals_list
export regions_list
export complete_region

projectbasepath = joinpath(@__DIR__, "../")

NDEFAULT = 10

DEBUG = false
NDEDBUG = 6


function load_hhs(
		region::NamedTuple,
		hospital_list::Array{String,1},
		scenario::Symbol,
		patient_type::Symbol,
		start_date::Date,
		end_date::Date,
		covid_capacity_proportion::Real=0.4,
		dist_threshold::Real=600,
	)
	@assert(start_date < end_date)
	@assert(patient_type in [:icu, :acute, :all])

	data = deserialize(joinpath(projectbasepath, "data/data_hhs.jlser"))

	@assert data.start_date <= start_date < end_date <= data.end_date

	hospital_ind = filter_hospitals(data, region=region, ids=hospital_list)

	if DEBUG
		beds_ = data.casesdata[:moderate,:allbeds].capacity[hospital_ind,1]
		hospital_ind = hospital_ind[sortperm(beds_, rev=true)]
		hospital_ind = hospital_ind[1:NDEDBUG]
		hospital_ind = sort(hospital_ind)
	end

	N = length(hospital_ind)
	T = (end_date - start_date).value + 1

	hospital_ids = data.location_ids[hospital_ind]
	hospital_names = data.location_names[hospital_ind]
	hospital_abbrevs = data.location_names[hospital_ind]

	bedtype = (patient_type == :all) ? :allbeds : patient_type
	casesdata = data.casesdata[scenario,bedtype]

	start_date_idx = (start_date - data.start_date).value + 1
	end_date_idx   = (end_date   - data.start_date).value + 1
	admitted = casesdata.admitted[hospital_ind,start_date_idx:end_date_idx]

	day0 = max(data.start_date, start_date - Day(1))
	day0_idx = (day0 - data.start_date).value + 1
	initial = casesdata.active[hospital_ind, day0_idx]

	discharged = Array{Float64,2}(undef, N, T)
	for i in 1:N
		discharged[i,:] = initial[i] .* (pdf.(casesdata.los_dist, 0:T-1))
		if isinf(discharged[i,1])
			discharged[i,1] = 0.0
		end
	end

	default_capacity_level = 1
	beds = casesdata.capacity[hospital_ind,default_capacity_level] .* covid_capacity_proportion
	capacity = casesdata.capacity[hospital_ind,:] .* covid_capacity_proportion
	capacity_names = ["Baseline Capacity"]

	node_locations = Dict(name => haskey(data.locations_latlong, h) ? data.locations_latlong[h] : (lat=0.0, long=0.0) for (name,h) in zip(hospital_names, hospital_ids))

	locs = [haskey(data.locations_latlong, h) ? data.locations_latlong[h] : (lat=0.0, long=0.0) for h in hospital_ids]
	dist_matrix = haversine_distance_matrix(locs)
	adj = (0 .< dist_matrix .<= dist_threshold)

	extent = (extent_type = :points, extent_regions = [])

	return (
		initial = initial,
		discharged = discharged,
		admitted = admitted,
		beds = beds,
		capacity = capacity,
		adj = adj,
		node_locations = node_locations,
		node_names = hospital_names,
		node_names_abbrev = hospital_abbrevs,
		node_ids = hospital_ids,
		extent = extent,
		capacity_names = capacity_names,
	)
end

function los_dist_default(bedtype::Symbol)
	if bedtype == :icu
		return Gamma(1.77595, 5.9512)
	elseif bedtype == :acute
		return Gamma(2.601, 3.8046)
	else
		return Gamma(2.244, 4.4988)
	end
end

function filter_hospitals(data; region=nothing, names=nothing, ids=nothing)
	if !isnothing(region)
		col_lookup = Dict(
			:state => :state_abbrev,
			:hospital_system => :system_id,
			:hrr => :hrr_id,
			:hsa => :hsa_id,
		)
		col = col_lookup[region.region_type]
		hospitals_info = filter(h -> !ismissing(h[col]) && (h[col] == region.region_id), data.location_meta)
	else
		hospitals_info = data.location_meta
	end

	if !isnothing(names) && !isempty(names)
		hospitals_info = filter(h -> h.name in names, hospitals_info)
	end
	if !isnothing(ids) && !isempty(ids)
		hospitals_info = filter(h -> h.id in ids, hospitals_info)
	end

	unique!(h -> h.id, hospitals_info)
	hospitals_ind = [h.index for h in hospitals_info]
	filter!(x -> !isnothing(x), hospitals_ind)
	sort!(hospitals_ind)

	return hospitals_ind
end

function hospitals_list(;region=nothing, names=nothing, ids=nothing, bedtype=:icu, scenario=:moderate)
	data = deserialize(joinpath(projectbasepath, "data/data_hhs.jlser"))

	hospitals_ind = filter_hospitals(data, region=region, names=names, ids=ids)
	hospital_names = data.location_names[hospitals_ind]
	hospital_ids = data.location_ids[hospitals_ind]

	casesdata = data.casesdata[scenario, bedtype]

	day0 = today()
	day0_idx = (day0 - data.start_date).value + 1
	initial = casesdata.active[hospitals_ind, day0_idx]

	default_capacity_level = 1
	beds = casesdata.capacity[hospitals_ind, default_capacity_level]
	empty_ind = findall(beds .== 0)

	load = initial ./ beds
	load[empty_ind] .= 1.0

	n_total = min(NDEFAULT, length(hospitals_ind) - length(empty_ind))
	n_size = Int(ceil(n_total * 0.75))
	n_load = n_total - n_size

	default_hospitals_ind_size = setdiff(sortperm(beds, rev=true), empty_ind)
	default_hospitals_ind_load = setdiff(sortperm(load, rev=true), empty_ind)
	default_hospitals_ind = vcat(default_hospitals_ind_size[1:n_size], default_hospitals_ind_load[1:n_load])

	if DEBUG && NDEDBUG < NDEFAULT
		default_hospitals_ind = default_hospitals_ind[1:min(NDEDBUG, length(default_hospitals_ind))]
	end

	hospitals_meta = [
		(
			hospital_name = hospital_names[i],
			hospital_id = hospital_ids[i],
			current_load = load[i],
			is_default = (i in default_hospitals_ind),
		)
		for i in 1:length(hospital_ids)
	]
	return hospitals_meta
end

function regions_list(region_type::Symbol=:all)
	data = deserialize(joinpath(projectbasepath, "data/regions_hhs.jlser"))
	if region_type != :all
		filter!(r -> r.region_type == region_type, data)
	end
	return data
end

function complete_region(r)
	regions = deserialize(joinpath(projectbasepath, "data/regions_hhs.jlser"))
	filter!(region -> region.region_type == r.region_type, regions)
	if haskey(r, :region_id) && !haskey(r, :region_name)
		region_idx = findfirst(region -> region.region_id == r.region_id, regions)
		region = regions[region_idx]
	elseif haskey(r, :region_name) && !haskey(r, :region_id)
		region_idx = findfirst(region -> region.region_name == r.region_name, regions)
		region = regions[region_idx]
	else
		region = r
	end
	return region
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
