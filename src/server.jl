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

route("/about") do
	serve_static_file("html/about.html")
end

route("/api/patients/summary", method=POST) do
	start_date = Date(@params(:start_date))
	end_date   = Date(@params(:end_date))
	bed_avail = parse(Float64, @params(:bed_avail))
	max_travel_hours = parse(Float64, @params(:max_travel_hours))
	patient_type = Symbol(@params(:patient_type))
	los = @params(:los)

	handle_patients_request(
		start_date, end_date,
		bed_avail,
		max_travel_hours,
		patient_type,
		los,
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
