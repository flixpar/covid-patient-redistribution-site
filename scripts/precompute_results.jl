using Dates
using JSON

push!(LOAD_PATH, normpath(@__DIR__, "..", "src"));
push!(LOAD_PATH, normpath(@__DIR__, "..", "lib"));
include("../src/EndpointHandler.jl")


REGIONS = [
	(region_name = "MD", region_type = "state"),
	(region_name = "CT", region_type = "state"),
	(region_name = "MA", region_type = "state"),
	(region_name = "ME", region_type = "state"),
	(region_name = "VA", region_type = "state"),
]

params_date_range = today():Day(1):(today()+Day(2))
params_list = [
	(scenario=:moderate, patient_type=:icu),
	(scenario=:moderate, patient_type=:acute),
]
default_params = (
	objective = :minoverflow,
	constrain_integer = false,
	transfer_budget = Inf,
	capacity_util = 1.0,
	uncertainty_level = :default,
	los_param = "default_dist",
	end_date = Date(2021, 01, 09),
	smoothness = false,
)
results_path = "../public/results-static/"
VERBOSE = true


function precompute_result(params)
	if VERBOSE
		println("==================================")
		println("Precomputing results for:")
		println("start date: $(params.start_date), scenario: $(params.scenario), patient type: $(params.patient_type)")
	end

	hospitals_meta = EndpointHandler.get_hospital_list(region=params.region)
	hospitals = [h["name"] for h in hospitals_meta]

	result = EndpointHandler.handle_patients_request(
		hospitals,
		params.scenario,
		params.patient_type,

		default_params.objective,
		default_params.constrain_integer,
		default_params.transfer_budget,
		default_params.capacity_util,
		default_params.uncertainty_level,
		default_params.los_param,

		params.start_date,
		default_params.end_date,

		verbose=VERBOSE,
		smoothness=default_params.smoothness,
	)

	d = replace(string(params.start_date), "-" => "")
	fn = joinpath(results_path, "$(d)_$(params.scenario)_$(params.patient_type).json")
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
	for start_date in params_date_range, params_ in params_list, region in REGIONS
		params = merge(params_, (;start_date, region))
		precompute_result(params)
	end
end
