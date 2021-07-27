using Dates
using JSON
using Serialization

push!(LOAD_PATH, normpath(@__DIR__, "..", "src"))
push!(LOAD_PATH, normpath(@__DIR__, "..", "lib"))
include("../src/EndpointHandler.jl")


STARTDATE = Date(2021, 02, 14)
ENDDATE   = Date(2021, 03, 06)

REGIONTYPE = :state
SKIPREGIONS = []

params_list = [
	(scenario=:moderate, patient_type=:icu),
	(scenario=:moderate, patient_type=:acute),
]
default_params = (
	objective = :minoverflow,
	constrain_integer = false,
	transfer_budget = Inf,
	totaltransferbudget = Inf,
	capacity_util = 1.0,
	covid_capacity_proportion = (b -> b == :icu ? 0.5 : 0.4),
	dist_threshold = 600.0,
	uncertainty_level = :default,
	los_param = "default_dist",
	end_date = ENDDATE,
	smoothness = false,
	max_hospitals = 250,
	solver = :auto,
	threads = Sys.CPU_THREADS-1,
)
results_path = "../public/results-static/"
VERBOSE = true

REGIONS = deserialize("../data/regions_hhs.jlser")
filter!(r -> r.region_type == REGIONTYPE, REGIONS)
filter!(r -> !(r.region_id in SKIPREGIONS), REGIONS)


function precompute_result(params)
	if VERBOSE
		println("==================================")
		println("Precomputing results for:")
		println("region: $(params.region), start date: $(params.start_date), scenario: $(params.scenario), patient type: $(params.patient_type)")
	end

	hospitals = EndpointHandler.hospitals_list(region=params.region)
	n_hospitals = min(length(hospitals), default_params.max_hospitals)
	hospital_inds = sortperm(hospitals, rev=true, by=(h -> h[:total_beds]))[1:n_hospitals]
	hospital_ids = [hospitals[i][:hospital_id] for i in sort(hospital_inds)]
	println("Number of hospitals: $(n_hospitals)")

	result = EndpointHandler.handle_patients_request(
		params.region,
		hospital_ids,
		params.scenario,
		params.patient_type,

		default_params.objective,
		default_params.constrain_integer,
		default_params.transfer_budget,
		default_params.totaltransferbudget,
		default_params.capacity_util,
		default_params.covid_capacity_proportion(params.patient_type),
		default_params.dist_threshold,
		default_params.uncertainty_level,
		default_params.los_param,

		params.start_date,
		default_params.end_date,

		smoothness=default_params.smoothness,

		solver=default_params.solver,
		threads=default_params.threads,
		verbose=VERBOSE,
	)

	d = replace(string(params.start_date), "-" => "")
	fn = joinpath(results_path, "latest_$(params.scenario)_$(params.patient_type)_$(params.region.region_type)_$(params.region.region_id).json")
	write(fn, JSON.json(result))

	if VERBOSE
		println("Done. Saved to: $(fn)")
		println("==================================")
	end

	return
end

if abspath(PROGRAM_FILE) == @__FILE__
	if !isdir(results_path)
		mkpath(results_path)
	end
	println("Precomputing results!")
	for params_ in params_list, region in REGIONS
		params = merge(params_, (;start_date = STARTDATE, region = region))
		try
			precompute_result(params)
		catch e
			println("Error with: $(params)\nError: $(e)")
			throw(e)
		end
	end
end
