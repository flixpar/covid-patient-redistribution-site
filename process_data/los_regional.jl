using CSV
using Dates
using DataFrames
using Serialization

using Distributions
using LinearAlgebra: norm
using BlackBoxOptim

using Base.Threads
using ProgressMeter

include("util.jl")


function estimate_los_regional()
	rawdata = DataFrame(CSV.File("../data/hospitalization_data.csv"))
	metadata = DataFrame(CSV.File("../data/hhs_hospital_meta.csv"))
	regions = deserialize("../data/regions_hhs.jlser")
	push!(regions, (region_type = :country, region_name = "United States", region_id = "US"))

	end_date = maximum(rawdata.date)
	start_date = end_date - Month(6)
	filter!(r -> start_date <= r.date <= end_date, rawdata)

	function filter_hospitals(region)
		if region.region_type == :country
			return sort(filter(x -> !ismissing(x), unique(metadata.hospital_id)))
		end

		col_lookup = Dict(
			:state => :state_abbrev,
			:hospital_system => :system_id,
			:hrr => :hrr_id,
			:hsa => :hsa_id,
		)
		col = col_lookup[region.region_type]

		region_id = (region.region_type in [:hrr, :hsa]) ? parse(Int, region.region_id) : region.region_id

		hospitals_meta = filter(h -> !ismissing(h[col]) && (h[col] == region_id), metadata)
		hospital_ids = sort(unique(hospitals_meta.hospital_id))

		return hospital_ids
	end

	function extract_data_total(region, bedtype)
		hospital_ids = filter_hospitals(region)
		if length(hospital_ids) == 0
			return nothing
		end
		_rawdata = filter(row -> !ismissing(row.hospital_id) && row.hospital_id in hospital_ids, rawdata)

		data_dict = Dict((row.hospital_id, row.date) => (
				active = row["active_$(bedtype)"],
				admissions = row["admissions_$(bedtype )"],
			)
			for row in eachrow(_rawdata)
		)

		date_range = sort(unique(_rawdata.date))

		admissions = [haskey(data_dict, (h,d)) ? data_dict[(h,d)].admissions : missing for h in hospital_ids, d in date_range]
		active = [haskey(data_dict, (h,d)) ? data_dict[(h,d)].active : missing for h in hospital_ids, d in date_range]

		admissions = interpolate_missing(admissions)
		active = interpolate_missing(active)

		admissions_total = sum(admissions, dims=1)[:]
		active_total = sum(active, dims=1)[:]

		return (
			N = 1,
			T = length(date_range),
			date_range = date_range,
			start_date = minimum(date_range),
			end_date = maximum(date_range),
			admitted = admissions_total,
			active = active_total,
			initial = active_total[1],
		)
	end

	function estimate_los_single(data; timelimit=1.0)

		function unpack_params(params)
			alpha, theta = params
			dist = Gamma(alpha, theta)
			return dist
		end

		function score_func(params)
			los_dist = unpack_params(params)
			active = estimate_active(data.initial, data.admitted, los_dist)
			score = norm(active - data.active, 2)
			return score
		end

		param_bounds = [(0.0,40.0), (0.0,40.0)]

		r = bboptimize(
			score_func,
			SearchRange = param_bounds,
			Method = :adaptive_de_rand_1_bin_radiuslimited,
			TraceMode = :silent,
			MaxTime = timelimit,
			RandomizeRngSeed = false,
			RngSeed = 0,
		)

		best_params = best_candidate(r)
		los_dist = unpack_params(best_params)

		return los_dist
	end

	bedtypes = [:icu, :acute, :combined, :combined_ped]
	params = collect(Iterators.product(bedtypes, regions))[:]

	p = Progress(length(params))

	results_lock = ReentrantLock()
	io_lock = ReentrantLock()

	los_dist_est = Dict()
	@threads for (bedtype, region) in params
		try
			d = extract_data_total(region, bedtype)
			if isnothing(d) continue end

			dist = estimate_los_single(d, timelimit=1.0)

			lock(results_lock) do
				los_dist_est[region.region_type, region.region_id, bedtype] = dist
			end
		catch
			lock(io_lock) do
				println("Error at: ($(bedtype), $(region))")
				flush(stdout)
			end
		end
		next!(p)
	end

	serialize("../data/regional_los_est.jlser", los_dist_est)

	return
end

if abspath(PROGRAM_FILE) == @__FILE__
	estimate_los_regional()
end
