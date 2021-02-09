module EndpointHandler

using Genie

using Dates
using JuMP
using DataFrames
using LinearAlgebra

using DataLoader
using PatientAllocation
using HospitalSelection
import PatientAllocationResults

export handle_patients_request
export get_hospital_list
export get_regions_list
export handle_hospital_selection
export complete_region


function handle_patients_request(
		region::NamedTuple,
		location_ids::Array{String,1},
		scenario::Symbol,
		patient_type::Symbol,
		objective::Symbol,
		constrain_integer::Bool,
		transfer_budget::Float64,
		capacity_util::Float64,
		uncertainty_level::Symbol,
		los_param::String,

		start_date::Date,
		end_date::Date;

		smoothness::Bool=true,
		solver::Symbol=:default,
		threads::Int=-1,
		verbose::Bool=false,
	)
	@info "Handle Patients Request"
	@info "Scenario: $(scenario), Patient type: $(patient_type)"

	@assert patient_type in [:acute, :icu, :all]

	data = load_data(region, location_ids, scenario, patient_type, start_date, end_date)
	default_capacity_level = 1

	if los_param == "default_dist"
		los_dist = los_dist_default(patient_type)
	elseif !isnothing(tryparse(Int, los_param))
		los_dist = tryparse(Int, los_param)
	else
		error("Invalid los distribution selection: $(los_param)")
	end

	N, C = size(data.capacity)

	transfer_budget = fill(transfer_budget, N)

	s = smoothness ? 1 : 0

	if objective == :minoverflow
		model = patient_redistribution(
			data.capacity,
			data.initial,
			data.discharged,
			data.admitted,
			data.adj,
			los_dist,
			sent_penalty=0.01,
			smoothness_penalty=0.001*s,
			active_smoothness_penalty=0.01*s,
			admitted_smoothness_penalty=0.25*s,
			capacity_cushion=(1.0-capacity_util),
			transfer_budget=transfer_budget,
			constrain_integer=constrain_integer,
			solver=solver,
			threads=threads,
			verbose=verbose,
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
			smoothness_penalty=0.001*s,
			active_smoothness_penalty=0.01*s,
			admitted_smoothness_penalty=0.25*s,
			capacity_cushion=(1.0-capacity_util),
			constrain_integer=constrain_integer,
			verbose=verbose,
		)
	elseif objective == :hybrid
		capacity_weights = ones(Int, C)
		capacity_weights[end] = 4
		overflowmin_weight = 0.5
		loadbalance_weight = 2.0

		model = patient_hybridmodel(
			data.capacity,
			data.initial,
			data.discharged,
			data.admitted,
			data.adj,
			los_dist,
			overflowmin_weight=overflowmin_weight,
			loadbalance_weight=loadbalance_weight,
			sent_penalty=5.0,
			smoothness_penalty=0,
			active_smoothness_penalty=0.01*s,
			admitted_smoothness_penalty=0.25*s,
			capacity_cushion=(1.0-capacity_util),
			capacity_weights=capacity_weights,
			transfer_budget=transfer_budget,
			constrain_integer=constrain_integer,
			verbose=verbose,
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

	nodes_meta = hospitals_list(region=region, ids=data.node_ids)

	config = Dict(
		:start_date => start_date,
		:end_date   => end_date,
		:dates      => collect(start_date : Day(1) : end_date),
		:node_names => data.node_names,
		:node_names_abbrev => data.node_names_abbrev,
		:node_locations    => data.node_locations,
		:nodes_meta => nodes_meta,
		:capacity_names => data.capacity_names,
		:node_type => "hospital",
		:region    => region,
		:extent    => data.extent,
		:default_capacity_level => default_capacity_level,
		:params => (;
			scenario,
			bedtype = patient_type,
			objective,
			constrain_integer,
			capacity_util,
			uncertainty_level,
			los_param,
		),
	)

	outcomes = Dict(
		:summary => results.summary_table,
		:full_results => results.complete_table,
		:sent => permutedims(sent, (3,2,1)),
		:beds => data.beds,
		:capacity => permutedims(data.capacity, (2,1)),
		:active => permutedims(results.active_patients, (2,1)),
		:active_null => permutedims(results.active_patients_nosent, (2,1)),
		:admitted => permutedims(data.admitted, (2,1)),
		:total_patients => sum(data.initial) + sum(data.admitted),
		:config => config,
	)
	return outcomes
end

function get_hospital_list(;region=nothing, names=nothing, ids=nothing, ndefault=nothing)
	hospitals = hospitals_list(region=region, names=names, ids=ids, ndefault=ndefault)
	return hospitals
end

function get_regions_list(region_type::Symbol=:any)
	regions = regions_list(region_type)
	return regions
end

function handle_hospital_selection(loc)
	scores = score_hospitals(loc)
	return scores
end

end;
