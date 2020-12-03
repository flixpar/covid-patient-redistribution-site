module EndpointHandler

using Genie
using Genie.Renderer.Json

using Dates
using JuMP
using DataFrames
using LinearAlgebra

using DataLoader
using PatientAllocation
import PatientAllocationResults

export handle_patients_request


function handle_patients_request(
		scenario::Symbol,
		patient_type::Symbol,
		objective::Symbol,
		constrain_integer::Bool,
		transfer_budget_dict::Dict{String,Any},
		surge_preferences_dict::Dict{String,Any},
		capacity_util::Float64,
		uncertainty_level::Symbol,
		los_param::String,

		start_date::Date,
		end_date::Date,
	)
	@info "Handle Patients Request"
	@info "Scenario: $(scenario), Patient type: $(patient_type)"

	@assert patient_type in [:ward, :icu, :all]

	data = load_jhhs(scenario, patient_type, start_date, end_date)
	default_capacity_level = 4

	if los_param == "default_dist"
		los_dist = los_dist_default(patient_type)
	elseif !isnothing(tryparse(Int, los_param))
		los_dist = tryparse(Int, los_param)
	else
		error("Invalid los distribution selection: $(los_param)")
	end

	transfer_budget = [parse(Int, transfer_budget_dict[lowercase(k)]) for k in data.node_names]
	surge_preferences = [parse(Float64, surge_preferences_dict[lowercase(k)]) for k in data.node_names]

	N, C = size(data.capacity)

	if objective == :minoverflow
		objective_weights = ones(Float64, N, C)
		objective_weights[:,end] = 1.0 .- (0.003 * surge_preferences)

		model = patient_redistribution(
			data.capacity,
			data.initial,
			data.discharged,
			data.admitted,
			data.adj,
			los_dist,
			sent_penalty=0.01,
			smoothness_penalty=0.001,
			active_smoothness_penalty=0.01,
			admitted_smoothness_penalty=0.1,
			capacity_cushion=(1.0-capacity_util),
			objective_weights=objective_weights,
			transfer_budget=transfer_budget,
			constrain_integer=constrain_integer,
			verbose=false,
		)
	elseif objective == :loadbalance
		model = patient_loadbalance(
			data.capacity[:,default_capacity_level],
			data.initial,
			data.discharged,
			data.admitted,
			data.adj,
			los_dist,
			sent_penalty=0.01,
			smoothness_penalty=0.001,
			active_smoothness_penalty=0.01,
			admitted_smoothness_penalty=0.1,
			capacity_cushion=(1.0-capacity_util),
			constrain_integer=constrain_integer,
			verbose=false,
		)
	elseif objective == :hybrid
		objective_weights = ones(Float64, N, C)
		objective_weights[:,end] = 1.0 .- (0.003 * surge_preferences)
		capacity_weights = ones(Int, C)
		capacity_weights[end] = 4
		overflowmin_weight = 1.0
		loadbalance_weight = 0.25

		model = patient_hybridmodel(
			data.capacity,
			data.initial,
			data.discharged,
			data.admitted,
			data.adj,
			los_dist,
			overflowmin_weight=overflowmin_weight,
			loadbalance_weight=loadbalance_weight,
			sent_penalty=0.01,
			smoothness_penalty=0.001,
			active_smoothness_penalty=0.01,
			admitted_smoothness_penalty=0.1,
			capacity_cushion=(1.0-capacity_util),
			objective_weights=objective_weights,
			capacity_weights=capacity_weights,
			transfer_budget=transfer_budget,
			constrain_integer=constrain_integer,
			verbose=false,
		)
	else
		error("Invalid objective: $(objective)")
	end
	sent = value.(model[:sent])

	results = PatientAllocationResults.results_all(
		sent,
		data.capacity[:,default_capacity_level],
		data.initial,
		data.discharged,
		data.admitted,
		data.node_names,
		start_date,
		los_dist,
		use_rounding=false,
	)

	config = Dict(
		:start_date => start_date,
		:end_date   => end_date,
		:dates      => collect(start_date : Day(1) : end_date),
		:node_names => data.node_names,
		:node_names_abbrev => data.node_names_abbrev,
		:node_locations    => data.node_locations,
		:capacity_names => data.capacity_names,
		:node_type => "hospital",
		:region    => "jhhs",
		:extent    => data.extent,
		:capacity_util => capacity_util,
		:default_capacity_level => default_capacity_level,
	)

	outcomes = Dict(
		:summary => results.summary_table,
		:full_results => results.complete_table,
		:sent_matrix => results.sent_matrix_table,
		:net_sent => results.netsent,
		:sent => permutedims(sent, (3,2,1)),
		:beds => data.beds,
		:capacity => permutedims(data.capacity, (2,1)),
		:active => permutedims(results.active_patients, (2,1)),
		:active_null => permutedims(results.active_patients_nosent, (2,1)),
		:admitted => permutedims(data.admitted, (2,1)),
		:total_patients => sum(data.initial) + sum(data.admitted),
		:config => config,
	)
	return json(outcomes)
end

end;
