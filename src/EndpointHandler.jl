module EndpointHandler

using Genie

using Dates
using JuMP
using DataFrames
using LinearAlgebra

using DataLoader
using PatientAllocation
using HospitalSelection
using RegionSelection
using StatusReport
import PatientAllocationResults

export handle_patients_request
export get_hospital_list
export get_regions_list
export get_hospital_data
export handle_hospital_selection
export complete_region
export handle_region_selection
export handle_status_report


function handle_patients_request(
		region::NamedTuple,
		location_ids::Array{String,1},
		scenario::Symbol,
		patient_type::Symbol,
		objective::Symbol,
		constrain_integer::Bool,
		transfer_budget::Float64,
		total_transfer_budget::Float64,
		capacity_util::Float64,
		covid_capacity_estimate::Union{String,Float64},
		dist_threshold::Float64,
		dist_cost::Float64,
		uncertainty_level::Symbol,
		los_param::String,

		start_date::Date,
		end_date::Date;

		smoothness::Bool=true,
		solver::Symbol=:default,
		threads::Int=-1,
		verbose::Bool=false,
	)
	@info "Handle redistribution request for region: $(region.region_name), dates: $(start_date) to $(end_date)"

	@assert patient_type in [:acute, :icu, :combined, :combined_ped]

	data = load_hhs(region, location_ids, scenario, patient_type, start_date, end_date, covid_capacity_estimate, dist_threshold)
	default_capacity_level = 1

	if los_param == "default_dist"
		los_dist = los_dist_default(patient_type)
	elseif los_param == "regional_dist"
		los_dist = los_dist_regional(region, patient_type)
	elseif !isnothing(tryparse(Int, los_param))
		los_dist = tryparse(Int, los_param)
	else
		error("Invalid los distribution selection: $(los_param)")
	end

	N, C = size(data.capacity)

	transfer_budget = fill(transfer_budget, N)

	cost_matrix = data.dist_matrix
	m1, m2 = extrema(cost_matrix)
	z = dist_cost / (m2 - m1)
	map!(x -> (x - m1) * z, cost_matrix, cost_matrix)

	s = smoothness ? 1 : 0

	model = patient_redistribution(
		data.capacity,
		data.initial,
		data.discharged,
		data.admitted,
		los_dist,
		obj=objective,
		adj_matrix=data.adj,
		cost_matrix=cost_matrix,
		sent_penalty=0.01,
		smoothness_penalty=0.001*s,
		active_smoothness_penalty=0.01*s,
		admitted_smoothness_penalty=0.25*s,
		capacity_cushion=(1.0-capacity_util),
		transfer_budget=transfer_budget,
		total_transfer_budget=total_transfer_budget,
		constrain_integer=constrain_integer,
		solver=solver,
		threads=threads,
		verbose=verbose,
	)
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
			covid_capacity_estimate,
			dist_threshold,
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

function get_hospital_list(;region=nothing, names=nothing, ids=nothing)
	hospitals = hospitals_list(region=region, names=names, ids=ids)
	return hospitals
end

function get_regions_list(region_type::Symbol=:any)
	regions = regions_list(region_type)
	return regions
end

function get_hospital_data(hospital_id, patient_type, bed_type)
	data = load_hhs_raw(
		hospital_id,
		:moderate,
		patient_type,
		bed_type,
	)
	return data
end

function handle_hospital_selection(loc)
	scores = score_hospitals(loc)
	return scores
end

function handle_region_selection(region_type, patient_type, metric_type, start_date, end_date)
	regions_selection(region_type, patient_type, metric_type, start_date, end_date)
end

function handle_region_selection(region_type, patient_type, metric_type, date)
	regions_selection(region_type, patient_type, metric_type, date)
end

function handle_status_report()
	status_report_metrics()
end

end;
