using CSV
using DataFrames

include("util.jl")


###########################
#### Convert HHS Data #####
###########################

function convert_hhs_data()
	rawdata_fn = latest_hhs_rawdata_fn()
	rawdata = DataFrame(CSV.File(rawdata_fn))

	bad_ids = begin
		id_counts = combine(groupby(rawdata, :hospital_pk), :hospital_name => (x -> length(unique(x))) => :n_names)
		filter!(x -> x.n_names > 1, id_counts)
		unique(id_counts.hospital_pk)
	end
	filter!(row -> !(row.hospital_pk in bad_ids), rawdata)

	data_weekly = select(rawdata,
		:hospital_name => :hospital,
		:hospital_pk => :hospital_id,
		:collection_week => ByRow(d -> Date(d, "yyyy/mm/dd")) => :date,

		:previous_day_admission_adult_covid_confirmed_7_day_sum => ByRow(x -> (ismissing(x) || x == -999999) ? missing : x) => :admissions_weekly_allbeds,
		:total_adult_patients_hospitalized_confirmed_covid_7_day_sum => ByRow(x -> (ismissing(x) || x == -999999) ? missing : x) => :active_weekly_allbeds,
		:staffed_icu_adult_patients_confirmed_covid_7_day_sum => ByRow(x -> (ismissing(x) || x == -999999) ? missing : x) => :active_weekly_icu,
	)
	data_weekly.active_weekly_acute = data_weekly.active_weekly_allbeds - data_weekly.active_weekly_icu
	sort!(data_weekly, [:hospital, :hospital_id, :date])

	data_daily_list = []
	for loc_df in groupby(data_weekly, :hospital_id)
		loc_df = sort(loc_df, :date)

		h_name = loc_df.hospital[1]
		h_id = loc_df.hospital_id[1]

		dates_w = loc_df.date

		admissions_allbeds_d = interpolate_timeseries_linear(dates_w, loc_df.admissions_weekly_allbeds ./ 7)
		active_allbeds_d = interpolate_timeseries_linear(dates_w, loc_df.active_weekly_allbeds ./ 7)
		active_icu_d = interpolate_timeseries_linear(dates_w, loc_df.active_weekly_icu ./ 7)
		active_acute_d = active_allbeds_d - active_icu_d

		start_date = dates_w[1]
		end_date   = dates_w[end]
		dates_d = collect(start_date : Day(1) : end_date)

		t = length(dates_d)
		loc_df_daily = DataFrame(
			hospital = fill(h_name, t),
			hospital_id = fill(h_id, t),
			date = dates_d,
			admissions_icu = admissions_allbeds_d .* 0.3,
			admissions_acute = admissions_allbeds_d .* 0.7,
			admissions_allbeds = admissions_allbeds_d,
			active_icu = active_icu_d,
			active_acute = active_acute_d,
			active_allbeds = active_allbeds_d,
		)
		push!(data_daily_list, loc_df_daily)
	end
	data_daily = vcat(data_daily_list...)

	data_daily |> CSV.write("../data/hospitalization_data.csv")

	return
end
