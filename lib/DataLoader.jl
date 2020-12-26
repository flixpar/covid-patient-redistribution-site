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

projectbasepath = joinpath(@__DIR__, "../")

NDEFAULT = 10

DEBUG = false
NDEDBUG = 6


function load_hhs(
		hospital_list::Array{String,1},
		scenario::Symbol,
		patient_type::Symbol,
		start_date::Date,
		end_date::Date,
	)
	@assert(start_date < end_date)
	@assert(patient_type in [:icu, :acute, :all])

	data = deserialize(joinpath(projectbasepath, "data/data_hhs.jlser"))

	@assert data.start_date <= start_date < end_date <= data.end_date

	hospital_ind = [findfirst(==(h), data.location_names) for h in hospital_list]
	hospital_ind = sort(hospital_ind)

	if DEBUG
		beds_ = data.casesdata[:moderate,:allbeds].capacity[hospital_ind,1]
		hospital_ind = hospital_ind[sortperm(beds_, rev=true)]
		hospital_ind = hospital_ind[1:NDEDBUG]
		hospital_ind = sort(hospital_ind)
	end

	N = length(hospital_ind)
	T = (end_date - start_date).value + 1

	hospitals = data.location_names[hospital_ind]
	hospitals_abbrev = data.location_names_short[hospital_ind]

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

	covid_capacity_proportion = 0.4

	default_capacity_level = 1
	beds = casesdata.capacity[hospital_ind,default_capacity_level] .* covid_capacity_proportion
	capacity = casesdata.capacity[hospital_ind,:] .* covid_capacity_proportion
	capacity_names = ["Baseline Capacity"]

	node_locations = Dict(h => data.locations_latlong[h] for h in hospitals)

	# adj = (data.dist_matrix[hospital_ind,hospital_ind] .<= 1)
	adj = adj = BitArray(ones(N,N) - diagm(ones(N)))

	extent = (extent_type = :points, extent_regions = [])

	return (
		initial = initial,
		discharged = discharged,
		admitted = admitted,
		beds = beds,
		capacity = capacity,
		adj = adj,
		node_locations = node_locations,
		node_names = hospitals,
		node_names_abbrev = hospitals_abbrev,
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

function hospitals_list(;region=nothing, names=nothing)
	data = deserialize(joinpath(projectbasepath, "data/data_hhs.jlser"))

	if !isnothing(names)
		hospitals_ind = [h.index for h in data.location_meta if h.name in names]
	elseif !isnothing(region)
		if region.region_type == "state"
			hospitals_info = filter(h -> h.state == region.region_name, data.location_meta)
		else
			hospitals_info = data.location_meta
		end
		hospitals_ind = [h.index for h in hospitals_info]
	else
		hospitals_ind = collect(1:length(data.location_names))
	end
	filter!(x -> !isnothing(x), hospitals_ind)
	sort!(hospitals_ind)

	hospitals = data.location_names[hospitals_ind]

	casesdata = data.casesdata[:moderate,:allbeds]

	day0 = today()
	day0_idx = (day0 - data.start_date).value + 1
	initial = casesdata.active[hospitals_ind, day0_idx]

	default_capacity_level = 1
	beds = casesdata.capacity[hospitals_ind, default_capacity_level]

	load = initial ./ beds
	load[beds .== 0] .= 1.0

	default_hospitals_ind = sortperm(beds, rev=true)
	default_hospitals_ind = default_hospitals_ind[1:NDEFAULT]

	if DEBUG && NDEDBUG < NDEFAULT
		default_hospitals_ind = default_hospitals_ind[1:NDEDBUG]
	end

	hospitals_meta = [
		Dict(
			"name" => hospitals[i],
			"current_load" => load[i],
			"default" => i in default_hospitals_ind,
		)
		for i in 1:length(hospitals)
	]
	return hospitals_meta
end

function regions_list()
	data = deserialize(joinpath(projectbasepath, "data/regions_hhs.jlser"))
	return data
end

end
