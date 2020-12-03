using Genie
using Genie.Router
using Genie.Requests

using Dates

push!(LOAD_PATH, normpath(@__DIR__, "..", "src"));
push!(LOAD_PATH, normpath(@__DIR__, "..", "lib"));

using EndpointHandler


route("/") do
	serve_static_file("html/patients.html")
end

route("/patients") do
	serve_static_file("html/patients.html")
end

route("/method") do
	serve_static_file("html/method.html")
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
	transfer_budget = input["transferbudget"]
	surge_preferences = input["surgepreferences"]
	capacity_util = parse(Float64, input["utilization"])
	uncertainty_level = str_to_symbol(input["uncertaintylevel"])
	los = input["los"]

	start_date = Date(input["start_date"])
	end_date   = Date(input["end_date"])

	handle_patients_request(
		scenario, patient_type,
		objective,
		transfer_budget, surge_preferences,
		capacity_util, uncertainty_level, los,
		start_date, end_date,
	)
end


haskey(ENV, "GENIE_ENV") || (ENV["GENIE_ENV"] = "dev")
if !haskey(ENV, "HOST")
	ENV["HOST"] = (ENV["GENIE_ENV"] == "dev") ? "127.0.0.1" : "0.0.0.0"
	host = (ENV["GENIE_ENV"] == "dev") ? "127.0.0.1" : "0.0.0.0"
end

port = (haskey(ENV, "PORT") ? parse(Int, ENV["PORT"]) : 8000)

Genie.config.run_as_server = true
Genie.startup(port, host)
