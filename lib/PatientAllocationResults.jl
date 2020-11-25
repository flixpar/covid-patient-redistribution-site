module PatientAllocationResults

using DataFrames
using LinearAlgebra
using Dates
using Distributions


function results_all(
		sent::Array{<:Real,3},
		beds::Array{<:Real,1},
		initial_patients::Array{<:Real,1},
		discharged_patients::Array{<:Real,2},
		admitted_patients::Array{<:Real,2},
		locations::Array{String,1},
		start_date::Date,
		los;
		use_rounding::Bool=true,
)
	N, _, T = size(sent)

	if use_rounding && !isa(beds[1], Int)
		beds = round.(Int, beds, RoundUp)
	end

	summary = results_summary(sent, beds, initial_patients, discharged_patients, admitted_patients, locations, start_date, los)
	complete = results_complete(sent, beds, initial_patients, discharged_patients, admitted_patients, locations, start_date, los)

	sent_matrix_table = results_sentmatrix_table(sent, locations)
	sent_matrix_vis = results_sentmatrix_vis(sent, initial_patients, admitted_patients, locations)
	netsent = results_netsent(sent, start_date)

	sent_to = Dict(locations[i] => locations[row] for (i,row) in enumerate(eachrow(sum(sent, dims=3)[:,:,1] .> 0)))

	active, active_null = results_active_patients(sent, initial_patients, discharged_patients, admitted_patients, los)

	overflow = [max(0, active[i,t] - beds[i]) for i in 1:N, t in 1:T]
	load = [active[i,t] / beds[i] for i in 1:N, t in 1:T]

	overflow_null = [max(0, active_null[i,t] - beds[i]) for i in 1:N, t in 1:T]
	load_null = [active_null[i,t] / beds[i] for i in 1:N, t in 1:T]

	return (
		summary_table=summary,
		complete_table=complete,
		sent_matrix_table=sent_matrix_table,
		sent_matrix_vis=sent_matrix_vis,
		netsent=netsent,
		sent_to=sent_to,
		active_patients=active,
		overflow=overflow,
		load=load,
		active_patients_nosent=active_null,
		overflow_nosent=overflow_null,
		load_nosent=load_null,
	)
end

function results_summary(
		sent::Array{<:Real,3},
		beds::Array{<:Real,1},
		initial_patients::Array{<:Real,1},
		discharged_patients::Array{<:Real,2},
		admitted_patients::Array{<:Real,2},
		locations::Array{String,1},
		start_date::Date,
		los,
)
	N, _, T = size(sent)

	active, active_null = results_active_patients(sent, initial_patients, discharged_patients, admitted_patients, los)

	overflow = [sum(max(0, active[i,t] - beds[i]) for t in 1:T) for i in 1:N]
	load = [sum(active[i,t] / beds[i] for t in 1:T)/T for i in 1:N]

	overflow_null = [sum(max(0, active_null[i,t] - beds[i]) for t in 1:T) for i in 1:N]
	load_null = [sum(active_null[i,t] / beds[i] for t in 1:T)/T for i in 1:N]

	summary = DataFrame(
		location=locations,
		total_sent=sum(sent, dims=[2,3])[:],
		total_received=sum(sent, dims=[1,3])[:],
		overflow=overflow,
		overall_load=load,
		overflow_nosent=overflow_null,
		overall_load_nosent=load_null,
	)

	return summary
end

function results_complete(
		sent::Array{<:Real,3},
		beds::Array{<:Real,1},
		initial_patients::Array{<:Real,1},
		discharged_patients::Array{<:Real,2},
		admitted_patients::Array{<:Real,2},
		locations::Array{String,1},
		start_date::Date,
		los,
)
	N, _, T = size(sent)

	active_patients, active_patients_null = results_active_patients(sent, initial_patients, discharged_patients, admitted_patients, los)

	overflow = [max(0, active_patients[i,t] - beds[i]) for i in 1:N, t in 1:T]
	load = [(active_patients[i,t] / beds[i]) for i in 1:N, t in 1:T]

	overflow_null = [max(0, active_patients_null[i,t] - beds[i]) for i in 1:N, t in 1:T]
	load_null = [(active_patients_null[i,t] / beds[i]) for i in 1:N, t in 1:T]

	outcomes = DataFrame()
	for (i,s) in enumerate(locations)
		single_state_outcome = DataFrame(
			location=fill(s, T),
			date=start_date .+ Day.(0:T-1),
			sent=sum(sent[i,:,:], dims=1)[:],
			received=sum(sent[:,i,:], dims=1)[:],
			new_patients=admitted_patients[i,:],
			active_patients=active_patients[i,:],
			active_patients_nosent=active_patients_null[i,:],
			capacity=fill(beds[i], T),
			overflow=overflow[i,:],
			load=load[i,:],
			overflow_nosent=overflow_null[i,:],
			load_nosent=load_null[i,:],
			# sent_to=[sum(sent[i,:,t])>0 ? collect(zip(locations[sent[i,:,t] .> 0], sent[i,sent[i,:,t].>0,t])) : "[]" for t in 1:T],
			# sent_from=[sum(sent[:,i,t])>0 ? collect(zip(locations[sent[:,i,t] .> 0], sent[sent[:,i,t].>0,i,t])) : "[]" for t in 1:T],
		)
		outcomes = vcat(outcomes, single_state_outcome)
	end

	return outcomes
end

function results_sentmatrix_table(sent::Array{<:Real,3}, locations::Array{String,1})
	sent_matrix = DataFrame(sum(sent, dims=3)[:,:,1])
	rename!(sent_matrix, Symbol.(locations))
	# insertcols!(sent_matrix, 1, :state => locations)
	return sent_matrix
end

function results_sentmatrix_vis(sent::Array{<:Real,3}, initial_patients::Array{<:Real,1},
		admitted_patients::Array{<:Real,2}, locations::Array{String,1})
	selfedges = initial_patients + sum(admitted_patients, dims=2)[:] - sum(sent, dims=[2,3])[:]
	sent_vis_matrix = sum(sent, dims=3)[:,:,1] + diagm(selfedges)
	sent_vis_matrix = DataFrame(sent_vis_matrix)
	rename!(sent_vis_matrix, Symbol.(locations))
	return sent_vis_matrix
end

function results_netsent(sent::Array{<:Real,3}, start_date::Date)
	N, _, T = size(sent)
	net_sent = sum(sent, dims=2)[:,1,:] .- sum(sent, dims=1)[1,:,:]
	net_sent = DataFrame(Matrix(net_sent))
	rename!(net_sent, Symbol.(start_date .+ Dates.Day.(0:T-1)))
	return net_sent
end

function results_active_patients(
		sent::Array{<:Real,3},
		initial_patients::Array{<:Real,1},
		discharged_patients::Array{<:Real,2},
		admitted_patients::Array{<:Real,2},
		los;
		use_rounding::Bool=true,
)
	N, _, T = size(sent)

	L = nothing
	if isa(los, Int)
		L = vcat(ones(Int, los), zeros(Int, T-los))
	elseif isa(los, Array{<:Real,1})
		if length(los) >= T
			L = los
		else
			L = vcat(los, zeros(Float64, T-length(los)))
		end
	elseif isa(los, Distribution)
		L = 1.0 .- cdf.(los, 0:T)
	else
		error("Invalid length of stay distribution")
	end

	active = [(
			initial_patients[i]
			- sum(discharged_patients[i,1:t])
			+ sum(L[t-t₁+1] * (
				admitted_patients[i,t₁]
				- sum(sent[i,:,t₁])
				+ sum(sent[:,i,t₁])
			) for t₁ in 1:t)
			+ sum(sent[i,:,t])
		) for i in 1:N, t in 1:T
	]
	active_null = [(
			initial_patients[i]
			- sum(discharged_patients[i,1:t])
			+ sum(L[t-t₁+1] * admitted_patients[i,t₁] for t₁ in 1:t)
		) for i in 1:N, t in 1:T
	]

	if use_rounding
		active = round.(Int, active)
		active_null = round.(Int, active_null)
	end

	return active, active_null
end

end
