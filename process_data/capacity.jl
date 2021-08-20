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

	data = select(rawdata,
		:hospital_name => :hospital,
		:hospital_pk => :hospital_id,
		:collection_week => ByRow(d -> Date(d, "yyyy/mm/dd")) => :date,
		:all_adult_hospital_inpatient_beds_7_day_avg => ByRow(x -> (ismissing(x) || x == -999999) ? missing : x) => :beds_combined,
		:total_staffed_adult_icu_beds_7_day_avg => ByRow(x -> (ismissing(x) || x == -999999) ? missing : x) => :beds_icu,
	)
	data.beds_acute = max.(0, data.beds_combined - data.beds_icu)
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

	capacity_data_all = combine(groupby(data, [:hospital, :hospital_id]), [
		:beds_icu => apply(mean) => :beds_icu_mean,
		:beds_acute => apply(mean) => :beds_acute_mean,
		:beds_combined => apply(mean) => :beds_combined_mean,

		:beds_icu => apply(median) => :beds_icu_median,
		:beds_acute => apply(median) => :beds_acute_median,
		:beds_combined => apply(median) => :beds_combined_median,

		:beds_icu => apply(minimum) => :beds_icu_min,
		:beds_acute => apply(minimum) => :beds_acute_min,
		:beds_combined => apply(minimum) => :beds_combined_min,

		:beds_icu => apply(maximum) => :beds_icu_max,
		:beds_acute => apply(maximum) => :beds_acute_max,
		:beds_combined => apply(maximum) => :beds_combined_max,

		:beds_icu => apply(std) => :beds_icu_std,
		:beds_acute => apply(std) => :beds_acute_std,
		:beds_combined => apply(std) => :beds_combined_std,

		:beds_icu => apply(mad) => :beds_icu_mad,
		:beds_acute => apply(mad) => :beds_acute_mad,
		:beds_combined => apply(mad) => :beds_combined_mad,
	])

	std_mult = 1.0

	capacity_data = select(capacity_data_all,
		:hospital, :hospital_id,

		:beds_icu_mean => :capacity_icu,
		:beds_acute_mean => :capacity_acute,
		:beds_combined_mean => :capacity_combined,

		[:beds_icu_mean, :beds_icu_std] => ByRow((m,s) -> m-(std_mult*s)) => :capacity_icu_lb,
		[:beds_acute_mean, :beds_acute_std] => ByRow((m,s) -> m-(std_mult*s)) => :capacity_acute_lb,
		[:beds_combined_mean, :beds_combined_std] => ByRow((m,s) -> m-(std_mult*s)) => :capacity_combined_lb,

		[:beds_icu_mean, :beds_icu_std] => ByRow((m,s) -> m+(std_mult*s)) => :capacity_icu_ub,
		[:beds_acute_mean, :beds_acute_std] => ByRow((m,s) -> m+(std_mult*s)) => :capacity_acute_ub,
		[:beds_combined_mean, :beds_combined_std] => ByRow((m,s) -> m+(std_mult*s)) => :capacity_combined_ub,
	)
	filter!(row -> row.capacity_icu + row.capacity_acute + row.capacity_combined > 0, capacity_data)
	sort!(capacity_data, [:hospital, :hospital_id])

	capacity_data_all |> CSV.write("../data/beds_hhs.csv")
	capacity_data |> CSV.write("../data/capacity_hhs.csv")

	return
end
