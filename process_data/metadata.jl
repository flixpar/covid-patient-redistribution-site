using CSV
using JSON
using DataFrames

include("util.jl")


###########################
#### Extract Metadata #####
###########################

function extract_metadata()
	rawdata_fn = latest_hhs_rawdata_fn()
	rawdata = DataFrame(CSV.File(rawdata_fn))

	bad_ids = begin
		id_counts = combine(groupby(rawdata, :hospital_pk), :hospital_name => (x -> length(unique(x))) => :n_names)
		filter!(x -> x.n_names > 1, id_counts)
		unique(id_counts.hospital_pk)
	end
	filter!(row -> !(row.hospital_pk in bad_ids), rawdata)

	unique!(rawdata, :hospital_pk)

	data = select(rawdata,
		:hospital_name => :hospital,
		:hospital_pk => :hospital_id,
		:state,
		:city => ByRow(x -> ismissing(x) ? x : titlecase(x)) => :city,
		:zip,
		:fips_code,
	)
	sort!(data, [:hospital, :hospital_id])

	states_data = DataFrame(CSV.File("../rawdata/states.csv"))
	state_data_dict = Dict(row.abbrev => row.state for row in eachrow(states_data))
	state_data_dict["GU"] = "Guam"
	state_data_dict["MP"] = "Northern Mariana Islands"
	state_data_dict["VI"] = "US Virgin Islands"

	insertcols!(data, 4, :state_abbrev => deepcopy(data.state))
	data.state = [haskey(state_data_dict, s) ? state_data_dict[s] : s for s in data.state]

	hospitalsystem_rawdata = DataFrame(CSV.File("../rawdata/chsp-hospital-linkage-2018.csv"))
	hospitalsystem_dict = Dict(row.ccn => (
		hospital_name = row.hospital_name,
		health_system_id = row.health_sys_id,
		health_system_name = row.health_sys_name,
	) for row in eachrow(hospitalsystem_rawdata))

	data.system_id = [haskey(hospitalsystem_dict, h) ? hospitalsystem_dict[h].health_system_id : missing for h in data.hospital_id]
	data.system_name = [haskey(hospitalsystem_dict, h) ? hospitalsystem_dict[h].health_system_name : missing for h in data.hospital_id]

	nyt_metadata = JSON.parsefile("../rawdata/nyt_hospital_metadata.json")
	nyt_metadata_dict = Dict(h["ccn"] => h for h in nyt_metadata)

	nyt_names = [haskey(nyt_metadata_dict, row.hospital_id) ? nyt_metadata_dict[row.hospital_id]["nyt_hospital_name"] : titlecase(row.hospital) for row in eachrow(data)]
	insertcols!(data, 2, :hospitalname =>  nyt_names)

	hsahrr_data = DataFrame(CSV.File("../rawdata/ZipHsaHrr18.csv"))
	hsahrr_dict = Dict(row.zipcode18 => row for row in eachrow(hsahrr_data))

	missing_row = (hsanum=missing, hsacity=missing, hsastate=missing, hrrnum=missing, hrrcity=missing, hrrstate=missing)
	hsahrrs = [haskey(hsahrr_dict,z) ? hsahrr_dict[z] : missing_row for z in data.zip]

	data.hsa_id = [h.hsanum for h in hsahrrs]
	data.hsa_name = [h.hsacity * ", " * h.hsastate for h in hsahrrs]
	data.hrr_id = [h.hrrnum for h in hsahrrs]
	data.hrr_name = [h.hrrcity * ", " * h.hrrstate for h in hsahrrs]

	data |> CSV.write("../data/hhs_hospital_meta.csv")

	return
end

function extract_dates_metadata()
	hhsdata = DataFrame(CSV.File("../data/hospitalization_data.csv"))
	hhsdata_start, hhsdata_end = extrema(hhsdata.date)

	forecast_data = DataFrame(CSV.File("../data/hospitalization_forecast.csv"))
	forecast_start, forecast_end = extrema(forecast_data.date)

	dates = (;
		forecast_update = latest_forecast_date(),
		forecast_start, forecast_end,
		hhsdata_update = latest_hhs_rawdata_date(),
		hhsdata_start, hhsdata_end,
	)

	open("../public/json/dates.json", "w") do f
		JSON.print(f, dates, 4)
	end

	return
end
