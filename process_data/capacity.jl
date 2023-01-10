using CSV
using Dates
using Statistics
using DataFrames

include("util.jl")


############################
#### Estimate Capacity #####
############################

function estimate_capacity()
	rawdata_fn = latest_hhs_rawdata_fn()
	rawdata = DataFrame(CSV.File(rawdata_fn, missingstring=["", "-999999"], dateformat="yyyy/mm/dd"))

	bad_ids = begin
		id_counts = combine(groupby(rawdata, :hospital_pk), :hospital_name => (x -> length(unique(x))) => :n_names)
		filter!(x -> x.n_names > 1, id_counts)
		unique(id_counts.hospital_pk)
	end
	filter!(row -> !(row.hospital_pk in bad_ids), rawdata)

	data = select(rawdata,
		:hospital_name => :hospital,
		:hospital_pk => :hospital_id,
		:collection_week => :date,
		:all_adult_hospital_inpatient_beds_7_day_avg => :beds_combined,
		:total_staffed_adult_icu_beds_7_day_avg => :beds_icu,
		:all_pediatric_inpatient_beds_7_day_avg => :beds_combined_ped,
		:total_staffed_pediatric_icu_beds_7_day_avg => :beds_icu_ped
	)

	data.beds_acute = max.(0, data.beds_combined - data.beds_icu)
	data.beds_acute_ped = max.(0, data.beds_combined_ped - data.beds_icu_ped)

	cols = [:beds_combined, :beds_icu, :beds_acute, :beds_combined_ped, :beds_icu_ped, :beds_acute_ped]

	sort!(data, [:hospital, :hospital_id, :date])

	function apply(f)
		function _f(xs)
			if all(ismissing.(xs))
				return 0
			else
				xs = filter(x -> !ismissing(x), xs)
				return f(xs)
			end
		end
		return _f
	end

	mad(xs) = median(abs.(xs .- median(xs)))

	tfms = [mean, median, minimum, maximum, std, mad]
	col_tfms = [col => apply(t) => "$(col)_$(t)" for t in tfms, col in cols][:]
	capacity_data_all = combine(groupby(data, [:hospital, :hospital_id]), col_tfms...)

	std_mult = 1.0
	addstd(m,s) = m+(std_mult*s)
	substd(m,s) = max(0,m-(std_mult*s))

	capacity_data = select(capacity_data_all,
		:hospital, :hospital_id,
		["$(col)_mean" => replace(string(col), "beds" => "capacity") for col in cols]...,
		[["$(col)_mean", "$(col)_std"] => ByRow(substd) => replace(string(col), "beds" => "capacity")*"_lb" for col in cols]...,
		[["$(col)_mean", "$(col)_std"] => ByRow(addstd) => replace(string(col), "beds" => "capacity")*"_ub" for col in cols]...,
	)
	filter!(row -> row.capacity_icu + row.capacity_acute + row.capacity_combined > 0, capacity_data)
	sort!(capacity_data, [:hospital, :hospital_id])

	capacity_data_all |> CSV.write("../data/beds_hhs.csv")
	capacity_data |> CSV.write("../data/capacity_hhs.csv")

	return
end

function estimate_covid_capacity(α=0.5)
	rawdata_fn = latest_hhs_rawdata_fn()
	rawdata = DataFrame(CSV.File(rawdata_fn, missingstring=["", "-999999"], dateformat="yyyy/mm/dd"))

	data = select(
		rawdata,
		:hospital_pk => :hospital_id,
		:hospital_name,
		:collection_week => :date,

		[:all_adult_hospital_inpatient_beds_7_day_sum, :all_adult_hospital_inpatient_beds_7_day_coverage] => ByRow((a,b) -> a/b) => :capacity,
		[:total_adult_patients_hospitalized_confirmed_and_suspected_covid_7_day_sum, :total_adult_patients_hospitalized_confirmed_and_suspected_covid_7_day_coverage] => ByRow((a,b) -> a/b) => :occupancy_covid,
		[:all_adult_hospital_inpatient_bed_occupied_7_day_sum, :all_adult_hospital_inpatient_bed_occupied_7_day_coverage] => ByRow((a,b) -> a/b) => :occupancy_total,

		[:total_staffed_adult_icu_beds_7_day_sum, :total_staffed_adult_icu_beds_7_day_coverage] => ByRow((a,b) -> a/b) => :capacity_icu,
		[:staffed_adult_icu_bed_occupancy_7_day_sum, :staffed_adult_icu_bed_occupancy_7_day_coverage] => ByRow((a,b) -> a/b) => :occupancy_total_icu,
		[:staffed_icu_adult_patients_confirmed_and_suspected_covid_7_day_sum, :staffed_icu_adult_patients_confirmed_and_suspected_covid_7_day_coverage] => ByRow((a,b) -> a/b) => :occupancy_covid_icu,

		[:all_pediatric_inpatient_beds_7_day_sum, :all_pediatric_inpatient_beds_7_day_coverage] => ByRow((a,b) -> a/b) => :capacity_ped,
		[:all_pediatric_inpatient_bed_occupied_7_day_sum, :all_pediatric_inpatient_bed_occupied_7_day_coverage] => ByRow((a,b) -> a/b) => :occupancy_total_ped,
		[:total_pediatric_patients_hospitalized_confirmed_and_suspected_covid_7_day_sum, :total_pediatric_patients_hospitalized_confirmed_and_suspected_covid_7_day_coverage] => ByRow((a,b) -> a/b) => :occupancy_covid_ped,
	)

	filter!(r -> r.date >= Date(2021, 1, 1), data)

	function est_capacity(cap, occ, occ_covid, dates)
		if all(ismissing.(occ_covid)) return 0 end

		m = median(skipmissing(occ_covid))
		mask = occ_covid .<= 2m
		mask = coalesce.(mask, false)

		ests = occ_covid + (α .* (cap - occ))

		if all(ismissing.(ests[mask])) return 0 end

		est = median(skipmissing(ests[mask]))
		return est
	end

	capacity = combine(
		groupby(data, :hospital_id),
		[:capacity, :occupancy_total, :occupancy_covid, :date] => est_capacity => :capacity_covid,
		[:capacity_icu, :occupancy_total_icu, :occupancy_covid_icu, :date] => est_capacity => :capacity_covid_icu,
		[:capacity_ped, :occupancy_total_ped, :occupancy_covid_ped, :date] => est_capacity => :capacity_covid_ped,
	)

	sort!(capacity, :hospital_id)
	capacity |> CSV.write("../data/capacity_covid.csv")

	return
end

function extract_capacity_timeseries()
	rawdata_fn = latest_hhs_rawdata_fn()
	rawdata = DataFrame(CSV.File(rawdata_fn, missingstring=["", "-999999"], dateformat="yyyy/mm/dd"))

	data_weekly = select(rawdata,
		:hospital_name => :hospital,
		:hospital_pk => :hospital_id,
		:collection_week => :date,
		:all_adult_hospital_inpatient_beds_7_day_avg => :beds_combined,
		:total_staffed_adult_icu_beds_7_day_avg => :beds_icu,
		:inpatient_beds_7_day_avg => :beds_combined_adultped,
		:total_icu_beds_7_day_avg => :beds_icu_adultped,
	)
	sort!(data_weekly, [:hospital, :hospital_id, :date])

	capacity_cols = [:beds_combined, :beds_icu, :beds_combined_adultped, :beds_icu_adultped]
	data_weekly = interpolate_missing(data_weekly, capacity_cols)

	col_tfms = [([col, :date] => ((b,d) -> interpolate_timeseries_linear(d, b)) => col) for col in capacity_cols]
	data_daily = combine(
		groupby(data_weekly, :hospital_id),
		:hospital => (x -> x[1]) => :hospital,
		:date => (ds -> ds[1]:Day(1):ds[end]) => :date,
		col_tfms...,
	)

	data_daily |> CSV.write("../data/capacity_timeseries.csv")
	return
end

if abspath(PROGRAM_FILE) == @__FILE__
	estimate_capacity()
	extract_capacity_timeseries()
	estimate_covid_capacity()
end
