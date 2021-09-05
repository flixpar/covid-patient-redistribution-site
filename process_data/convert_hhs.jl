using CSV
using DataFrames

include("util.jl")


###########################
#### Convert HHS Data #####
###########################

function convert_hhs_data(;icu_pct=0.3)
	rawdata_fn = latest_hhs_rawdata_fn()
	rawdata = DataFrame(CSV.File(rawdata_fn))

	bad_ids = begin
		id_counts = combine(groupby(rawdata, :hospital_pk), :hospital_name => (x -> length(unique(x))) => :n_names)
		filter!(x -> x.n_names > 1, id_counts)
		unique(id_counts.hospital_pk)
	end
	filter!(row -> !(row.hospital_pk in bad_ids), rawdata)

	fix_censored(x) = (ismissing(x) || x == -999999) ? missing : x
	data_weekly = select(rawdata,
		:hospital_name => :hospital,
		:hospital_pk => :hospital_id,
		:collection_week => ByRow(d -> Date(d, "yyyy/mm/dd")) => :date,

		:previous_day_admission_adult_covid_confirmed_7_day_sum => ByRow(fix_censored) => :admissions_combined_weekly,
		:total_adult_patients_hospitalized_confirmed_covid_7_day_sum => ByRow(fix_censored) => :active_combined_weekly,
		:staffed_icu_adult_patients_confirmed_covid_7_day_sum => ByRow(fix_censored) => :active_icu_weekly,
		:previous_day_admission_pediatric_covid_confirmed_7_day_sum => ByRow(fix_censored) => :admissions_combined_ped_weekly,
		:total_pediatric_patients_hospitalized_confirmed_and_suspected_covid_7_day_sum => ByRow(fix_censored) => :active_combined_ped_weekly,
	)

	data_weekly.active_acute_weekly = max.(0, data_weekly.active_combined_weekly - data_weekly.active_icu_weekly)

	sort!(data_weekly, [:hospital, :hospital_id, :date])

	data_daily_list = []
	for loc_df in groupby(data_weekly, :hospital_id)
		loc_df = sort(loc_df, :date)

		h_name = loc_df.hospital[1]
		h_id = loc_df.hospital_id[1]

		dates_w = loc_df.date

		admissions_combined_d = interpolate_timeseries_linear(dates_w, loc_df.admissions_combined_weekly ./ 7)
		active_combined_d = interpolate_timeseries_linear(dates_w, loc_df.active_combined_weekly ./ 7)
		active_icu_d = interpolate_timeseries_linear(dates_w, loc_df.active_icu_weekly ./ 7)
		active_acute_d = active_combined_d - active_icu_d

		admissions_combined_ped_d = interpolate_timeseries_linear(dates_w, loc_df.admissions_combined_ped_weekly ./ 7)
		active_combined_ped_d = interpolate_timeseries_linear(dates_w, loc_df.active_combined_ped_weekly ./ 7)

		start_date = dates_w[1]
		end_date   = dates_w[end]
		dates_d = collect(start_date : Day(1) : end_date)

		t = length(dates_d)
		loc_df_daily = DataFrame(
			hospital = fill(h_name, t),
			hospital_id = fill(h_id, t),
			date = dates_d,
			admissions_icu = admissions_combined_d .* icu_pct,
			admissions_acute = admissions_combined_d .* (1.0 - icu_pct),
			admissions_combined = admissions_combined_d,
			admissions_combined_ped = admissions_combined_ped_d,
			active_icu = active_icu_d,
			active_acute = active_acute_d,
			active_combined = active_combined_d,
			active_combined_ped = active_combined_ped_d,
		)
		push!(data_daily_list, loc_df_daily)
	end
	data_daily = vcat(data_daily_list...)

	data_daily |> CSV.write("../data/hospitalization_data.csv")

	return
end
