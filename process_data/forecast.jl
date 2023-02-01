using CSV
using DataFrames
using Glob, Dates


function main()
	forecast_date = latest_forecast_date()
	forecast_cols = [:admissions_combined, :active_combined]
	history_weeks = 12
	uncertainty_type = :none

	forecast = compute_forecast(forecast_date, forecast_cols, history_weeks, uncertainty_type)
	forecast |> CSV.write("../data/forecasts/forecast-$(forecast_date).csv")

	return
end

function disaggregate_forecast(forecast_date="latest"; uncertainty_type=:bounds, write_versioned=false)
	forecast_date = (forecast_date == "latest") ? latest_forecast_date() : forecast_date
	forecast_cols = [:admissions_combined, :admissions_icu, :admissions_acute, :admissions_combined_ped, :active_combined]
	history_weeks = 12
	uncertainty_type_ = (uncertainty_type == :bounds) ? :quantile : uncertainty_type

	forecast = compute_forecast(forecast_date, forecast_cols, history_weeks, uncertainty_type_)

	if uncertainty_type == :bounds
		forecast_lb = filter(row -> row.quantile == 0.25, forecast)
		forecast_ub = filter(row -> row.quantile == 0.75, forecast)
		forecast_point = filter(row -> row.quantile == 0.5, forecast)

		select!(forecast_lb, Not([:quantile, :forecast_date, :target_date]))
		select!(forecast_ub, Not([:quantile, :forecast_date, :target_date]))
		select!(forecast_point, Not(:quantile))

		rename!(forecast_lb, forecast_cols .=> ["$(col)_lb" for col in forecast_cols])
		rename!(forecast_ub, forecast_cols .=> ["$(col)_ub" for col in forecast_cols])

		forecast = outerjoin(forecast_point, forecast_lb, on=[:hospital_id, :weeks_out])
		forecast = outerjoin(forecast, forecast_ub, on=[:hospital_id, :weeks_out])
	end

	if write_versioned
		forecast |> CSV.write("../data/forecasts/forecast-$(forecast_date).csv")
	else
		forecast |> CSV.write("../data/hospitalization_forecast.csv")
	end

	return
end

function compute_forecast(forecast_date, forecast_cols, history_weeks, uncertainty_type)

	# load hospitalizations data
	hosp_data, hosp_data_mean = load_hospitalization_data(forecast_date, forecast_cols, history_weeks)
	hospital_ids = sort(unique(hosp_data.hospital_id))
	hist_start_date, hist_end_date = extrema(hosp_data.date)

	# load hospital metadata
	hosp_metadata = load_hospital_metadata(hospital_ids)
	counties_hosp = unique(hosp_metadata.county_fips)

	# load cases data
	cases_data, cases_data_mean = load_cases_data(hist_start_date, hist_end_date)
	counties_cases = unique(cases_data.fips)
	counties = sort(intersect(counties_hosp, counties_cases))

	# load cases forecast
	cases_forecast, quantiles, forecast_target_dates = load_cases_forecast(forecast_date, counties, uncertainty_type)
	max_weeks_out = size(cases_forecast, 2)

	# construct mapping from counties to hospitals
	county_to_hosp = Dict(c => String[] for c in counties)
	for row in eachrow(hosp_metadata)
		if haskey(county_to_hosp, row.county_fips)
			push!(county_to_hosp[row.county_fips], row.hospital_id)
		end
	end

	# compute the aggregation weights
	weights = zeros(length(forecast_cols), length(hospital_ids), length(counties))
	hospital_inds = Dict(hospital_ids .=> 1:length(hospital_ids))
	for (k, col) in enumerate(forecast_cols)
		for (j, county) in enumerate(counties)
			county_hosp_ids = county_to_hosp[county]

			county_hosps = [haskey(hosp_data_mean, h) ? hosp_data_mean[h][col] : 0 for h in county_hosp_ids]
			county_weights = county_hosps ./ cases_data_mean[county]

			for (i, h) in enumerate(county_hosp_ids)
				if haskey(hospital_inds, h)
					weights[k, hospital_inds[h], j] = county_weights[i]
				end
			end
		end
	end
	replace!(weights, NaN => 0, Inf => 0)

	# compute the forecast
	hosp_forecast = Array{Float64, 4}(undef, length(forecast_cols), length(hospital_ids), max_weeks_out, length(quantiles))
	for (k, col) in enumerate(forecast_cols)
		for q in 1:length(quantiles)
			@views hosp_forecast[k, :, :, q] = weights[k, :, :] * cases_forecast[:, :, q]
		end
	end

	# transform forecast into dataframe
	M = length(forecast_cols)
	N = length(hospital_ids)
	T = max_weeks_out
	Q = length(quantiles)

	hosp_forecast_df = DataFrame(
		hospital_id = [hospital_ids[i] for m in 1:M, i in 1:N, j in 1:T, q in 1:Q] |> vec,
		weeks_out = [j for m in 1:M, i in 1:N, j in 1:T, q in 1:Q] |> vec,
		metric = [forecast_cols[m] for m in 1:M, i in 1:N, j in 1:T, q in 1:Q] |> vec,
		quantile = [quantiles[q] for m in 1:M, i in 1:N, j in 1:T, q in 1:Q] |> vec,
		value = [hosp_forecast[m, i, j, q] for m in 1:M, i in 1:N, j in 1:T, q in 1:Q] |> vec,
	)

	hosp_forecast_df = unstack(hosp_forecast_df, :metric, :value)
	insertcols!(hosp_forecast_df, 2, :forecast_date => forecast_date)
	insertcols!(hosp_forecast_df, 3, :target_date => map(w -> forecast_target_dates[w], hosp_forecast_df.weeks_out))

	sort!(hosp_forecast_df, [:hospital_id, :weeks_out, :quantile])

	if uncertainty_type == :none
		select!(hosp_forecast_df, Not(:quantile))
	end

	return hosp_forecast_df
end

function load_hospitalization_data(forecast_date, forecast_cols, history_weeks)
	hosp_data = DataFrame(CSV.File("../data/hospitalization_data.csv", select=[:hospital_id, :date, forecast_cols...]))

	hosp_dates = sort(unique(hosp_data.date))
	forecast_date_idx = searchsortedfirst(hosp_dates, forecast_date) - 1
	hist_start_date = hosp_dates[forecast_date_idx - history_weeks]
	hist_end_date = hosp_dates[forecast_date_idx]

	filter!(r -> hist_start_date <= r.date <= hist_end_date, hosp_data)
	select!(hosp_data, :hospital_id, :date, forecast_cols...)
	sort!(hosp_data, [:hospital_id, :date])

	hosp_data_mean = combine(
		groupby(hosp_data, :hospital_id),
		forecast_cols .=> (mean ∘ nonmissing) .=> forecast_cols,
	)
	hosp_data_mean = Dict(r.hospital_id => r for r in eachrow(hosp_data_mean))

	return hosp_data, hosp_data_mean
end

function load_cases_data(start_date, end_date)
	cases_rawdata = DataFrame(CSV.File("../rawdata/time_series_covid19_confirmed_US.csv"))
	cases_data = process_cases(cases_rawdata)
	filter!(r -> start_date <= r.date <= end_date, cases_data)

	cases_data_mean = combine(
		groupby(cases_data, :fips),
		:cases => (mean ∘ nonmissing) => :cases,
	)
	cases_data_mean = Dict(r.fips => max(r.cases * 7, 0) for r in eachrow(cases_data_mean))

	return cases_data, cases_data_mean
end

function load_cases_forecast(forecast_date, counties, uncertainty_type)
	cases_forecast_raw = DataFrame(CSV.File(forecast_fn(forecast_date)))
	cases_forecast = process_hub_forecast(cases_forecast_raw, uncertainty_type)

	max_weeks_out = maximum(cases_forecast.weeks_out)
	forecast_target_dates = sort(unique(cases_forecast.target_date))
	quantiles = sort(unique(cases_forecast.quantile))

	cases_forecast_array = zeros(Float64, length(counties), max_weeks_out, length(quantiles))
	county_inds = Dict(counties .=> 1:length(counties))
	quantile_inds = Dict(quantiles .=> 1:length(quantiles))
	for row in eachrow(cases_forecast)
		if haskey(county_inds, row.fips)
			cases_forecast_array[county_inds[row.fips], row.weeks_out, quantile_inds[row.quantile]] = row.cases
		end
	end

	return cases_forecast_array, quantiles, forecast_target_dates
end

function load_hospital_metadata(hospital_ids)
	hosp_metadata = DataFrame(CSV.File("../data/hhs_hospital_meta.csv"))
	dropmissing!(hosp_metadata, [:hospital_id, :county_fips])
	filter!(r -> r.hospital_id in hospital_ids, hosp_metadata)
	return hosp_metadata
end

function latest_forecast_date()
	paths = glob("../rawdata/forecasts/*-COVIDhub-4_week_ensemble.csv")
	if isempty(paths) return nothing end
	date_strs = [basename(p)[1:10] for p in paths]
	dates = [Date(d) for d in date_strs]
	date = maximum(dates)
	return date
end

function forecast_fn(forecast_date)
	fn_ext = (forecast_date >= Date(2021, 9, 27)) ? "COVIDhub-4_week_ensemble" : "COVIDhub-ensemble"
	fn = "../rawdata/forecasts/$(forecast_date)-$(fn_ext).csv"
	return fn
end

function process_cases(cases_rawdata)
	date_cols = filter(x -> contains(x, "/"), names(cases_rawdata))
	cases_data = stack(cases_rawdata, date_cols, variable_name=:date_str, value_name=:cum_cases)
	cases_data.date = map(d -> Date(d, dateformat"m/d/yy")+Year(2000), cases_data.date_str)
	dropmissing!(cases_data, [:FIPS, :date])

	select!(cases_data,
		:FIPS => ByRow(x -> Int(x)) => :fips,
		:date,
		:cum_cases,
	)

	new_cases = combine(groupby(cases_data, :fips),
		:date,
		:cum_cases => (xs -> vcat(xs[1], diff(xs))) => :cases,
	)
	cases_data = leftjoin(cases_data, new_cases, on=[:fips, :date])

	return cases_data
end

function process_hub_forecast(forecast_raw, uncertainty_type=:quantile)
	forecast = filter(row -> contains(row.target, "inc case"), forecast_raw)
	rename!(forecast, :value => :cases)

	filter!(row -> row.location != "US", forecast)
	rename!(forecast, :location => :fips)
	forecast.fips = map(x -> parse(Int, x), forecast.fips)

	weeks_out = map(s -> parse(Int, s[1]), forecast.target)
	insertcols!(forecast, 4, :weeks_out => weeks_out)
	select!(forecast, Not(:target))

	if uncertainty_type == :quantile
		filter!(row -> row.type == "quantile", forecast)
		select!(forecast, Not(:type))
		forecast.quantile = map(x -> parse(Float64, x), forecast.quantile)
	elseif uncertainty_type == :none
		filter!(row -> row.type == "point", forecast)
		select!(forecast, Not(:quantile))
		rename!(forecast, :type => :quantile)
	else
		error("Unknown uncertainty type: $uncertainty_type")
	end

	rename!(forecast, :target_end_date => :target_date)

	sort!(forecast, [:fips, :weeks_out])
	return forecast
end

function mean(xs; init=0)
	if isempty(xs)
		return init
	else
		return sum(xs) / length(xs)
	end
end

nonmissing(xs) = filter(!ismissing, xs)

if abspath(PROGRAM_FILE) == @__FILE__
	main()
end
