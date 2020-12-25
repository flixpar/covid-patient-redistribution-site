using Genie
using Genie.Router
using Genie.Requests
using Genie.Renderer.Json

using Dates

push!(LOAD_PATH, normpath(@__DIR__, "..", "src"));
push!(LOAD_PATH, normpath(@__DIR__, "..", "lib"));

using EndpointHandler


route("/") do
	serve_static_file("html/home.html")
end

route("/home") do
	serve_static_file("html/home.html")
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

	default_locations = get_hospital_list()
	default_locations = [h["name"] for h in default_locations if h["default"]]

	response = handle_patients_request(
		default_locations,
		scenario, patient_type,
		objective, constrain_integer,
		transfer_budget,
		capacity_util, uncertainty_level, los,
		start_date, end_date,
	)
	return json(response)
end

route("/api/hospital-list", method=GET) do
	response = get_hospital_list()
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
