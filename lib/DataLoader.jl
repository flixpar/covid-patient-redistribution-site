module DataLoader

using CSV
using JSON
using Serialization
using DataFrames
using Distributions
using Dates
using LinearAlgebra

export load_hhs
export load_hhs_raw
export los_dist_default
export los_dist_regional
export hospitals_list
export regions_list
export complete_region
export haversine_distance_matrix

projectbasepath = joinpath(@__DIR__, "../")

DEBUG = false
NDEDBUG = 6


function load_hhs(
		region::NamedTuple,
		hospital_list::Array{String,1},
		scenario::Symbol,
		patient_type::Symbol,
		start_date::Date,
		end_date::Date,
		covid_capacity_estimate::Union{Float64, String}="default",
		dist_threshold::Real=600,
	)
	@assert(start_date < end_date)
	@assert(patient_type in [:icu, :acute, :all, :combined_ped])

	data = deserialize(joinpath(projectbasepath, "data/data_hhs.jlser"))

	@assert data.start_date <= start_date < end_date <= data.end_date

	hospital_ind = filter_hospitals(data, region=region, ids=hospital_list)

	if DEBUG
		beds_ = data.casesdata[:moderate,:combined].capacity[hospital_ind,1]
		hospital_ind = hospital_ind[sortperm(beds_, rev=true)]
		hospital_ind = hospital_ind[1:NDEDBUG]
		hospital_ind = sort(hospital_ind)
	end

	N = length(hospital_ind)
	T = (end_date - start_date).value + 1

	hospital_ids = data.location_ids[hospital_ind]
	hospital_names = data.location_names[hospital_ind]
	hospital_abbrevs = data.location_names[hospital_ind]

	bedtype = (patient_type == :all) ? :combined : patient_type
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
		if isinf(discharged[i,1]) || isnan(discharged[i,1])
			discharged[i,1] = 0.0
		end
	end

	default_capacity_level = 1
	capacity_names = ["Baseline Capacity"]
	if isa(covid_capacity_estimate, Number)
		beds = casesdata.capacity[hospital_ind,default_capacity_level] .* covid_capacity_estimate
		capacity = casesdata.capacity[hospital_ind,:] .* covid_capacity_estimate
	else
		beds = casesdata.covid_capacity[hospital_ind]
		capacity = reshape(beds, :, 1)
	end

	node_locations = Dict(name => haskey(data.locations_latlong, h) ? data.locations_latlong[h] : (lat=0.0, long=0.0) for (name,h) in zip(hospital_names, hospital_ids))

	locs = [haskey(data.locations_latlong, h) ? data.locations_latlong[h] : (lat=0.0, long=0.0) for h in hospital_ids]
	dist_matrix = haversine_distance_matrix(locs)
	adj = (0 .< dist_matrix .<= dist_threshold)

	extent = (extent_type = :points, extent_regions = [])

	return (;
		initial,
		discharged,
		admitted,
		beds,
		capacity,
		dist_matrix,
		adj,
		node_locations,
		node_names = hospital_names,
		node_names_abbrev = hospital_abbrevs,
		node_ids = hospital_ids,
		extent,
		capacity_names,
	)
end

function load_hhs_raw(
		hospital_id::String,
		scenario::Symbol,
		patient_type::Symbol,
		bed_type::Symbol,
		covid_capacity_estimate::Union{Float64, String}="default",
	)
	@assert patient_type == :covid
	@assert(bed_type in [:icu, :acute, :all])

	data = deserialize(joinpath(projectbasepath, "data/data_hhs.jlser"))

	hospital_ind = filter_hospitals(data, ids=[hospital_id])[1]
	hospital_name = data.location_names[hospital_ind]

	bedtype = (bed_type == :all) ? :combined : bed_type
	casesdata = data.casesdata[scenario, bedtype]

	admissions = casesdata.admitted[hospital_ind,:]
	occupancy = casesdata.active[hospital_ind,:]

	default_capacity_level = 1
	capacity_names = ["Baseline Capacity"]
	if isa(covid_capacity_estimate, Number)
		beds = casesdata.capacity[hospital_ind,default_capacity_level] .* covid_capacity_estimate
		capacity = casesdata.capacity[hospital_ind,:] .* covid_capacity_estimate
	else
		beds = casesdata.covid_capacity[hospital_ind]
		capacity = [beds]
	end

	location = get(data.locations_latlong, hospital_id, (lat=0.0, long=0.0))

	dates = collect(data.start_date:Day(1):data.end_date)

	return (;
		hospital_id,
		hospital_name,
		dates,
		admissions,
		occupancy,
		beds,
		capacity,
		capacity_names,
		location,
	)
end

function los_dist_default(bedtype::Symbol)
	losdata = deserialize(joinpath(projectbasepath, "data/hhs_los_est.jlser"))
	if haskey(losdata, bedtype)
		return losdata[bedtype]
	else
		return losdata[:combined]
	end
end

function los_dist_regional(region, bedtype::Symbol)
	losdata = deserialize(joinpath(projectbasepath, "data/regional_los_est.jlser"))
	if haskey(losdata, (region.region_type, region.region_id, bedtype))
		return losdata[region.region_type, region.region_id, bedtype]
	else
		return los_dist_default(bedtype)
	end
end

function filter_hospitals(data; region=nothing, names=nothing, ids=nothing)
	if !isnothing(region)
		col_lookup = Dict(
			:state => :state_abbrev,
			:county => :county_fips,
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

function hospitals_list(;region=nothing, names=nothing, ids=nothing)
	hospitals_info = deserialize(joinpath(projectbasepath, "data/hhs_current_load_covid.jlser"))

	if !isnothing(region)
		col_lookup = Dict(
			:state => :state_abbrev,
			:county => :county_fips,
			:hospital_system => :system_id,
			:hrr => :hrr_id,
			:hsa => :hsa_id,
		)
		col = col_lookup[region.region_type]
		filter!(h -> !ismissing(h[col]) && (string(h[col]) == region.region_id), hospitals_info)
	end

	if !isnothing(names) && !isempty(names)
		filter!(h -> h.hospital in names, hospitals_info)
	end
	if !isnothing(ids) && !isempty(ids)
		filter!(h -> h.hospital_id in ids, hospitals_info)
	end

	cols_cvt = Dict(:hospital => :hospital_name, :hospital_id => :hospital_id, :total_load => :current_load, :total_beds => :total_beds)
	hospitals_info = [Dict(cols_cvt[c] => h[c] for c in keys(cols_cvt)) for h in hospitals_info]

	return hospitals_info
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
