module PatientAllocation

using JuMP
using Gurobi

using Distributions
using LinearAlgebra
using MathOptInterface
using Statistics

export patient_redistribution, patient_loadbalance, patient_hybridmodel


function patient_redistribution(
		capacity::Array{<:Real},
		initial_patients::Array{<:Real,1},
		discharged_patients::Array{<:Real,2},
		admitted_patients::Array{<:Real,2},
		adj_matrix::BitArray{2}, los::Union{<:Distribution,Array{<:Real,1},Int};

		capacity_cushion::Union{Real,Array{<:Real,1}}=0.0,
		no_artificial_overflow::Bool=false, no_worse_overflow::Bool=false,
		sent_penalty::Real=0, smoothness_penalty::Real=0,
		active_smoothness_penalty::Real=0, admitted_smoothness_penalty::Real=0,
		constrain_integer::Bool=false,
		capacity_weights::Array{<:Real,1}=Int[],
		node_weights::Array{<:Real,1}=Int[],
		objective_weights::Array{<:Real}=Int[],
		transfer_budget::Array{<:Real,1}=Int[],
		total_transfer_budget::Real=Inf,

		sendreceive_gap::Int=0, min_send_amt::Real=0,
		balancing_thresh::Real=1.0, balancing_penalty::Real=0,
		severity_weighting::Bool=false, setup_cost::Real=0,

		timelimit::Real=Inf,
		mipgap::Real=0.0,
		solver::Symbol=:default,
		threads::Int=-1,
		verbose::Bool=false,
	)

	###############
	#### Setup ####
	###############

	if ndims(capacity) == 1
		capacity = reshape(capacity, (:,1))
	end

	N, T = size(admitted_patients)
	C = size(capacity, 2)
	check_sizes(initial_patients, discharged_patients, admitted_patients, capacity)

	capacity = capacity .* (1.0 .- capacity_cushion)

	if isempty(capacity_weights)
		capacity_weights = ones(Int, C)
	end
	if isempty(node_weights)
		node_weights = ones(Int, N)
	end
	if isempty(objective_weights)
		objective_weights = ones(Float64, N, C)
	end

	if ndims(objective_weights) == 1
		objective_weights = repeat(objective_weights, (1,C))
	end
	@assert size(objective_weights) == (N,C)

	objective_weights = objective_weights .* node_weights
	objective_weights = objective_weights .* capacity_weights'

	if isempty(transfer_budget)
		transfer_budget = fill(Inf, N)
	end

	L = discretize_los(los, T)

	###############
	#### Model ####
	###############

	model = Model(Gurobi.Optimizer)
	if !verbose set_silent(model) end

	if constrain_integer && (timelimit > 0) && !isinf(timelimit)
		set_optimizer_attribute(model, "TimeLimit", timelimit)
	end

	if constrain_integer && (mipgap > 0)
		set_optimizer_attribute(model, "MIPGap", mipgap)
	end

	if solver != :default
		solver_lookup = Dict(:auto => -1, :primalsimplex => 0, :dualsimplex => 1, :barrier => 2, :all => 3)
		set_optimizer_attribute(model, "Method", solver_lookup[solver])
	end

	if threads > 0
		set_optimizer_attribute(model, "Threads", threads)
	end

	###############
	## Variables ##
	###############

	@variable(model, sent[1:N,1:N,1:T] >= 0, integer=constrain_integer)
	@variable(model, overflow[1:N,1:T,1:C] >= 0)

	#################
	## Expressions ##
	#################

	# expressions for the number of active patients
	@expression(model, active_patients[i=1:N,t=1:T],
		initial_patients[i]
		- sum(discharged_patients[i,1:t])
		+ sum(L[t-t₁+1] * (
			admitted_patients[i,t₁]
			- sum(sent[i,:,t₁])
			+ sum(sent[:,i,t₁])
		) for t₁ in 1:t)
		# + sum(sent[i,:,t])
	)
	active_null = compute_active_null(initial_patients, discharged_patients, admitted_patients, L)

	# objective function
	objective = @expression(model, sum(sum(overflow, dims=2) .* objective_weights))

	######################
	## Hard Constraints ##
	######################

	# ensure the number of active patients is non-negative
	@constraint(model, [i=1:N,t=1:T], active_patients[i,t] >= 0)

	# only send new patients
	@constraint(model, [t=1:T], sum(sent[:,:,t], dims=2) .<= admitted_patients[:,t])

	# objective constraint
	@constraint(model, [i=1:N,t=1:T,c=1:C], overflow[i,t,c] >= active_patients[i,t] - capacity[i,c])

	################################
	## Optional Constraints/Costs ##
	################################

	enforce_adj!(model, sent, adj_matrix)
	enforce_no_artificial_overflow!(model, no_artificial_overflow, active_patients, active_null, capacity)
	enforce_no_worse_overflow!(model, no_worse_overflow, active_patients, active_null, capacity)
	enforce_minsendamt!(model, sent, min_send_amt, constrain_integer)
	enforce_sendreceivegap!(model, sent, sendreceive_gap)
	enforce_transferbudget!(model, sent, transfer_budget, total_transfer_budget)

	add_sent_penalty!(model, sent, objective, sent_penalty)
	add_smoothness_penalty!(model, sent, objective, smoothness_penalty)
	add_active_smoothness_penalty!(model, sent, objective, active_smoothness_penalty, active_patients)
	add_admitted_smoothness_penalty!(model, sent, objective, admitted_smoothness_penalty, admitted_patients)
	add_setup_cost!(model, sent, objective, setup_cost)
	add_loadbalancing_penalty!(model, sent, objective, balancing_penalty, balancing_thresh, active_patients, capacity)
	add_severity_weighting!(model, sent, objective, severity_weighting, overflow, active_null, capacity)

	###############
	#### Solve ####
	###############

	@objective(model, Min, objective)
	optimize!(model)

	return model
end

function patient_loadbalance(
		capacity::Array{<:Real},
		initial_patients::Array{<:Real,1},
		discharged_patients::Array{<:Real,2},
		admitted_patients::Array{<:Real,2},
		adj_matrix::BitArray{2}, los::Union{<:Distribution,Array{<:Real,1},Int};

		capacity_cushion::Union{Real,Array{<:Real,1}}=0.0,
		no_artificial_overflow::Bool=false, no_worse_overflow::Bool=false,
		sent_penalty::Real=0, smoothness_penalty::Real=0,
		active_smoothness_penalty::Real=0, admitted_smoothness_penalty::Real=0,
		constrain_integer::Bool=false,
		capacity_weights::Array{<:Real,1}=Int[],
		transfer_budget::Array{<:Real,1}=Int[],
		total_transfer_budget::Real=Inf,

		sendreceive_gap::Int=0, min_send_amt::Real=0,
		setup_cost::Real=0,

		timelimit::Real=Inf,
		mipgap::Real=0.0,
		solver::Symbol=:default,
		threads::Int=-1,
		verbose::Bool=false,
	)

	###############
	#### Setup ####
	###############

	if ndims(capacity) == 1
		capacity = reshape(capacity, (:,1))
	end

	N, T = size(admitted_patients)
	C = size(capacity, 2)
	check_sizes(initial_patients, discharged_patients, admitted_patients, capacity)

	capacity = capacity .* (1.0 .- capacity_cushion)

	if isempty(capacity_weights)
		capacity_weights = ones(Int, C)
	end

	L = discretize_los(los, T)

	###############
	#### Model ####
	###############

	model = Model(Gurobi.Optimizer)
	if !verbose set_silent(model) end

	if constrain_integer && (timelimit > 0) && !isinf(timelimit)
		set_optimizer_attribute(model, "TimeLimit", timelimit)
	end

	if constrain_integer && (mipgap > 0)
		set_optimizer_attribute(model, "MIPGap", mipgap)
	end

	if solver != :default
		solver_lookup = Dict(:auto => -1, :primalsimplex => 0, :dualsimplex => 1, :barrier => 2, :all => 3)
		set_optimizer_attribute(model, "Method", solver_lookup[solver])
	end

	if threads > 0
		set_optimizer_attribute(model, "Threads", threads)
	end

	###############
	## Variables ##
	###############

	@variable(model, sent[1:N,1:N,1:T] >= 0, integer=constrain_integer)
	@variable(model, load_objective[1:N,1:T,1:C] >= 0)

	#################
	## Expressions ##
	#################

	# expressions for the number of active patients
	@expression(model, active_patients[i=1:N,t=1:T],
		initial_patients[i]
		- sum(discharged_patients[i,1:t])
		+ sum(L[t-t₁+1] * (
			admitted_patients[i,t₁]
			- sum(sent[i,:,t₁])
			+ sum(sent[:,i,t₁])
		) for t₁ in 1:t)
		+ sum(sent[i,:,t])
	)
	active_null = compute_active_null(initial_patients, discharged_patients, admitted_patients, L)

	# expression for the patient load
	@expression(model, load[i=1:N,t=1:T,c=1:C], active_patients[i,t] / capacity[i,c])

	# objective function
	objective = @expression(model, dot(capacity_weights, sum(load_objective, dims=(1,2))))

	######################
	## Hard Constraints ##
	######################

	# ensure the number of active patients is non-negative
	@constraint(model, [i=1:N,t=1:T], active_patients[i,t] >= 0)

	# only send new patients
	@constraint(model, [t=1:T], sum(sent[:,:,t], dims=2) .<= admitted_patients[:,t])

	# objective constraint
	@constraint(model, [i=1:N,t=1:T,c=1:C],  (load[i,t,c] - mean(load[:,t,c])) <= load_objective[i,t,c])
	@constraint(model, [i=1:N,t=1:T,c=1:C], -(load[i,t,c] - mean(load[:,t,c])) <= load_objective[i,t,c])

	################################
	## Optional Constraints/Costs ##
	################################

	enforce_adj!(model, sent, adj_matrix)
	enforce_no_artificial_overflow!(model, no_artificial_overflow, active_patients, active_null, capacity)
	enforce_no_worse_overflow!(model, no_worse_overflow, active_patients, active_null, capacity)
	enforce_minsendamt!(model, sent, min_send_amt, constrain_integer)
	enforce_sendreceivegap!(model, sent, sendreceive_gap)
	enforce_transferbudget!(model, sent, transfer_budget, total_transfer_budget)

	add_sent_penalty!(model, sent, objective, sent_penalty)
	add_smoothness_penalty!(model, sent, objective, smoothness_penalty)
	add_active_smoothness_penalty!(model, sent, objective, active_smoothness_penalty, active_patients)
	add_admitted_smoothness_penalty!(model, sent, objective, admitted_smoothness_penalty, admitted_patients)
	add_setup_cost!(model, sent, objective, setup_cost)

	###############
	#### Solve ####
	###############

	@objective(model, Min, objective)
	optimize!(model)

	return model
end

function patient_hybridmodel(
		capacity::Array{<:Real},
		initial_patients::Array{<:Real,1},
		discharged_patients::Array{<:Real,2},
		admitted_patients::Array{<:Real,2},
		adj_matrix::BitArray{2}, los::Union{<:Distribution,Array{<:Real,1},Int};

		overflowmin_weight::Real=1.0,
		loadbalance_weight::Real=0.25,

		capacity_cushion::Union{Real,Array{<:Real,1}}=0.0,
		no_artificial_overflow::Bool=false, no_worse_overflow::Bool=false,
		sent_penalty::Real=0, smoothness_penalty::Real=0,
		active_smoothness_penalty::Real=0, admitted_smoothness_penalty::Real=0,
		constrain_integer::Bool=false,
		capacity_weights::Array{<:Real,1}=Int[],
		node_weights::Array{<:Real,1}=Int[],
		objective_weights::Array{<:Real}=Int[],
		transfer_budget::Array{<:Real,1}=Int[],
		total_transfer_budget::Real=Inf,

		sendreceive_gap::Int=0, min_send_amt::Real=0,
		balancing_thresh::Real=1.0, balancing_penalty::Real=0,
		severity_weighting::Bool=false, setup_cost::Real=0,

		timelimit::Real=Inf,
		mipgap::Real=0.0,
		solver::Symbol=:default,
		threads::Int=-1,
		verbose::Bool=false,
	)

	###############
	#### Setup ####
	###############

	if ndims(capacity) == 1
		capacity = reshape(capacity, (:,1))
	end

	N, T = size(admitted_patients)
	C = size(capacity, 2)
	check_sizes(initial_patients, discharged_patients, admitted_patients, capacity)

	capacity = capacity .* (1.0 .- capacity_cushion)

	if isempty(capacity_weights)
		capacity_weights = ones(Int, C)
	end
	if isempty(node_weights)
		node_weights = ones(Int, N)
	end
	if isempty(objective_weights)
		objective_weights = ones(Float64, N, C)
	end

	if ndims(objective_weights) == 1
		objective_weights = repeat(objective_weights, (1,C))
	end
	@assert size(objective_weights) == (N,C)

	objective_weights = objective_weights .* node_weights
	objective_weights = objective_weights .* capacity_weights'

	if isempty(transfer_budget)
		transfer_budget = fill(Inf, N)
	end

	L = discretize_los(los, T)

	###############
	#### Model ####
	###############

	model = Model(Gurobi.Optimizer)
	if !verbose set_silent(model) end

	if constrain_integer && (timelimit > 0) && !isinf(timelimit)
		set_optimizer_attribute(model, "TimeLimit", timelimit)
	end

	if constrain_integer && (mipgap > 0)
		set_optimizer_attribute(model, "MIPGap", mipgap)
	end

	if solver != :default
		solver_lookup = Dict(:auto => -1, :primalsimplex => 0, :dualsimplex => 1, :barrier => 2, :all => 3)
		set_optimizer_attribute(model, "Method", solver_lookup[solver])
	end

	if threads > 0
		set_optimizer_attribute(model, "Threads", threads)
	end

	###############
	## Variables ##
	###############

	@variable(model, sent[1:N,1:N,1:T] >= 0, integer=constrain_integer)
	@variable(model, load_objective[1:N,1:T,1:C] >= 0)
	@variable(model, overflow[1:N,1:T] >= 0)

	#################
	## Expressions ##
	#################

	# expressions for the number of active patients
	@expression(model, active_patients[i=1:N,t=1:T],
		initial_patients[i]
		- sum(discharged_patients[i,1:t])
		+ sum(L[t-t₁+1] * (
			admitted_patients[i,t₁]
			- sum(sent[i,:,t₁])
			+ sum(sent[:,i,t₁])
		) for t₁ in 1:t)
		+ sum(sent[i,:,t])
	)
	active_null = compute_active_null(initial_patients, discharged_patients, admitted_patients, L)

	# expression for the patient load
	@expression(model, load[i=1:N,t=1:T,c=1:C], active_patients[i,t] / capacity[i,c])

	# objective function
	objective = @expression(model, 
		(loadbalance_weight * dot(capacity_weights, sum(load_objective, dims=(1,2))))
		+ (overflowmin_weight * sum(sum(overflow, dims=2) .* node_weights))
	)

	######################
	## Hard Constraints ##
	######################

	# ensure the number of active patients is non-negative
	@constraint(model, [i=1:N,t=1:T], active_patients[i,t] >= 0)

	# only send new patients
	@constraint(model, [t=1:T], sum(sent[:,:,t], dims=2) .<= admitted_patients[:,t])

	# objective constraints
	@constraint(model, [i=1:N,t=1:T,c=1:C],  (load[i,t,c] - mean(load[:,t,c])) <= load_objective[i,t,c])
	@constraint(model, [i=1:N,t=1:T,c=1:C], -(load[i,t,c] - mean(load[:,t,c])) <= load_objective[i,t,c])
	@constraint(model, [i=1:N,t=1:T], overflow[i,t] >= active_patients[i,t] - capacity[i,end])

	################################
	## Optional Constraints/Costs ##
	################################

	enforce_adj!(model, sent, adj_matrix)
	enforce_no_artificial_overflow!(model, no_artificial_overflow, active_patients, active_null, capacity)
	enforce_no_worse_overflow!(model, no_worse_overflow, active_patients, active_null, capacity)
	enforce_minsendamt!(model, sent, min_send_amt, constrain_integer)
	enforce_sendreceivegap!(model, sent, sendreceive_gap)
	enforce_transferbudget!(model, sent, transfer_budget, total_transfer_budget)

	add_sent_penalty!(model, sent, objective, sent_penalty)
	add_smoothness_penalty!(model, sent, objective, smoothness_penalty)
	add_active_smoothness_penalty!(model, sent, objective, active_smoothness_penalty, active_patients)
	add_admitted_smoothness_penalty!(model, sent, objective, admitted_smoothness_penalty, admitted_patients)
	add_setup_cost!(model, sent, objective, setup_cost)
	add_loadbalancing_penalty!(model, sent, objective, balancing_penalty, balancing_thresh, active_patients, capacity)
	add_severity_weighting!(model, sent, objective, severity_weighting, overflow, active_null, capacity)

	###############
	#### Solve ####
	###############

	@objective(model, Min, objective)
	optimize!(model)

	return model
end

##############################################
############# Helper Functions ###############
##############################################

function discretize_los(los, T)
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
	return L
end

function compute_active_null(initial_patients, discharged_patients, admitted_patients, L)
	N, T = size(admitted_patients)
	active_null = [(
			initial_patients[i]
			- sum(discharged_patients[i,1:t])
			+ sum(L[t-t₁+1] * admitted_patients[i,t₁] for t₁ in 1:t)
		) for i in 1:N, t in 1:T
	]
	return active_null
end

function check_sizes(initial_patients, discharged_patients, admitted_patients, beds)
	N, T = size(admitted_patients)
	@assert(size(initial_patients) == (N,))
	@assert(size(discharged_patients) == (N, T))
	@assert(size(beds, 1) == N)
	return
end

##############################################
########### Optional Constraints #############
##############################################

# only send patients between connected locations
function enforce_adj!(model, sent, adj_matrix)
	N, _, T = size(sent)
	@assert(size(adj_matrix) == (N,N))
	for i in 1:N, j in 1:N
		if ~adj_matrix[i,j]
			for t in 1:T
				fix(sent[i,j,t], 0, force=true)
			end
		end
	end
	return
end

function enforce_no_artificial_overflow!(model, no_artificial_overflow, active_patients, active_null, capacity)
	if no_artificial_overflow
		N, T = size(active_null)
		for i in 1:N, t in 1:T
			if active_null[i,t] <= capacity[i,end]
				@constraint(model, active_patients[i,t] <= capacity[i,end])
			end
		end
	end
	return
end

function enforce_no_worse_overflow!(model, no_worse_overflow, active_patients, active_null, capacity)
	if no_worse_overflow
		N, T = size(active_null)
		for i in 1:N, t in 1:T
			if active_null[i,t] >= capacity[i,end]
				@constraint(model, active_patients[i,t] <= active_null[i,t])
			end
		end
	end
	return
end

# enforce minimum transfer amount if enabled
function enforce_minsendamt!(model, sent, min_send_amt, constrain_integer)
	if min_send_amt > 0
		N, _, T = size(sent)
		if constrain_integer
			semi_set = MOI.Semiinteger(Int(min_send_amt), Inf)
		else
			semi_set = MOI.Semicontinuous(Float64(min_send_amt), Inf)
		end
		for i in 1:N, j in 1:N, t in 1:T
			if !is_fixed(sent[i,j,t])
				delete_lower_bound(sent[i,j,t])
				@constraint(model, sent[i,j,t] in semi_set)
			end
		end
	end
	return
end

# enforce a minimum time between sending and receiving
function enforce_sendreceivegap!(model, sent, sendreceive_gap)
	if sendreceive_gap > 0
		N, _, T = size(sent)
		@constraint(model, [i=1:N,t=1:T-1],
			[sum(sent[:,i,t]), sum(sent[i,:,t:min(t+sendreceive_gap,T)])] in MOI.SOS1([1.0, 1.0])
		)
		@constraint(model, [i=1:N,t=1:T-1],
			[sum(sent[:,i,t:min(t+sendreceive_gap,T)]), sum(sent[i,:,t])] in MOI.SOS1([1.0, 1.0])
		)
	end
	return
end

# enforce an upper limit on the number of transfers per hospital-day
function enforce_transferbudget!(model, sent, transfer_budget, total_transfer_budget)
	N, _, T = size(sent)
	for i in 1:N
		if !isinf(transfer_budget[i])
			@constraint(model, [t=1:T], sum(sent[i,:,t]) <= transfer_budget[i])
		end
	end
	if !isinf(total_transfer_budget)
		@constraint(model, sum(sent) ≤ total_transfer_budget)
	end
end

##############################################
############ Optional Penalties ##############
##############################################

# penalize total sent if enabled
function add_sent_penalty!(model, sent, objective, sent_penalty)
	if sent_penalty > 0
		add_to_expression!(objective, sent_penalty*sum(sent))
	end
	return
end

# penalize non-smoothness in sent patients if enabled
function add_smoothness_penalty!(model, sent, objective, smoothness_penalty)
	if smoothness_penalty > 0
		N, _, T = size(sent)

		@variable(model, smoothness_dummy[i=1:N,j=1:N,t=1:T-1] >= 0)
		@constraint(model, [t=1:T-1],  (sent[:,:,t] - sent[:,:,t+1]) .<= smoothness_dummy[:,:,t])
		@constraint(model, [t=1:T-1], -(sent[:,:,t] - sent[:,:,t+1]) .<= smoothness_dummy[:,:,t])

		add_to_expression!(objective, smoothness_penalty * sum(smoothness_dummy))
		add_to_expression!(objective, smoothness_penalty * sum(sent[:,:,1]))
	end
	return
end

# penalize non-smoothness in active patients if enabled
function add_active_smoothness_penalty!(model, sent, objective, smoothness_penalty, active_patients)
	if smoothness_penalty > 0
		N, _, T = size(sent)

		@variable(model, active_smoothness_dummy[i=1:N,t=1:T-1] >= 0)
		@constraint(model, [i=1:N,t=1:T-1],  (active_patients[i,t] - active_patients[i,t+1]) <= active_smoothness_dummy[i,t])
		@constraint(model, [i=1:N,t=1:T-1], -(active_patients[i,t] - active_patients[i,t+1]) <= active_smoothness_dummy[i,t])

		add_to_expression!(objective, smoothness_penalty * sum(active_smoothness_dummy))
	end
	return
end

# penalize non-smoothness in admitted patients if enabled
function add_admitted_smoothness_penalty!(model, sent, objective, smoothness_penalty, admitted_patients)
	if smoothness_penalty > 0
		N, _, T = size(sent)

		@expression(model, total_admitted[i=1:N,t=1:T], admitted_patients[i,t] - sum(sent[i,:,t]) + sum(sent[:,i,t]))

		@variable(model, admitted_smoothness_dummy_l1[i=1:N,t=1:T-1] >= 0)
		@constraint(model, [i=1:N,t=1:T-1],  (total_admitted[i,t] - total_admitted[i,t+1]) <= admitted_smoothness_dummy_l1[i,t])
		@constraint(model, [i=1:N,t=1:T-1], -(total_admitted[i,t] - total_admitted[i,t+1]) <= admitted_smoothness_dummy_l1[i,t])

		@variable(model, admitted_smoothness_dummy_l∞[i=1:N] >= 0)
		@constraint(model, [i=1:N,t=1:T-1], admitted_smoothness_dummy_l1[i,t] <= admitted_smoothness_dummy_l∞[i])

		add_to_expression!(objective, smoothness_penalty * sum(admitted_smoothness_dummy_l1))
		add_to_expression!(objective, smoothness_penalty * T * sum(admitted_smoothness_dummy_l∞))
	end
	return
end

# add setup costs if enabled
function add_setup_cost!(model, sent, objective, setup_cost)
	if setup_cost > 0
		N, _, T = size(sent)
		@variable(model, setup_dummy[i=1:N,j=i+1:N], Bin)
		@constraint(model, [i=1:N,j=i+1:N], [1-setup_dummy[i,j], sum(sent[i,j,:])+sum(sent[j,i,:])] in MOI.SOS1([1.0, 1.0]))
		add_to_expression!(objective, setup_cost*sum(setup_dummy))
	end
	return
end

# load balancing penalty
function add_loadbalancing_penalty!(model, sent, objective, balancing_penalty, balancing_thresh, active_patients, capacity)
	if balancing_penalty > 0
		N, _, T = size(sent)
		@variable(model, balancing_dummy[1:N,1:T] >= 0)
		@constraint(model, [i=1:N,t=1:T], balancing_dummy[i,t] >= (active_patients[i,t] / capacity[i,1]) - balancing_thresh)
		add_to_expression!(objective, balancing_penalty * sum(balancing_dummy))
	end
	return
end

# weight objective per-location by max load
function add_severity_weighting!(model, sent, objective, severity_weighting, overflow, active_null, capacity)
	if severity_weighting
		N, _, T = size(sent)
		max_load_null = [maximum(active_null[i,:] / capacity[i,1]) for i in 1:N]
		severity_weight = [max_load_null[i] > 1.0 ? 0.0 : 9.0 for i in 1:N]
		add_to_expression!(objective, dot(sum(overflow, dims=2), severity_weight))
	end
	return
end

end;
