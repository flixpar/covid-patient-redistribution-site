using Genie
using Genie.Router

using Dates

push!(LOAD_PATH, normpath(@__DIR__, "..", "src"));
push!(LOAD_PATH, normpath(@__DIR__, "..", "lib"));

using EndpointHandler


route("/") do
	serve_static_file("html/home.html")
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

route("/api/patients/summary", method=POST) do
	str_to_symbol(s) = Symbol(replace(lowercase(s), " " => "_"))

	scenario = str_to_symbol(@params(:scenario))
	patient_type = str_to_symbol(@params(:patient_type))
	objective = str_to_symbol(@params(:objective))

	start_date = Date(@params(:start_date))
	end_date   = Date(@params(:end_date))

	los = @params(:los)

	handle_patients_request(
		scenario, patient_type,
		objective, los,
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
