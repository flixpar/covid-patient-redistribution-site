using CSV
using Dates
using Base.Threads
using ProgressMeter
using DataFrames

include("util.jl")


function disaggregate_forecast(forecast_date="latest"; VERBOSE=false, DEBUG=false)

	hosp_data_all = DataFrame(CSV.File("../data/hospitalization_data.csv"))
	for col in [:admissions_icu, :admissions_acute, :admissions_allbeds, :active_icu, :active_acute, :active_allbeds]
		hosp_data_all[:,col] = coalesce.(hosp_data_all[:,col], 0)
	end

	hosp_metadata = DataFrame(CSV.File("../data/hhs_hospital_meta.csv"))

	cases_data_all = DataFrame(CSV.File("../rawdata/csse_confirmed_cases.csv"))

	if forecast_date == "latest"
		forecast_date = latest_forecast_date()
	end

	fn = "../rawdata/forecasts/$(forecast_date)-COVIDhub-ensemble.csv"
	forecast = DataFrame(CSV.File(fn))

	filter!(row -> contains(row.target, "inc case"), forecast)
	filter!(row -> row.type == "point", forecast)
	filter!(row -> row.location != "US", forecast)
	forecast.location = parse.(Int, forecast.location)

	hosp_data = filter(row -> row.date <= forecast_date, hosp_data_all)
	cases_data = filter(row -> row.date <= forecast_date, cases_data_all)

	recent_dates = sort(intersect(unique(hosp_data.date), unique(cases_data.date)))[end-14+1:end]

	total_hosp_recent = filter(row -> row.date in recent_dates, hosp_data)
	total_hosp_recent = combine(groupby(total_hosp_recent, :hospital_id),
		:admissions_icu => sum => :admissions_icu,
		:admissions_acute => sum => :admissions_acute,
	)
	total_hosp_recent_dict = Dict(row.hospital_id => row for row in eachrow(total_hosp_recent))

	total_cases_recent = filter(row -> row.date in recent_dates, cases_data)
	total_cases_recent = combine(groupby(total_cases_recent, :county_fips), :cases => sum => :cases)
	total_cases_recent_dict = Dict(row.county_fips => row.cases for row in eachrow(total_cases_recent))

	if VERBOSE
		@show forecast_date
		@show recent_dates
	end

	h_forecasts = []

	results_lock = ReentrantLock()
	io_lock = ReentrantLock()

	counties = sort(unique(forecast.location))
	if DEBUG counties = counties[1:60] end

	p = Progress(length(counties))

	@threads for county in counties
		county_hosp_ind = findall(f -> !ismissing(f) && f == county, hosp_metadata.fips_code)

		if isempty(county_hosp_ind)
			next!(p)
			continue
		end

		county_hosp_ids = unique(hosp_metadata[county_hosp_ind, :hospital_id])

		admissions_icu = [haskey(total_hosp_recent_dict,h) ? total_hosp_recent_dict[h].admissions_icu : 0 for h in county_hosp_ids]
		admissions_acute = [haskey(total_hosp_recent_dict,h) ? total_hosp_recent_dict[h].admissions_acute : 0 for h in county_hosp_ids]

		total_admissions_icu = sum(admissions_icu)
		total_admissions_acute = sum(admissions_acute)

		total_cases = max(1, total_cases_recent_dict[county])

		scale_icu = total_admissions_icu / total_cases
		scale_acute = total_admissions_acute / total_cases

		hosp_weights_icu = admissions_icu ./ total_admissions_icu
		hosp_weights_acute = admissions_acute ./ total_admissions_acute

		z = sum(hosp_weights_icu)
		map!(x -> (z==0.0 || isnan(x)) ? 0.0 : x/z, hosp_weights_icu, hosp_weights_icu)

		z = sum(hosp_weights_acute)
		map!(x -> (z==0.0 || isnan(x)) ? 0.0 : x/z, hosp_weights_acute, hosp_weights_acute)

		county_forecast = filter(row -> row.location == county, forecast)

		day0 = minimum(county_forecast.target_end_date) - Day(7)
		last_cases_df = filter(row -> row.county_fips == county && (day0-Day(7) < row.date <= day0), cases_data)
		last_cases = sum(last_cases_df.cases)

		dfs = DataFrame[]
		for (i,hid) in enumerate(county_hosp_ids)
			h_forecast = select(county_forecast,
				:target_end_date => :date,
				:value => ByRow(x -> x * scale_icu * hosp_weights_icu[i]) => :admissions_icu,
				:value => ByRow(x -> x * scale_acute * hosp_weights_acute[i]) => :admissions_acute,
			)
			insertcols!(h_forecast, 1, :hospital_id => fill(hid, nrow(h_forecast)))

			push!(h_forecast,
				(
					hospital_id = hid,
					date = day0,
					admissions_icu = last_cases * scale_icu * hosp_weights_icu[i],
					admissions_acute = last_cases * scale_acute * hosp_weights_acute[i],
				)
			)

			push!(dfs, h_forecast)
		end

		c_forecast = vcat(dfs...)
		lock(results_lock) do
			push!(h_forecasts, c_forecast)
		end

		if VERBOSE
			lock(io_lock) do
				@show county
				@show county_hosp_ids
				@show total_admissions_icu
				@show total_admissions_acute
				@show total_cases
				@show scale_icu, scale_acute
				@show hosp_weights_icu
				@show hosp_weights_acute
				@show county_forecast
				for df in dfs
					@show df
				end
				print("\n\n=================================\n\n")
				flush(stdout)
			end
		end

		next!(p)
	end

	hospitalization_forecast = vcat(h_forecasts...)
	sort!(hospitalization_forecast, [:hospital_id, :date])

	hospitalization_forecast.admissions_total = hospitalization_forecast.admissions_icu + hospitalization_forecast.admissions_acute

	hospitalization_forecast |> CSV.write("../data/hospitalization_forecast.csv")

	return
end

function convert_cases()
	rawdata = DataFrame(CSV.File("../rawdata/time_series_covid19_confirmed_US.csv"))

	date_cols = filter(x -> contains(x, "/"), names(rawdata))
	data = stack(rawdata, date_cols, variable_name=:date_str, value_name=:cum_cases)
	data.date = map(d -> Date(d, "m/d/yy")+Year(2000), data.date_str)
	dropmissing!(data, [:FIPS, :date])

	select!(data,
		:UID => :county_uid,
		:FIPS => ByRow(x -> Int(x)) => :county_fips,
		:Admin2 => :county_name,
		:Province_State => :state,
		:date,
		:cum_cases,
	)
	sort!(data, [:county_fips, :date])

	new_cases = combine(groupby(data, :county_fips),
		:date,
		:cum_cases => (xs -> vcat(xs[1], diff(xs))) => :cases,
	)

	data = leftjoin(data, new_cases, on=[:county_fips, :date])

	data |> CSV.write("../rawdata/csse_confirmed_cases.csv")

	return
end
