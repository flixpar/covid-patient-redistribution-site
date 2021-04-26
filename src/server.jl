using Genie
using Genie.Router
using Genie.Requests
using Genie.Renderer
using Genie.Renderer.Json

using Dates

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

route("/about") do
	serve_static_file("html/about.html")
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
	capacity_util = parse(Float64, input["utilization"])
	uncertainty_level = str_to_symbol(input["uncertaintylevel"])
	los = input["los"]
	constrain_integer = (input["integer"] == "true")

	start_date = Date(input["start_date"])
	end_date   = Date(input["end_date"])

	region = (region_type = region_type, region_id = region_id)

	if !haskey(input, "locations") || isnothing(input["locations"])
		default_locations = get_locations_list(region=region)
		locations_list = [h.id for h in default_locations if h["default"]]
	else
		locations_list = Array{String,1}(input["locations"])
	end

	covid_capacity_proportion = haskey(input, "covid_capacity_proportion") ? parse(Float64, input["covid_capacity_proportion"]) : 0.4
	dist_threshold = haskey(input, "dist_threshold") ? parse(Float64, input["dist_threshold"]) : 1000.0

	use_smoothness = haskey(input, "smoothness") ? (input["smoothness"] == "true") : true
	verbose = haskey(input, "verbose") ? (input["verbose"] == "true") : false

	response = handle_patients_request(
		region, locations_list,
		scenario, patient_type,
		objective, constrain_integer,
		transfer_budget, capacity_util,
		covid_capacity_proportion,
		dist_threshold,
		uncertainty_level, los,
		start_date, end_date,
		smoothness=use_smoothness,
		verbose=verbose,
	)
	return json(response)
end

route("/api/locations-list", method=GET) do
	if haskey(@params, :region_type) && haskey(@params, :region_id)
		region = (region_type = Symbol(@params(:region_type)), region_id = @params(:region_id))
	else
		region = nothing
	end
	response = get_locations_list(region=region)
	return json(response)
end

route("/api/regions-list", method=GET) do
	if haskey(@params, :region_type)
		region_type = Symbol(@params(:region_type))
	else
		region_type = :any
	end
	response = get_regions_list(region_type)
	return json(response)
end


haskey(ENV, "GENIE_ENV") || (ENV["GENIE_ENV"] = "dev")
if !haskey(ENV, "HOST")
	ENV["HOST"] = (ENV["GENIE_ENV"] == "dev") ? "127.0.0.1" : "0.0.0.0"
	host = (ENV["GENIE_ENV"] == "dev") ? "127.0.0.1" : "0.0.0.0"
end

port = (haskey(ENV, "PORT") ? parse(Int, ENV["PORT"]) : 8000)

Genie.config.run_as_server = true
Genie.startup(port, host)
