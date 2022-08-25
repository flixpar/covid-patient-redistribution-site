using Genie
using Genie.Router
using Genie.Requests
using Genie.Renderer

using JSON
using Dates
using InlineStrings

push!(LOAD_PATH, normpath(@__DIR__, "..", "src"));
push!(LOAD_PATH, normpath(@__DIR__, "..", "lib"));

using EndpointHandler


route("/") do
	redirect("/home")
end

route("/home") do
	serve_static_file("html/about.html")
end

route("/patients-static") do
	serve_static_file("html/patients-static.html")
end

route("/patients-interactive") do
	serve_static_file("html/patients-interactive.html")
end

route("/hospital-selection") do
	serve_static_file("html/hospital-selection.html")
end

route("/region-selection") do
	serve_static_file("html/region-selection.html")
end

route("/status-report") do
	serve_static_file("html/status-report.html")
end

route("/data-explore") do
	serve_static_file("html/data-explore.html")
end

route("/about") do
	serve_static_file("html/about.html")
end

route("/guide") do
	serve_static_file("html/guide.html")
end

route("/api/patients", method=POST) do
	str_to_symbol(s) = Symbol(replace(lowercase(s), " " => "_"))

	input = jsonpayload()

	region_type = str_to_symbol(input["region_type"])
	region_id = input["region_id"]
	scenario = str_to_symbol(input["scenario"])
	patient_type = str_to_symbol(input["patient_type"])
	objective = str_to_symbol(input["objective"])
	transfer_budget = parse(Float64, input["transferbudget"])
	total_transfer_budget = parse(Float64, input["totaltransferbudget"])
	capacity_util = parse(Float64, input["utilization"])
	uncertainty_level = str_to_symbol(input["uncertaintylevel"])
	los = input["los"]
	constrain_integer = (input["integer"] == "true")

	start_date = Date(input["start_date"])
	end_date   = Date(input["end_date"])

	region = (region_type = region_type, region_id = region_id)
	region = complete_region(region)

	if isnothing(input["hospitals"])
		default_locations = get_hospital_list(region=region)
		hospitals_list = [h.id for h in default_locations if h["default"]]
	else
		hospitals_list = Array{String,1}(input["hospitals"])
	end

	covid_capacity_estimate = get(input, "covid_capacity_estimate", "default") |> x -> tryparse(Float64, x) |> y -> something(y, "default")

	dist_threshold = haskey(input, "dist_threshold") ? parse(Float64, input["dist_threshold"]) : 600.0
	dist_cost = haskey(input, "dist_cost") ? parse(Float64, input["dist_cost"]) : 0.0

	use_smoothness = haskey(input, "smoothness") ? (input["smoothness"] == "true") : true
	verbose = haskey(input, "verbose") ? (input["verbose"] == "true") : false

	response = handle_patients_request(
		region, hospitals_list,
		scenario, patient_type,
		objective, constrain_integer,
		transfer_budget, total_transfer_budget,
		capacity_util,
		covid_capacity_estimate,
		dist_threshold, dist_cost,
		uncertainty_level, los,
		start_date, end_date,
		smoothness=use_smoothness,
		verbose=verbose,
	)
	return json(response)
end

route("/api/hospital-list", method=GET) do
	paramsdata = getpayload()
	if haskey(paramsdata, :region_type) && haskey(paramsdata, :region_id)
		region = (region_type = Symbol(paramsdata[:region_type]), region_id = paramsdata[:region_id])
	else
		region = nothing
	end
	response = get_hospital_list(region=region)
	return json(response)
end

route("/api/regions-list", method=GET) do
	paramsdata = getpayload()
	region_type = Symbol(get(paramsdata, :region_type, :any))
	response = get_regions_list(region_type)
	return json(response)
end

route("/api/hospital-selection") do
	paramsdata = getpayload()
	if haskey(paramsdata, :lat) && haskey(paramsdata, :long)
		loc = (lat = parse(Float64, paramsdata[:lat]), long = parse(Float64, paramsdata[:long]))
	elseif haskey(paramsdata, :zipcode)
		@warn "Query by zipcode not yet implemented"
		loc = (lat = 39.2961773, long = -76.5939447) # JHH (temporary)
	else
		@error "No location to use for hospital selection"
		return
	end
	response = handle_hospital_selection(loc)
	return json(response)
end

route("/api/region-selection") do
	paramsdata = getpayload()
	region_type = Symbol(get(paramsdata, :region_type, :state))
	patient_type = Symbol(get(paramsdata, :patient_type, :combined))
	metric_type = Symbol(get(paramsdata, :metric_type, :beddays))
	if haskey(paramsdata, :date)
		date = Date(paramsdata[:date])
		response = handle_region_selection(region_type, patient_type, metric_type, date)
	elseif haskey(paramsdata, :start_date) && haskey(paramsdata, :end_date)
		start_date = Date(paramsdata[:start_date])
		end_date = Date(paramsdata[:end_date])
		response = handle_region_selection(region_type, patient_type, metric_type, start_date, end_date)
	else
		@error "Invalid params for region selection api"
		return
	end
	return json(response)
end

route("/api/hospital-data") do
	paramsdata = getpayload()
	patient_type = Symbol(get(paramsdata, :patient_type, :covid))
	bed_type = Symbol(get(paramsdata, :bed_type, :icu))
	response = get_hospital_data(paramsdata[:hospital_id], patient_type, bed_type)
	return json(response)
end

route("/api/status-report") do
	return json(handle_status_report())
end


port = (haskey(ENV, "PORT") ? parse(Int, ENV["PORT"]) : 8000)
up(port, async = false)
