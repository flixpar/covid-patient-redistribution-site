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
	rawdata = DataFrame(CSV.File(rawdata_fn))

	bad_ids = begin
		id_counts = combine(groupby(rawdata, :hospital_pk), :hospital_name => (x -> length(unique(x))) => :n_names)
		filter!(x -> x.n_names > 1, id_counts)
		unique(id_counts.hospital_pk)
	end
	filter!(row -> !(row.hospital_pk in bad_ids), rawdata)

	fix_censored(x) = (ismissing(x) || x == -999999) ? missing : x
	data = select(rawdata,
		:hospital_name => :hospital,
		:hospital_pk => :hospital_id,
		:collection_week => ByRow(d -> Date(d, "yyyy/mm/dd")) => :date,
		:all_adult_hospital_inpatient_beds_7_day_avg => ByRow(fix_censored) => :beds_combined,
		:total_staffed_adult_icu_beds_7_day_avg => ByRow(fix_censored) => :beds_icu,
		:inpatient_beds_7_day_avg => ByRow(fix_censored) => :beds_combined_adultped,
		:total_icu_beds_7_day_avg => ByRow(fix_censored) => :beds_icu_adultped,
	)

	data.beds_acute = max.(0, data.beds_combined - data.beds_icu)

	data.beds_combined_ped = max.(0, data.beds_combined_adultped - data.beds_combined)
	data.beds_icu_ped = max.(0, data.beds_icu_adultped - data.beds_icu)
	data.beds_acute_ped = max.(0, data.beds_combined_ped - data.beds_icu_ped)
	select!(data, Not([:beds_combined_adultped, :beds_icu_adultped]))

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

if abspath(PROGRAM_FILE) == @__FILE__
	estimate_capacity()
end
