using Dates

push!(LOAD_PATH, normpath(@__DIR__, "..", "src"));
push!(LOAD_PATH, normpath(@__DIR__, "..", "lib"));
include("../src/EndpointHandler.jl")

params_date_range = today():Day(1):(today()+Day(2))
params_list = [
	(scenario=:moderate,    patient_type=:icu),
	(scenario=:pessimistic, patient_type=:icu),
	(scenario=:optimistic,  patient_type=:icu),
	(scenario=:moderate,    patient_type=:acute),
	(scenario=:pessimistic, patient_type=:acute),
	(scenario=:optimistic,  patient_type=:acute),
]
default_params = (
	objective = :minoverflow,
	constrain_integer = false,
	transfer_budget = Inf,
	capacity_util = 1.0,
	uncertainty_level = :default,
	los_param = "default_dist",
	period_length = Month(2),
)
results_path = "../public/results-static/"
VERBOSE = true


function precompute_result(params)
	if VERBOSE
		println("==================================")
		println("Precomputing results for:")
		println("start date: $(params.start_date), scenario: $(params.scenario), patient type: $(params.patient_type)")
	end

	result = EndpointHandler.handle_patients_request(
		params.scenario,
		params.patient_type,

		default_params.objective,
		default_params.constrain_integer,
		default_params.transfer_budget,
		default_params.capacity_util,
		default_params.uncertainty_level,
		default_params.los_param,

		params.start_date,
		params.start_date + default_params.period_length,

		verbose=VERBOSE,
	)

	d = replace(string(params.start_date), "-" => "")
	fn = joinpath(results_path, "$(d)_$(params.scenario)_$(params.patient_type).json")
	write(fn, result)

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
	for start_date in params_date_range, params_ in params_list
		params = merge(params_, (start_date=start_date,))
		precompute_result(params)
	end
end
