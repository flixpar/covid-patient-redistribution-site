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

projectbasepath = joinpath(@__DIR__, "../")

DEBUG = false
NDEDBUG = 8


function load_hhs(
		scenario::Symbol,
		patient_type::Symbol,
		start_date::Date,
		end_date::Date,
	)
	@assert(start_date < end_date)
	@assert(patient_type in [:icu, :acute, :all])

	data = deserialize(joinpath(projectbasepath, "data/data_hhs.jlser"))

	beds_ = data.casesdata[:moderate,:allbeds].capacity[:,1]
	hospital_ind = sortperm(beds_, rev=true)

	if DEBUG
		hospital_ind = hospital_ind[1:NDEDBUG]
	end

	@assert data.start_date <= start_date < end_date <= data.end_date

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

function hospitals_list()
	data = deserialize(joinpath(projectbasepath, "data/data_hhs.jlser"))
	hospitals = data.location_names

	casesdata = data.casesdata[:moderate,:allbeds]

	day0 = today()
	day0_idx = (day0 - data.start_date).value + 1
	initial = casesdata.active[:,day0_idx]

	default_capacity_level = 1
	beds = casesdata.capacity[:,default_capacity_level]

	load = initial ./ beds

	default_hospitals_ind = sortperm(beds, rev=true)
	default_hospitals_ind = default_hospitals_ind[1:10]

	if DEBUG && NDEDBUG < 10
		default_hospitals_ind = default_hospitals_ind[1:NDEDBUG]
	end

	default_hospitals = sort(hospitals[default_hospitals_ind])

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

end
