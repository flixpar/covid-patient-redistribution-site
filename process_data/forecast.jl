using CSV
using Dates
using Glob
using Base.Threads
using ProgressMeter
using DataFrames

include("util.jl")


function disaggregate_forecast(forecast_date="latest"; uncertainty_version=:default, write_versioned=false, VERBOSE=false, DEBUG=false)

	forecast_cols = [:admissions_icu, :admissions_acute, :admissions_combined_ped]

	hosp_data_all = DataFrame(CSV.File("../data/hospitalization_data.csv"))
	for col in forecast_cols
		hosp_data_all[:,col] = coalesce.(hosp_data_all[:,col], 0)
	end

	hosp_metadata = DataFrame(CSV.File("../data/hhs_hospital_meta.csv"))

	cases_data_all = DataFrame(CSV.File("../rawdata/csse_confirmed_cases.csv"))

	if forecast_date == "latest"
		forecast_date = latest_forecast_date()
	end

	fn_ext = (forecast_date >= Date(2021, 9, 27)) ? "COVIDhub-4_week_ensemble" : "COVIDhub-ensemble"
	fn = "../rawdata/forecasts/$(forecast_date)-$(fn_ext).csv"
	forecast = DataFrame(CSV.File(fn))

	filter!(row -> contains(row.target, "inc case"), forecast)
	filter!(row -> row.location != "US", forecast)
	forecast.location = parse.(Int, forecast.location)

	forecast.weeks_out = map(s -> parse(Int, s[1]), forecast.target)
	select!(forecast, Not(:target))

	if uncertainty_version == :default

		uncertainty_scale = [1.0, 1.0, 1.0, 1.0]

		pct_lb, pct_ub = 0.25, 0.75
		forecast.quantile = map(q -> (q == "NA") ? :point : parse(Float64, q), forecast.quantile)
		filter!(row -> row.quantile == :point || row.quantile == pct_lb || row.quantile == pct_ub, forecast)
		forecast.bound = map(q -> (q == :point) ? :est : (q == pct_lb) ? :lb : :ub, forecast.quantile)
		select!(forecast, Not([:quantile, :type]))
		forecast = unstack(forecast, :bound, :value)

		forecast.lb = map(r -> r.est + ((r.lb - r.est) * uncertainty_scale[r.weeks_out]), eachrow(forecast))
		forecast.ub = map(r -> r.est + ((r.ub - r.est) * uncertainty_scale[r.weeks_out]), eachrow(forecast))

	elseif uncertainty_version == :alternate

		quantiles = [(0.25, 0.75), (0.25, 0.75), (0.1, 0.9), (0.025, 0.975)]
		forecast.quantile = map(q -> (q == "NA") ? :point : parse(Float64, q), forecast.quantile)
		forecast.bound = map(eachrow(forecast)) do r
			if r.quantile == :point
				:est
			elseif r.quantile == quantiles[r.weeks_out][1]
				:lb
			elseif r.quantile == quantiles[r.weeks_out][2]
				:ub
			else
				:na
			end
		end
		filter!(r -> r.bound != :na, forecast)
		select!(forecast, Not([:quantile, :type, :weeks_out]))
		forecast = unstack(forecast, :bound, :value)

	else

		filter!(row -> row.type == "point", forecast)
		forecast.est = forecast.value
		forecast.lb = forecast.value
		forecast.ub = forecast.value

	end

	hosp_data = filter(row -> row.date <= forecast_date, hosp_data_all)
	cases_data = filter(row -> row.date <= forecast_date, cases_data_all)

	recent_dates = sort(intersect(unique(hosp_data.date), unique(cases_data.date)))[end-14+1:end]

	total_hosp_recent = filter(row -> row.date in recent_dates, hosp_data)
	total_hosp_recent = combine(groupby(total_hosp_recent, :hospital_id),
		[col => sum => col for col in forecast_cols]...,
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
		county_hosp_ind = findall(f -> !ismissing(f) && f == county, hosp_metadata.county_fips)

		if isempty(county_hosp_ind)
			next!(p)
			continue
		end

		county_hosp_ids = unique(hosp_metadata[county_hosp_ind, :hospital_id])

		total_cases = max(1, total_cases_recent_dict[county])

		hist = Dict(col => [haskey(total_hosp_recent_dict,h) ? total_hosp_recent_dict[h][col] : 0 for h in county_hosp_ids] for col in forecast_cols)
		hist_total = Dict(col => sum(hist[col]) for col in forecast_cols)
		scale = Dict(col => hist_total[col] / total_cases for col in forecast_cols)

		hosp_weights = Dict(col => hist[col] .* (scale[col] / hist_total[col]) for col in forecast_cols)
		for col in forecast_cols
			z = sum(hosp_weights[col])
			map!(x -> (z==0.0 || isnan(x)) ? 0.0 : x/z, hosp_weights[col], hosp_weights[col])
		end

		county_forecast = filter(row -> row.location == county, forecast)

		day0 = minimum(county_forecast.target_end_date) - Day(7)
		last_cases_df = filter(row -> row.county_fips == county && (day0-Day(7) < row.date <= day0), cases_data)
		last_cases = sum(last_cases_df.cases)

		dfs = DataFrame[]
		for (i,hid) in enumerate(county_hosp_ids)
			w = Dict(col => hosp_weights[col][i] for col in forecast_cols)

			h_forecast = select(county_forecast,
				:target_end_date => :date,
				:weeks_out,
				[:est => ByRow(x -> x * w[col]) => col for col in forecast_cols]...,
				[:lb => ByRow(x -> x * w[col]) => "$(col)_lb" for col in forecast_cols]...,
				[:ub => ByRow(x -> x * w[col]) => "$(col)_ub" for col in forecast_cols]...,
			)
			insertcols!(h_forecast, 1, :hospital_id => fill(hid, nrow(h_forecast)))

			push!(h_forecast, Dict(
				"hospital_id" => hid,
				"date" => day0,
				"weeks_out" => 0,
				["$(col)" => last_cases * w[col] for col in forecast_cols]...,
				["$(col)_lb" => last_cases * w[col] for col in forecast_cols]...,
				["$(col)_ub" => last_cases * w[col] for col in forecast_cols]...,
			))

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

	hospitalization_forecast.admissions_combined = hospitalization_forecast.admissions_icu + hospitalization_forecast.admissions_acute
	hospitalization_forecast.admissions_combined_lb = hospitalization_forecast.admissions_icu_lb + hospitalization_forecast.admissions_acute_lb
	hospitalization_forecast.admissions_combined_ub = hospitalization_forecast.admissions_icu_ub + hospitalization_forecast.admissions_acute_ub

	if write_versioned
		hospitalization_forecast |> CSV.write("../data/forecasts/forecast-$(forecast_date).csv")
	else
		hospitalization_forecast |> CSV.write("../data/hospitalization_forecast.csv")
	end

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

function disaggregate_forecast_all()
	fns = glob("../rawdata/forecasts/*.csv")
	dates = [Date(basename(fn)[1:10]) for fn in fns]
	sort!(dates, rev=true)
	for d in dates
		disaggregate_forecast(d, write_versioned=true)
	end
	return
end
