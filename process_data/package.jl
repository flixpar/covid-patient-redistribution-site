using CSV
using Serialization
using Dates
using DataFrames

include("util.jl")


############################
#### Package Main Data #####
############################

function package_main_data()
	SCENARIOS = [:moderate]
	BEDTYPES  = [:combined, :icu, :acute, :combined_ped]

	los_dist = deserialize(joinpath(@__DIR__, "../data/hhs_los_est.jlser"))
	capacity_data = DataFrame(CSV.File(joinpath(@__DIR__, "../data/capacity_hhs.csv")))
	covid_capacity_data = DataFrame(CSV.File(joinpath(@__DIR__, "../data/capacity_covid.csv")))

	forecast = DataFrame(CSV.File(joinpath(@__DIR__, "../data/hospitalization_forecast.csv")))

	hhs_data = DataFrame(CSV.File(joinpath(@__DIR__, "../data/hospitalization_data.csv")))
	hhs_data_dict = Dict((row.hospital_id, row.date) => row for row in eachrow(hhs_data))

	hospital_ids = capacity_data.hospital_id
	N = length(hospital_ids)

	start_date = minimum(hhs_data.date)
	end_date   = maximum(forecast.date)
	date_range = collect(start_date : Day(1) : end_date)
	T = length(date_range)

	function load_capacity(hospitals, bedtype, bounds=:est, capacity_levels=[:baseline])
		beds_dict = Dict(row.hospital_id => Dict(
			:est => row["capacity_$(bedtype)"],
			:lb  => row["capacity_$(bedtype)_lb"],
			:ub  => row["capacity_$(bedtype)_ub"],
		) for row in eachrow(capacity_data))

		bounds_ = (bounds isa Symbol) ? [bounds] : bounds
		capacity_levels_ = (capacity_levels isa Symbol) ? [capacity_levels] : capacity_levels

		capacity = [beds_dict[h][bd] for h in hospital_ids, l in capacity_levels_, bd in bounds_]

		if bounds isa Symbol
			capacity = flatten(capacity, dims=3)
		end
		if capacity_levels isa Symbol
			capacity = flatten(capacity, dims=2)
		end

		return capacity
	end

	covid_capacity_dict = Dict(r.hospital_id => (combined = r.capacity_covid, icu = r.capacity_covid_icu) for r in eachrow(covid_capacity_data))
	function load_covid_capacity(hospitals, bedtype)
		if bedtype == :combined
			capacity = [haskey(covid_capacity_dict, h) ? covid_capacity_dict[h].combined : 0 for h in hospital_ids]
		elseif bedtype == :icu
			capacity = [haskey(covid_capacity_dict, h) ? covid_capacity_dict[h].icu : 0 for h in hospital_ids]

		elseif bedtype == :acute
			capacity = [haskey(covid_capacity_dict, h) ? covid_capacity_dict[h].combined - covid_capacity_dict[h].icu : 0 for h in hospital_ids]

		else
			capacity = [0 for h in hospital_ids]
		end
		return Float64.(capacity)
	end

	firstval(xs) = xs[findfirst(isnbad, xs)]
	lastval(xs) = xs[findlast(isnbad, xs)]

	function load_data_hhs(scenario, bedtype)
		@assert(scenario in [:optimistic, :moderate, :pessimistic, :catastrophic])

		forecast_dict = Dict((row.hospital_id, row.date) => (
			admitted = row["admissions_$(bedtype)"],
			admitted_lb = row["admissions_$(bedtype)_lb"],
			admitted_ub = row["admissions_$(bedtype)_ub"],
		) for row in eachrow(forecast))

		hist_dict = Dict(k => (active = v["active_$(bedtype)"], admitted = v["admissions_$(bedtype)"]) for (k,v) in pairs(hhs_data_dict))

		hist_date_range = sort(intersect(date_range, hhs_data.date))
		forecast_date_range = sort(intersect(date_range, forecast.date))

		hist_date_range_t = [findfirst(date_range .== d) for d in hist_date_range]
		forecast_date_range_t = [findfirst(date_range .== d) for d in forecast_date_range]

		hist_active = [haskey(hist_dict,(h,d)) ? hist_dict[(h,d)].active : missing for h in hospital_ids, d in hist_date_range]
		hist_admitted = [haskey(hist_dict,(h,d)) ? hist_dict[(h,d)].admitted : missing for h in hospital_ids, d in hist_date_range]

		forecast_initial = hist_active[:,end]

		forecast_admitted = [haskey(forecast_dict,(h,d)) ? forecast_dict[(h,d)].admitted : missing for h in hospital_ids, d in forecast_date_range]
		forecast_admitted_bds = [haskey(forecast_dict,(h,d)) ? forecast_dict[(h,d)][a] : missing for h in hospital_ids, d in forecast_date_range, a in [:admitted_lb, :admitted_ub]]

		total(xs) = [sum(skipbad(xs[:,t])) for t in 1:size(xs,2)]
		forecast_admitted_scalefactor = lastval(total(hist_admitted)) / firstval(total(forecast_admitted))

		forecast_admitted .*= forecast_admitted_scalefactor
		forecast_admitted_bds .*= forecast_admitted_scalefactor

		forecast_active = permutedims(hcat([estimate_active(forecast_initial[i], forecast_admitted[i,:], los_dist[bedtype]) for i in 1:N]...), (2,1))
		forecast_active_scalefactor = lastval(total(hist_active)) / firstval(total(forecast_active))
		forecast_active .*= forecast_active_scalefactor

		active = Array{Union{Float64,Missing},2}(undef, N, T)
		fill!(active, missing)

		active[:,forecast_date_range_t] = forecast_active
		active[:,hist_date_range_t] = hist_active

		admitted = Array{Union{Float64,Missing},2}(undef, N, T)
		fill!(admitted, missing)

		admitted[:,forecast_date_range_t] = forecast_admitted
		admitted[:,hist_date_range_t] = hist_admitted

		active = interpolate_missing(active)
		admitted = interpolate_missing(admitted)

		admitted_bds = Array{Union{Float64,Missing},3}(undef, N, T, 2)
		fill!(admitted_bds, missing)
		admitted_bds[:,forecast_date_range_t,:] = forecast_admitted_bds
		admitted_bds[:,hist_date_range_t,1] = hist_admitted
		admitted_bds[:,hist_date_range_t,2] = hist_admitted
		admitted_bds = interpolate_missing(admitted_bds)

		beds = load_capacity(hospital_ids, bedtype, :est, :baseline)
		capacity = load_capacity(hospital_ids, bedtype, :est, [:baseline])
		capacity_bds = load_capacity(hospital_ids, bedtype, [:lb,:ub], [:baseline])

		covid_capacity = load_covid_capacity(hospital_ids, bedtype)

		capacity_names_full = ["Base Capacity"]
		capacity_names_abbrev = ["baselinecap"]

		data = (;
			scenario,
			bedtype,

			los_dist = los_dist[bedtype],

			active,
			admitted,
			admitted_uncertainty = admitted_bds,

			beds,
			capacity,
			capacity_uncertainty = capacity_bds,
			covid_capacity,

			capacity_names = capacity_names_full,
			capacity_names_abbrev,
		)

		return data
	end

	maindata = Dict()
	for scenario in SCENARIOS, bedtype in BEDTYPES
		maindata[(scenario,bedtype)] = load_data_hhs(scenario, bedtype)
	end

	metadata = DataFrame(CSV.File(joinpath(@__DIR__, "../data/hhs_hospital_meta.csv")))
	hospital_meta = [(
		name = row.hospitalname,
		hhsname = row.hospital,
		id = row.hospital_id,
		index = findfirst(==(row.hospital_id), hospital_ids),
		state = row.state,
		state_abbrev = row.state_abbrev,
		zipcode = row.zip,
		city = row.city,
		county_name = row.county_name,
		county_fips = string(row.county_fips),
		system_name = row.system_name,
		system_id = row.system_id,
		hsa_name = row.hsa_name,
		hsa_id = string(row.hsa_id),
		hrr_name = row.hrr_name,
		hrr_id = string(row.hrr_id),
	) for row in eachrow(metadata)]

	filter!(h -> !isnothing(h.index), hospital_meta)
	sort!(hospital_meta, by=(h -> h.index))

	hospital_names = [h.name for h in hospital_meta]
	hospital_identifiers = [h.id for h in hospital_meta]

	hospital_positions_raw = DataFrame(CSV.File(joinpath(@__DIR__, "../data/hhs_hospital_locations.csv")))
	filter!(row -> row.hospital_id in hospital_ids, hospital_positions_raw)
	hospital_positions = Dict(row.hospital_id => (
			lat  = row.lat,
			long = row.long,
		)
		for row in eachrow(hospital_positions_raw)
	)

	completedata = (;
		location_ids = hospital_identifiers,
		location_names = hospital_names,
		location_meta = hospital_meta,
		start_date,
		end_date,
		locations_latlong = hospital_positions,
		casesdata = maindata,
	)

	serialize(joinpath(@__DIR__, "../data/data_hhs.jlser"), completedata)

	return
end

function package_load_data()
	rawdata_fn = latest_hhs_rawdata_fn()
	rawdata = DataFrame(CSV.File(rawdata_fn))

	bad_ids = begin
		id_counts = combine(groupby(rawdata, :hospital_pk), :hospital_name => (x -> length(unique(x))) => :n_names)
		filter!(x -> x.n_names > 1, id_counts)
		unique(id_counts.hospital_pk)
	end
	filter!(row -> !(row.hospital_pk in bad_ids), rawdata)

	find_censored(x) = (ismissing(x) || x == -999999) ? missing : x

	data_weekly = select(rawdata,
		:hospital_name => :hospital,
		:hospital_pk => :hospital_id,
		:collection_week => ByRow(d -> Date(d, "yyyy/mm/dd")) => :date,

		:all_adult_hospital_inpatient_beds_7_day_avg => ByRow(find_censored) => :total_beds,
		:all_adult_hospital_inpatient_bed_occupied_7_day_avg => ByRow(find_censored) => :total_occupancy,

		:total_staffed_adult_icu_beds_7_day_avg => ByRow(find_censored) => :icu_beds,
		:staffed_adult_icu_bed_occupancy_7_day_avg => ByRow(find_censored) => :icu_occupancy,
	)
	sort!(data_weekly, [:hospital, :hospital_id, :date])

	function latest_val(xs)
		xs = filter(x -> !ismissing(x), xs)
		z = length(xs) == 0 ? missing : xs[end]
		z = coalesce(z, 0)
		return z
	end

	data_latest = combine(groupby(data_weekly, [:hospital, :hospital_id]), [
		:total_beds => latest_val => :total_beds,
		:total_occupancy => latest_val => :total_occupancy,
		:icu_beds => latest_val => :icu_beds,
		:icu_occupancy => latest_val => :icu_occupancy,
	])

	compute_load(a,b) = (a==0) ? 0.0 : (b==0) ? 1.0 : a/b

	insertcols!(data_latest, 5, :total_load => compute_load.(data_latest.total_occupancy, data_latest.total_beds))
	insertcols!(data_latest, 8, :icu_load => compute_load.(data_latest.icu_occupancy, data_latest.icu_beds))

	metadata = DataFrame(CSV.File(joinpath(@__DIR__, "../data/hhs_hospital_meta.csv")))

	hospital_locations_data = DataFrame(CSV.File(joinpath(@__DIR__, "../data/hhs_hospital_locations.csv")))
	select!(hospital_locations_data, :hospital_id, :lat, :long)

	data_combined_all = leftjoin(data_latest, metadata, on=:hospital_id, makeunique=true)
	data_combined_all = leftjoin(data_combined_all, hospital_locations_data, on=:hospital_id)

	data_combined_all.lat = coalesce.(data_combined_all.lat, 0.0)
	data_combined_all.long = coalesce.(data_combined_all.long, 0.0)

	data_combined = select(data_combined_all,
		:hospitalname => :hospital,
		:hospital => :hhsname,
		:hospital_id,
		:lat,
		:long,
		:total_beds,
		:total_occupancy,
		:total_load,
		:icu_beds,
		:icu_occupancy,
		:icu_load,
	)

	data_combined |> CSV.write(joinpath(@__DIR__, "../data/hhs_current_load.csv"))

	data_combined_list = collect([NamedTuple(h) for h in eachrow(data_combined)])

	serialize(joinpath(@__DIR__, "../data/hhs_current_load.jlser"), data_combined_list)

	return
end

function package_covid_load_data()
	rawdata_fn = latest_hhs_rawdata_fn()
	rawdata = DataFrame(CSV.File(rawdata_fn))

	bad_ids = begin
		id_counts = combine(groupby(rawdata, :hospital_pk), :hospital_name => (x -> length(unique(x))) => :n_names)
		filter!(x -> x.n_names > 1, id_counts)
		unique(id_counts.hospital_pk)
	end
	filter!(row -> !(row.hospital_pk in bad_ids), rawdata)

	find_censored(x) = (ismissing(x) || x == -999999) ? missing : x

	data_weekly = select(rawdata,
		:hospital_name => :hospital,
		:hospital_pk => :hospital_id,
		:collection_week => ByRow(d -> Date(d, "yyyy/mm/dd")) => :date,

		:total_adult_patients_hospitalized_confirmed_covid_7_day_avg => ByRow(find_censored) => :total_occupancy,
		:staffed_icu_adult_patients_confirmed_covid_7_day_avg => ByRow(find_censored) => :icu_occupancy,
	)
	sort!(data_weekly, [:hospital, :hospital_id, :date])

	function latest_val(xs)
		xs = filter(x -> !ismissing(x), xs)
		z = length(xs) == 0 ? missing : xs[end]
		z = coalesce(z, 0)
		return z
	end

	data_latest = combine(groupby(data_weekly, [:hospital, :hospital_id]), [
		:total_occupancy => latest_val => :total_occupancy,
		:icu_occupancy => latest_val => :icu_occupancy,
	])

	capacity_rawdata = DataFrame(CSV.File(joinpath(@__DIR__, "../data/capacity_covid.csv")))
	capacity_data = select(capacity_rawdata,
		:hospital_id,
		:capacity_covid => :total_beds,
		:capacity_covid_icu => :icu_beds,
		[:capacity_covid, :capacity_covid_icu] => ((a,b) -> a - b) => :acute_beds,
	)

	data_latest = rightjoin(data_latest, capacity_data, on=:hospital_id)

	compute_load(a,b) = (a==0) ? 0.0 : (b==0) ? 1.0 : a/b

	insertcols!(data_latest, 5, :total_load => compute_load.(data_latest.total_occupancy, data_latest.total_beds))
	insertcols!(data_latest, 8, :icu_load => compute_load.(data_latest.icu_occupancy, data_latest.icu_beds))

	metadata = DataFrame(CSV.File(joinpath(@__DIR__, "../data/hhs_hospital_meta.csv")))

	hospital_locations_data = DataFrame(CSV.File(joinpath(@__DIR__, "../data/hhs_hospital_locations.csv")))
	select!(hospital_locations_data, :hospital_id, :lat, :long)

	data_combined_all = leftjoin(data_latest, metadata, on=:hospital_id, makeunique=true)
	data_combined_all = leftjoin(data_combined_all, hospital_locations_data, on=:hospital_id)

	data_combined_all.lat = coalesce.(data_combined_all.lat, 0.0)
	data_combined_all.long = coalesce.(data_combined_all.long, 0.0)

	data_combined = select(data_combined_all,
		:hospitalname => :hospital,
		:hospital => :hhsname,
		:hospital_id,
		:lat, :long,
		:state, :state_abbrev, :city,
		:county_fips, :county_name,
		:system_id, :system_name,
		:hsa_id, :hsa_name,
		:hrr_id, :hrr_name,
		:total_beds,
		:total_occupancy,
		:total_load,
		:icu_beds,
		:icu_occupancy,
		:icu_load,
		:acute_beds,
	)
	sort!(data_combined, [:hospital, :hospital_id])
	data_combined |> CSV.write(joinpath(@__DIR__, "../data/hhs_current_load_covid.csv"))

	data_combined_list = collect([NamedTuple(h) for h in eachrow(data_combined)])
	serialize(joinpath(@__DIR__, "../data/hhs_current_load_covid.jlser"), data_combined_list)

	return
end

if abspath(PROGRAM_FILE) == @__FILE__
	package_main_data()
	package_load_data()
	package_covid_load_data()
end
