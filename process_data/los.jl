using CSV
using DataFrames
using Distributions
using Dates
using BlackBoxOptim
using LinearAlgebra: norm

include("util.jl")


#######################
#### Estimate LOS #####
#######################

function estimate_los()
	rawdata = DataFrame(CSV.File("../data/hospitalization_data.csv"))

	function estimate_los_single(data; time_limit=1.0)
	
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
			MaxTime = time_limit,
			RandomizeRngSeed = false,
			RngSeed = 0,
		)
	
		best_params = best_candidate(r)
		los_dist = unpack_params(best_params)
	
		return los_dist
	end

	function extract_data_total(bedtype)
		hospital_ids = sort(unique(rawdata.hospital_id))
		date_range = sort(unique(rawdata.date))
		
		data_dict = Dict((row.hospital_id, row.date) => (
				active = row["active_$(bedtype)"],
				admissions = row["admissions_$(bedtype )"],
			)
			for row in eachrow(rawdata)
		)
		
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

	bedtypes = [:icu, :acute, :allbeds]

	data_total = Dict()
	for bedtype in bedtypes
		data_total[bedtype] = extract_data_total(bedtype)
	end

	los_dist_est = Dict()
	for bedtype in bedtypes
		d = data_total[bedtype]
		dist = estimate_los_single(d)
		los_dist_est[bedtype] = dist
	end

	serialize("../data/hhs_los_est.jlser", los_dist_est)

	return
end
