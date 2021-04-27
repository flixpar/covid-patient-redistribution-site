using CSV
using Serialization
using Dates
using DataFrames

using Convex
using Gurobi

include("util.jl")


############################
#### Package Main Data #####
############################

function package_main_data()
	los_dist = Gamma(1.75, 6.0)

	metadata = DataFrame(CSV.File("../data/metadata.csv"))
	capacity_data = DataFrame(CSV.File("../data/capacity.csv"))
	rawdata = DataFrame(CSV.File("../data/rawdata.csv"))

	metadata.location_id = string.(metadata.location_id)
	capacity_data.location_id = string.(capacity_data.location_id)
	rawdata.location_id = string.(rawdata.location_id)

	location_ids = metadata.location_id
	location_names = metadata.location_name
	N = length(location_ids)

	start_date, end_date = extrema(rawdata.date)
	date_range = collect(start_date : Day(1) : end_date)
	T = length(date_range)

	capacity_names = ["Base Capacity"]
	C = length(capacity_names)

	capacity_dict = Dict(row.location_id => row.beds_total for row in eachrow(capacity_data))
	capacity = [capacity_dict[r] for r in location_ids, c in 1:C]
	beds = capacity[:,1]

	active_dict = Dict((row.location_id, row.date) => row.occupancy_covid for row in eachrow(rawdata))
	active = [haskey(active_dict, (h,d)) ? active_dict[h,d] : missing for h in location_ids, d in date_range]
	active = interpolate_missing(active)

	admitted = estimate_admitted(active, los_dist)

	locations_latlong = Dict(row.location_id => (lat = row.lat, long = row.long) for row in eachrow(metadata))

	completedata = (;
		node_ids = location_ids,
		node_names = location_names,
		node_locations = locations_latlong,
		capacity_names,
		start_date,
		end_date,
		active,
		admitted,
		capacity,
		beds,
		los_dist,
	)

	serialize(joinpath(@__DIR__, "../data/data.jlser"), completedata)

	return
end

function package_load_data()
	data = DataFrame(CSV.File("../data/rawdata.csv"))
	sort!(data, [:location_id, :date])
	data = combine(groupby(data, :location_id), :occupancy_total => lastvalue => :occupancy_total)

	metadata = DataFrame(CSV.File("../data/metadata.csv"))
	capacity_data = DataFrame(CSV.File("../data/capacity.csv"))
	select!(capacity_data, :location_id, :beds_total)

	data = outerjoin(data, metadata, on=:location_id)
	data = outerjoin(data, capacity_data, on=:location_id)

	select!(data,
		:location_name,
		:location_id,
		:lat, :long,
		:beds_total => :beds,
		:occupancy_total => :occupancy,
		[:occupancy_total, :beds_total] => ByRow((o,b) -> (b == 0) ? o : (o/b)) => :load,
	)
	data.location_id = string.(data.location_id)

	data |> CSV.write(joinpath(@__DIR__, "../data/current_load.csv"))

	data_list = collect([NamedTuple(h) for h in eachrow(data)])
	serialize(joinpath(@__DIR__, "../data/current_load.jlser"), data_list)

	return
end

function package_covid_load_data()
	data = DataFrame(CSV.File("../data/rawdata.csv"))
	sort!(data, [:location_id, :date])
	data = combine(groupby(data, :location_id), :occupancy_covid => lastvalue => :occupancy_covid)

	metadata = DataFrame(CSV.File("../data/metadata.csv"))
	capacity_data = DataFrame(CSV.File("../data/capacity.csv"))
	select!(capacity_data, :location_id, :beds_total)

	data = outerjoin(data, metadata, on=:location_id)
	data = outerjoin(data, capacity_data, on=:location_id)

	covid_cap = 0.4

	select!(data,
		:location_name,
		:location_id,
		:lat, :long,
		:beds_total => ByRow(x -> x * covid_cap) => :beds,
		:occupancy_covid => :occupancy,
		[:occupancy_covid, :beds_total] => ByRow((o,b) -> (b == 0) ? o : (o/(b*covid_cap))) => :load,
	)
	data.location_id = string.(data.location_id)

	data |> CSV.write(joinpath(@__DIR__, "../data/current_covid_load.csv"))

	data_list = collect([NamedTuple(h) for h in eachrow(data)])
	serialize(joinpath(@__DIR__, "../data/current_covid_load.jlser"), data_list)

	return
end

function estimate_admitted(active::Array{<:Real,1}, los_dist::Distribution; l::Int=35)
	T = length(active)
	L = 1.0 .- cdf.(los_dist, 0:l)

	admitted = Variable(T+l)
	est_active = [L' * admitted[(t+l):-1:t] for t in 1:T]
	cons = [admitted[t] >= 0 for t in 1:(T+l)]
	problem = minimize(sum(square.(est_active - active)), cons)

	solve!(problem, Gurobi.Optimizer, silent_solver=true)
	sol_admitted = evaluate(admitted)

	return sol_admitted[(l+1):end]
end

function estimate_admitted(active::Array{<:Real,2}, los_dist::Distribution)
	admitted = Array{Float64,2}(undef, size(active)...)
	for i in 1:size(active,1)
		admitted[i,:] = estimate_admitted(active[i,:], los_dist)
	end
	return admitted
end
