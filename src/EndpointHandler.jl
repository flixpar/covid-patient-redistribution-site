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
		start_date::Date,
		end_date::Date,
		bed_avail::Real,
		max_travel::Real,
		patient_type::Symbol,
		los::String,
)
	@info "Handle Patients Request"

	@assert patient_type in [:regular, :icu, :all]

	data = load_jhhs(start_date, end_date, patient_type, bed_avail, max_travel)

	model = patient_allocation(
		data.beds,
		data.initial,
		data.discharged,
		data.admitted,
		data.adj,
		los=11,
		sent_penalty=0.01,
		smoothness_penalty=0.01,
		no_artificial_overflow=true,
		no_worse_overflow=true,
		bed_mult=0.95,
		verbose=false
	)
	sent = value.(model[:sent])

	results = PatientAllocationResults.results_all(
		sent,
		data.beds,
		data.initial,
		data.discharged,
		data.admitted,
		data.node_names,
		start_date,
		11,
	)

	config = Dict(
		:start_date => start_date,
		:end_date   => end_date,
		:dates      => collect(start_date : Day(1) : end_date),
		:node_names => data.node_names,
		:node_names_abbrev => data.node_names_abbrev,
		:node_locations    => data.node_locations,
		:pct_beds_available     => bed_avail,
		:travel_threshold_hours => max_travel,
		:node_type => string(alloc_level),
		:region    => region,
		:subregion => subregion,
		:extent    => data.extent,
	)

	outcomes = Dict(
		:summary => results.summary_table,
		:full_results => results.complete_table,
		:sent_matrix => results.sent_matrix_table,
		:net_sent => results.netsent,
		:sent => permutedims(sent, (3,2,1)),
		:beds => data.beds,
		:active => permutedims(results.active_patients, (2,1)),
		:active_null => permutedims(results.active_patients_nosent, (2,1)),
		:total_patients => sum(data.initial) + sum(data.admitted),
		:config => config,
	)
	return json(outcomes)
end

end;
